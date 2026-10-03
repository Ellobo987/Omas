# MEMORY.md — Las Omas (sitio + SGI-OMAS)
Memoria del proyecto entre sesiones. Máximo ~50 líneas: resumir o borrar lo que ya no aporte.

## Estado actual
- **Sitio público** (`PARTE VISUAL DE OMAS/`): 7 páginas terminadas (inicio, nosotras, qué hacemos, talleres, empresas, doná, contacto) más `privacidad.html` (Ley 25.326, enlazada en el pie). Todos los formularios llevan el aviso de datos (`avisoDatos` en `modales.js`, clase `.aviso-datos`). Tiene modales compartidos para donar paso a paso y para inscribirse a talleres (`js/modales.js`).
- **SGI-OMAS** (`admin/`): prototipo del frontend con datos de ejemplo. Ya funcionan el ingreso, el Inicio del panel y Depósito y pesajes (donación que entra, retiro y devolución de costureras, taras, tolerancia del 5 %, funciona sin internet).
- Pesajes: la foto del visor de la balanza es **obligatoria** para seguir (devolución y donación). El número de remito se valida: 13 números y un guion (`remitoValido` en `pesaje.js`). Que sea correlativo lo tiene que controlar la API.
- **Talleres** (`admin/talleres.html` + `talleres.js`), con dos pestañas (`#fechas` y `#inscriptas`). **Inscriptas**: lo que se anota desde el sitio (`OmasApi.inscribirTaller`) se lista por taller, con DNI tapado; solo Coordinadora y Supervisión. Sin botón de WhatsApp: la confirmación la va a mandar un bot automático que dispara la API al recibir la inscripción. En el menú lateral, Talleres se despliega (flechita) en "Modificar talleres" e "Inscripciones" (`sub` en MODULOS de `menu.js`). **Fechas**: como no tienen días fijos, Coordinadora y Supervisión editan **solo la fecha**; Depósito solo mira. La fecha **se elige tocando, no se escribe** (menos datos a cargar, sin errores de tipeo): "Todas las semanas" (días Lun–Sáb), "Un día puntual" (calendario) o "A confirmar", y horario Desde/Hasta (8 a 21 h, cada media hora). Se guarda como datos (`cuando` en `api.js`) y el texto lo arma `OmasApi.textoFecha`, el mismo para panel y sitio. Un día puntual que ya pasó se marca en el panel y en el sitio dice "Fecha a confirmar". La página pública `talleres.html` carga `../admin/api.js` y arma las tarjetas con `OmasApi.listarTalleres()`. En el prototipo los cambios viven en sessionStorage: se ven en el sitio solo en la misma pestaña. Las tarjetas de "Modificar talleres" son verticales (foto grande, estado, fecha, cantidad de inscriptas; dos columnas en la compu) y la vista previa imita la tarjeta del sitio.
- **Relevamiento** de la visita a la sede en [relevamiento.md](relevamiento.md), sin datos personales. Con eso se corrigieron: el destino "Taller textil" (M) en Pesajes, los pedidos del Inicio con unidad (bolsas o kg), Cocina y Pastelería "A confirmar" (suspendido hasta el SUM) y textos de `que-hacemos.html` y `empresas.html` (trapos con Coca-Cola desde 2019; el desmarcado tapa el logo cosiendo una tela; el catering todavía se cocina en casas; hay tres ferias, no "sedes"; "friselina").
- El botón "Ingreso al sistema" está solo en la barra de arriba (ya no en el pie). Las reseñas de `empresas.html` vienen del widget de Elfsight: su encabezado se configura en el panel de Elfsight, no en el código.
- La API (ASP.NET Core .NET 10 + SQL Server) todavía no existe: `api.js` la simula con `modoPrototipo: true`.
- Usuarios de prueba: laura (Coordinadora), sandra (Supervisión), florencia (Depósito). La clave de todos es `omas2026`.
- Para verlo: Live Server de VS Code (la raíz ya está configurada). El panel está en `/admin/ingresar.html`.
- Código en GitHub (público): https://github.com/Ellobo987/Omas, rama `main`. Los commits usan el email noreply `Ellobo987@users.noreply.github.com` (configurado solo en este repo) para no mostrar el personal.

## Decisiones (y por qué)
- **HTML/CSS/JS sin frameworks ni build, con Bootstrap por CDN:** así el equipo lo puede entender y tocar sin herramientas extra.
- **Todo en español:** código, clases, IDs y comentarios. Los textos van en tono rioplatense ("Probá", "Doná").
- **Todo acceso a datos pasa por `admin/api.js` (OmasApi):** para conectar la API real alcanza con poner `modoPrototipo: false`, sin tocar las pantallas.
- **Sesión con cookie HttpOnly/Secure/SameSite=Strict, sin "recordarme":** son computadoras compartidas. Por la misma razón el prototipo usa solo `sessionStorage`.
- **No hay registro público:** las cuentas las crea la Coordinadora, porque es un sistema interno.
- **Sin pagos a costureras** (ni liquidaciones, ni 85/15, ni descuentos, ni montos en pesos): esos pagos son informales y registrarlos trae riesgo legal. En su lugar va el módulo **Rendimiento** (kg por pedido, tiempos de retiro y devolución, calidad).
- **Lo compartido va en un solo archivo** (`modales.js`, `menu.js`, `api.js`): antes estaba copiado en cada `.html`.
- **Paleta única en `:root` de `css/omas.css`:** el vino `#803C47` es el color principal y el rojo `#9E272E` se usa **solo** para "Doná". También hay modo oscuro.
- **Celular primero y accesible:** el pesaje se usa con el pulgar al lado de la balanza. Se usan aria, foco visible y la tecla Escape.

## Aprendizajes y errores a evitar
- Las páginas públicas están un nivel abajo: los recursos llevan `../` (`../css`, `../img`).
- `modales.js` tiene que cargarse **antes** que `omas.js`.
- Nunca usar `localStorage` para la sesión ni guardar datos sensibles ahí.
- Escapar el texto antes de meterlo en `innerHTML` (con `esc` de `menu.js`).
- No volver a proponer tablas ni pantallas de pagos o liquidaciones.

## Próximos pasos
- Módulos marcados como `pronto` en `menu.js`: Producción, Rendimiento, Ventas y pedidos, Catering, Reportes para empresas y Usuarios. **Ventas y pedidos** va primero: pedidos de bolsas por unidad y de trapos por kg, que llegan por mail (con orden de compra) o WhatsApp; lotes asignados al pedido; entregas con remito → kg por mujer por remito.
- Pendiente de decidir: donaciones de vecinos (sin remito) y COyS (llega pesado y hay que saber quiénes juntaron); rol de Ventas y rol de Tesorería; cómo separar Cooperativa y Asociación.
- Conectar la API real y reemplazar los datos de ejemplo (pesajes, panel, talleres de `omas.js`).
- Completar el CBU en el modal de donación, y el CUIT y la personería en `privacidad.html`. Que alguien con formación legal revise esa página.
- Confirmar permisos de logos de empresas y de fotos (dos imágenes parecen bajadas de un medio). Evaluar si el DNI hace falta en la inscripción a talleres.
- Cuando haya dominio: pasar `og:image` y `og:url` a URLs completas.

## Cómo trabajamos
- Leer antes de tocar y seguir el estilo que ya existe (IIFE, `var`, comentario de cabecera en cada archivo).
- Hacer cambios chicos y en su lugar: sin dependencias nuevas y sin reescribir archivos enteros.
- Avisar si algo no se pudo probar o quedó a medias. Responder en español.
- Al cerrar una tarea, actualizar este archivo.
