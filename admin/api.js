/* ===== SGI-OMAS · Cliente de la API =====
   Todas las pantallas del panel hablan con la API (api/LasOmasApi: ASP.NET Core .NET 8 + EF Database First
   + SQL Server, base LasOmas) solo a través de este archivo.

   El panel se abre desde la misma API (https://localhost:7122/admin/...): así la cookie de sesión viaja sola.

   QUÉ VA A LA BASE Y QUÉ NO
   El modelo de la base (corregido por el profesor) tiene Usuario, Rol, EmpresaDonante, IngresoDonacion,
   Bulto, CategoriaTela y Estado. Eso va a la API: sesión, usuarios, empresas, donaciones y stock.
   Talleres, inscripciones, pedidos del Taller textil y los lotes de las costureras NO tienen tablas:
   siguen simulados en el navegador (sessionStorage) hasta que el modelo los incluya (ver MODULOS_CON_API).

   Contrato de la API (lo que usan las pantallas):
     POST /api/auth/login   { usuario (el email), clave } → 200 { id, nombre, rol } y deja la cookie de sesión
                            (HttpOnly, Secure, SameSite=Strict, no persistente) · 401 datos incorrectos · 423 bloqueada
     POST /api/auth/logout  204 · GET /api/auth/yo → 200 { id, nombre, rol } · 401 sin sesión
     POST /api/auth/clave   { claveActual, claveNueva (8 o más) } → 204 · 400 actual incorrecta · 423 bloqueada

     Usuarios (CRUD, solo Administración):
     GET  /api/usuarios → [{ id, nombre, apellido, email, telefono, rol, activo }]
     POST /api/usuarios { nombre, apellido, email, telefono?, rol } → 201 { usuario, claveTemporal } · 409 email repetido
     PUT  /api/usuarios/{id} { nombre, apellido, telefono?, rol } · POST /api/usuarios/{id}/clave → { claveTemporal }
     DELETE /api/usuarios/{id} 204 baja lógica (Activo_SN = 0) · PUT /api/usuarios/{id}/alta 204

     Empresas donantes (CRUD): GET/POST /api/empresas · GET/PUT/DELETE /api/empresas/{id}
       { razonSocial, cuit (11 números), telefono?, email? } · 409 CUIT repetido o empresa con donaciones

     Donaciones (proceso): POST /api/donaciones { idEmpresa, numeroRemito, bultos: [{ pesoKg, idCategoria, color?, descartado? }] }
       → 201 la donación con sus bultos · 409 remito repetido para esa empresa · GET /api/donaciones
     Stock: GET /api/bultos (los que están "En depósito") · GET /api/bultos/{id} · GET /api/stock
       PUT /api/bultos/{id}/categoria { idCategoria } (mover entero) · POST /api/bultos/{id}/dividir { pesoKg, idCategoria }
       PUT /api/bultos/{id}/estado { idEstado } (Retirado / Descartado / En depósito)
     Catálogos: GET /api/categorias · GET /api/estados · GET /api/roles

   No hay registro público: las cuentas las crea Administración desde la pantalla Usuarios.
   Este archivo lo carga también talleres.html del sitio público, solo para leer los talleres. */
/* Live Server abre en 127.0.0.1, pero para el navegador 127.0.0.1 y localhost son sitios distintos
   y la cookie de sesión no viajaría a la API (localhost:5201). Se pasa solo a localhost. */
if(location.hostname === "127.0.0.1" && location.port === "5500") location.replace(location.href.replace("//127.0.0.1", "//localhost"));

window.OmasApi = (function(){
  "use strict";

  var CONFIG = {
    // La API se publica en el mismo dominio que el panel, así la cookie de sesión viaja sola
    // Abierto desde la API (o publicado): la API está en el mismo lugar → "/api".
    // Abierto con Live Server (puerto 5500): la API corre aparte en la compu → http://localhost:5201/api.
    base: location.port === "5500" ? "http://localhost:5201/api" : "/api",
    // true: todo simulado en el navegador, sin API (para mostrar el prototipo sin prender nada)
    modoPrototipo: false
  };
  // Los módulos que tienen tablas en la base. El resto queda simulado aunque modoPrototipo sea false.
  var MODULOS_CON_API = ["sesion", "usuarios", "deposito"];
  function usaApi(modulo){ return !CONFIG.modoPrototipo && MODULOS_CON_API.indexOf(modulo) >= 0; }

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
    if(respuesta.status === 401) throw new ErrorApi("credenciales", ruta === "/auth/login" ? MENSAJES.credenciales : "Tu sesión se cerró. Volvé a ingresar.");
    if(respuesta.status === 423) throw new ErrorApi("bloqueada", MENSAJES.bloqueada);
    if(respuesta.status === 403) throw new ErrorApi("permiso", "No tenés permiso para hacer esto.");
    if(!respuesta.ok){
      // La API explica qué pasó: { mensaje } o, si un dato está mal, { errors: { Campo: ["…"] } }
      var texto = await mensajeDeError(respuesta);
      if(respuesta.status === 409) throw new ErrorApi("repetido", texto || "Ya existe un registro con esos datos.");
      if(respuesta.status === 400 || respuesta.status === 404) throw new ErrorApi("datos", texto || "Revisá los datos.");
      throw new ErrorApi("servidor", MENSAJES.servidor);
    }
    return respuesta.status === 204 ? null : respuesta.json();
  }
  async function mensajeDeError(respuesta){
    try {
      var cuerpo = await respuesta.json();
      if(cuerpo.mensaje) return cuerpo.mensaje;
      if(cuerpo.errors){
        // El primer error de validación que esté escrito en castellano (los de .NET vienen en inglés)
        var todos = Object.keys(cuerpo.errors).reduce(function(l, k){ return l.concat(cuerpo.errors[k]); }, []);
        return todos.filter(function(t){ return !/^The |could not be converted/.test(t); })[0] || "";
      }
    } catch(e){}
    return "";
  }

  /* ----- Simulación para el prototipo (se borra cuando exista la API) ----- */
  /* Cuentas de prueba. La pantalla Usuarios agrega, edita y da de baja sobre esta misma lista
     (guardada en sessionStorage), así las cuentas nuevas también pueden ingresar.
     PROTOTIPO: la clave queda en texto solo acá; la API real guarda un hash. */
  var CLAVE_PRUEBA = "omas2026";
  var USUARIOS_EJEMPLO = [
    { id: "laura", nombre: "Laura", usuario: "laura@lasomas.test", rol: "Coordinadora", activo: true, alta: "2025-03-10", clave: CLAVE_PRUEBA },
    { id: "sandra", nombre: "Sandra", usuario: "sandra@lasomas.test", rol: "Administración", activo: true, alta: "2025-03-10", clave: CLAVE_PRUEBA },
    { id: "florencia", nombre: "Florencia", usuario: "florencia@lasomas.test", rol: "Depósito", activo: true, alta: "2025-04-02", clave: CLAVE_PRUEBA },
    { id: "ejemplo-baja", nombre: "Usuaria de ejemplo", usuario: "ejemplo@lasomas.test", rol: "Depósito", activo: false, alta: "2025-05-20", clave: CLAVE_PRUEBA }
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
  // El id se guarda siempre como texto: la API lo manda como número y las pantallas lo comparan como texto
  function recordarUsuario(u){
    u.id = String(u.id);
    try { sessionStorage.setItem("omas-usuario", JSON.stringify(u)); } catch(e){}
    return u;
  }
  // Quién ingresó, para los módulos que todavía se simulan (talleres, pedidos): sirve en los dos modos
  function sesionGuardada(){ return guardado("omas-sesion-prueba") || guardado("omas-usuario"); }

  async function iniciarSesion(usuario, clave){
    var u = usaApi("sesion")
      ? await pedir("/auth/login", { method: "POST", body: JSON.stringify({ usuario: usuario, clave: clave }) })
      : await loginPrueba(usuario, clave);
    return recordarUsuario(u);
  }

  async function usuarioActual(){
    if(!usaApi("sesion")) return sesionGuardada();
    try { return recordarUsuario(await pedir("/auth/yo", { method: "GET" })); }
    catch(e){ if(e.tipo === "credenciales") return null; throw e; }
  }

  // Por defecto lleva al ingreso; con { redirigir: false } solo cierra (lo usa la pantalla de ingreso)
  async function cerrarSesion(opciones){
    try {
      sessionStorage.removeItem("omas-usuario");
      sessionStorage.removeItem("omas-sesion-prueba");
      localStorage.removeItem("omas-sesion-prueba"); // por si quedó de una versión anterior
    } catch(e){}
    if(usaApi("sesion")){ try { await pedir("/auth/logout", { method: "POST" }); } catch(e){} }
    if(!opciones || opciones.redirigir !== false) location.href = "ingresar.html";
  }

  // Cambiar la propia contraseña (POST /api/auth/clave). Error "datos" si la actual no es correcta.
  async function cambiarClave(actual, nueva){
    if(usaApi("sesion")) return pedir("/auth/clave", { method: "POST", body: JSON.stringify({ claveActual: actual, claveNueva: nueva }) });
    await esperar(400);
    var yo = sesionGuardada(), lista = usuariosPrueba(), cuenta = yo && lista.filter(function(x){ return x.id === yo.id; })[0];
    if(!cuenta || cuenta.clave !== actual) throw new ErrorApi("datos", "La contraseña actual no es correcta.");
    if(nueva === actual) throw new ErrorApi("datos", "La contraseña nueva tiene que ser distinta de la actual.");
    cuenta.clave = nueva; guardarUsuariosPrueba(lista);
    return null;
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
    if(usaApi("talleres")) return pedir("/talleres" + (todos ? "?todos=true" : ""), { method: "GET" });
    return talleresPrueba().filter(function(t){ return todos || t.activo; });
  }

  async function puedeEditarTalleres(){
    await esperar(400);
    var u = sesionGuardada();
    if(!u || u.rol === "Depósito") throw new ErrorApi("permiso", "Solo la coordinación, la supervisión y Administración pueden cambiar los talleres.");
  }
  function datosTaller(d){
    return { nombre: d.nombre.trim(), tipo: d.tipo, img: d.img, desc: d.desc.trim(), cuando: limpiarCuando(d.cuando) };
  }

  async function crearTaller(datos){
    var nuevo = datosTaller(datos);
    if(usaApi("talleres")) return pedir("/talleres", { method: "POST", body: JSON.stringify(nuevo) });
    await puedeEditarTalleres();
    var lista = talleresPrueba();
    var taller = Object.assign({ id: "t" + Date.now(), activo: true }, nuevo);
    lista.push(taller); guardarTalleresPrueba(lista);
    return taller;
  }

  async function actualizarTaller(id, datos){
    var cambios = datosTaller(datos);
    if(usaApi("talleres")) return pedir("/talleres/" + encodeURIComponent(id), { method: "PUT", body: JSON.stringify(cambios) });
    await puedeEditarTalleres();
    var lista = talleresPrueba(), t = lista.filter(function(x){ return x.id === id; })[0];
    if(!t) throw new ErrorApi("servidor", "No encontramos ese taller.");
    Object.assign(t, cambios); guardarTalleresPrueba(lista);
    return t;
  }

  // activo = false → baja lógica (deja de verse en el sitio) · activo = true → vuelve a mostrarse
  async function cambiarAltaTaller(id, activo){
    if(usaApi("talleres")){
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
    if(usaApi("talleres")) return pedir("/inscripciones", { method: "POST", body: JSON.stringify(inscripcion) });
    await esperar(400);
    var nuevas = guardado(CLAVE_INSCRIPCIONES) || [];
    inscripcion.id = "n" + Date.now();
    inscripcion.fecha = new Date().toISOString();
    nuevas.push(inscripcion);
    try { sessionStorage.setItem(CLAVE_INSCRIPCIONES, JSON.stringify(nuevas)); } catch(e){}
    return inscripcion;
  }

  async function listarInscripciones(){
    if(usaApi("talleres")) return pedir("/inscripciones", { method: "GET" });
    var u = sesionGuardada();
    if(!u || u.rol === "Depósito") throw new ErrorApi("servidor", "Solo la coordinación y la supervisión pueden ver las inscripciones.");
    return INSCRIPCIONES_EJEMPLO.concat(guardado(CLAVE_INSCRIPCIONES) || []);
  }

  /* ----- Depósito: fardos y stock -----
     Los usan Depósito y pesajes (retiros, donaciones), Stock del depósito (mover fardos de sección)
     y el Taller textil (pide lienzo para los pedidos), así lo que se lleva uno se descuenta para el otro.
     PROTOTIPO: se leen y se guardan sin esperar (pesaje.js funciona sin internet y es síncrono). */
  // Secciones del depósito. La letra va adelante del código del fardo (T-0241 = trapos).
  // "Sin clasificar": la donación se pesó pero todavía no se separó. "Descarte": sale del depósito.
  // "categoria": cómo se llama en la tabla CategoriaTela. Descarte no es una categoría: es el estado "Descartado".
  var SECCIONES_DEPOSITO = [
    { id: "feria", nombre: "Feria", letra: "F", material: "Prendas para feria", categoria: "Feria" },
    { id: "desmarcado", nombre: "Desmarcado", letra: "D", material: "Uniformes para desmarcar", categoria: "Desmarcado" },
    { id: "trapos", nombre: "Trapos", letra: "T", material: "Tela para trapos", categoria: "Trapos" },
    { id: "lienzo", nombre: "Lienzo para bolsas", letra: "B", material: "Lienzo para bolsas", categoria: "Lienzo para bolsas" },
    // Merchandising con los propios uniformes de la empresa ("Vuelta de Rosca")
    { id: "taller", nombre: "Taller textil", letra: "M", material: "Uniformes para merchandising", categoria: "Merchandising" },
    { id: "desbastado", nombre: "Desbastado", letra: "X", material: "Textil para desbastado", categoria: "Desbastado" },
    { id: "descarte", nombre: "Descarte", letra: "Z", material: "Descarte", sale: true },
    { id: "sinClasificar", nombre: "Sin clasificar", letra: "S", material: "Sin clasificar", categoria: "Sin clasificar" }
  ];
  function seccionDe(material){ return SECCIONES_DEPOSITO.filter(function(s){ return s.material === material; })[0]; }
  function diaIso(desplazamiento){
    var d = new Date(); d.setDate(d.getDate() + desplazamiento);
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  }
  function entrada(dias, empresa){ return [{ fecha: diaIso(dias) + "T10:00:00", texto: "Entró en la donación de " + empresa, por: "Florencia" }]; }
  var FARDOS_EJEMPLO = [
    { codigo: "S-0004", material: "Sin clasificar", kg: 46.0, entro: diaIso(-9), empresa: "Holcim", historial: entrada(-9, "Holcim") },
    { codigo: "S-0005", material: "Sin clasificar", kg: 27.5, entro: diaIso(-2), empresa: "Conci", historial: entrada(-2, "Conci") },
    { codigo: "T-0240", material: "Tela para trapos", kg: 64.5, entro: diaIso(-12), empresa: "Naranja X", historial: entrada(-12, "Naranja X") },
    { codigo: "D-0120", material: "Uniformes para desmarcar", kg: 38.0, entro: diaIso(-6), empresa: "Holcim", historial: entrada(-6, "Holcim") },
    { codigo: "B-0051", material: "Lienzo para bolsas", kg: 22.3, entro: diaIso(-15), empresa: "Hiper Libertad", historial: entrada(-15, "Hiper Libertad") },
    { codigo: "B-0049", material: "Lienzo para bolsas", kg: 31.0, entro: diaIso(-20), empresa: "Conci", historial: entrada(-20, "Conci") },
    { codigo: "X-0017", material: "Textil para desbastado", kg: 90.0, entro: diaIso(-25), empresa: "Naranja X", historial: entrada(-25, "Naranja X") }
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

  /* ----- Depósito con la API: los "fardos" de las pantallas son los Bulto de la base -----
     Las pantallas siguen trabajando con { codigo, material, kg, entro, empresa }: acá se traduce.
     El código del bulto es su número en la base (#0007). El historial no está en el modelo. */
  var catalogo = null;
  async function catalogos(){
    if(!catalogo){
      var r = await Promise.all([pedir("/categorias", { method: "GET" }), pedir("/estados", { method: "GET" })]);
      catalogo = { categorias: r[0], estados: r[1] };
    }
    return catalogo;
  }
  async function idCategoria(seccion){
    var c = (await catalogos()).categorias.filter(function(x){ return x.nombre === seccion.categoria; })[0];
    if(!c) throw new ErrorApi("datos", "Falta la categoría " + seccion.categoria + " en la base: correr lasomas.sql.");
    return c.id;
  }
  async function idEstado(nombre){
    var e = (await catalogos()).estados.filter(function(x){ return x.nombre === nombre; })[0];
    if(!e) throw new ErrorApi("datos", "Falta el estado " + nombre + " en la base: correr lasomas.sql.");
    return e.id;
  }
  function codigoBulto(id){ return "#" + String(id).padStart(4, "0"); }
  function idBulto(codigo){ return +String(codigo).replace(/\D/g, ""); }
  function fardoDeBulto(b){
    var s = SECCIONES_DEPOSITO.filter(function(x){ return x.categoria === b.categoria; })[0];
    return { id: b.id, codigo: codigoBulto(b.id), material: s ? s.material : b.categoria, kg: +b.pesoKg, color: b.color,
      entro: b.fechaIngreso.slice(0, 10), empresa: b.empresa, remito: b.numeroRemito, estado: b.estado, historial: null };
  }

  async function listarFardos(material){
    if(usaApi("deposito")){
      var bultos = (await pedir("/bultos", { method: "GET" })).map(fardoDeBulto);
      return bultos.filter(function(f){ return !material || f.material === material; });
    }
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
    if(usaApi("deposito")) return moverBulto(codigo, destino, kg);
    await esperar(250);
    var u = sesionGuardada();
    if(!u) throw new ErrorApi("credenciales", "Tu sesión se cerró. Volvé a ingresar.");
    var deposito = depositoPrueba(), f = deposito.filter(function(x){ return x.codigo === codigo; })[0];
    var hacia = SECCIONES_DEPOSITO.filter(function(s){ return s.id === destino; })[0];
    if(!f || f.kg <= 0) throw new ErrorApi("servidor", "Ese bulto ya no está en el depósito.");
    if(!hacia) throw new ErrorApi("servidor", "Elegí a qué sección va.");
    if(hacia.material === f.material) throw new ErrorApi("servidor", "El bulto ya está en " + hacia.nombre + ".");
    kg = redondear(kg);
    if(!(kg > 0)) throw new ErrorApi("servidor", "Poné cuántos kilos movés.");
    if(kg > f.kg + 0.05) throw new ErrorApi("servidor", "El bulto " + codigo + " tiene " + kgTexto(f.kg) + ": no se puede mover más que eso.");

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
        nuevo = { codigo: codigoNuevoPrueba(hacia.letra), material: hacia.material, kg: kg, 
          entro: f.entro, empresa: f.empresa, historial: [{ fecha: ahora, texto: "Salió del bulto " + codigo + " (" + seccionDe(mov.materialAntes).nombre + ")", por: u.nombre }] };
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
    if(usaApi("deposito")) return deshacerBulto(id);
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

  /* Mover con la API. Entero: se cambia la categoría (o el estado, si va a Descarte) y conserva el número.
     Una parte: la API la separa en un bulto nuevo de la misma donación. Se puede deshacer lo que se movió
     entero (vuelve como estaba); una parte separada no, porque la base no junta bultos. */
  async function moverBulto(codigo, destino, kg){
    var id = idBulto(codigo), hacia = SECCIONES_DEPOSITO.filter(function(s){ return s.id === destino; })[0];
    if(!hacia) throw new ErrorApi("datos", "Elegí a qué sección va.");
    var antes = await pedir("/bultos/" + id, { method: "GET" }), peso = +antes.pesoKg;
    kg = redondear(kg);
    if(!(kg > 0)) throw new ErrorApi("datos", "Poné cuántos kilos movés.");
    if(kg > peso + 0.05) throw new ErrorApi("datos", "El bulto " + codigo + " tiene " + kgTexto(peso) + ": no se puede mover más que eso.");
    var todo = kg >= peso - 0.05, nuevo = null, mov = null;
    if(todo && hacia.sale){
      await pedir("/bultos/" + id + "/estado", { method: "PUT", body: JSON.stringify({ idEstado: await idEstado("Descartado") }) });
      mov = { id: "m" + Date.now(), bulto: id, idEstado: antes.idEstado };
      kg = peso;
    } else if(todo){
      if(antes.categoria === hacia.categoria) throw new ErrorApi("datos", "El bulto ya está en " + hacia.nombre + ".");
      await pedir("/bultos/" + id + "/categoria", { method: "PUT", body: JSON.stringify({ idCategoria: await idCategoria(hacia) }) });
      mov = { id: "m" + Date.now(), bulto: id, idCategoria: antes.idCategoria };
      kg = peso;
    } else {
      // A Descarte una parte: se separa en la misma categoría y lo separado queda "Descartado"
      var r = await pedir("/bultos/" + id + "/dividir", { method: "POST",
        body: JSON.stringify({ pesoKg: kg, idCategoria: hacia.sale ? antes.idCategoria : await idCategoria(hacia) }) });
      if(hacia.sale) await pedir("/bultos/" + r.nuevo.id + "/estado", { method: "PUT", body: JSON.stringify({ idEstado: await idEstado("Descartado") }) });
      else nuevo = fardoDeBulto(r.nuevo);
    }
    if(mov) movimientos[mov.id] = mov;
    var origen = fardoDeBulto(await pedir("/bultos/" + id, { method: "GET" }));
    if(todo && hacia.sale) origen.kg = 0;
    return { movimiento: mov ? mov.id : null, origen: origen, nuevo: nuevo, kg: kg, destino: hacia.nombre };
  }
  async function deshacerBulto(idMovimiento){
    var mov = movimientos[idMovimiento];
    if(!mov) throw new ErrorApi("datos", "Ese movimiento ya no se puede deshacer.");
    if(mov.idEstado) await pedir("/bultos/" + mov.bulto + "/estado", { method: "PUT", body: JSON.stringify({ idEstado: mov.idEstado }) });
    else await pedir("/bultos/" + mov.bulto + "/categoria", { method: "PUT", body: JSON.stringify({ idCategoria: mov.idCategoria }) });
    delete movimientos[idMovimiento];
    return null;
  }

  /* Sale material del depósito: lo lleva una costurera (retiro) o el Taller textil para un pedido.
     Con la API el bulto queda "Retirado"; si se lleva una parte, se separa y lo separado queda "Retirado". */
  async function retirarFardo(codigo, kg){
    if(!usaApi("deposito")){
      var deposito = depositoPrueba(), f = deposito.filter(function(x){ return x.codigo === codigo; })[0];
      if(!f) throw new ErrorApi("datos", "Ese bulto ya no está en el depósito.");
      if(kg > f.kg + 0.05) throw new ErrorApi("datos", "El bulto " + codigo + " tiene " + kgTexto(f.kg) + ": no alcanza.");
      f.kg = redondear(f.kg - kg); guardarDepositoPrueba(deposito);
      return { codigo: codigo, kg: kg };
    }
    var id = idBulto(codigo), b = await pedir("/bultos/" + id, { method: "GET" }), peso = +b.pesoKg;
    if(b.estado !== "En depósito") throw new ErrorApi("datos", "El bulto " + codigo + " ya no está en el depósito.");
    if(kg > peso + 0.05) throw new ErrorApi("datos", "El bulto " + codigo + " tiene " + kgTexto(peso) + ": no alcanza.");
    var retirado = id;
    if(kg < peso - 0.05){
      var r = await pedir("/bultos/" + id + "/dividir", { method: "POST", body: JSON.stringify({ pesoKg: redondear(kg), idCategoria: b.idCategoria }) });
      retirado = r.nuevo.id;
    }
    await pedir("/bultos/" + retirado + "/estado", { method: "PUT", body: JSON.stringify({ idEstado: await idEstado("Retirado") }) });
    return { codigo: codigoBulto(retirado), kg: kg };
  }

  /* ----- Empresas donantes (CRUD) ----- */
  var EMPRESAS_EJEMPLO = [
    { id: 1, razonSocial: "Empresa Ejemplo Uno S.A.", cuit: "30000000017", telefono: "3510000001", email: "donaciones@ejemplo-uno.test", donaciones: 1 },
    { id: 2, razonSocial: "Empresa Ejemplo Dos S.R.L.", cuit: "30000000025", telefono: null, email: "contacto@ejemplo-dos.test", donaciones: 0 }
  ];
  var CLAVE_EMPRESAS = "omas-empresas-prueba";
  function empresasPrueba(){ return guardado(CLAVE_EMPRESAS) || JSON.parse(JSON.stringify(EMPRESAS_EJEMPLO)); }
  function guardarEmpresasPrueba(lista){ try { sessionStorage.setItem(CLAVE_EMPRESAS, JSON.stringify(lista)); } catch(e){} }
  function datosEmpresa(d){
    return { razonSocial: d.razonSocial.trim(), cuit: d.cuit.replace(/\D/g, ""), telefono: (d.telefono || "").trim() || null, email: (d.email || "").trim() || null };
  }

  async function listarEmpresas(){
    if(usaApi("deposito")) return pedir("/empresas", { method: "GET" });
    await esperar(200);
    return empresasPrueba().sort(function(a, b){ return a.razonSocial.localeCompare(b.razonSocial, "es"); });
  }
  async function crearEmpresa(datos){
    var nueva = datosEmpresa(datos);
    if(usaApi("deposito")) return pedir("/empresas", { method: "POST", body: JSON.stringify(nueva) });
    var lista = empresasPrueba();
    if(lista.some(function(e){ return e.cuit === nueva.cuit; })) throw new ErrorApi("repetido", "Ya hay una empresa con ese CUIT.");
    var empresa = Object.assign({ id: Date.now(), donaciones: 0 }, nueva);
    lista.push(empresa); guardarEmpresasPrueba(lista);
    return empresa;
  }
  async function actualizarEmpresa(id, datos){
    var cambios = datosEmpresa(datos);
    if(usaApi("deposito")) return pedir("/empresas/" + encodeURIComponent(id), { method: "PUT", body: JSON.stringify(cambios) });
    var lista = empresasPrueba(), e = lista.filter(function(x){ return x.id === id; })[0];
    if(lista.some(function(x){ return x.cuit === cambios.cuit && x.id !== id; })) throw new ErrorApi("repetido", "Ya hay otra empresa con ese CUIT.");
    Object.assign(e, cambios); guardarEmpresasPrueba(lista);
    return e;
  }
  async function eliminarEmpresa(id){
    if(usaApi("deposito")) return pedir("/empresas/" + encodeURIComponent(id), { method: "DELETE" });
    var lista = empresasPrueba(), e = lista.filter(function(x){ return x.id === id; })[0];
    if(e && e.donaciones) throw new ErrorApi("repetido", "La empresa tiene donaciones registradas: no se puede borrar.");
    guardarEmpresasPrueba(lista.filter(function(x){ return x.id !== id; }));
    return null;
  }

  // Donaciones registradas desde una fecha (para el Inicio): [{ id, numeroRemito, fechaIngreso, empresa, registradaPor, totalKg, cantidadBultos }]
  async function listarDonaciones(desde){
    if(!usaApi("deposito")) return [];
    return pedir("/donaciones" + (desde ? "?desde=" + encodeURIComponent(desde) : ""), { method: "GET" });
  }

  /* ----- Donaciones (el proceso) -----
     reparto = { idSeccion: kg }: cada sección con kilos es un bulto. Descarte se guarda como un bulto
     "Sin clasificar" en estado "Descartado" (así se sabe cuánto se descartó). Devuelve los bultos creados. */
  async function registrarDonacion(idEmpresa, numeroRemito, reparto){
    var secciones = SECCIONES_DEPOSITO.filter(function(s){ return reparto[s.id] > 0; });
    var sinClasificar = SECCIONES_DEPOSITO.filter(function(s){ return s.id === "sinClasificar"; })[0];
    var bultos = [];
    for(var i = 0; i < secciones.length; i++){
      var s = secciones[i];
      bultos.push({ pesoKg: redondear(reparto[s.id]), idCategoria: await idCategoria(s.sale ? sinClasificar : s), descartado: !!s.sale });
    }
    var d = await pedir("/donaciones", { method: "POST", body: JSON.stringify({ idEmpresa: idEmpresa, numeroRemito: numeroRemito, bultos: bultos }) });
    // Mismo orden que se mandó: así cada bulto se sabe de qué sección es
    return d.bultos.map(function(b, i){ return { codigo: codigoBulto(b.id), destino: secciones[i].nombre, material: secciones[i].material, kg: +b.pesoKg, sale: !!secciones[i].sale }; });
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
    var u = sesionGuardada();
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
    if(usaApi("pedidos")) return pedir("/pedidos", { method: "GET" });
    await esperar(250);
    return pedidosPrueba();
  }
  async function listarOperariasTaller(){
    if(usaApi("pedidos")) return pedir("/operarias?unidad=taller", { method: "GET" });
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
    if(usaApi("pedidos")) return pedir("/pedidos/" + encodeURIComponent(id) + "/respuesta", { method: "POST", body: JSON.stringify({ accion: accion, texto: texto || "" }) });
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
    if(usaApi("pedidos")) return pedir("/pedidos/" + encodeURIComponent(id) + "/material", { method: "POST", body: JSON.stringify({ fardo: fardo, kg: kg }) });
    await rolPedidos(ORGANIZAN, "Solo la coordinación pide material al depósito.");
    // El pedido se simula, pero el lienzo sale del depósito de verdad (con la API, el bulto queda "Retirado")
    var r = await retirarFardo(fardo, kg);
    var lista = pedidosPrueba(), p = pedidoDe(lista, id);
    p.material.push({ fardo: r.codigo, kg: kg }); guardarPedidosPrueba(lista);
    return p;
  }

  async function asignarTrabajo(id, operaria, cantidad){
    if(usaApi("pedidos")) return pedir("/pedidos/" + encodeURIComponent(id) + "/reparto", { method: "POST", body: JSON.stringify({ operaria: operaria, cantidad: cantidad }) });
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
    if(usaApi("pedidos")) return pedir("/pedidos/" + encodeURIComponent(id) + "/terminadas", { method: "POST", body: JSON.stringify({ operaria: operaria, cantidad: cantidad }) });
    await rolPedidos(ORGANIZAN, "Solo la coordinación registra lo terminado.");
    var lista = pedidosPrueba(), p = pedidoDe(lista, id), r = p.reparto.filter(function(x){ return x.operaria === operaria; })[0];
    if(!r) throw new ErrorApi("servidor", "Esa operaria no tiene bolsas de este pedido.");
    if(r.terminadas + cantidad > r.asignadas) throw new ErrorApi("servidor", "Tiene " + (r.asignadas - r.terminadas) + " bolsas por terminar, no más.");
    r.terminadas += cantidad; guardarPedidosPrueba(lista);
    return p;
  }

  async function registrarEntrega(id, cantidad, remito){
    if(usaApi("pedidos")) return pedir("/pedidos/" + encodeURIComponent(id) + "/entregas", { method: "POST", body: JSON.stringify({ cantidad: cantidad, remito: remito }) });
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
    var u = sesionGuardada();
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

  /* Con la API: la base guarda Nombre y Apellido por separado y se entra con el Email.
     La pantalla trabaja con { nombre (completo), usuario (el email) }: acá se traduce. */
  function cuentaDeApi(u){
    return { id: String(u.id), nombre: (u.nombre + " " + u.apellido).trim(), usuario: u.email, telefono: u.telefono, rol: u.rol, activo: u.activo, alta: null };
  }
  // "María Eva López" → nombre "María Eva", apellido "López" (el apellido es la última palabra)
  function separarNombre(completo){
    var partes = completo.trim().split(/\s+/);
    if(partes.length < 2) throw new ErrorApi("datos", "Escribí el nombre y el apellido.");
    return { nombre: partes.slice(0, -1).join(" "), apellido: partes[partes.length - 1] };
  }

  async function listarUsuarios(){
    if(usaApi("usuarios")) return (await pedir("/usuarios", { method: "GET" })).map(cuentaDeApi);
    await soloAdministracion();
    return usuariosPrueba().map(publico);
  }

  async function crearUsuario(datos){
    var nueva = { nombre: datos.nombre.trim(), usuario: datos.usuario.trim().toLowerCase(), rol: datos.rol };
    if(usaApi("usuarios")){
      var partes = separarNombre(nueva.nombre);
      var r = await pedir("/usuarios", { method: "POST", body: JSON.stringify({ nombre: partes.nombre, apellido: partes.apellido, email: nueva.usuario, rol: nueva.rol }) });
      return { usuario: cuentaDeApi(r.usuario), claveTemporal: r.claveTemporal };
    }
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
    if(usaApi("usuarios")){
      // El teléfono no está en la pantalla: se manda el que ya tenía, así no se borra
      var actual = await pedir("/usuarios/" + encodeURIComponent(id), { method: "GET" }), n = separarNombre(cambios.nombre);
      return cuentaDeApi(await pedir("/usuarios/" + encodeURIComponent(id), { method: "PUT",
        body: JSON.stringify({ nombre: n.nombre, apellido: n.apellido, telefono: actual.telefono, rol: cambios.rol }) }));
    }
    var yo = await soloAdministracion();
    if(id === yo.id && cambios.rol !== "Administración") throw new ErrorApi("servidor", "No podés sacarte el rol de Administración a vos misma.");
    var lista = usuariosPrueba(), u = buscarCuenta(lista, id);
    Object.assign(u, cambios); guardarUsuariosPrueba(lista);
    return publico(u);
  }

  async function restablecerClave(id){
    if(usaApi("usuarios")) return pedir("/usuarios/" + encodeURIComponent(id) + "/clave", { method: "POST" });
    await soloAdministracion();
    var lista = usuariosPrueba(), u = buscarCuenta(lista, id);
    u.clave = claveTemporal(); guardarUsuariosPrueba(lista);
    return { claveTemporal: u.clave };
  }

  // activa = false → baja lógica · activa = true → la vuelve a activar
  async function cambiarAltaUsuario(id, activa){
    if(usaApi("usuarios")){
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
    retirarFardo: retirarFardo,
    registrarDonacion: registrarDonacion,
    listarDonaciones: listarDonaciones,
    listarEmpresas: listarEmpresas,
    crearEmpresa: crearEmpresa,
    actualizarEmpresa: actualizarEmpresa,
    eliminarEmpresa: eliminarEmpresa,
    usaApi: usaApi,
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
    cambiarClave: cambiarClave,
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
