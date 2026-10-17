/* ===== SGI-OMAS · Empresas donantes (CRUD) =====
   Las empresas que donan ropa y uniformes. Se eligen al registrar una donación en Depósito y pesajes.
   · Alta y modificación: razón social, CUIT, teléfono y email. El CUIT no se puede repetir.
   · Baja: solo Administración y Coordinadora, y solo si la empresa no tiene donaciones
     (la tabla no tiene baja lógica, y una donación no puede quedar sin empresa).
   Todo pasa por OmasApi (api.js), que lo guarda en la base (tabla EmpresaDonante). */
(function(){
  "use strict";

  var app = document.getElementById("app");
  var avisoEl = document.getElementById("aviso");
  var empresas = [], yo = null, puedeBorrar = false, avisoReloj;
  var busqueda = "", abierto = null, confirmarBorrar = null;

  function esc(s){ return String(s == null ? "" : s).replace(/[&<>"']/g, function(c){ return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function avisar(texto){
    avisoEl.textContent = texto; avisoEl.classList.add("ver");
    clearTimeout(avisoReloj);
    avisoReloj = setTimeout(function(){ avisoEl.classList.remove("ver"); }, 2400);
  }
  // "30000000017" → "30-00000001-7" (así se lee en los papeles)
  function cuitLindo(c){ return c && c.length === 11 ? c.slice(0, 2) + "-" + c.slice(2, 10) + "-" + c.slice(10) : c; }
  var EMAIL_VALIDO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  /* ----- Formulario (alta y edición) ----- */
  function campo(id, nombre, etiqueta, valor, extra){
    return '<label class="etiqueta-campo" for="' + nombre + "-" + id + '">' + etiqueta + "</label>" +
      '<input class="entrada" id="' + nombre + "-" + id + '" name="' + nombre + '" autocomplete="off" value="' + esc(valor) + '"' + (extra || "") + ">";
  }
  function formulario(e){
    var nueva = !e, id = nueva ? "nueva" : e.id;
    return '<form class="empresa-form" data-id="' + (nueva ? "" : e.id) + '" novalidate>' +
      campo(id, "razonSocial", "Razón social", nueva ? "" : e.razonSocial, ' maxlength="150"') +
      campo(id, "cuit", "CUIT", nueva ? "" : cuitLindo(e.cuit), ' inputmode="numeric" maxlength="13" placeholder="Ej.: 30-12345678-9"') +
      campo(id, "telefono", "Teléfono (opcional)", nueva ? "" : e.telefono, ' type="tel" maxlength="30"') +
      campo(id, "email", "Email (opcional)", nueva ? "" : e.email, ' type="email" maxlength="254"') +
      '<p class="taller-error" data-error role="alert" hidden></p>' +
      '<div class="taller-botones"><button type="submit" class="btn-grande">' + (nueva ? "Guardar empresa" : "Guardar cambios") + "</button>" +
      '<button type="button" class="enlace" data-accion="cancelar">Cancelar</button></div>' +
      (nueva ? "" : extraBorrar(e)) + "</form>";
  }
  function extraBorrar(e){
    if(!puedeBorrar) return "";
    if(e.donaciones) return '<div class="usuario-extra"><p class="nota-chica mb-0">Tiene ' + (e.donaciones === 1 ? "1 donación registrada" : e.donaciones + " donaciones registradas") + ": no se puede borrar.</p></div>";
    return '<div class="usuario-extra">' + (confirmarBorrar === e.id
      ? '<div class="confirmar-baja" role="group" aria-label="Confirmar"><p class="mb-2"><strong>¿Borrar ' + esc(e.razonSocial) + "?</strong> No tiene donaciones, así que no se pierde nada.</p>" +
        '<button type="button" class="btn-peligro" data-accion="borrarSi" data-id="' + e.id + '">Sí, borrar</button>' +
        '<button type="button" class="enlace" data-accion="borrarNo">No</button></div>'
      : '<button type="button" class="enlace enlace-peligro" data-accion="borrar" data-id="' + e.id + '">Borrar esta empresa</button>') + "</div>";
  }

  /* ----- Lista ----- */
  function tarjeta(e){
    var datos = ["CUIT " + cuitLindo(e.cuit)].concat(e.telefono ? [e.telefono] : [], e.email ? [e.email] : []);
    return '<li class="tarjeta usuario-card">' +
      '<div class="usuario-cabeza"><span class="avatar">' + esc(e.razonSocial.charAt(0)) + "</span>" +
        '<div class="usuario-datos"><strong>' + esc(e.razonSocial) + '</strong><span class="nota-chica">' + esc(datos.join(" · ")) + "</span></div>" +
        '<span class="rol-chip">' + (e.donaciones === 1 ? "1 donación" : e.donaciones + " donaciones") + "</span></div>" +
      (abierto === String(e.id) ? formulario(e) : '<button type="button" class="btn-linea usuario-boton" data-accion="editar" data-id="' + e.id + '">Editar</button>') +
      "</li>";
  }

  function render(foco){
    var q = busqueda.trim().toLowerCase().replace(/-/g, "");
    var lista = empresas.filter(function(e){ return !q || e.razonSocial.toLowerCase().indexOf(q) >= 0 || e.cuit.indexOf(q) >= 0; });
    app.innerHTML = '<h1 class="titulo">Empresas donantes</h1>' +
      '<p class="bajada">Las empresas que donan ropa y uniformes. Se eligen al registrar una donación.</p>' +
      (abierto === "nueva"
        ? '<section class="tarjeta usuario-nueva" aria-labelledby="nueva-titulo"><h2 class="tarjeta-titulo" id="nueva-titulo">Nueva empresa</h2>' + formulario(null) + "</section>"
        : '<button type="button" class="btn-grande usuario-crear" data-accion="nueva">+ Nueva empresa</button>') +
      '<label class="etiqueta-campo" for="buscar">Buscar</label>' +
      '<input class="entrada" id="buscar" type="search" placeholder="Razón social o CUIT" autocomplete="off" value="' + esc(busqueda) + '">' +
      (lista.length ? '<ul class="usuario-lista">' + lista.map(tarjeta).join("") + "</ul>"
        : '<p class="nota-chica">' + (q ? "No hay empresas que coincidan con la búsqueda." : "Todavía no hay empresas cargadas.") + "</p>");
    if(foco){ var el = app.querySelector(foco); if(el) el.focus(); }
  }

  function mostrarError(form, texto, campoEl){
    var error = form.querySelector("[data-error]");
    error.textContent = texto; error.hidden = false;
    if(campoEl) campoEl.focus();
  }

  /* ----- Clics ----- */
  app.addEventListener("click", async function(ev){
    var el = ev.target.closest("[data-accion]");
    if(!el) return;
    var accion = el.dataset.accion, id = el.dataset.id;
    if(accion === "nueva"){ abierto = "nueva"; confirmarBorrar = null; render("#razonSocial-nueva"); }
    if(accion === "editar"){ abierto = id; confirmarBorrar = null; render("#razonSocial-" + id); }
    if(accion === "cancelar"){ var antes = abierto; abierto = null; confirmarBorrar = null; render(antes === "nueva" ? ".usuario-crear" : '[data-accion="editar"][data-id="' + antes + '"]'); }
    if(accion === "borrar"){ confirmarBorrar = +id; render('[data-accion="borrarSi"]'); }
    if(accion === "borrarNo"){ confirmarBorrar = null; render('[data-accion="borrar"]'); }
    if(accion === "borrarSi"){
      el.disabled = true;
      try {
        await OmasApi.eliminarEmpresa(+id);
        var nombre = empresas.filter(function(e){ return e.id === +id; })[0].razonSocial;
        empresas = empresas.filter(function(e){ return e.id !== +id; });
        abierto = null; confirmarBorrar = null; render(".usuario-crear");
        avisar(nombre + " quedó borrada");
      } catch(err){ el.disabled = false; avisar(err.message || "No se pudo borrar."); }
    }
  });

  app.addEventListener("input", function(ev){
    if(ev.target.id === "buscar"){
      busqueda = ev.target.value;
      var pos = ev.target.selectionStart;
      render("#buscar");
      document.getElementById("buscar").setSelectionRange(pos, pos);
      return;
    }
    var form = ev.target.closest(".empresa-form");
    if(form) form.querySelector("[data-error]").hidden = true;
  });

  /* ----- Guardar ----- */
  app.addEventListener("submit", async function(ev){
    var form = ev.target.closest(".empresa-form");
    if(!form) return;
    ev.preventDefault();
    var f = form.elements, nueva = !form.dataset.id;
    var datos = { razonSocial: f.razonSocial.value.trim(), cuit: f.cuit.value.replace(/\D/g, ""), telefono: f.telefono.value.trim(), email: f.email.value.trim().toLowerCase() };
    if(datos.razonSocial.length < 2) return mostrarError(form, "Escribí la razón social.", f.razonSocial);
    if(datos.cuit.length !== 11) return mostrarError(form, "El CUIT tiene 11 números (los guiones no hacen falta).", f.cuit);
    if(datos.email && !EMAIL_VALIDO.test(datos.email)) return mostrarError(form, "El email no es válido.", f.email);

    var boton = form.querySelector('[type="submit"]'), texto = boton.textContent;
    boton.disabled = true; boton.textContent = "Guardando…";
    try {
      if(nueva){
        var creada = await OmasApi.crearEmpresa(datos);
        empresas.push(creada);
        empresas.sort(function(a, b){ return a.razonSocial.localeCompare(b.razonSocial, "es"); });
        abierto = null; render('[data-accion="editar"][data-id="' + creada.id + '"]');
        avisar(creada.razonSocial + " quedó cargada");
      } else {
        var actualizada = await OmasApi.actualizarEmpresa(+form.dataset.id, datos);
        empresas = empresas.map(function(e){ return e.id === actualizada.id ? actualizada : e; });
        abierto = null; render('[data-accion="editar"][data-id="' + actualizada.id + '"]');
        avisar("Cambios guardados");
      }
    } catch(err){
      boton.disabled = false; boton.textContent = texto;
      mostrarError(form, err.message || "No se pudo guardar. Probá de nuevo.", err.tipo === "repetido" ? f.cuit : null);
    }
  });

  async function iniciar(){
    yo = await OmasApi.exigirSesion();
    OmasMenu.iniciar(yo);
    puedeBorrar = yo.rol === "Administración" || yo.rol === "Coordinadora";
    try { empresas = await OmasApi.listarEmpresas(); render(); }
    catch(err){ app.innerHTML = '<h1 class="titulo">Empresas donantes</h1><p class="aviso-caja">' + esc(err.message || "No se pudieron cargar las empresas.") + "</p>"; }
  }
  iniciar();
})();
