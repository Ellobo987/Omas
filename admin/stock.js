/* ===== SGI-OMAS · Stock del depósito =====
   Qué fardos hay en el depósito y en qué sección están (lo que tienen las costureras en su casa no se cuenta acá).
   · Una lista corta: un renglón por sección con sus kilos. Se toca y se despliegan sus fardos, de a una sección.
     "Sin clasificar" va primero y arranca abierta: es lo que hay que hacer.
   · Al tocar un fardo sube una hoja con su detalle, para moverlo y ver su historial.
     Entero conserva el código (no hay que cambiar la etiqueta); una parte sale como fardo nuevo con su código.
     A Descarte, esos kilos salen del depósito. Lo movido entero se puede deshacer.
   Todo pasa por OmasApi (api.js): listarFardos, moverFardo y deshacerMovimiento. Con la API los fardos son
   los bultos de la base (tabla Bulto); el historial y la ubicación solo existen en el modo prototipo. */
(function(){
  "use strict";

  var app = document.getElementById("app");
  var hoja = document.getElementById("hoja");
  var avisoEl = document.getElementById("aviso");
  var SECCIONES = OmasApi.SECCIONES_DEPOSITO;
  var SIN_CLASIFICAR = "Sin clasificar";
  var DIAS_AVISO = 7; // más de una semana sin clasificar se marca
  var fardos = [], abierta = null, elegido = null, ultimo = null, avisoReloj;

  var FLECHA = '<svg class="stock-flecha" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg>';

  /* ----- Ayudas ----- */
  function esc(s){ return String(s == null ? "" : s).replace(/[&<>"']/g, function(c){ return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function kg(n){ return n.toLocaleString("es-AR", { maximumFractionDigits: 2 }) + " kg"; }
  function decimal(v){ var n = parseFloat(String(v || "").replace(",", ".")); return isNaN(n) ? 0 : Math.round(n * 100) / 100; }
  function avisar(texto){
    avisoEl.textContent = texto; avisoEl.classList.add("ver");
    clearTimeout(avisoReloj);
    avisoReloj = setTimeout(function(){ avisoEl.classList.remove("ver"); }, 2600);
  }
  function seccionDe(material){ return SECCIONES.filter(function(s){ return s.material === material; })[0]; }
  function diasDesde(iso){
    var p = iso.split("-"), h = new Date(); h.setHours(0, 0, 0, 0);
    return Math.round((h - new Date(+p[0], +p[1] - 1, +p[2])) / 864e5);
  }
  function textoDias(n){ return n <= 0 ? "hoy" : n === 1 ? "ayer" : "hace " + n + " días"; }
  function fechaHora(iso){
    var d = new Date(iso);
    return d.toLocaleDateString("es-AR", { day: "numeric", month: "numeric" }) + " " + d.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" });
  }
  function total(lista){ return lista.reduce(function(s, f){ return s + f.kg; }, 0); }
  function cantidad(n){ return n === 1 ? "1 fardo" : n + " fardos"; }
  function porCodigo(codigo){ return fardos.filter(function(f){ return f.codigo === codigo; })[0]; }
  function fardosDe(s){
    return fardos.filter(function(f){ return f.material === s.material; })
      // Lo que falta clasificar, lo más viejo arriba; lo demás por código
      .sort(function(a, b){ return s.material === SIN_CLASIFICAR ? (a.entro < b.entro ? -1 : 1) : (a.codigo < b.codigo ? -1 : 1); });
  }
  // Las secciones que se muestran: "Sin clasificar" primero; Descarte no, porque ya salió del depósito
  function secciones(){
    var lista = SECCIONES.filter(function(s){ return !s.sale; });
    return lista.filter(function(s){ return s.material === SIN_CLASIFICAR; }).concat(lista.filter(function(s){ return s.material !== SIN_CLASIFICAR; }));
  }

  /* ----- Lo que se acaba de mover (con Deshacer) ----- */
  function cajaUltimo(){
    if(!ultimo) return "";
    var r = ultimo.resultado, texto;
    if(r.nuevo) texto = "Salieron " + kg(r.kg) + " de " + esc(r.origen.codigo) + " a " + esc(r.destino) + ". Escribí el código nuevo en la bolsa:";
    else if(r.origen.kg <= 0) texto = esc(r.origen.codigo) + " fue entero a " + esc(r.destino) + " (" + kg(r.kg) + ").";
    else if(r.origen.material === ultimo.materialAntes) texto = "Salieron " + kg(r.kg) + " de " + esc(r.origen.codigo) + " a " + esc(r.destino) + ".";
    else texto = esc(r.origen.codigo) + " pasó entero a " + esc(r.destino) + ". Sigue con el mismo código.";
    return '<div class="info-caja stock-ultimo" id="ultimo" tabindex="-1">' +
      '<p class="mb-0">' + texto + (r.nuevo ? ' <span class="etiqueta-codigo">' + esc(r.nuevo.codigo) + "</span>" : "") + "</p>" +
      // Lo separado en una parte no se puede deshacer con la API (la base no junta bultos)
      '<div class="stock-ultimo-botones">' + (r.movimiento ? '<button type="button" class="pildora" data-accion="deshacer">Deshacer</button>' : "") +
      '<button type="button" class="enlace" data-accion="cerrarUltimo">Listo</button></div></div>';
  }

  /* ----- Lista de secciones ----- */
  function filaFardo(f){
    var dias = diasDesde(f.entro), viejo = f.material === SIN_CLASIFICAR && dias >= DIAS_AVISO;
    return '<li><button type="button" class="fardo-fila" data-accion="ver" data-codigo="' + esc(f.codigo) + '">' +
      '<span class="etiqueta-codigo">' + esc(f.codigo) + "</span>" +
      // Lo que lleva una semana o más sin clasificar se marca en rojo
      '<span class="fardo-fila-texto">' + esc(f.empresa) + " · " + (viejo ? '<span class="chip chip-atraso">' + textoDias(dias) + "</span>" : textoDias(dias)) + "</span>" +
      '<strong class="fardo-fila-kg">' + kg(f.kg) + "</strong>" + FLECHA + "</button></li>";
  }
  function seccion(s){
    var lista = fardosDe(s), abierto = abierta === s.id, id = "sec-" + s.id;
    var pendiente = s.material === SIN_CLASIFICAR;
    return '<section class="stock-grupo' + (pendiente ? " pendiente" : "") + (abierto ? " abierto" : "") + '">' +
      '<button type="button" class="stock-fila" data-accion="seccion" data-seccion="' + s.id + '" aria-expanded="' + abierto + '" aria-controls="' + id + '">' +
        '<span class="stock-fila-texto"><strong>' + esc(s.nombre) + "</strong><small>" + cantidad(lista.length) + "</small></span>" +
        '<span class="stock-fila-kg">' + kg(total(lista)) + "</span>" + FLECHA + "</button>" +
      '<ul class="stock-fardos" id="' + id + '"' + (abierto ? "" : " hidden") + ">" + lista.map(filaFardo).join("") + "</ul></section>";
  }

  function render(foco){
    var conFardos = secciones().filter(function(s){ return fardosDe(s).length; });
    var vacias = secciones().filter(function(s){ return !fardosDe(s).length; });
    app.innerHTML = '<h1 class="titulo">Stock del depósito</h1>' +
      '<p class="bajada">' + kg(total(fardos)) + " en " + cantidad(fardos.length) + ". Tocá una sección para ver sus fardos.</p>" +
      cajaUltimo() +
      '<div class="stock-lista">' + conFardos.map(seccion).join("") + "</div>" +
      (vacias.length ? '<p class="nota-chica mt-3">Sin fardos: ' + vacias.map(function(s){ return esc(s.nombre); }).join(", ") + ".</p>" : "");
    if(foco){ var el = app.querySelector(foco); if(el) el.focus(); }
  }

  /* ----- Hoja con el detalle de un fardo ----- */
  function dibujarHoja(){
    var f = porCodigo(elegido), s = seccionDe(f.material), dias = diasDesde(f.entro);
    var opciones = SECCIONES.filter(function(x){ return x.material !== f.material; });
    hoja.innerHTML = '<div class="hoja-panel" role="dialog" aria-modal="true" aria-labelledby="hoja-titulo">' +
      '<div class="pedido-top mb-1"><span class="etiqueta-codigo grande" id="hoja-titulo">' + esc(f.codigo) + "</span>" +
        '<span class="chip ' + (f.material === SIN_CLASIFICAR ? "chip-alerta" : "chip-neutro") + '">' + esc(s.nombre) + "</span></div>" +
      '<p class="fardo-kg">' + kg(f.kg) + "</p>" +
      '<p class="nota-chica">De ' + esc(f.empresa) + " · entró " + textoDias(dias) + " · " + esc(f.ubicacion || "remito " + f.remito) + "</p>" +
      '<form class="pedido-form mover-form" novalidate>' +
        '<fieldset><legend class="etiqueta-campo">' + (f.material === SIN_CLASIFICAR ? "¿A dónde va?" : "¿A dónde lo movés?") + '</legend><div class="chips-panel">' +
        opciones.map(function(x){
          return '<input type="radio" class="chip-check" name="destino" id="destino-' + x.id + '" value="' + x.id + '">' +
            '<label class="pildora' + (x.sale ? " pildora-descarte" : "") + '" for="destino-' + x.id + '">' + esc(x.nombre) + "</label>";
        }).join("") + "</div></fieldset>" +
        '<fieldset class="mt-3"><legend class="etiqueta-campo">¿Cuánto?</legend><div class="chips-panel">' +
          '<input type="radio" class="chip-check" name="cuanto" id="cuanto-todo" value="todo" checked>' +
          '<label class="pildora" for="cuanto-todo">Todo (' + kg(f.kg) + ")</label>" +
          '<input type="radio" class="chip-check" name="cuanto" id="cuanto-parte" value="parte">' +
          '<label class="pildora" for="cuanto-parte">Una parte</label></div></fieldset>' +
        '<div class="mover-parte" hidden><label class="etiqueta-campo mt-3" for="mover-kg">¿Cuántos kilos?</label>' +
          '<input class="entrada mb-0" id="mover-kg" name="kg" inputmode="decimal" placeholder="Ej.: 12,5"></div>' +
        '<p class="nota-chica mt-2 mb-0">Entero sigue con el mismo código. Una parte sale como fardo nuevo, con otro código.</p>' +
        '<p class="taller-error" data-error role="alert" hidden></p>' +
        '<button type="submit" class="btn-grande mt-3">Mover</button>' +
        '<button type="button" class="enlace w-100" data-cerrar>Cancelar</button></form>' +
      // El historial solo existe en el prototipo: la base no guarda los movimientos (no hay tabla en el modelo)
      (f.historial ? '<details class="pedido-mensaje fardo-historial mt-2 mb-0"><summary>Historial (' + f.historial.length + ")</summary>" +
        '<ul class="pedido-lista mt-2">' + f.historial.slice().reverse().map(function(h){
          return "<li><span>" + esc(h.texto) + '<small class="d-block nota-chica">' + esc(h.por) + "</small></span><time>" + esc(fechaHora(h.fecha)) + "</time></li>";
        }).join("") + "</ul></details>" : "") + "</div>";
  }
  function abrirHoja(codigo){
    elegido = codigo; dibujarHoja(); hoja.hidden = false;
    hoja.querySelector('input[name="destino"]').focus();
  }
  function cerrarHoja(){
    var era = elegido;
    hoja.hidden = true; hoja.innerHTML = ""; elegido = null;
    var fila = app.querySelector('[data-accion="ver"][data-codigo="' + era + '"]');
    if(fila) fila.focus();
  }

  async function cargar(){ fardos = await OmasApi.listarFardos(); }

  /* ----- Clics en la lista ----- */
  app.addEventListener("click", async function(e){
    var el = e.target.closest("[data-accion]");
    if(!el || el.disabled) return;
    switch(el.dataset.accion){
      case "seccion":
        // De a una sección abierta: así la lista no se hace larga
        abierta = abierta === el.dataset.seccion ? null : el.dataset.seccion;
        render('[data-seccion="' + el.dataset.seccion + '"]');
        break;
      case "ver": abrirHoja(el.dataset.codigo); break;
      case "cerrarUltimo": ultimo = null; render(".stock-fila"); break;
      case "deshacer":
        el.disabled = true;
        try {
          await OmasApi.deshacerMovimiento(ultimo.resultado.movimiento);
          ultimo = null; await cargar(); render(".stock-fila");
          avisar("Listo, se deshizo el movimiento");
        } catch(err){ el.disabled = false; avisar(err.message || "No se pudo deshacer."); }
        break;
    }
  });

  /* ----- La hoja ----- */
  hoja.addEventListener("click", function(e){
    if(e.target === hoja || e.target.closest("[data-cerrar]")) cerrarHoja();
  });
  document.addEventListener("keydown", function(e){
    if(e.key === "Escape" && !hoja.hidden) cerrarHoja();
  });
  // "Una parte" muestra el campo de kilos, sin volver a dibujar
  hoja.addEventListener("change", function(e){
    if(e.target.name !== "cuanto") return;
    var form = e.target.form, parte = e.target.value === "parte";
    form.querySelector(".mover-parte").hidden = !parte;
    if(parte) form.elements.kg.focus();
  });
  hoja.addEventListener("input", function(){
    var error = hoja.querySelector("[data-error]");
    if(error) error.hidden = true;
  });

  hoja.addEventListener("submit", async function(e){
    e.preventDefault();
    var form = e.target, f = porCodigo(elegido);
    var destino = form.elements.destino.value, parte = form.elements.cuanto.value === "parte";
    var cuanto = parte ? decimal(form.elements.kg.value) : f.kg;
    var error = form.querySelector("[data-error]"), boton = form.querySelector('[type="submit"]');
    function mal(texto, campo){ error.textContent = texto; error.hidden = false; if(campo) campo.focus(); }
    if(!destino) return mal("Elegí a dónde va.", form.querySelector('input[name="destino"]'));
    if(parte && cuanto <= 0) return mal("Poné cuántos kilos movés.", form.elements.kg);
    if(parte && cuanto > f.kg + 0.05) return mal("El fardo tiene " + kg(f.kg) + ": no se puede mover más que eso.", form.elements.kg);
    boton.disabled = true;
    try {
      var materialAntes = f.material;
      var r = await OmasApi.moverFardo(f.codigo, destino, cuanto);
      ultimo = { resultado: r, materialAntes: materialAntes };
      hoja.hidden = true; hoja.innerHTML = ""; elegido = null;
      await cargar(); render("#ultimo");
    } catch(err){
      boton.disabled = false;
      mal(err.message || "No se pudo mover el fardo.");
    }
  });

  async function iniciar(){
    var yo = await OmasApi.exigirSesion();
    OmasMenu.iniciar(yo);
    try {
      await cargar();
      // Si hay algo sin clasificar, esa sección arranca abierta
      if(fardos.some(function(f){ return f.material === SIN_CLASIFICAR; })) abierta = "sinClasificar";
      render();
    } catch(err){
      app.innerHTML = '<h1 class="titulo">Stock del depósito</h1><p class="aviso-caja">' + esc(err.message || "No se pudo cargar el stock.") + "</p>";
    }
  }
  iniciar();
})();
