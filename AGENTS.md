# AGENTS.md — Las Omas (sitio + SGI-OMAS)
Sitio público y sistema de gestión interno (SGI-OMAS) de **Las Omas**, una asociación civil de mujeres de Córdoba que ofrece contención, oficios y trabajo en economía circular textil. El sitio busca donaciones, inscripciones a talleres y empresas aliadas. El SGI-OMAS es el proyecto de la cátedra: ordenar el depósito, la producción y el rendimiento del taller.
La memoria entre sesiones (estado, decisiones y próximos pasos) está en [memory.md](memory.md). Cómo trabaja de verdad Las Omas (unidades, circuito de la ropa, ventas, cooperativa) está en [relevamiento.md](relevamiento.md): **leerlo antes de diseñar un módulo**.

## Stack y estructura
- HTML + CSS + JavaScript sin frameworks, sin npm y sin build. Bootstrap 5.3.3 y Google Fonts por CDN.
- Backend previsto: ASP.NET Core (.NET 10) + SQL Server. **Todavía no existe**: el panel funciona en modo prototipo.
- `PARTE VISUAL DE OMAS/`: páginas públicas. Están un nivel abajo, así que los recursos llevan `../`.
- `js/modales.js`: modales de donar y de inscripción, que se inyectan en todas las páginas. Se carga **antes** de `js/omas.js`.
- `css/omas.css`: estilos del sitio. La paleta completa está en `:root`, con modo claro y oscuro.
- `admin/api.js`: el único punto de contacto con la API (`OmasApi`). El contrato de endpoints está documentado en su cabecera.
- `admin/menu.js`: el menú lateral compartido (`OmasMenu`). La lista de módulos es `MODULOS`.
- `admin/pesaje.js`: el módulo de depósito y pesajes, el más completo. Sirve de referencia para las pantallas nuevas del panel.

## Comandos
No hay build, tests ni lint. Para verlo:
- VS Code → extensión **Live Server** → "Go Live". La raíz y los montajes ya están en `.vscode/settings.json`.
- Sitio: `http://127.0.0.1:5500/index.html` · Panel: `http://127.0.0.1:5500/admin/ingresar.html`
- Usuarios de prueba: `laura` (Coordinadora), `sandra` (Supervisión), `florencia` (Depósito). La clave de todos es `omas2026`.

## Convenciones
- **Todo en español**: variables, funciones, clases CSS, IDs y comentarios. Los textos para las usuarias van en tono rioplatense, simple y cálido ("Probá", "Ingresá").
- JS en módulos IIFE con `"use strict"`, `var` y funciones con nombre (modelo: `admin/api.js`, `admin/menu.js`).
- Cada archivo empieza con un comentario `/* ===== Nombre ===== */` que dice qué hace y cómo se conecta con el resto. Los comentarios explican el *por qué*.
- Colores solo con las variables de `:root`. El vino `#803C47` es el principal y el rojo `#9E272E` se usa **solo** para "Doná".
- Lo que se repite entre páginas va en un solo archivo compartido, nunca copiado en cada `.html`.
- Pantallas del panel: `OmasApi.exigirSesion()` → `OmasMenu.iniciar(usuario)` → pantalla. Los datos se piden solo a través de `api.js`.
- Celular primero y accesible: aria, foco visible, Escape para cerrar, orden de Tab igual al visual.

## Reglas de dominio / trampas conocidas
- **El sistema no maneja pagos a costureras**: nada de liquidaciones, sueldos, adelantos, reparto 85/15, descuentos de bolsas o tijeras ni montos en pesos por trabajadora. Esos pagos son informales y registrarlos tiene riesgo legal. En su lugar existe **Rendimiento** (kg por pedido, tiempos de retiro y devolución, calidad). Las planillas de pagos solo sirven como fuente de kilos y de pedidos.
- Pesajes: hay tres registros (entra una donación, retira una costurera, devuelve una costurera). La tara se descuenta del peso. Se acepta una diferencia de hasta 5 % entre lo retirado y lo devuelto. Si no hay internet, los pesajes quedan "sin subir".
- Códigos de lote por destino: F feria, D desmarcado, T trapos, M taller textil (merchandising), B bolsas, X desbastado, Z descarte (ej. `T-0231`).
- Pedidos: las **bolsas de lienzo se piden por unidad** (de 100 a 6.000) y los **trapos por kg**. Cada pedido lleva su unidad: nunca suponer kg.
- Todo lo textil va a facturar la **Cooperativa Textil** (en formación). Catering y talleres siguen en la asociación civil. Ventas y gastos tienen que saber a qué entidad pertenecen.
- No escribir en el repo (que es público) datos personales ni situaciones particulares de las mujeres que salgan del relevamiento.
- Roles: Coordinadora (todo, incluso Usuarios), Supervisión (aprueba), Depósito (registra, no aprueba).
- No hay registro público: las cuentas las crea la Coordinadora.
- Sesión: cookie HttpOnly/Secure/SameSite=Strict, no persistente y sin "recordarme". El prototipo usa `sessionStorage`, **nunca** `localStorage`.

## Forma de trabajar
- Leer los archivos involucrados antes de tocar y seguir el estilo que ya tienen.
- Planificar primero (y contar el plan) si el cambio toca varios archivos, crea un módulo o cambia datos o contratos. Lo chico se hace directo.
- Cambios chicos y en su lugar, sin reescribir archivos enteros.
- Al terminar: explicar en pocas líneas qué cambió y dónde (con enlaces a los archivos), decir qué se probó y qué no, y actualizar [memory.md](memory.md).
- Responder en español.

## Límites
- ✅ **Siempre**: seguir las convenciones de arriba, escapar el texto antes de meterlo en `innerHTML` (`esc`), marcar los datos de ejemplo como tales, mantener el modo oscuro y el celular funcionando.
- ⚠️ **Preguntar antes**: agregar dependencias o CDNs, crear archivos o carpetas nuevas, cambiar el contrato de `api.js` o el formato de los datos, cambiar la paleta, borrar contenido o imágenes, renombrar la carpeta `PARTE VISUAL DE OMAS`.
- 🚫 **Nunca**: modelar pagos a costureras, guardar sesiones o datos sensibles en `localStorage`, agregar registro público, meter frameworks o pasos de build, poner credenciales reales en el código.

## Verificación
- Abrir con Live Server la página o pantalla que se tocó: que no haya errores en la consola (F12).
- Probar a 375 px de ancho (celular) y en escritorio, sin scroll horizontal.
- Probar en modo claro y oscuro.
- Probar con el teclado: se puede llegar a todo con Tab, el foco se ve y Escape cierra.
- En el panel: ingresar con los usuarios de prueba y revisar que cada rol vea lo que le corresponde.
- Si se tocó un recurso compartido (`modales.js`, `menu.js`, `omas.css`, `admin.css`), revisar al menos otra página que lo use.
