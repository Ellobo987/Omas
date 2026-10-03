/* ===== SGI-OMAS · Talleres: fechas e inscriptas =====
   Dos secciones, también en el menú lateral (cambian con el # de la dirección, así se puede volver con "Atrás"):
   · Modificar talleres: los talleres de Las Omas no tienen días fijos, así que la coordinación les pone
     la fecha desde acá y la página Talleres del sitio la muestra. Solo se edita la fecha:
     nombre, foto y descripción quedan fijos.
   · Inscripciones: quiénes se anotaron desde el sitio, por taller. La confirmación por WhatsApp
     la manda un bot automático apenas se inscriben (lo dispara la API), por eso acá no hay botón.
   Todo pasa por OmasApi (api.js). Coordinadora y Supervisión ven las dos; Depósito solo mira
   las fechas, porque las inscriptas son datos personales (DNI y teléfono).
   PROTOTIPO: los cambios se ven en el sitio si se abre en la misma pestaña (ver api.js). */
(function(){
  "use strict";

  var app = document.getElementById("app");
  var avisoEl = document.getElementById("aviso");
  var talleres = [], puedeEditar = false, abierto = null, avisoReloj;
  var vista = "fechas", inscripciones = null, errorInscripciones = "", filtro = "todos", dniVisible = {};

  /* La fecha se elige tocando, no escribiendo: así no hay errores de tipeo y en el sitio
     todas las tarjetas quedan con el mismo formato. Los horarios van de 8 a 21 h, cada media hora. */
  var DIAS = [[1, "Lun"], [2, "Mar"], [3, "Mié"], [4, "Jue"], [5, "Vie"], [6, "Sáb"]];
  var HORAS = [];
  for(var m = 8 * 60; m <= 21 * 60; m += 30) HORAS.push(String(Math.floor(m / 60)).padStart(2, "0") + ":" + (m % 60 ? "30" : "00"));
  var MODOS = [["semanal", "Todas las semanas"], ["puntual", "Un día puntual"], ["aConfirmar", "A confirmar"]];

  function esc(s){ return String(s == null ? "" : s).replace(/[&<>"']/g, function(c){ return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  // El mismo texto que muestra la tarjeta del sitio (lo arma api.js para los dos)
  function horario(t){ return OmasApi.textoFecha(t.cuando); }
  function sinFecha(t){ return !t.cuando || t.cuando.modo === "aConfirmar"; }
  function hoyIso(){ var d = new Date(); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); }
  function avisar(texto){
    avisoEl.textContent = texto; avisoEl.classList.add("ver");
    clearTimeout(avisoReloj);
    avisoReloj = setTimeout(function(){ avisoEl.classList.remove("ver"); }, 2400);
  }

  function opcionesHora(elegida, desdeIndice, hastaIndice){
    return HORAS.slice(desdeIndice, hastaIndice).map(function(h){
      return '<option value="' + h + '"' + (h === elegida ? " selected" : "") + ">" + h + "</option>";
    }).join("");
  }

  function formulario(t){
    var id = esc(t.id);
    var c = t.cuando || { modo: "aConfirmar" };
    // Si todavía no tenía fecha, se arranca con valores comunes para tocar lo menos posible
    var dias = c.dias || [], fecha = c.fecha || "", desde = c.desde || "14:00", hasta = c.hasta || "17:00";
    function bloque(modo){ return ' data-bloque="' + modo + '"' + (c.modo === modo ? "" : " hidden"); }
    return '<form class="taller-form" data-id="' + id + '" novalidate>' +
      '<fieldset class="mb-3"><legend class="etiqueta-campo">¿Cuándo es?</legend><div class="chips-panel">' +
        MODOS.map(function(o){
          return '<input type="radio" class="chip-check" name="modo" id="modo-' + o[0] + "-" + id + '" value="' + o[0] + '"' + (c.modo === o[0] ? " checked" : "") + ">" +
            '<label class="pildora" for="modo-' + o[0] + "-" + id + '">' + o[1] + "</label>";
        }).join("") + "</div></fieldset>" +
      '<fieldset class="mb-3"' + bloque("semanal") + '><legend class="etiqueta-campo">Días</legend><div class="chips-panel">' +
        DIAS.map(function(d){
          return '<input type="checkbox" class="chip-check" name="dias" id="dia-' + d[0] + "-" + id + '" value="' + d[0] + '"' + (dias.indexOf(d[0]) >= 0 ? " checked" : "") + ">" +
            '<label class="pildora pildora-dia" for="dia-' + d[0] + "-" + id + '">' + d[1] + "</label>";
        }).join("") + "</div></fieldset>" +
      "<div" + bloque("puntual") + '><label class="etiqueta-campo" for="fecha-' + id + '">Fecha</label>' +
        '<input class="entrada" type="date" id="fecha-' + id + '" name="fecha" min="' + hoyIso() + '" value="' + esc(fecha) + '"></div>' +
      '<fieldset' + (c.modo === "aConfirmar" ? " hidden" : "") + ' data-bloque-horario><legend class="etiqueta-campo">Horario</legend><div class="fila-entrada fila-horario">' +
        '<label class="campo-hora"><span>Desde</span><select class="entrada" name="desde">' + opcionesHora(desde, 0, HORAS.length - 1) + "</select></label>" +
        '<label class="campo-hora"><span>Hasta</span><select class="entrada" name="hasta">' + opcionesHora(hasta, 1, HORAS.length) + "</select></label>" +
      "</div></fieldset>" +
      '<p class="nota-chica mt-2"' + bloque("aConfirmar") + '>En el sitio dice "Fecha a confirmar" y se pueden anotar igual.</p>' +
      // Vista previa con el mismo estilo que la tarjeta del sitio (foto de fondo y degradé vino)
      '<p class="etiqueta-campo mt-3">Así se ve en el sitio</p>' +
      '<div class="previa-sitio">' + (t.img ? '<img src="../' + esc(t.img) + '" alt="">' : "") +
        '<span class="previa-velo" aria-hidden="true"></span><div class="previa-cuerpo">' +
        '<span class="previa-titulo">' + esc(t.nombre) + "</span>" +
        '<span class="previa-horario" data-previa>' + esc(horario(t)) + "</span>" +
        '<span class="previa-boton" aria-hidden="true">Inscribirme →</span></div></div>' +
      '<p class="taller-error" data-error role="alert" hidden></p>' +
      '<div class="taller-botones"><button type="submit" class="btn-grande">Guardar fecha</button>' +
      '<button type="button" class="enlace" data-accion="cancelar">Cancelar</button></div></form>';
  }

  var ICONO_FECHA = '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/></svg>';
  var ICONO_PERSONAS = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.8-3.5 3.4-5.5 6.5-5.5s5.7 2 6.5 5.5M16 4.5a3.5 3.5 0 0 1 0 7M18 14.8c2 .7 3.2 2.5 3.6 5.2"/></svg>';

  // Un día puntual que ya pasó se marca, porque en el sitio pasa a decir "Fecha a confirmar"
  function estado(t){
    if(sinFecha(t)) return '<span class="taller-estado a-confirmar">Fecha a confirmar</span>';
    if(OmasApi.yaPaso(t.cuando)) return '<span class="taller-estado ya-paso">Ya pasó: poné otra fecha</span>';
    return '<span class="taller-estado">Con fecha</span>';
  }

  // Tarjeta vertical: foto grande arriba con el estado, y abajo nombre, fecha, inscriptas y el botón
  function tarjeta(t){
    var editando = abierto === t.id;
    var cant = inscripciones ? inscripciones.filter(function(i){ return i.tallerId === t.id; }).length : null;
    return '<article class="tarjeta taller-card' + (editando ? " editando" : "") + '">' +
      '<div class="taller-card-foto">' + (t.img ? '<img src="../' + esc(t.img) + '" alt="" width="640" height="360" loading="lazy">' : "") +
        estado(t) + "</div>" +
      '<div class="taller-card-cuerpo">' +
        '<h2 class="taller-card-titulo">' + esc(t.nombre) + "</h2>" +
        '<p class="taller-card-fecha">' + ICONO_FECHA + "<span>" + esc(sinFecha(t) ? "Todavía sin fecha" : horario(t)) + "</span></p>" +
        (cant !== null ? '<p class="taller-card-anotadas">' + ICONO_PERSONAS + cant + (cant === 1 ? " inscripta" : " inscriptas") + "</p>" : "") +
        (editando ? formulario(t)
          : puedeEditar ? '<button type="button" class="btn-linea taller-card-boton" data-accion="editar" data-id="' + esc(t.id) + '">Cambiar fecha</button>' : "") +
      "</div></article>";
  }

  function pestanas(){
    if(!puedeEditar) return "";
    var cant = inscripciones ? inscripciones.length : null;
    function pestana(id, texto, extra){
      return '<a class="pestana" href="#' + id + '"' + (vista === id ? ' aria-current="page"' : "") + ">" + texto + (extra || "") + "</a>";
    }
    return '<nav class="pestanas" aria-label="Secciones de Talleres">' +
      pestana("fechas", "Modificar talleres") +
      pestana("inscriptas", "Inscripciones", cant !== null ? '<span class="pestana-num">' + cant + "</span>" : "") + "</nav>";
  }

  function vistaFechas(){
    return '<p class="bajada">Poné cuándo es cada taller. Lo que guardes acá aparece en la página Talleres del sitio.</p>' +
      (puedeEditar ? "" : '<p class="aviso-caja">Podés ver las fechas, pero solo la coordinación y la supervisión las pueden cambiar.</p>') +
      '<div class="taller-grilla">' + talleres.map(tarjeta).join("") + "</div>" +
      // Misma pestaña a propósito: en el prototipo los cambios viven en esta pestaña
      '<a class="btn-linea taller-ver" href="/talleres.html">Ver la página Talleres del sitio</a>' +
      '<p class="nota-chica mt-3">Prototipo con talleres de ejemplo. Los cambios se ven en el sitio solo en esta misma pestaña y se borran al cerrarla.</p>';
  }

  /* ----- Inscriptas ----- */
  function fechaCorta(iso){ return new Date(iso).toLocaleDateString("es-AR", { day: "numeric", month: "short" }); }
  // El DNI se ve tapado en la lista: alcanza con los últimos números para reconocer a la persona
  function dniTapado(dni){ return "•••" + String(dni).slice(-3); }
  function filaInscripta(i){
    var visible = dniVisible[i.id];
    return "<li>" +
      '<div class="inscripta-datos"><strong>' + esc(i.nombre) + "</strong>" +
      '<span class="nota-chica">Se anotó el ' + esc(fechaCorta(i.fecha)) + " · DNI " + esc(visible ? i.dni : dniTapado(i.dni)) +
      ' <button type="button" class="enlace py-0" data-accion="verDni" data-id="' + esc(i.id) + '" aria-pressed="' + !!visible + '"' +
      ' aria-label="' + (visible ? "Ocultar" : "Ver") + " DNI de " + esc(i.nombre) + '">' + (visible ? "Ocultar" : "Ver") + "</button></span></div>" +
      "</li>";
  }

  function vistaInscriptas(){
    if(errorInscripciones) return '<p class="aviso-caja">' + esc(errorInscripciones) + "</p>";
    if(!inscripciones) return '<p class="nota-chica">Cargando inscriptas…</p>';
    function deTaller(t){
      return inscripciones.filter(function(i){ return i.tallerId === t.id; })
        .sort(function(a, b){ return a.fecha < b.fecha ? 1 : -1; }); // las más nuevas arriba
    }
    var opciones = '<option value="todos">Todos los talleres (' + inscripciones.length + ")</option>" + talleres.map(function(t){
      return '<option value="' + esc(t.id) + '"' + (filtro === t.id ? " selected" : "") + ">" + esc(t.nombre) + " (" + deTaller(t).length + ")</option>";
    }).join("");
    var grupos = talleres.filter(function(t){ return filtro === "todos" || filtro === t.id; }).map(function(t){
      var lista = deTaller(t);
      return '<section class="tarjeta"><div class="tarjeta-cabeza"><div><h2 class="tarjeta-titulo">' + esc(t.nombre) + "</h2>" +
        '<p class="tarjeta-sub">' + esc(horario(t) || "Sin fecha") + "</p></div>" +
        '<span class="pestana-num">' + lista.length + "</span></div>" +
        (lista.length ? '<ul class="inscriptas">' + lista.map(filaInscripta).join("") + "</ul>"
          : '<p class="nota-chica mb-0">Todavía no se anotó nadie.</p>') + "</section>";
    }).join("");
    return '<p class="bajada">Quiénes se anotaron desde la página Talleres del sitio.</p>' +
      '<label class="etiqueta-campo" for="filtro-taller">Taller</label>' +
      '<select class="entrada" id="filtro-taller">' + opciones + "</select>" +
      '<div class="taller-lista">' + grupos + "</div>" +
      '<p class="nota-chica mt-3">Prototipo: las personas son inventadas, más las que se anoten desde el sitio en esta misma pestaña.</p>';
  }

  function render(){
    // Si el foco estaba en una pestaña, vuelve a la pestaña actual (redibujar lo perdería)
    var enPestana = document.activeElement && document.activeElement.classList.contains("pestana");
    app.innerHTML = '<h1 class="titulo">Talleres</h1>' + pestanas() +
      (vista === "inscriptas" ? vistaInscriptas() : vistaFechas());
    if(enPestana){ var actual = app.querySelector('.pestana[aria-current="page"]'); if(actual) actual.focus(); }
  }

  async function cargarInscripciones(){
    errorInscripciones = "";
    try { inscripciones = await OmasApi.listarInscripciones(); }
    catch(err){ errorInscripciones = err.message || "No se pudieron cargar las inscriptas."; }
    render();
  }

  // Se pide la lista cada vez que se entra a la pestaña, así aparecen las inscripciones nuevas
  function elegirVista(){
    vista = puedeEditar && location.hash === "#inscriptas" ? "inscriptas" : "fechas";
    abierto = null;
    render();
    // En Modificar talleres también se piden, una vez, para mostrar cuántas tiene cada taller
    if(puedeEditar && (vista === "inscriptas" || !inscripciones)) cargarInscripciones();
  }
  window.addEventListener("hashchange", elegirVista);

  function abrir(id){
    abierto = id; render();
    var campo = app.querySelector('.taller-form input[name="modo"]:checked');
    if(campo) campo.focus();
  }
  function cerrar(){
    var id = abierto;
    abierto = null; render();
    var boton = app.querySelector('[data-accion="editar"][data-id="' + id + '"]');
    if(boton) boton.focus();
  }

  function leer(form){
    var dias = Array.prototype.filter.call(form.querySelectorAll('input[name="dias"]'), function(c){ return c.checked; })
      .map(function(c){ return +c.value; });
    return { modo: form.elements.modo.value, dias: dias, fecha: form.elements.fecha.value,
      desde: form.elements.desde.value, hasta: form.elements.hasta.value };
  }

  // Lo que falta o está mal, con el campo al que hay que llevar el foco. null si está todo bien.
  function revisar(form, c){
    if(c.modo === "semanal" && !c.dias.length) return { texto: "Tocá al menos un día.", campo: form.querySelector('input[name="dias"]') };
    if(c.modo === "puntual" && !c.fecha) return { texto: "Elegí la fecha del taller.", campo: form.elements.fecha };
    if(c.modo === "puntual" && c.fecha < hoyIso()) return { texto: "Esa fecha ya pasó. Elegí una de hoy en adelante.", campo: form.elements.fecha };
    if(c.modo !== "aConfirmar" && c.hasta <= c.desde) return { texto: "La hora de fin tiene que ser después de la de inicio.", campo: form.elements.hasta };
    return null;
  }

  // Muestra solo lo que corresponde al modo elegido y actualiza la vista previa
  function actualizar(form){
    var c = leer(form);
    form.querySelectorAll("[data-bloque]").forEach(function(b){ b.hidden = b.dataset.bloque !== c.modo; });
    form.querySelector("[data-bloque-horario]").hidden = c.modo === "aConfirmar";
    // Mientras falte algo, la vista previa no muestra un texto a medias
    var problema = c.modo === "aConfirmar" ? null : revisar(form, c);
    form.querySelector("[data-previa]").textContent = problema ? "(completá la fecha)" : OmasApi.textoFecha(c);
  }

  app.addEventListener("click", function(e){
    var el = e.target.closest("[data-accion]");
    if(!el) return;
    if(el.dataset.accion === "editar") abrir(el.dataset.id);
    if(el.dataset.accion === "cancelar") cerrar();
    if(el.dataset.accion === "verDni"){
      dniVisible[el.dataset.id] = !dniVisible[el.dataset.id];
      render();
      var boton = app.querySelector('[data-accion="verDni"][data-id="' + el.dataset.id + '"]');
      if(boton) boton.focus();
    }
  });

  app.addEventListener("change", function(e){
    if(e.target.id !== "filtro-taller") return;
    filtro = e.target.value; render();
    document.getElementById("filtro-taller").focus();
  });

  // La vista previa cambia mientras eligen, sin redibujar (así no se pierde el foco)
  app.addEventListener("input", function(e){
    var form = e.target.closest(".taller-form");
    if(!form) return;
    actualizar(form);
    form.querySelector("[data-error]").hidden = true;
  });

  app.addEventListener("keydown", function(e){
    if(e.key === "Escape" && e.target.closest(".taller-form")) cerrar();
  });

  app.addEventListener("submit", async function(e){
    var form = e.target.closest(".taller-form");
    if(!form) return;
    e.preventDefault();
    var datos = leer(form), error = form.querySelector("[data-error]");
    var problema = revisar(form, datos);
    if(problema){
      error.textContent = problema.texto;
      error.hidden = false; problema.campo.focus(); return;
    }
    var boton = form.querySelector('[type="submit"]');
    boton.disabled = true; boton.textContent = "Guardando…";
    try {
      var actualizado = await OmasApi.guardarFechaTaller(form.dataset.id, datos);
      talleres = talleres.map(function(t){ return t.id === actualizado.id ? actualizado : t; });
      cerrar();
      avisar("Listo, la fecha ya se ve en el sitio");
    } catch(err){
      error.textContent = err.message || "No se pudo guardar. Probá de nuevo.";
      error.hidden = false;
      boton.disabled = false; boton.textContent = "Guardar fecha";
    }
  });

  async function iniciar(){
    var usuario = await OmasApi.exigirSesion();
    OmasMenu.iniciar(usuario);
    puedeEditar = usuario.rol === "Coordinadora" || usuario.rol === "Supervisión";
    try {
      talleres = await OmasApi.listarTalleres();
      elegirVista();
    } catch(err){
      app.innerHTML = '<h1 class="titulo">Talleres</h1><p class="aviso-caja">' + esc(err.message || "No se pudieron cargar los talleres.") + "</p>";
    }
  }
  iniciar();
})();
