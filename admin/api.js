/* ===== SGI-OMAS · Cliente de la API =====
   Todas las pantallas del panel hablan con la API (ASP.NET Core en .NET 8 + EF Database First + SQL Server)
   solo a través de este archivo. Cuando la API esté lista, alcanza con poner
   modoPrototipo en false: las pantallas no cambian.

   Contrato que tiene que cumplir la API (lo usan las pantallas):
     POST /api/auth/login   { usuario, clave }
                            200 { id, nombre, rol } y deja la cookie de sesión (HttpOnly, Secure, SameSite=Strict).
                            La cookie NO es persistente: se borra al cerrar el navegador. No hay "recordarme".
                            401 usuario o contraseña incorrectos · 423 cuenta bloqueada por intentos
     POST /api/auth/logout  204, borra la cookie
     GET  /api/auth/yo      200 { id, nombre, rol } si hay sesión · 401 si no

     Talleres (CRUD) · crear, editar y dar de baja: Administración, Coordinadora y Supervisión (403 para Depósito)
     GET    /api/talleres               200 [{ id, nombre, tipo, img, desc, cuando, activo }]
                                        PÚBLICO (sin sesión): solo los activos. Lo usa la página Talleres del sitio.
     GET    /api/talleres?todos=true    200 también los dados de baja (panel, con sesión)
     POST   /api/talleres               { nombre, tipo, img, desc, cuando } → 201 el taller creado
     PUT    /api/talleres/{id}          { nombre, tipo, img, desc, cuando } → 200 el taller actualizado
     DELETE /api/talleres/{id}          204 baja LÓGICA (activo = false): deja de verse en el sitio,
                                        pero sus inscripciones quedan guardadas
     PUT    /api/talleres/{id}/alta     204 lo vuelve a mostrar
       tipo = "oficios" | "digital" | "bienestar" · img = una foto de la galería (TALLERES_FOTOS)
       cuando = { modo: "semanal",    dias: [1, 3], desde: "14:00", hasta: "17:00" }  (1 = lunes … 6 = sábado)
              | { modo: "puntual",    fecha: "2026-11-15", desde: "09:00", hasta: "13:00" }
              | { modo: "aConfirmar" }
       Se guarda como datos, no como texto: el texto ("Lun y Mié · 14 a 17 h") lo arma textoFecha().
       La API tiene que validar lo mismo que el panel: al menos un día, fecha no pasada, hasta > desde.
     POST /api/inscripciones  { tallerId, nombre, dni, telefono }
                            201 PÚBLICO (sin sesión): el formulario de inscripción del sitio.
                            Al guardarla, la API dispara el bot de WhatsApp que le confirma la
                            inscripción al teléfono que dejó (por eso el panel no tiene botón de WhatsApp).
     GET  /api/inscripciones  200 [{ id, tallerId, nombre, dni, telefono, fecha }]
                            Administración, Coordinadora y Supervisión (403 para Depósito): son datos personales.

     Usuarios (CRUD) · solo el rol Administración (403 para el resto):
     GET    /api/usuarios               200 [{ id, nombre, usuario, rol, activo, alta }]
     POST   /api/usuarios               { nombre, usuario, rol } → 201 { usuario, claveTemporal }
                                        409 si el nombre de usuario ya existe
     PUT    /api/usuarios/{id}          { nombre, rol } → 200 la usuaria actualizada
     POST   /api/usuarios/{id}/clave    200 { claveTemporal }: se olvidó la clave y se le da una nueva
     DELETE /api/usuarios/{id}          204 baja LÓGICA (activo = false): no se borra, así queda
                                        registrado quién hizo cada pesaje. No puede darse de baja a sí misma.
     PUT    /api/usuarios/{id}/alta     204 la vuelve a activar
     La clave se guarda con hash en la base, nunca en texto. La temporal se muestra una sola vez.

     Depósito · fardos y stock (los comparten Depósito, Stock del depósito y Taller textil):
     GET    /api/fardos?material=...    200 [{ codigo, material, kg, ubicacion, entro, empresa, historial[] }] solo los que tienen kg
       historial = [{ fecha, texto, por }] (tabla MovimientoFardo) · material "Sin clasificar" = pesado pero no separado
     POST   /api/fardos/{codigo}/mover  { destino, kg } → 200 { movimiento, origen, nuevo?, kg, destino }
       Todo el fardo: conserva el código y cambia de sección. Una parte: sale un fardo nuevo con su código.
       A "descarte": esos kg salen del depósito. No más kg de los que tiene el fardo.
     DELETE /api/fardos/movimientos/{id} 204 deshace un movimiento recién hecho
     Los códigos de los fardos (letra de la sección + número) los da la API, así no se repiten.

     Taller textil · pedidos (proceso):
     GET    /api/pedidos                200 [{ id, numero, canal, recibido, cliente, producto, medida, cantidad, entrega,
                                               ordenCompra, mensaje, estado, consulta?, motivo?, material[], reparto[], entregas[] }]
       canal = "whatsapp" | "gmail" | "web" · estado = "nuevo" | "masDatos" | "aceptado" | "rechazado"
       Los pedidos los CREA el bot (WhatsApp / Gmail) o el formulario del sitio, no una persona:
     POST   /api/pedidos/entrantes      { canal, cliente, producto, medida, cantidad, entrega, mensaje } → 201 (usa el bot)
     POST   /api/pedidos/{id}/respuesta { accion: "aceptar" | "rechazar" | "masDatos", texto } → 200 · solo Administración
     POST   /api/pedidos/{id}/material  { fardo, kg } → 200 · descuenta los kg del fardo del depósito
     POST   /api/pedidos/{id}/reparto   { operaria, cantidad } → 200 · no más de lo que falta repartir
     POST   /api/pedidos/{id}/terminadas { operaria, cantidad } → 200 · no más de lo que tiene asignado
     POST   /api/pedidos/{id}/entregas  { cantidad, remito } → 200 · no más de lo terminado y no entregado
     Material, reparto y entregas: Administración, Coordinadora y Supervisión (403 para Depósito).

   No hay registro público: las cuentas las crea Administración desde la pantalla Usuarios.

   Este archivo lo carga también talleres.html del sitio público, solo para leer los talleres. */
window.OmasApi = (function(){
  "use strict";

  var CONFIG = {
    // La API se publica en el mismo dominio que el panel, así la cookie de sesión viaja sola
    base: "/api",
    // true mientras no exista la API: simula las respuestas con usuarios de prueba
    modoPrototipo: true
  };

  function ErrorApi(tipo, mensaje){ this.tipo = tipo; this.message = mensaje; }
  ErrorApi.prototype = Object.create(Error.prototype);

  var MENSAJES = {
    credenciales: "Usuario o contraseña incorrectos.",
    bloqueada: "La cuenta quedó bloqueada por varios intentos fallidos. Probá de nuevo en 15 minutos o pedile ayuda a la coordinación.",
    sinConexion: "No hay conexión con el sistema. Revisá internet y probá de nuevo.",
    servidor: "El sistema tuvo un problema. Probá de nuevo en un rato."
  };

  async function pedir(ruta, opciones){
    var respuesta;
    try {
      respuesta = await fetch(CONFIG.base + ruta, Object.assign({
        credentials: "include",
        headers: { "Content-Type": "application/json", "Accept": "application/json" }
      }, opciones));
    } catch(e){
      throw new ErrorApi("sin-conexion", MENSAJES.sinConexion);
    }
    if(respuesta.status === 401) throw new ErrorApi("credenciales", MENSAJES.credenciales);
    if(respuesta.status === 423) throw new ErrorApi("bloqueada", MENSAJES.bloqueada);
    if(respuesta.status === 403) throw new ErrorApi("permiso", "No tenés permiso para hacer esto.");
    if(respuesta.status === 409) throw new ErrorApi("repetido", "Ya existe un registro con esos datos.");
    if(!respuesta.ok) throw new ErrorApi("servidor", MENSAJES.servidor);
    return respuesta.status === 204 ? null : respuesta.json();
  }

  /* ----- Simulación para el prototipo (se borra cuando exista la API) ----- */
  /* Cuentas de prueba. La pantalla Usuarios agrega, edita y da de baja sobre esta misma lista
     (guardada en sessionStorage), así las cuentas nuevas también pueden ingresar.
     PROTOTIPO: la clave queda en texto solo acá; la API real guarda un hash. */
  var CLAVE_PRUEBA = "omas2026";
  var USUARIOS_EJEMPLO = [
    { id: "laura", nombre: "Laura", usuario: "laura", rol: "Coordinadora", activo: true, alta: "2025-03-10", clave: CLAVE_PRUEBA },
    { id: "sandra", nombre: "Sandra", usuario: "sandra", rol: "Administración", activo: true, alta: "2025-03-10", clave: CLAVE_PRUEBA },
    { id: "florencia", nombre: "Florencia", usuario: "florencia", rol: "Depósito", activo: true, alta: "2025-04-02", clave: CLAVE_PRUEBA },
    { id: "ejemplo-baja", nombre: "Usuaria de ejemplo", usuario: "ejemplo", rol: "Depósito", activo: false, alta: "2025-05-20", clave: CLAVE_PRUEBA }
  ];
  var CLAVE_USUARIOS = "omas-usuarios-prueba";
  var MAX_INTENTOS = 5;

  // Solo sessionStorage: se borra al cerrar la pestaña. Nunca localStorage, para que no quede nadie guardado.
  function guardado(clave){
    try { return JSON.parse(sessionStorage.getItem(clave)); } catch(e){ return null; }
  }
  function esperar(ms){ return new Promise(function(r){ setTimeout(r, ms); }); }
  function usuariosPrueba(){ return guardado(CLAVE_USUARIOS) || USUARIOS_EJEMPLO.slice(); }
  function guardarUsuariosPrueba(lista){ try { sessionStorage.setItem(CLAVE_USUARIOS, JSON.stringify(lista)); } catch(e){} }
  // Lo que se muestra de una cuenta: nunca la clave
  function publico(u){ return { id: u.id, nombre: u.nombre, usuario: u.usuario, rol: u.rol, activo: u.activo, alta: u.alta }; }

  async function loginPrueba(usuario, clave){
    await esperar(700);
    var intentos = 0;
    try { intentos = +sessionStorage.getItem("omas-intentos") || 0; } catch(e){}
    if(intentos >= MAX_INTENTOS) throw new ErrorApi("bloqueada", MENSAJES.bloqueada);
    var buscado = usuario.trim().toLowerCase();
    var cuenta = usuariosPrueba().filter(function(x){ return x.usuario === buscado && x.activo; })[0];
    if(!cuenta || clave !== cuenta.clave){
      try { sessionStorage.setItem("omas-intentos", intentos + 1); } catch(e){}
      throw new ErrorApi("credenciales", MENSAJES.credenciales);
    }
    var u = { id: cuenta.id, nombre: cuenta.nombre.split(" ")[0], rol: cuenta.rol };
    try {
      sessionStorage.removeItem("omas-intentos");
      sessionStorage.setItem("omas-sesion-prueba", JSON.stringify(u));
    } catch(e){}
    return u;
  }

  /* ----- Sesión ----- */
  // Copia del nombre y el rol solo para mostrarlos; quien decide si hay sesión es la cookie de la API
  function recordarUsuario(u){ try { sessionStorage.setItem("omas-usuario", JSON.stringify(u)); } catch(e){} }

  async function iniciarSesion(usuario, clave){
    var u = CONFIG.modoPrototipo
      ? await loginPrueba(usuario, clave)
      : await pedir("/auth/login", { method: "POST", body: JSON.stringify({ usuario: usuario, clave: clave }) });
    recordarUsuario(u);
    return u;
  }

  async function usuarioActual(){
    if(CONFIG.modoPrototipo) return guardado("omas-sesion-prueba");
    try { var u = await pedir("/auth/yo", { method: "GET" }); recordarUsuario(u); return u; }
    catch(e){ if(e.tipo === "credenciales") return null; throw e; }
  }

  // Por defecto lleva al ingreso; con { redirigir: false } solo cierra (lo usa la pantalla de ingreso)
  async function cerrarSesion(opciones){
    try {
      sessionStorage.removeItem("omas-usuario");
      sessionStorage.removeItem("omas-sesion-prueba");
      localStorage.removeItem("omas-sesion-prueba"); // por si quedó de una versión anterior
    } catch(e){}
    if(!CONFIG.modoPrototipo){ try { await pedir("/auth/logout", { method: "POST" }); } catch(e){} }
    if(!opciones || opciones.redirigir !== false) location.href = "ingresar.html";
  }

  // Para las pantallas del panel: si no hay sesión, manda al ingreso y después vuelve acá
  async function exigirSesion(){
    var u = null;
    try { u = await usuarioActual(); } catch(e){}
    if(!u){
      var pagina = location.pathname.split("/").pop() || "panel.html";
      location.replace("ingresar.html?volver=" + encodeURIComponent(pagina));
      return new Promise(function(){}); // la página se va, no sigue
    }
    return u;
  }

  /* ----- Talleres (CRUD) -----
     La coordinación crea, edita y da de baja los talleres desde el panel, y el sitio público
     muestra los activos. Los talleres no tienen días fijos, por eso la fecha se cambia seguido.
     PROTOTIPO: datos de ejemplo. Los cambios se guardan en sessionStorage, así que se ven
     en el sitio solo si se abre en la MISMA pestaña. Con la API se ven en cualquier lado. */
  var TIPOS_TALLER = { oficios: "Oficios", digital: "Digital", bienestar: "Bienestar" };
  // La foto se elige de esta galería (fotos que ya tiene el sitio): no hay que subir archivos
  var TALLERES_FOTOS = ["img/costurera.webp", "img/confeccion.webp", "img/maquina.webp", "img/corte.webp", "img/pasteleria.jpg",
    "img/ceramica.jpg", "img/digital.webp", "img/munequeria.webp", "img/bioconstruccion.webp", "img/taller-grupo.webp", "img/encuentro.webp"];
  // Una fecha puntual de ejemplo que siempre quede en el futuro (dentro de tres semanas, un sábado)
  function sabadoEnTresSemanas(){
    var d = new Date(); d.setDate(d.getDate() + 21 + (6 - d.getDay()));
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  }
  var TALLERES_EJEMPLO = [
    { id: "costura", nombre: "Moldería y Costura", tipo: "oficios", img: "img/costurera.webp", desc: "Moldes, máquinas domésticas e industriales y reutilización de uniformes.", cuando: { modo: "semanal", dias: [1, 3], desde: "14:00", hasta: "17:00" } },
    { id: "cocina", nombre: "Cocina y Pastelería", tipo: "oficios", img: "img/pasteleria.jpg", desc: "Recetas prácticas con productos locales, para casa o para emprender.", cuando: { modo: "aConfirmar" } }, // suspendido hasta que esté el SUM gastronómico
    { id: "digital", nombre: "Habilidades digitales y reparación de PC", tipo: "digital", img: "img/digital.webp", desc: "Desde cero: uso de la compu, internet, redes y arreglo de notebooks.", cuando: { modo: "semanal", dias: [4], desde: "15:00", hasta: "17:00" } },
    { id: "tejido", nombre: "Tejido y muñequería", tipo: "oficios", img: "img/munequeria.webp", desc: "Muñecos y objetos únicos con retazos, lanas y telas en desuso.", cuando: { modo: "semanal", dias: [5], desde: "10:00", hasta: "12:00" } },
    { id: "bioconstruccion", nombre: "Bioconstrucción", tipo: "oficios", img: "img/bioconstruccion.webp", desc: "Construir con barro, paja y materiales reciclados, en equipo.", cuando: { modo: "puntual", fecha: sabadoEnTresSemanas(), desde: "09:00", hasta: "13:00" } }
  ];
  TALLERES_EJEMPLO.forEach(function(t){ t.activo = true; });
  // "-3": la lista completa (con altas y bajas). Así no se mezcla con lo guardado en formatos anteriores.
  var CLAVE_TALLERES = "omas-talleres-prueba-3";
  function talleresPrueba(){ return guardado(CLAVE_TALLERES) || JSON.parse(JSON.stringify(TALLERES_EJEMPLO)); }
  function guardarTalleresPrueba(lista){ try { sessionStorage.setItem(CLAVE_TALLERES, JSON.stringify(lista)); } catch(e){} }

  // Sin opciones: solo los activos (lo que ve el sitio). Con { todos: true }: también los de baja (panel).
  async function listarTalleres(opciones){
    var todos = !!(opciones && opciones.todos);
    if(!CONFIG.modoPrototipo) return pedir("/talleres" + (todos ? "?todos=true" : ""), { method: "GET" });
    return talleresPrueba().filter(function(t){ return todos || t.activo; });
  }

  async function puedeEditarTalleres(){
    await esperar(400);
    var u = guardado("omas-sesion-prueba");
    if(!u || u.rol === "Depósito") throw new ErrorApi("permiso", "Solo la coordinación, la supervisión y Administración pueden cambiar los talleres.");
  }
  function datosTaller(d){
    return { nombre: d.nombre.trim(), tipo: d.tipo, img: d.img, desc: d.desc.trim(), cuando: limpiarCuando(d.cuando) };
  }

  async function crearTaller(datos){
    var nuevo = datosTaller(datos);
    if(!CONFIG.modoPrototipo) return pedir("/talleres", { method: "POST", body: JSON.stringify(nuevo) });
    await puedeEditarTalleres();
    var lista = talleresPrueba();
    var taller = Object.assign({ id: "t" + Date.now(), activo: true }, nuevo);
    lista.push(taller); guardarTalleresPrueba(lista);
    return taller;
  }

  async function actualizarTaller(id, datos){
    var cambios = datosTaller(datos);
    if(!CONFIG.modoPrototipo) return pedir("/talleres/" + encodeURIComponent(id), { method: "PUT", body: JSON.stringify(cambios) });
    await puedeEditarTalleres();
    var lista = talleresPrueba(), t = lista.filter(function(x){ return x.id === id; })[0];
    if(!t) throw new ErrorApi("servidor", "No encontramos ese taller.");
    Object.assign(t, cambios); guardarTalleresPrueba(lista);
    return t;
  }

  // activo = false → baja lógica (deja de verse en el sitio) · activo = true → vuelve a mostrarse
  async function cambiarAltaTaller(id, activo){
    if(!CONFIG.modoPrototipo){
      return pedir("/talleres/" + encodeURIComponent(id) + (activo ? "/alta" : ""), { method: activo ? "PUT" : "DELETE" });
    }
    await puedeEditarTalleres();
    var lista = talleresPrueba(), t = lista.filter(function(x){ return x.id === id; })[0];
    if(!t) throw new ErrorApi("servidor", "No encontramos ese taller.");
    t.activo = activo; guardarTalleresPrueba(lista);
    return null;
  }

  // Deja solo los campos que corresponden a cada modo
  function limpiarCuando(c){
    if(c.modo === "semanal") return { modo: "semanal", dias: c.dias.slice().sort(), desde: c.desde, hasta: c.hasta };
    if(c.modo === "puntual") return { modo: "puntual", fecha: c.fecha, desde: c.desde, hasta: c.hasta };
    return { modo: "aConfirmar" };
  }


  /* El texto de la fecha se arma acá y no en cada pantalla: así el panel y el sitio
     lo muestran siempre igual ("Lun y Mié · 14 a 17 h", "Sábado 15/11 · 9 a 13 h"). */
  var DIAS_CORTOS = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
  var DIAS_LARGOS = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];

  // "2026-11-15" → fecha local (new Date("2026-11-15") la tomaría en UTC y podría correrse un día)
  function leerFecha(texto){ var p = texto.split("-"); return new Date(+p[0], +p[1] - 1, +p[2]); }
  function hoy(){ var d = new Date(); d.setHours(0, 0, 0, 0); return d; }
  // "14:00" → "14" · "09:30" → "9:30"
  function hora(texto){ var p = texto.split(":"); return +p[0] + (p[1] === "00" ? "" : ":" + p[1]); }
  function enumerar(lista){ return lista.length < 2 ? lista.join("") : lista.slice(0, -1).join(", ") + " y " + lista[lista.length - 1]; }

  // Un taller de un día puntual que ya pasó se muestra en el sitio como "Fecha a confirmar"
  function yaPaso(cuando){ return !!cuando && cuando.modo === "puntual" && leerFecha(cuando.fecha) < hoy(); }

  function textoFecha(cuando){
    if(!cuando || cuando.modo === "aConfirmar") return "Fecha a confirmar";
    var dia;
    if(cuando.modo === "semanal"){
      dia = cuando.dias.length === 1 ? DIAS_LARGOS[cuando.dias[0]] : enumerar(cuando.dias.map(function(n){ return DIAS_CORTOS[n]; }));
    } else {
      var f = leerFecha(cuando.fecha);
      dia = DIAS_LARGOS[f.getDay()] + " " + f.getDate() + "/" + (f.getMonth() + 1) +
        (f.getFullYear() !== new Date().getFullYear() ? "/" + f.getFullYear() : "");
    }
    return dia + " · " + hora(cuando.desde) + " a " + hora(cuando.hasta) + " h";
  }

  /* ----- Inscripciones a talleres -----
     El sitio las manda y el panel las lista (pestaña Inscriptas de Talleres).
     PROTOTIPO: personas INVENTADAS de ejemplo, más las que se anoten desde el sitio en esta pestaña. */
  function haceDias(n){ var d = new Date(); d.setDate(d.getDate() - n); return d.toISOString(); }
  var INSCRIPCIONES_EJEMPLO = [
    { id: "e1", tallerId: "costura", nombre: "Ana Gómez", dni: "30111222", telefono: "351 555-0101", fecha: haceDias(1) },
    { id: "e2", tallerId: "costura", nombre: "Beatriz Díaz", dni: "28333444", telefono: "351 555-0102", fecha: haceDias(3) },
    { id: "e3", tallerId: "cocina", nombre: "Carolina Ruiz", dni: "35555666", telefono: "351 555-0103", fecha: haceDias(2) },
    { id: "e4", tallerId: "digital", nombre: "Daniela Torres", dni: "40777888", telefono: "351 555-0104", fecha: haceDias(5) }
  ];
  var CLAVE_INSCRIPCIONES = "omas-inscripciones-prueba";

  async function inscribirTaller(datos){
    var inscripcion = { tallerId: datos.tallerId, nombre: datos.nombre.trim(), dni: datos.dni.replace(/\D/g, ""), telefono: datos.telefono.trim() };
    if(!CONFIG.modoPrototipo) return pedir("/inscripciones", { method: "POST", body: JSON.stringify(inscripcion) });
    await esperar(400);
    var nuevas = guardado(CLAVE_INSCRIPCIONES) || [];
    inscripcion.id = "n" + Date.now();
    inscripcion.fecha = new Date().toISOString();
    nuevas.push(inscripcion);
    try { sessionStorage.setItem(CLAVE_INSCRIPCIONES, JSON.stringify(nuevas)); } catch(e){}
    return inscripcion;
  }

  async function listarInscripciones(){
    if(!CONFIG.modoPrototipo) return pedir("/inscripciones", { method: "GET" });
    var u = guardado("omas-sesion-prueba");
    if(!u || u.rol === "Depósito") throw new ErrorApi("servidor", "Solo la coordinación y la supervisión pueden ver las inscripciones.");
    return INSCRIPCIONES_EJEMPLO.concat(guardado(CLAVE_INSCRIPCIONES) || []);
  }

  /* ----- Depósito: fardos y stock -----
     Los usan Depósito y pesajes (retiros, donaciones), Stock del depósito (mover fardos de sección)
     y el Taller textil (pide lienzo para los pedidos), así lo que se lleva uno se descuenta para el otro.
     PROTOTIPO: se leen y se guardan sin esperar (pesaje.js funciona sin internet y es síncrono). */
  // Secciones del depósito. La letra va adelante del código del fardo (T-0241 = trapos).
  // "Sin clasificar": la donación se pesó pero todavía no se separó. "Descarte": sale del depósito.
  var SECCIONES_DEPOSITO = [
    { id: "feria", nombre: "Feria", letra: "F", material: "Prendas para feria" },
    { id: "desmarcado", nombre: "Desmarcado", letra: "D", material: "Uniformes para desmarcar" },
    { id: "trapos", nombre: "Trapos", letra: "T", material: "Tela para trapos" },
    { id: "lienzo", nombre: "Lienzo para bolsas", letra: "B", material: "Lienzo para bolsas" },
    // Merchandising con los propios uniformes de la empresa ("Vuelta de Rosca")
    { id: "taller", nombre: "Taller textil", letra: "M", material: "Uniformes para merchandising" },
    { id: "desbastado", nombre: "Desbastado", letra: "X", material: "Textil para desbastado" },
    { id: "descarte", nombre: "Descarte", letra: "Z", material: "Descarte", sale: true },
    { id: "sinClasificar", nombre: "Sin clasificar", letra: "S", material: "Sin clasificar" }
  ];
  function seccionDe(material){ return SECCIONES_DEPOSITO.filter(function(s){ return s.material === material; })[0]; }
  function diaIso(desplazamiento){
    var d = new Date(); d.setDate(d.getDate() + desplazamiento);
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  }
  function entrada(dias, empresa){ return [{ fecha: diaIso(dias) + "T10:00:00", texto: "Entró en la donación de " + empresa, por: "Florencia" }]; }
  var FARDOS_EJEMPLO = [
    { codigo: "S-0004", material: "Sin clasificar", kg: 46.0, ubicacion: "Piso, entrada", entro: diaIso(-9), empresa: "Holcim", historial: entrada(-9, "Holcim") },
    { codigo: "S-0005", material: "Sin clasificar", kg: 27.5, ubicacion: "Piso, entrada", entro: diaIso(-2), empresa: "Conci", historial: entrada(-2, "Conci") },
    { codigo: "T-0240", material: "Tela para trapos", kg: 64.5, ubicacion: "Estante A2", entro: diaIso(-12), empresa: "Naranja X", historial: entrada(-12, "Naranja X") },
    { codigo: "D-0120", material: "Uniformes para desmarcar", kg: 38.0, ubicacion: "Estante B1", entro: diaIso(-6), empresa: "Holcim", historial: entrada(-6, "Holcim") },
    { codigo: "B-0051", material: "Lienzo para bolsas", kg: 22.3, ubicacion: "Estante C3", entro: diaIso(-15), empresa: "Hiper Libertad", historial: entrada(-15, "Hiper Libertad") },
    { codigo: "B-0049", material: "Lienzo para bolsas", kg: 31.0, ubicacion: "Estante C2", entro: diaIso(-20), empresa: "Conci", historial: entrada(-20, "Conci") },
    { codigo: "X-0017", material: "Textil para desbastado", kg: 90.0, ubicacion: "Piso, sector D", entro: diaIso(-25), empresa: "Naranja X", historial: entrada(-25, "Naranja X") }
  ];
  var CLAVE_DEPOSITO = "omas-deposito-prueba-2";
  function depositoPrueba(){ return guardado(CLAVE_DEPOSITO) || JSON.parse(JSON.stringify(FARDOS_EJEMPLO)); }
  function guardarDepositoPrueba(lista){ try { sessionStorage.setItem(CLAVE_DEPOSITO, JSON.stringify(lista)); } catch(e){} }

  // El próximo código de cada letra. En el sistema real lo da la API (así no se repite entre celulares).
  var CLAVE_CODIGOS = "omas-codigos-prueba";
  function codigoNuevoPrueba(letra){
    var proximos = guardado(CLAVE_CODIGOS) || { F: 88, D: 121, T: 241, M: 34, B: 52, X: 18, Z: 9, S: 6 };
    var codigo = letra + "-" + String(proximos[letra] || 1).padStart(4, "0");
    proximos[letra] = (proximos[letra] || 1) + 1;
    try { sessionStorage.setItem(CLAVE_CODIGOS, JSON.stringify(proximos)); } catch(e){}
    return codigo;
  }

  async function listarFardos(material){
    if(!CONFIG.modoPrototipo) return pedir("/fardos" + (material ? "?material=" + encodeURIComponent(material) : ""), { method: "GET" });
    await esperar(200);
    return depositoPrueba().filter(function(f){ return f.kg > 0 && (!material || f.material === material); });
  }

  /* Mover un fardo a otra sección (o clasificar uno "Sin clasificar").
     Todo el fardo: conserva el código y cambia de sección (no hay que volver a etiquetarlo).
     Una parte: sale un fardo nuevo, con su propio código, porque físicamente es otra bolsa.
     A Descarte: esos kilos salen del depósito. Cada movimiento queda en el historial del fardo. */
  var movimientos = {}; // los recién hechos, para poder deshacerlos
  function redondear(n){ return Math.round(n * 100) / 100; }
  function kgTexto(n){ return n.toLocaleString("es-AR", { maximumFractionDigits: 2 }) + " kg"; }
  async function moverFardo(codigo, destino, kg){
    if(!CONFIG.modoPrototipo) return pedir("/fardos/" + encodeURIComponent(codigo) + "/mover", { method: "POST", body: JSON.stringify({ destino: destino, kg: kg }) });
    await esperar(250);
    var u = guardado("omas-sesion-prueba");
    if(!u) throw new ErrorApi("credenciales", "Tu sesión se cerró. Volvé a ingresar.");
    var deposito = depositoPrueba(), f = deposito.filter(function(x){ return x.codigo === codigo; })[0];
    var hacia = SECCIONES_DEPOSITO.filter(function(s){ return s.id === destino; })[0];
    if(!f || f.kg <= 0) throw new ErrorApi("servidor", "Ese fardo ya no está en el depósito.");
    if(!hacia) throw new ErrorApi("servidor", "Elegí a qué sección va.");
    if(hacia.material === f.material) throw new ErrorApi("servidor", "El fardo ya está en " + hacia.nombre + ".");
    kg = redondear(kg);
    if(!(kg > 0)) throw new ErrorApi("servidor", "Poné cuántos kilos movés.");
    if(kg > f.kg + 0.05) throw new ErrorApi("servidor", "El fardo " + codigo + " tiene " + kgTexto(f.kg) + ": no se puede mover más que eso.");

    var ahora = new Date().toISOString(), todo = kg >= f.kg - 0.05, nuevo = null;
    var mov = { id: "m" + Date.now(), codigo: codigo, materialAntes: f.material, kgAntes: f.kg, nuevo: null };
    if(todo && hacia.sale){
      f.historial.push({ fecha: ahora, texto: "Fue entero a " + hacia.nombre + " (" + kgTexto(f.kg) + ")", por: u.nombre });
      kg = f.kg; f.kg = 0;
    } else if(todo){
      f.historial.push({ fecha: ahora, texto: "Pasó entero de " + seccionDe(f.material).nombre + " a " + hacia.nombre, por: u.nombre });
      f.material = hacia.material; kg = f.kg;
    } else {
      f.kg = redondear(f.kg - kg);
      if(!hacia.sale){
        nuevo = { codigo: codigoNuevoPrueba(hacia.letra), material: hacia.material, kg: kg, ubicacion: f.ubicacion,
          entro: f.entro, empresa: f.empresa, historial: [{ fecha: ahora, texto: "Salió del fardo " + codigo + " (" + seccionDe(mov.materialAntes).nombre + ")", por: u.nombre }] };
        deposito.push(nuevo); mov.nuevo = nuevo.codigo;
      }
      f.historial.push({ fecha: ahora, texto: "Salieron " + kgTexto(kg) + " a " + hacia.nombre + (nuevo ? " (" + nuevo.codigo + ")" : ""), por: u.nombre });
    }
    guardarDepositoPrueba(deposito);
    movimientos[mov.id] = mov;
    return { movimiento: mov.id, origen: f, nuevo: nuevo, kg: kg, destino: hacia.nombre };
  }
  // Deshace un movimiento recién hecho: el fardo vuelve como estaba y el nuevo (si salió uno) se borra
  async function deshacerMovimiento(id){
    if(!CONFIG.modoPrototipo) return pedir("/fardos/movimientos/" + encodeURIComponent(id), { method: "DELETE" });
    await esperar(200);
    var mov = movimientos[id];
    if(!mov) throw new ErrorApi("servidor", "Ese movimiento ya no se puede deshacer.");
    var deposito = depositoPrueba(), f = deposito.filter(function(x){ return x.codigo === mov.codigo; })[0];
    if(mov.nuevo){
      deposito = deposito.filter(function(x){ return x.codigo !== mov.nuevo; });
      // Si nadie usó otro código después, el número vuelve a quedar libre
      var letra = mov.nuevo.charAt(0), numero = +mov.nuevo.slice(2), proximos = guardado(CLAVE_CODIGOS);
      if(proximos && proximos[letra] === numero + 1){ proximos[letra] = numero; try { sessionStorage.setItem(CLAVE_CODIGOS, JSON.stringify(proximos)); } catch(e){} }
    }
    f.material = mov.materialAntes; f.kg = mov.kgAntes; f.historial.pop();
    guardarDepositoPrueba(deposito);
    delete movimientos[id];
    return null;
  }

  /* ----- Taller textil: pedidos de clientes -----
     Recorrido: el pedido entra solo (bot de WhatsApp, Gmail o el formulario del sitio) → queda en la bandeja →
     Administración lo acepta, lo rechaza o pide más datos → el taller pide el lienzo al depósito →
     se reparte entre las operarias (cada una hace la bolsa entera) → se registran las terminadas →
     se entrega con remito, en una o varias veces. El plazo suele ser de hasta dos semanas.
     PROTOTIPO: los pedidos son de ejemplo y el bot está simulado (simularPedidoEntrante). */
  function diaIso(n){ var d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); }
  function haceHoras(h){ return new Date(Date.now() - h * 36e5).toISOString(); }
  // Nombres INVENTADOS (el repositorio es público)
  var OPERARIAS_TALLER = ["Ana Ríos", "Bea Molina", "Carmen Díaz", "Dora Paz", "Elena Sosa", "Flor Luna"];
  var PEDIDOS_EJEMPLO = [
    { id: "p1", numero: "P-0131", canal: "whatsapp", recibido: haceHoras(2), cliente: "Muta Objetos", producto: "Bolsas a medida", medida: "20 × 25 cm",
      cantidad: 3000, entrega: diaIso(14), ordenCompra: "", estado: "nuevo",
      mensaje: "Hola! Necesitamos 3000 bolsitas de lienzo de 20x25 como las del mes pasado, para dentro de dos semanas. Gracias!" },
    { id: "p2", numero: "P-0130", canal: "gmail", recibido: haceHoras(5), cliente: "Coca-Cola · Planta Córdoba", producto: "Bolsas de lienzo con logo", medida: "35 × 40 cm",
      cantidad: 1000, entrega: diaIso(12), ordenCompra: "4500123", estado: "nuevo",
      mensaje: "Asunto: Orden de compra 4500123\nBuen día, adjuntamos la OC por 1.000 bolsas de lienzo 35x40 con logo para las visitas a planta. Saludos, Compras." },
    { id: "p3", numero: "P-0129", canal: "web", recibido: haceHoras(26), cliente: "Estampados del Centro", producto: "Bolsas de lienzo lisas", medida: "30 × 40 cm",
      cantidad: 5000, entrega: diaIso(16), ordenCompra: "", estado: "masDatos", consulta: "¿Las quieren con manija larga o corta?",
      mensaje: "Formulario del sitio: 5000 bolsas lisas 30x40 para estampar. Somos imprenta, las necesitamos en 2 semanas aprox." },
    { id: "p4", numero: "P-0127", canal: "gmail", recibido: haceHoras(24 * 6), cliente: "Coca-Cola · Visitas", producto: "Bolsas de lienzo con logo", medida: "35 × 40 cm",
      cantidad: 1000, entrega: diaIso(4), ordenCompra: "4500098", estado: "aceptado",
      mensaje: "Asunto: OC 4500098 · 1.000 bolsas 35x40 con logo.",
      material: [{ fardo: "B-0047", kg: 14 }],
      reparto: [{ operaria: "Ana Ríos", asignadas: 400, terminadas: 260 }, { operaria: "Bea Molina", asignadas: 300, terminadas: 180 }, { operaria: "Carmen Díaz", asignadas: 300, terminadas: 60 }],
      entregas: [] },
    { id: "p5", numero: "P-0125", canal: "whatsapp", recibido: haceHoras(24 * 9), cliente: "Emprendimiento Raíz (regalos)", producto: "Bolsas de lienzo lisas", medida: "25 × 30 cm",
      cantidad: 150, entrega: diaIso(1), ordenCompra: "", estado: "aceptado",
      mensaje: "Hola, quería 150 bolsitas lisas 25x30 para regalos empresariales.",
      material: [{ fardo: "B-0046", kg: 3 }],
      reparto: [{ operaria: "Dora Paz", asignadas: 150, terminadas: 150 }],
      entregas: [{ fecha: diaIso(-1), cantidad: 100, remito: "0001-00000412" }] },
    { id: "p6", numero: "P-0119", canal: "web", recibido: haceHoras(24 * 20), cliente: "Estampados del Centro", producto: "Bolsas de lienzo lisas", medida: "30 × 40 cm",
      cantidad: 4000, entrega: diaIso(-5), ordenCompra: "", estado: "aceptado",
      mensaje: "Formulario del sitio: 4000 bolsas lisas 30x40.",
      material: [{ fardo: "B-0040", kg: 52 }],
      reparto: [{ operaria: "Elena Sosa", asignadas: 2000, terminadas: 2000 }, { operaria: "Flor Luna", asignadas: 2000, terminadas: 2000 }],
      entregas: [{ fecha: diaIso(-6), cantidad: 4000, remito: "0001-00000398" }] }
  ];
  var CLAVE_PEDIDOS = "omas-pedidos-prueba";
  function pedidosPrueba(){ return guardado(CLAVE_PEDIDOS) || JSON.parse(JSON.stringify(PEDIDOS_EJEMPLO)); }
  function guardarPedidosPrueba(lista){ try { sessionStorage.setItem(CLAVE_PEDIDOS, JSON.stringify(lista)); } catch(e){} }

  // Quién puede qué: aceptar o rechazar es de Administración; organizar la producción, de la coordinación
  async function rolPedidos(roles, texto){
    await esperar(300);
    var u = guardado("omas-sesion-prueba");
    if(!u || roles.indexOf(u.rol) < 0) throw new ErrorApi("permiso", texto);
    return u;
  }
  var ORGANIZAN = ["Administración", "Coordinadora", "Supervisión"];
  function pedidoDe(lista, id){
    var p = lista.filter(function(x){ return x.id === id; })[0];
    if(!p) throw new ErrorApi("servidor", "No encontramos ese pedido.");
    return p;
  }
  function sumar(lista, campo){ return (lista || []).reduce(function(s, x){ return s + x[campo]; }, 0); }

  async function listarPedidos(){
    if(!CONFIG.modoPrototipo) return pedir("/pedidos", { method: "GET" });
    await esperar(250);
    return pedidosPrueba();
  }
  async function listarOperariasTaller(){
    if(!CONFIG.modoPrototipo) return pedir("/operarias?unidad=taller", { method: "GET" });
    return OPERARIAS_TALLER.slice();
  }

  // Solo para la demostración: así llegaría un pedido que arma el bot a partir de un WhatsApp
  var EJEMPLOS_BOT = [
    { cliente: "Librería El Ombú", producto: "Bolsas de lienzo con logo", medida: "30 × 35 cm", cantidad: 500, dias: 10,
      mensaje: "Buenas! Queremos 500 bolsas de lienzo 30x35 con nuestro logo para el día del libro. ¿Llegan en 10 días?" },
    { cliente: "Café Molienda", producto: "Bolsas a medida", medida: "15 × 20 cm", cantidad: 800, dias: 12,
      mensaje: "Hola, necesitamos 800 bolsitas de 15x20 para café en grano, sin logo." }
  ];
  async function simularPedidoEntrante(){
    var lista = pedidosPrueba(), e = EJEMPLOS_BOT[lista.length % EJEMPLOS_BOT.length];
    var ultimo = Math.max.apply(null, lista.map(function(p){ return +p.numero.slice(2); }));
    var nuevo = { id: "p" + Date.now(), numero: "P-" + String(ultimo + 1).padStart(4, "0"), canal: "whatsapp", recibido: new Date().toISOString(),
      cliente: e.cliente, producto: e.producto, medida: e.medida, cantidad: e.cantidad, entrega: diaIso(e.dias), ordenCompra: "", estado: "nuevo", mensaje: e.mensaje };
    lista.unshift(nuevo); guardarPedidosPrueba(lista);
    return nuevo;
  }

  // accion: "aceptar" | "rechazar" (con motivo) | "masDatos" (con la pregunta para el cliente)
  async function responderPedido(id, accion, texto){
    if(!CONFIG.modoPrototipo) return pedir("/pedidos/" + encodeURIComponent(id) + "/respuesta", { method: "POST", body: JSON.stringify({ accion: accion, texto: texto || "" }) });
    await rolPedidos(["Administración"], "Solo Administración acepta o rechaza los pedidos.");
    var lista = pedidosPrueba(), p = pedidoDe(lista, id);
    if(accion === "aceptar"){ p.estado = "aceptado"; p.material = []; p.reparto = []; p.entregas = []; }
    if(accion === "rechazar"){ p.estado = "rechazado"; p.motivo = texto; }
    if(accion === "masDatos"){ p.estado = "masDatos"; p.consulta = texto; }
    guardarPedidosPrueba(lista);
    return p;
  }

  // El taller le pide lienzo al depósito: se descuenta del fardo
  async function pedirMaterial(id, fardo, kg){
    if(!CONFIG.modoPrototipo) return pedir("/pedidos/" + encodeURIComponent(id) + "/material", { method: "POST", body: JSON.stringify({ fardo: fardo, kg: kg }) });
    await rolPedidos(ORGANIZAN, "Solo la coordinación pide material al depósito.");
    var deposito = depositoPrueba(), f = deposito.filter(function(x){ return x.codigo === fardo; })[0];
    if(!f) throw new ErrorApi("servidor", "Ese fardo ya no está en el depósito.");
    if(kg > f.kg + 0.05) throw new ErrorApi("servidor", "El fardo " + fardo + " tiene " + f.kg.toLocaleString("es-AR") + " kg: no alcanza.");
    f.kg = Math.round((f.kg - kg) * 100) / 100; guardarDepositoPrueba(deposito);
    var lista = pedidosPrueba(), p = pedidoDe(lista, id);
    p.material.push({ fardo: fardo, kg: kg }); guardarPedidosPrueba(lista);
    return p;
  }

  async function asignarTrabajo(id, operaria, cantidad){
    if(!CONFIG.modoPrototipo) return pedir("/pedidos/" + encodeURIComponent(id) + "/reparto", { method: "POST", body: JSON.stringify({ operaria: operaria, cantidad: cantidad }) });
    await rolPedidos(ORGANIZAN, "Solo la coordinación reparte el trabajo.");
    var lista = pedidosPrueba(), p = pedidoDe(lista, id);
    var libres = p.cantidad - sumar(p.reparto, "asignadas");
    if(cantidad > libres) throw new ErrorApi("servidor", "Quedan " + libres + " bolsas sin repartir.");
    var r = p.reparto.filter(function(x){ return x.operaria === operaria; })[0];
    if(r) r.asignadas += cantidad; else p.reparto.push({ operaria: operaria, asignadas: cantidad, terminadas: 0 });
    guardarPedidosPrueba(lista);
    return p;
  }

  async function registrarTerminadas(id, operaria, cantidad){
    if(!CONFIG.modoPrototipo) return pedir("/pedidos/" + encodeURIComponent(id) + "/terminadas", { method: "POST", body: JSON.stringify({ operaria: operaria, cantidad: cantidad }) });
    await rolPedidos(ORGANIZAN, "Solo la coordinación registra lo terminado.");
    var lista = pedidosPrueba(), p = pedidoDe(lista, id), r = p.reparto.filter(function(x){ return x.operaria === operaria; })[0];
    if(!r) throw new ErrorApi("servidor", "Esa operaria no tiene bolsas de este pedido.");
    if(r.terminadas + cantidad > r.asignadas) throw new ErrorApi("servidor", "Tiene " + (r.asignadas - r.terminadas) + " bolsas por terminar, no más.");
    r.terminadas += cantidad; guardarPedidosPrueba(lista);
    return p;
  }

  async function registrarEntrega(id, cantidad, remito){
    if(!CONFIG.modoPrototipo) return pedir("/pedidos/" + encodeURIComponent(id) + "/entregas", { method: "POST", body: JSON.stringify({ cantidad: cantidad, remito: remito }) });
    await rolPedidos(ORGANIZAN, "Solo la coordinación registra las entregas.");
    var lista = pedidosPrueba(), p = pedidoDe(lista, id);
    var listas = sumar(p.reparto, "terminadas") - sumar(p.entregas, "cantidad");
    if(cantidad > listas) throw new ErrorApi("servidor", "Hay " + listas + " bolsas terminadas para entregar.");
    p.entregas.push({ fecha: diaIso(0), cantidad: cantidad, remito: remito }); guardarPedidosPrueba(lista);
    return p;
  }

  /* ----- Usuarios (CRUD) -----
     Solo Administración crea, edita y da de baja cuentas. La baja es lógica: la cuenta queda
     guardada (para saber quién hizo cada registro) pero ya no puede ingresar. */
  var ROLES = ["Administración", "Coordinadora", "Supervisión", "Depósito"];

  async function soloAdministracion(){
    await esperar(350);
    var u = guardado("omas-sesion-prueba");
    if(!u || u.rol !== "Administración") throw new ErrorApi("servidor", "Solo Administración puede manejar las cuentas.");
    return u;
  }
  // Clave temporal fácil de dictar: sin letras que se confunden (l, 1, o, 0)
  function claveTemporal(){
    var letras = "abcdefghjkmnpqrstuvwxyz23456789", n = new Uint32Array(8), s = "";
    crypto.getRandomValues(n);
    for(var i = 0; i < 8; i++) s += letras[n[i] % letras.length] + (i === 3 ? "-" : "");
    return s;
  }
  function buscarCuenta(lista, id){
    var u = lista.filter(function(x){ return x.id === id; })[0];
    if(!u) throw new ErrorApi("servidor", "No encontramos esa cuenta.");
    return u;
  }

  async function listarUsuarios(){
    if(!CONFIG.modoPrototipo) return pedir("/usuarios", { method: "GET" });
    await soloAdministracion();
    return usuariosPrueba().map(publico);
  }

  async function crearUsuario(datos){
    var nueva = { nombre: datos.nombre.trim(), usuario: datos.usuario.trim().toLowerCase(), rol: datos.rol };
    if(!CONFIG.modoPrototipo) return pedir("/usuarios", { method: "POST", body: JSON.stringify(nueva) });
    await soloAdministracion();
    var lista = usuariosPrueba();
    if(lista.some(function(x){ return x.usuario === nueva.usuario; })) throw new ErrorApi("repetido", "Ya hay una cuenta con ese usuario. Probá con otro.");
    var clave = claveTemporal();
    var cuenta = Object.assign({ id: "u" + Date.now(), activo: true, alta: new Date().toISOString().slice(0, 10), clave: clave }, nueva);
    lista.push(cuenta); guardarUsuariosPrueba(lista);
    return { usuario: publico(cuenta), claveTemporal: clave };
  }

  async function actualizarUsuario(id, datos){
    var cambios = { nombre: datos.nombre.trim(), rol: datos.rol };
    if(!CONFIG.modoPrototipo) return pedir("/usuarios/" + encodeURIComponent(id), { method: "PUT", body: JSON.stringify(cambios) });
    var yo = await soloAdministracion();
    if(id === yo.id && cambios.rol !== "Administración") throw new ErrorApi("servidor", "No podés sacarte el rol de Administración a vos misma.");
    var lista = usuariosPrueba(), u = buscarCuenta(lista, id);
    Object.assign(u, cambios); guardarUsuariosPrueba(lista);
    return publico(u);
  }

  async function restablecerClave(id){
    if(!CONFIG.modoPrototipo) return pedir("/usuarios/" + encodeURIComponent(id) + "/clave", { method: "POST" });
    await soloAdministracion();
    var lista = usuariosPrueba(), u = buscarCuenta(lista, id);
    u.clave = claveTemporal(); guardarUsuariosPrueba(lista);
    return { claveTemporal: u.clave };
  }

  // activa = false → baja lógica · activa = true → la vuelve a activar
  async function cambiarAltaUsuario(id, activa){
    if(!CONFIG.modoPrototipo){
      return pedir("/usuarios/" + encodeURIComponent(id) + (activa ? "/alta" : ""), { method: activa ? "PUT" : "DELETE" });
    }
    var yo = await soloAdministracion();
    if(!activa && id === yo.id) throw new ErrorApi("servidor", "No podés darte de baja a vos misma.");
    var lista = usuariosPrueba(), u = buscarCuenta(lista, id);
    u.activo = activa; guardarUsuariosPrueba(lista);
    return null;
  }

  return {
    modoPrototipo: CONFIG.modoPrototipo,
    ROLES: ROLES,
    depositoPrueba: depositoPrueba,
    guardarDepositoPrueba: guardarDepositoPrueba,
    listarFardos: listarFardos,
    SECCIONES_DEPOSITO: SECCIONES_DEPOSITO,
    codigoNuevoPrueba: codigoNuevoPrueba,
    moverFardo: moverFardo,
    deshacerMovimiento: deshacerMovimiento,
    listarPedidos: listarPedidos,
    listarOperariasTaller: listarOperariasTaller,
    simularPedidoEntrante: simularPedidoEntrante,
    responderPedido: responderPedido,
    pedirMaterial: pedirMaterial,
    asignarTrabajo: asignarTrabajo,
    registrarTerminadas: registrarTerminadas,
    registrarEntrega: registrarEntrega,
    listarUsuarios: listarUsuarios,
    crearUsuario: crearUsuario,
    actualizarUsuario: actualizarUsuario,
    restablecerClave: restablecerClave,
    cambiarAltaUsuario: cambiarAltaUsuario,
    iniciarSesion: iniciarSesion,
    usuarioActual: usuarioActual,
    cerrarSesion: cerrarSesion,
    exigirSesion: exigirSesion,
    listarTalleres: listarTalleres,
    crearTaller: crearTaller,
    actualizarTaller: actualizarTaller,
    cambiarAltaTaller: cambiarAltaTaller,
    TIPOS_TALLER: TIPOS_TALLER,
    TALLERES_FOTOS: TALLERES_FOTOS,
    textoFecha: textoFecha,
    yaPaso: yaPaso,
    inscribirTaller: inscribirTaller,
    listarInscripciones: listarInscripciones
  };
})();
