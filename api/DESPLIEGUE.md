# Despliegue de la API LasOmas en Render

La API es .NET 8 y Render no trae `dotnet` en sus entornos nativos: se despliega como **contenedor Docker** con el `Dockerfile` de esta carpeta. El contexto del build es la raíz del repositorio, porque la imagen también lleva el sitio público (servido en `/`) y el panel (servido en `/admin`).

## 1. Base de datos (SQL Server)

Render **no ofrece SQL Server**: la base tiene que estar en otro servicio y la API se conecta por la cadena de conexión. Opciones: Azure SQL Database (tiene una oferta gratuita), u otro hosting de SQL Server con acceso desde internet.

La API es **Database First**: no tiene migraciones de Entity Framework. Las tablas y los datos iniciales salen únicamente de `base-de-datos/lasomas.sql`, que se puede correr varias veces sin perder nada.

Si la base se puede llamar **`LasOmas`**, correr `lasomas.sql` conectado a ella. Si el hosting le pone otro nombre (MonsterASP, por ejemplo, la llama `db12345`), usar **`base-de-datos/lasomas-hosting.sql`**: es el mismo script sin `CREATE DATABASE` ni `USE`. En MonsterASP se sube desde *Import* en el panel de la base, sin necesidad de SSMS.

```bash
# SQL Server con usuario y clave (Azure SQL u otro hosting)
sqlcmd -S tcp:SERVIDOR,1433 -d LasOmas -U USUARIO -P 'CLAVE' -N -f 65001 -i base-de-datos/lasomas.sql
```

También se puede abrir el script en SSMS o Azure Data Studio, conectado a la base `LasOmas`, y ejecutarlo. En Azure SQL la base se crea desde el portal; la línea `CREATE DATABASE` del script se saltea sola porque la base ya existe.

En el servidor hay que permitir conexiones desde Render (en Azure SQL: *Networking → Allow Azure services* no alcanza; agregar una regla de firewall para las IPs de salida que muestra Render en el servicio, pestaña *Connect → Outbound*).

> El script carga **usuarias de prueba con la clave `omas2026`**. En una base pública hay que cambiarles la clave o darlas de baja apenas se despliega.

## 2. Servicio web en Render

*New → Web Service →* elegir el repositorio `Omas`, y configurar:

| Campo | Valor |
|---|---|
| Language / Runtime | **Docker** |
| Branch | `main` |
| Root Directory | *(vacío)* |
| Dockerfile Path | `./api/Dockerfile` |
| Docker Build Context Directory | `.` |
| Health Check Path | `/salud` |

Variables de entorno (*Environment*):

| Clave | Valor |
|---|---|
| `ConnectionStrings__ConexionOmas` | `Server=tcp:SERVIDOR,1433;Database=LasOmas;User ID=USUARIO;Password=CLAVE;Encrypt=True;TrustServerCertificate=False;` |
| `Cors__OrigenesPermitidos__0` | URL del sitio que llama a la API, ej. `https://omas.onrender.com` |
| `PORT` | `8080` |

El doble guion bajo (`__`) reemplaza a los `:` de `appsettings.json`, así no hace falta subir claves al repositorio.

## 3. Probar

- `https://TU-SERVICIO.onrender.com/salud` → `{"estado":"ok"}` (la API levantó).
- `https://TU-SERVICIO.onrender.com/` → sitio público (`index.html`); el panel está en `/admin`.
- `POST /api/auth/...` → si responde 500, casi siempre es la cadena de conexión o el firewall de la base: revisar los *Logs* del servicio.

## Probar el contenedor en una máquina local

```bash
docker build -f api/Dockerfile -t omas-api .
docker run --rm -p 8080:8080 -e "ConnectionStrings__ConexionOmas=..." omas-api
# http://localhost:8080/salud
```
