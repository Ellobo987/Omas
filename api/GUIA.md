# Guía del backend de SGI-OMAS

Para entender (y poder explicar) cómo funciona la API: qué hay en cada carpeta, qué pasa desde que la pantalla manda un pedido hasta que se guarda en la base, y las preguntas que suelen tomar.

---

## 1. La arquitectura en una línea

```
Pantalla (HTML + JS)  →  API (C# · ASP.NET Core .NET 8)  →  SQL Server (base LasOmas)
   admin/*.html            api/LasOmasApi                       base-de-datos/lasomas.sql
   admin/api.js            Controller → DTO → Repository → AppDbContext → Models
```

- Las pantallas **nunca** tocan la base: le piden todo a la API con `fetch` (siempre a través de `admin/api.js`).
- La API recibe JSON, valida, aplica las reglas y usa **Entity Framework Core** para leer y escribir en SQL Server.
- Es **Database First**: primero se diseñó la base (el modelo que corrigió el profesor) y después se generaron las clases de C# a partir de ella.

---

## 2. Qué hay en cada carpeta

| Carpeta / archivo | Qué es | Ejemplo |
|---|---|---|
| `Program.cs` | El arranque: registra los servicios (base, repositorios, sesión, CORS) y arma el "pipeline" por el que pasa cada pedido. | `builder.Services.AddScoped<IUsuarioRepository, UsuarioRepository>()` |
| `Models/` | Una clase por tabla. **Generadas** con Scaffold-DbContext: no se escriben a mano. | `Bulto.cs`, `Usuario.cs` |
| `Data/AppDbContext.cs` | El "puente" con la base: un `DbSet` por tabla y cómo se relacionan. También generado. | `_context.Bultos`, `_context.Usuarios` |
| `DTOs/` | Lo que **entra y sale** por la API (no las tablas). Tienen las validaciones. | `CrearDonacionDTO`, `UsuarioDTO` |
| `Repositories/` | El acceso a datos: consultas con LINQ y guardado. Una **interfaz** (`IXRepository`) y su **implementación** (`XRepository`). | `DonacionRepository.ListarAsync()` |
| `Controllers/` | Los endpoints (`/api/...`): reciben el pedido, aplican las reglas y devuelven la respuesta con su código HTTP. | `DonacionesController.Registrar()` |
| `Seguridad/` | Roles, clave temporal, control de intentos fallidos y quién está logueado. | `Roles.Administracion`, `ControlIntentos` |
| `Servicios/` | Lo que habla con sistemas de afuera. | `MercadoPagoServicio` |
| `appsettings.json` | Configuración: cadena de conexión, orígenes de CORS. **Sin contraseñas** (el repositorio es público). | `ConnectionStrings:ConexionOmas` |

---

## 3. Recorrido de un pedido, paso a paso

Ejemplo: Florencia registra una donación en Pesajes y toca **Guardar donación**.

1. **Pantalla** (`admin/pesaje.js` → `OmasApi.registrarDonacion` en `admin/api.js`) manda:
   ```
   POST /api/donaciones
   { "idEmpresa": 1, "numeroRemito": "00001-00000002",
     "bultos": [ { "pesoKg": 20, "idCategoria": 4 }, { "pesoKg": 30, "idCategoria": 1 } ] }
   ```
   junto con la **cookie de sesión** (`omas_sesion`).
2. **Pipeline** (`Program.cs`): la cookie se valida (`UseAuthentication`) y se revisan los permisos (`UseAuthorization`). Si no hay sesión → **401**.
3. **Ruteo**: el pedido llega a `DonacionesController.Registrar(CrearDonacionDTO datos)`.
4. **Validación automática** (`[ApiController]`): ASP.NET lee el JSON, arma el DTO y revisa los atributos (`[Required]`, `[Range]`, `[RegularExpression]` del remito). Si algo está mal → **400** con el mensaje, sin entrar al método.
5. **Reglas de negocio** (en el controller): que la empresa exista, que el remito no esté repetido para esa empresa (**409**), que las categorías existan.
6. **Armado de las entidades**: se crea un `IngresoDonacion` con su lista de `Bulto`. Quién la registró sale de la sesión (`User.IdUsuario()`), **no** de lo que manda la pantalla.
7. **Repositorio** (`DonacionRepository.CrearAsync`): `_context.IngresoDonacions.Add(...)` y `SaveChangesAsync()`. EF Core genera los `INSERT` y los hace en **una sola transacción**: se guarda todo o nada.
8. **Respuesta**: **201 Created** con la donación y sus bultos (como DTO). La pantalla muestra los códigos (`#0008`).

Lo mismo vale para el resto: cambia el controller y el repositorio, el camino es igual.

---

## 4. Conceptos que conviene saber explicar

**Database First y Scaffold.** La base se creó con el script `base-de-datos/lasomas.sql` y las clases se generaron así (desde `api/LasOmasApi`):
```
dotnet tool run dotnet-ef dbcontext scaffold "Server=.;Database=LasOmas;Trusted_Connection=True;TrustServerCertificate=True;" Microsoft.EntityFrameworkCore.SqlServer --output-dir Models --context-dir Data --context AppDbContext --no-onconfiguring --force
```
(En la consola del Administrador de paquetes de Visual Studio es `Scaffold-DbContext` con los mismos datos.) Si cambia la base, se vuelve a correr y las clases se actualizan. Por eso **no se editan a mano** los archivos de `Models/`.

**Inyección de dependencias.** En `Program.cs` se registra qué clase usar para cada interfaz. Los controllers piden lo que necesitan en el constructor y ASP.NET se lo da:
```csharp
public DonacionesController(IDonacionRepository donaciones, IEmpresaDonanteRepository empresas, ...)
```
`AddScoped` = una instancia por pedido (lo correcto para el `DbContext`). `AddSingleton` = una sola para toda la aplicación (`ControlIntentos`, que cuenta intentos en memoria).

**¿Por qué DTO y no la entidad directo?** Para no exponer columnas que no corresponden (por ejemplo `ClaveHash` de `Usuario`), para validar la entrada y para que la API no dependa de cómo está armada la tabla.

**¿Por qué repositorio?** Separa el "cómo se consulta" (LINQ, `Include`, `SaveChanges`) del controller. Con la interfaz se puede cambiar la implementación sin tocar el controller.

**async / await.** Las consultas a la base son `async` (`ToListAsync`, `SaveChangesAsync`): mientras SQL Server responde, el servidor atiende otros pedidos en vez de quedarse esperando.

**Códigos HTTP que devuelve la API.**

| Código | Cuándo |
|---|---|
| 200 / 201 / 204 | Salió bien (201 = se creó algo, 204 = sin contenido, por ejemplo una baja) |
| 400 | Dato mal (validación del DTO o regla de negocio) |
| 401 | No hay sesión o la clave es incorrecta |
| 403 | Hay sesión pero el rol no tiene permiso (por ejemplo, Depósito entrando a Usuarios) |
| 404 | No existe (un id que no está) |
| 409 | Repetido (email, CUIT o remito) o no se puede (borrar una empresa con donaciones) |
| 423 | Cuenta bloqueada por 5 intentos fallidos |
| 429 | Demasiados pedidos (límite del pago con Mercado Pago) |

**Seguridad.**
- *Contraseñas:* se guarda un **hash** (PBKDF2 con sal, con `PasswordHasher<Usuario>` de ASP.NET), nunca la clave. Al ingresar se calcula el hash de lo que escribió y se compara.
- *Sesión:* cookie `omas_sesion` **HttpOnly** (JavaScript no la puede leer), **Secure** (solo por HTTPS) y **SameSite=Strict** (no viaja desde otros sitios). No es persistente: se borra al cerrar el navegador.
- *Roles:* `[Authorize(Roles = Roles.Administracion)]` en el controller de Usuarios. Si el rol no coincide → 403.
- *Baja lógica:* las cuentas no se borran (`Activo_SN = 0`), así queda quién registró cada donación. Si a alguien la dan de baja, su sesión deja de valer en el próximo pedido (`OnValidatePrincipal` en `Program.cs`).
- *Fuerza bruta:* 5 claves mal → 15 minutos bloqueada (`ControlIntentos`).
- *Secretos:* la cadena de conexión de la nube y el token de Mercado Pago van en **variables de entorno** de Render, no en el código.

**CORS.** El navegador no deja que una página de otro origen llame a la API si la API no lo permite. La política `PoliticaCors` permite los orígenes de `appsettings.json` (por ejemplo Live Server). Con cookies no se puede usar `AllowAnyOrigin`. En la práctica el panel se abre desde la misma API, así que no hace falta.

---

## 5. Endpoints

| Método y ruta | Quién | Qué hace |
|---|---|---|
| `POST /api/auth/login` | Todos | Ingreso con email y clave |
| `POST /api/auth/logout` · `GET /api/auth/yo` | Con sesión | Salir · quién soy |
| `POST /api/auth/clave` | Con sesión | Cambiar la propia contraseña |
| `GET/POST /api/usuarios` · `PUT/DELETE /api/usuarios/{id}` · `PUT .../alta` · `POST .../clave` | Administración | **CRUD de usuarios** (baja lógica, clave temporal) |
| `GET/POST /api/empresas` · `GET/PUT/DELETE /api/empresas/{id}` | Con sesión (borrar: Administración y Coordinadora) | **CRUD de empresas donantes** |
| `POST /api/donaciones` · `GET /api/donaciones` · `GET /api/donaciones/{id}` | Con sesión | **Proceso**: ingreso de donación con sus bultos |
| `GET /api/bultos` · `GET /api/stock` · `PUT /api/bultos/{id}/categoria` · `POST /api/bultos/{id}/dividir` · `PUT /api/bultos/{id}/estado` | Con sesión | Stock: mover, separar, retirar, descartar |
| `GET /api/categorias` · `GET /api/estados` · `GET /api/roles` | Con sesión | Listas para elegir |
| `POST /api/pagos/donacion` | Público | Pago con Mercado Pago (apagado sin token) |

**Lo que pide la materia:** dos CRUD (Usuarios y Empresas donantes), un proceso (ingreso de donación → bultos → stock) y gestión de usuarios (login, roles, baja lógica, cambio de clave).

---

## 6. Cómo correrla

1. Base: en SQL Server Management Studio abrir y ejecutar `base-de-datos/lasomas.sql` (crea la base `LasOmas` con datos de ejemplo).
2. API: abrir `api/LasOmasApi.sln` en Visual Studio y ejecutar con el perfil **https**, o en una terminal:
   ```
   cd api\LasOmasApi
   dotnet run --launch-profile https
   ```
3. Swagger para probar los endpoints: `https://localhost:7122/swagger` (primero `POST /api/auth/login`).
4. Panel: `https://localhost:7122/admin` · Sitio público: `https://localhost:7122`.

---

## 7. Preguntas que pueden tomar (con respuesta corta)

- **¿Qué es Database First?** Diseñar primero la base y generar las clases desde ella con Scaffold-DbContext. Lo contrario es Code First (clases primero y migraciones).
- **¿Para qué está el `AppDbContext`?** Representa la sesión con la base: sabe qué tablas hay (`DbSet`), arma las consultas y guarda los cambios con `SaveChanges`.
- **¿Qué diferencia hay entre un DTO y un Model?** El Model es la tabla; el DTO es lo que viaja por la API. Un usuario tiene `ClaveHash` en el Model, pero el `UsuarioDTO` no la tiene.
- **¿Dónde se valida?** Tres lugares: en la pantalla (para avisar rápido), en el DTO (atributos) y en la base (restricciones `CHECK`, `UNIQUE`, claves foráneas). La que vale de verdad es la del servidor.
- **¿Cómo se guarda una donación con sus bultos sin que quede a medias?** Se agregan juntos y se llama una sola vez a `SaveChangesAsync`, que corre todo en una transacción.
- **¿Por qué la baja de usuarios es lógica?** Para no perder el historial: cada donación guarda qué usuario la registró (`IngresoDonacion.IdUsuario`).
- **¿Cómo se controla que Depósito no entre a Usuarios?** Con `[Authorize(Roles = "Administración")]` en el controller: la API responde 403 aunque alguien escriba la dirección a mano.
- **¿Por qué no se guarda la contraseña?** Si alguien roba la base, con el hash no puede saber la clave. Además cada hash tiene su sal, así dos claves iguales dan hashes distintos.
- **¿Qué pasa si se cae internet en el depósito?** La donación no se guarda y la pantalla lo avisa; se vuelve a intentar cuando vuelve la conexión.
