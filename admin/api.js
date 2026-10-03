/* ===== SGI-OMAS · Cliente de la API =====
   Todas las pantallas del panel hablan con la API (ASP.NET Core en .NET 10 + SQL Server)
   solo a través de este archivo. Cuando la API esté lista, alcanza con poner
   modoPrototipo en false: las pantallas no cambian.

   Contrato que tiene que cumplir la API (lo usan las pantallas):
     POST /api/auth/login   { usuario, clave }
                            200 { id, nombre, rol } y deja la cookie de sesión (HttpOnly, Secure, SameSite=Strict).
                            La cookie NO es persistente: se borra al cerrar el navegador. No hay "recordarme".
                            401 usuario o contraseña incorrectos · 423 cuenta bloqueada por intentos
     POST /api/auth/logout  204, borra la cookie
     GET  /api/auth/yo      200 { id, nombre, rol } si hay sesión · 401 si no

     GET  /api/talleres     200 [{ id, nombre, tipo, img, desc, cuando }]
                            PÚBLICO (sin sesión): lo usa también la página Talleres del sitio.
     PUT  /api/talleres/{id}/fecha  cuando
                            200 el taller actualizado · solo Coordinadora y Supervisión (403 para Depósito).
                            Solo se edita la fecha: nombre, foto y descripción quedan fijos.
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
                            Solo Coordinadora y Supervisión (403 para Depósito): son datos personales.

   No hay registro público: las cuentas las crea la coordinación desde el sistema
   (por ejemplo POST /api/usuarios, solo para el rol Coordinadora).

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
    if(!respuesta.ok) throw new ErrorApi("servidor", MENSAJES.servidor);
    return respuesta.status === 204 ? null : respuesta.json();
  }

  /* ----- Simulación para el prototipo (se borra cuando exista la API) ----- */
  var USUARIOS_PRUEBA = {
    laura: { id: "laura", nombre: "Laura", rol: "Coordinadora" },
    sandra: { id: "sandra", nombre: "Sandra", rol: "Supervisión" },
    florencia: { id: "florencia", nombre: "Florencia", rol: "Depósito" }
  };
  var CLAVE_PRUEBA = "omas2026";
  var MAX_INTENTOS = 5;

  // Solo sessionStorage: se borra al cerrar la pestaña. Nunca localStorage, para que no quede nadie guardado.
  function guardado(clave){
    try { return JSON.parse(sessionStorage.getItem(clave)); } catch(e){ return null; }
  }
  function esperar(ms){ return new Promise(function(r){ setTimeout(r, ms); }); }

  async function loginPrueba(usuario, clave){
    await esperar(700);
    var intentos = 0;
    try { intentos = +sessionStorage.getItem("omas-intentos") || 0; } catch(e){}
    if(intentos >= MAX_INTENTOS) throw new ErrorApi("bloqueada", MENSAJES.bloqueada);
    var u = USUARIOS_PRUEBA[usuario.trim().toLowerCase()];
    if(!u || clave !== CLAVE_PRUEBA){
      try { sessionStorage.setItem("omas-intentos", intentos + 1); } catch(e){}
      throw new ErrorApi("credenciales", MENSAJES.credenciales);
    }
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

  /* ----- Talleres -----
     Los talleres no tienen días fijos: la coordinación les cambia la fecha desde el panel
     y el sitio público la muestra. Nombre, foto y descripción no se editan.
     PROTOTIPO: datos de ejemplo. Los cambios se guardan en sessionStorage, así que se ven
     en el sitio solo si se abre en la MISMA pestaña. Con la API se ven en cualquier lado. */
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
  // "-2": antes la fecha se guardaba como texto; así no se mezcla con lo guardado en ese formato
  var CLAVE_TALLERES = "omas-talleres-prueba-2";

  async function listarTalleres(){
    if(!CONFIG.modoPrototipo) return pedir("/talleres", { method: "GET" });
    var cambios = guardado(CLAVE_TALLERES) || {};
    return TALLERES_EJEMPLO.map(function(t){ return Object.assign({}, t, cambios[t.id] ? { cuando: cambios[t.id] } : null); });
  }

  // Deja solo los campos que corresponden a cada modo
  function limpiarCuando(c){
    if(c.modo === "semanal") return { modo: "semanal", dias: c.dias.slice().sort(), desde: c.desde, hasta: c.hasta };
    if(c.modo === "puntual") return { modo: "puntual", fecha: c.fecha, desde: c.desde, hasta: c.hasta };
    return { modo: "aConfirmar" };
  }

  async function guardarFechaTaller(id, cuando){
    var datos = limpiarCuando(cuando);
    if(!CONFIG.modoPrototipo){
      return pedir("/talleres/" + encodeURIComponent(id) + "/fecha", { method: "PUT", body: JSON.stringify(datos) });
    }
    await esperar(400);
    var u = guardado("omas-sesion-prueba");
    if(!u || u.rol === "Depósito") throw new ErrorApi("servidor", "Solo la coordinación y la supervisión pueden cambiar las fechas.");
    var cambios = guardado(CLAVE_TALLERES) || {};
    cambios[id] = datos;
    try { sessionStorage.setItem(CLAVE_TALLERES, JSON.stringify(cambios)); } catch(e){}
    var base = TALLERES_EJEMPLO.filter(function(t){ return t.id === id; })[0];
    return Object.assign({}, base, { cuando: datos });
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

  return {
    modoPrototipo: CONFIG.modoPrototipo,
    iniciarSesion: iniciarSesion,
    usuarioActual: usuarioActual,
    cerrarSesion: cerrarSesion,
    exigirSesion: exigirSesion,
    listarTalleres: listarTalleres,
    guardarFechaTaller: guardarFechaTaller,
    textoFecha: textoFecha,
    yaPaso: yaPaso,
    inscribirTaller: inscribirTaller,
    listarInscripciones: listarInscripciones
  };
})();
