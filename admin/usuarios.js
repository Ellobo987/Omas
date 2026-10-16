/* ===== SGI-OMAS · Usuarios (CRUD) =====
   Administración (Sandra) maneja las cuentas para entrar al sistema:
   · Alta: nombre, usuario y rol. El sistema genera una clave temporal que se muestra una sola vez.
   · Consulta: lista con buscador, separada en "Activas" y "De baja".
   · Modificación: nombre y rol. Si alguien se olvida la clave, se le da una nueva.
   · Baja: lógica. La cuenta no se borra (queda registrado quién hizo cada pesaje), solo deja de poder entrar.
   Todo pasa por OmasApi (api.js). Para cargar lo menos posible: el usuario se arma solo
   con el nombre y el rol se elige tocando. */
(function(){
  "use strict";

  var app = document.getElementById("app");
  var avisoEl = document.getElementById("aviso");
  var usuarios = [], yo = null, avisoReloj;
  var filtro = "activas", busqueda = "", abierto = null, confirmarBaja = null, claveMostrada = null;

  var DESCRIPCION_ROL = {
    "Administración": "Crea y da de baja cuentas. Ve todo el sistema.",
    "Coordinadora": "Organiza el trabajo: talleres, pedidos y lotes.",
    "Supervisión": "Revisa y aprueba lo que se carga.",
    "Depósito": "Registra pesajes, retiros y devoluciones."
  };

  function esc(s){ return String(s == null ? "" : s).replace(/[&<>"']/g, function(c){ return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function avisar(texto){
    avisoEl.textContent = texto; avisoEl.classList.add("ver");
    clearTimeout(avisoReloj);
    avisoReloj = setTimeout(function(){ avisoEl.classList.remove("ver"); }, 2400);
  }
  function fechaLarga(iso){ var p = iso.split("-"); return new Date(+p[0], +p[1] - 1, +p[2]).toLocaleDateString("es-AR", { day: "numeric", month: "long", year: "numeric" }); }
  // "María Eva López" → "maria" (sin tildes, en minúsculas): una propuesta que se puede cambiar
  function sugerirUsuario(nombre){
    return (nombre.trim().split(/\s+/)[0] || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9.]/g, "");
  }
  var USUARIO_VALIDO = /^[a-z0-9.]{3,20}$/;

  /* ----- Formulario (sirve para alta y para edición) ----- */
  function opcionesRol(id, elegido){
    return '<fieldset class="mb-3"><legend class="etiqueta-campo">Rol</legend><div class="roles-lista">' +
      OmasApi.ROLES.map(function(r){
        var idInput = "rol-" + r.replace(/\W/g, "") + "-" + id;
        return '<input type="radio" class="chip-check" name="rol" id="' + idInput + '" value="' + esc(r) + '"' + (r === elegido ? " checked" : "") + ">" +
          '<label class="rol-opcion" for="' + idInput + '"><strong>' + esc(r) + "</strong><span>" + esc(DESCRIPCION_ROL[r]) + "</span></label>";
      }).join("") + "</div></fieldset>";
  }

  function formulario(u){
    var nueva = !u, id = nueva ? "nueva" : esc(u.id);
    var html = '<form class="usuario-form" data-id="' + (nueva ? "" : esc(u.id)) + '" novalidate>' +
      '<label class="etiqueta-campo" for="nombre-' + id + '">Nombre y apellido</label>' +
      '<input class="entrada" id="nombre-' + id + '" name="nombre" autocomplete="off" maxlength="80" value="' + (nueva ? "" : esc(u.nombre)) + '">';
    if(nueva){
      html += '<label class="etiqueta-campo" for="usuario-' + id + '">Usuario para entrar</label>' +
        '<input class="entrada mb-1" id="usuario-' + id + '" name="usuario" autocomplete="off" autocapitalize="none" spellcheck="false" maxlength="20" aria-describedby="usuario-ayuda">' +
        '<p class="nota-chica mb-3" id="usuario-ayuda">Se arma solo con el nombre. Solo minúsculas, números y punto.</p>';
    } else {
      html += '<p class="nota-chica mb-3">Usuario: <strong>' + esc(u.usuario) + "</strong> (no se puede cambiar)</p>";
    }
    html += opcionesRol(id, nueva ? "Depósito" : u.rol) +
      '<p class="taller-error" data-error role="alert" hidden></p>' +
      '<div class="taller-botones"><button type="submit" class="btn-grande">' + (nueva ? "Crear cuenta" : "Guardar cambios") + "</button>" +
      '<button type="button" class="enlace" data-accion="cancelar">Cancelar</button></div>';
    // Lo que se hace con una cuenta que ya existe
    if(!nueva){
      var esYo = u.id === yo.id;
      html += '<div class="usuario-extra">' +
        '<button type="button" class="btn-linea" data-accion="clave" data-id="' + esc(u.id) + '">Darle una clave nueva</button>' +
        (esYo ? '<p class="nota-chica mb-0">No podés darte de baja a vos misma.</p>'
          : confirmarBaja === u.id
            ? '<div class="confirmar-baja" role="group" aria-label="Confirmar la baja"><p class="mb-2"><strong>¿Dar de baja a ' + esc(u.nombre) + "?</strong> Ya no va a poder entrar, pero su historial queda guardado.</p>" +
              '<button type="button" class="btn-peligro" data-accion="bajaSi" data-id="' + esc(u.id) + '">Sí, dar de baja</button>' +
              '<button type="button" class="enlace" data-accion="bajaNo">No</button></div>'
            : '<button type="button" class="enlace enlace-peligro" data-accion="baja" data-id="' + esc(u.id) + '">Dar de baja esta cuenta</button>') +
        "</div>";
    }
    return html + "</form>";
  }

  /* ----- Lista ----- */
  function tarjeta(u){
    var editando = abierto === u.id;
    return '<li class="tarjeta usuario-card' + (u.activo ? "" : " de-baja") + '">' +
      '<div class="usuario-cabeza"><span class="avatar">' + esc(u.nombre.charAt(0)) + "</span>" +
        '<div class="usuario-datos"><strong>' + esc(u.nombre) + (u.id === yo.id ? ' <span class="nota-chica">(vos)</span>' : "") + "</strong>" +
        '<span class="nota-chica">' + esc(u.usuario) + " · desde el " + esc(fechaLarga(u.alta)) + "</span></div>" +
        '<span class="rol-chip">' + esc(u.rol) + "</span></div>" +
      (editando ? formulario(u)
        : u.activo ? '<button type="button" class="btn-linea usuario-boton" data-accion="editar" data-id="' + esc(u.id) + '">Editar</button>'
          : '<button type="button" class="btn-linea usuario-boton" data-accion="alta" data-id="' + esc(u.id) + '">Volver a activar</button>') +
      "</li>";
  }

  function cajaClave(){
    if(!claveMostrada) return "";
    return '<section class="clave-caja" aria-labelledby="clave-titulo" tabindex="-1" id="clave-caja">' +
      '<h2 id="clave-titulo">' + esc(claveMostrada.titulo) + "</h2>" +
      '<p class="mb-2">Para entrar: usuario <strong>' + esc(claveMostrada.usuario) + "</strong> y esta clave:</p>" +
      '<p class="clave-numero" id="clave-numero">' + esc(claveMostrada.clave) + "</p>" +
      '<p class="nota-chica">Pasásela en persona o por WhatsApp. <strong>Se muestra una sola vez</strong>: anotala antes de cerrar este aviso.</p>' +
      '<div class="clave-botones"><button type="button" class="btn-linea" data-accion="copiar">Copiar clave</button>' +
      '<button type="button" class="btn-grande" data-accion="cerrarClave">Listo, ya la anoté</button></div></section>';
  }

  function render(foco){
    var q = busqueda.trim().toLowerCase();
    var activas = usuarios.filter(function(u){ return u.activo; }), baja = usuarios.filter(function(u){ return !u.activo; });
    var lista = (filtro === "activas" ? activas : baja).filter(function(u){
      return !q || u.nombre.toLowerCase().indexOf(q) >= 0 || u.usuario.indexOf(q) >= 0;
    }).sort(function(a, b){ return a.nombre.localeCompare(b.nombre, "es"); });

    app.innerHTML = '<h1 class="titulo">Usuarios</h1>' +
      '<p class="bajada">Las cuentas para entrar al sistema. Cada persona entra con su usuario y su clave.</p>' +
      cajaClave() +
      (abierto === "nueva"
        ? '<section class="tarjeta usuario-nueva" aria-labelledby="nueva-titulo"><h2 class="tarjeta-titulo" id="nueva-titulo">Nueva cuenta</h2>' + formulario(null) + "</section>"
        : '<button type="button" class="btn-grande usuario-crear" data-accion="nueva">+ Nueva cuenta</button>') +
      '<label class="etiqueta-campo" for="buscar">Buscar</label>' +
      '<input class="entrada" id="buscar" type="search" placeholder="Nombre o usuario" autocomplete="off" value="' + esc(busqueda) + '">' +
      '<nav class="pestanas pestanas-fila" aria-label="Estado de las cuentas">' +
        '<button type="button" class="pestana" data-accion="filtro" data-filtro="activas"' + (filtro === "activas" ? ' aria-current="page"' : "") + '>Activas <span class="pestana-num">' + activas.length + "</span></button>" +
        '<button type="button" class="pestana" data-accion="filtro" data-filtro="baja"' + (filtro === "baja" ? ' aria-current="page"' : "") + '>De baja <span class="pestana-num">' + baja.length + "</span></button></nav>" +
      (lista.length ? '<ul class="usuario-lista">' + lista.map(tarjeta).join("") + "</ul>"
        : '<p class="nota-chica">' + (q ? "No hay cuentas que coincidan con la búsqueda." : filtro === "activas" ? "No hay cuentas activas." : "No hay cuentas dadas de baja.") + "</p>");

    if(foco){ var el = app.querySelector(foco); if(el) el.focus(); }
  }

  async function cargar(){
    try { usuarios = await OmasApi.listarUsuarios(); render(); }
    catch(err){ app.innerHTML = '<h1 class="titulo">Usuarios</h1><p class="aviso-caja">' + esc(err.message || "No se pudieron cargar las cuentas.") + "</p>"; }
  }

  function mostrarError(form, texto, campo){
    var error = form.querySelector("[data-error]");
    error.textContent = texto; error.hidden = false;
    if(campo) campo.focus();
  }
  function reemplazar(actualizada){
    usuarios = usuarios.map(function(u){ return u.id === actualizada.id ? actualizada : u; });
  }

  /* ----- Clics ----- */
  app.addEventListener("click", async function(e){
    var el = e.target.closest("[data-accion]");
    if(!el) return;
    var accion = el.dataset.accion, id = el.dataset.id;
    if(accion === "nueva"){ abierto = "nueva"; confirmarBaja = null; render("#nombre-nueva"); }
    if(accion === "editar"){ abierto = id; confirmarBaja = null; render("#nombre-" + id); }
    if(accion === "cancelar"){ var antes = abierto; abierto = null; confirmarBaja = null; render(antes === "nueva" ? ".usuario-crear" : '[data-accion="editar"][data-id="' + antes + '"]'); }
    if(accion === "filtro"){ filtro = el.dataset.filtro; abierto = null; render('[data-filtro="' + filtro + '"]'); }
    if(accion === "baja"){ confirmarBaja = id; render('[data-accion="bajaSi"]'); }
    if(accion === "bajaNo"){ var era = confirmarBaja; confirmarBaja = null; render('[data-accion="baja"][data-id="' + era + '"]'); }
    if(accion === "cerrarClave"){ claveMostrada = null; render(".usuario-crear"); }
    if(accion === "copiar"){
      try { await navigator.clipboard.writeText(claveMostrada.clave); avisar("Clave copiada"); }
      catch(err){ avisar("No se pudo copiar: anotala a mano"); }
    }
    if(accion === "bajaSi" || accion === "alta"){
      el.disabled = true;
      try {
        await OmasApi.cambiarAltaUsuario(id, accion === "alta");
        var u = usuarios.filter(function(x){ return x.id === id; })[0];
        u.activo = accion === "alta"; abierto = null; confirmarBaja = null;
        render('[data-filtro="' + filtro + '"]');
        avisar(accion === "alta" ? u.nombre + " puede volver a entrar" : u.nombre + " quedó dada de baja");
      } catch(err){ el.disabled = false; avisar(err.message || "No se pudo hacer el cambio."); }
    }
    if(accion === "clave"){
      el.disabled = true;
      try {
        var r = await OmasApi.restablecerClave(id), cuenta = usuarios.filter(function(x){ return x.id === id; })[0];
        claveMostrada = { titulo: "Clave nueva para " + cuenta.nombre, usuario: cuenta.usuario, clave: r.claveTemporal };
        abierto = null; render("#clave-caja");
      } catch(err){ el.disabled = false; avisar(err.message || "No se pudo generar la clave."); }
    }
  });

  /* ----- Escribir ----- */
  // Mientras escribe el nombre, se propone el usuario (hasta que lo cambie a mano)
  app.addEventListener("input", function(e){
    if(e.target.id === "buscar"){
      busqueda = e.target.value;
      var pos = e.target.selectionStart;
      render("#buscar");
      var b = document.getElementById("buscar"); b.setSelectionRange(pos, pos);
      return;
    }
    var form = e.target.closest(".usuario-form");
    if(!form) return;
    form.querySelector("[data-error]").hidden = true;
    var campoUsuario = form.elements.usuario;
    if(e.target.name === "usuario") campoUsuario.dataset.tocado = "1";
    if(e.target.name === "nombre" && campoUsuario && !campoUsuario.dataset.tocado) campoUsuario.value = sugerirUsuario(e.target.value);
  });

  app.addEventListener("keydown", function(e){
    if(e.key === "Escape" && e.target.closest(".usuario-form")){
      var cancelar = e.target.closest(".usuario-form").querySelector('[data-accion="cancelar"]');
      if(cancelar) cancelar.click();
    }
  });

  /* ----- Guardar ----- */
  app.addEventListener("submit", async function(e){
    var form = e.target.closest(".usuario-form");
    if(!form) return;
    e.preventDefault();
    var nombre = form.elements.nombre.value.trim(), rol = form.elements.rol.value, nueva = !form.dataset.id;
    if(nombre.length < 3) return mostrarError(form, "Escribí el nombre y el apellido.", form.elements.nombre);
    if(!rol) return mostrarError(form, "Elegí un rol.", form.querySelector('input[name="rol"]'));
    var usuario = nueva ? form.elements.usuario.value.trim().toLowerCase() : null;
    if(nueva && !USUARIO_VALIDO.test(usuario)) return mostrarError(form, "El usuario tiene que tener entre 3 y 20 letras minúsculas, números o puntos.", form.elements.usuario);

    var boton = form.querySelector('[type="submit"]'), textoBoton = boton.textContent;
    boton.disabled = true; boton.textContent = "Guardando…";
    try {
      if(nueva){
        var r = await OmasApi.crearUsuario({ nombre: nombre, usuario: usuario, rol: rol });
        usuarios.push(r.usuario);
        claveMostrada = { titulo: "Listo, la cuenta de " + r.usuario.nombre + " está creada", usuario: r.usuario.usuario, clave: r.claveTemporal };
        abierto = null; filtro = "activas"; render("#clave-caja");
      } else {
        reemplazar(await OmasApi.actualizarUsuario(form.dataset.id, { nombre: nombre, rol: rol }));
        var id = abierto; abierto = null; render('[data-accion="editar"][data-id="' + id + '"]');
        avisar("Cambios guardados");
      }
    } catch(err){
      boton.disabled = false; boton.textContent = textoBoton;
      mostrarError(form, err.message || "No se pudo guardar. Probá de nuevo.", err.tipo === "repetido" ? form.elements.usuario : null);
    }
  });

  async function iniciar(){
    yo = await OmasApi.exigirSesion();
    OmasMenu.iniciar(yo);
    if(yo.rol !== "Administración"){
      app.innerHTML = '<h1 class="titulo">Usuarios</h1><p class="aviso-caja">Solo Administración puede ver y manejar las cuentas.</p>';
      return;
    }
    cargar();
  }
  iniciar();
})();
