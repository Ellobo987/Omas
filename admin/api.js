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

   No hay registro público: las cuentas las crea la coordinación desde el sistema
   (por ejemplo POST /api/usuarios, solo para el rol Coordinadora). */
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

  return {
    modoPrototipo: CONFIG.modoPrototipo,
    iniciarSesion: iniciarSesion,
    usuarioActual: usuarioActual,
    cerrarSesion: cerrarSesion,
    exigirSesion: exigirSesion
  };
})();
