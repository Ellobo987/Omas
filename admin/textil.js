/* ===== SGI-OMAS · Taller textil: pedidos de clientes (proceso) =====
   Tres secciones (cambian con el # de la dirección, y están en el menú lateral):
   · Bandeja (#bandeja): los pedidos que entraron solos. El bot de WhatsApp, Gmail o el formulario del sitio
     ya los dejan ordenados (cliente, producto, medida, cantidad, fecha). Administración (Sandra) los acepta,
     los rechaza con un motivo o le pide más datos al cliente. Ya no hace falta pasarlos a mano.
   · En producción (#curso): lo aceptado. El taller pide el lienzo al depósito (se descuenta del fardo),
     reparte las bolsas entre las operarias (cada una hace la bolsa entera), suma las terminadas
     y registra las entregas con remito, en una o varias veces.
   · Cerrados (#cerrados): entregados y rechazados.
   Todo pasa por OmasApi (api.js). Para cargar lo menos posible: los datos del pedido los arma el bot,
   y lo demás se elige tocando (operaria, fardo, motivo) con las cantidades ya propuestas. */
(function(){
  "use strict";

  var app = document.getElementById("app");
  var avisoEl = document.getElementById("aviso");
  var pedidos = [], operarias = [], fardos = null, yo = null, avisoReloj;
  var vista = "bandeja", abierto = null, respondiendo = null; // respondiendo = { id, modo: "rechazar" | "masDatos" }
  var puedeAceptar = false, puedeOrganizar = false;

  var MOTIVOS = ["No llegamos con la fecha", "No hay lienzo suficiente", "La medida no la hacemos", "Otro motivo"];
  var CANAL = {
    whatsapp: { nombre: "WhatsApp", icono: '<path d="M4 20l1.3-3.8A8 8 0 1 1 8 19z"/><path d="M9 9.5c.3 1.8 1.7 3.3 3.5 3.8l1.2-1 2 .8c-.2 1.2-1.2 1.9-2.4 1.8-3-.3-5.4-2.8-5.6-5.8 0-1.1.7-2.1 1.8-2.3l.8 2z"/>' },
    gmail: { nombre: "Gmail", icono: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/>' },
    web: { nombre: "Formulario del sitio", icono: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.5 2.6 3.7 5.6 3.7 9s-1.2 6.4-3.7 9c-2.5-2.6-3.7-5.6-3.7-9S9.5 5.6 12 3z"/>' }
  };

  /* ----- Ayudas ----- */
  function esc(s){ return String(s == null ? "" : s).replace(/[&<>"']/g, function(c){ return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function num(n){ return Number(n).toLocaleString("es-AR"); }
  function entero(v){ var n = parseInt(String(v || "").replace(/\D/g, ""), 10); return isNaN(n) ? 0 : n; }
  function decimal(v){ var n = parseFloat(String(v || "").replace(",", ".")); return isNaN(n) ? 0 : Math.round(n * 100) / 100; }
  function avisar(texto){
    avisoEl.textContent = texto; avisoEl.classList.add("ver");
    clearTimeout(avisoReloj);
    avisoReloj = setTimeout(function(){ avisoEl.classList.remove("ver"); }, 2600);
  }
  function leerFecha(iso){ var p = iso.split("-"); return new Date(+p[0], +p[1] - 1, +p[2]); }
  function diasHasta(iso){ var h = new Date(); h.setHours(0, 0, 0, 0); return Math.round((leerFecha(iso) - h) / 864e5); }
  function fechaCorta(iso){ return leerFecha(iso).toLocaleDateString("es-AR", { weekday: "short", day: "numeric", month: "numeric" }); }
  function hace(isoHora){
    var min = Math.round((Date.now() - new Date(isoHora)) / 6e4);
    if(min < 2) return "recién";
    if(min < 60) return "hace " + min + " min";
    var h = Math.round(min / 60);
    return h < 24 ? "hace " + h + " h" : "hace " + Math.round(h / 24) + (Math.round(h / 24) === 1 ? " día" : " días");
  }
  function chipEntrega(iso){
    var n = diasHasta(iso);
    if(n < 0) return '<span class="chip chip-atraso">' + (n === -1 ? "1 día de atraso" : (-n) + " días de atraso") + "</span>";
    if(n === 0) return '<span class="chip chip-alerta">se entrega hoy</span>';
    if(n <= 3) return '<span class="chip chip-alerta">' + (n === 1 ? "se entrega mañana" : "faltan " + n + " días") + "</span>";
    return '<span class="chip chip-ok">faltan ' + n + " días</span>";
  }
  function sumar(lista, campo){ return (lista || []).reduce(function(s, x){ return s + x[campo]; }, 0); }
  function asignadas(p){ return sumar(p.reparto, "asignadas"); }
  function terminadas(p){ return sumar(p.reparto, "terminadas"); }
  function entregadas(p){ return sumar(p.entregas, "cantidad"); }
  function porId(id){ return pedidos.filter(function(p){ return p.id === id; })[0]; }
  function reemplazar(p){ pedidos = pedidos.map(function(x){ return x.id === p.id ? p : x; }); }

  // En qué sección va cada pedido
  function seccion(p){
    if(p.estado === "nuevo" || p.estado === "masDatos") return "bandeja";
    if(p.estado === "rechazado" || entregadas(p) >= p.cantidad) return "cerrados";
    return "curso";
  }
  // Qué le falta a un pedido en producción (en el orden en que se hace)
  function etapa(p){
    if(!p.material.length) return { texto: "Falta pedir el lienzo", clase: "chip-alerta" };
    if(asignadas(p) < p.cantidad) return { texto: "Falta repartir", clase: "chip-alerta" };
    if(terminadas(p) < p.cantidad) return { texto: "En producción", clase: "chip-neutro" };
    return { texto: "Listo para entregar", clase: "chip-ok" };
  }

  /* ----- Bandeja ----- */
  function canal(p){
    var c = CANAL[p.canal];
    return '<span class="canal canal-' + p.canal + '"><svg viewBox="0 0 24 24" aria-hidden="true">' + c.icono + "</svg>" + c.nombre + "</span>";
  }
  function datosPedido(p){
    var filas = [["Producto", esc(p.producto)], ["Medida", esc(p.medida)], ["Cantidad", num(p.cantidad) + " bolsas"],
      ["Para el", esc(fechaCorta(p.entrega)) + " " + chipEntrega(p.entrega)]];
    if(p.ordenCompra) filas.push(["Orden de compra", esc(p.ordenCompra)]);
    return '<dl class="pedido-datos">' + filas.map(function(f){ return "<div><dt>" + f[0] + "</dt><dd>" + f[1] + "</dd></div>"; }).join("") + "</dl>";
  }
  function accionesBandeja(p){
    if(!puedeAceptar) return '<p class="nota-chica mb-0">Los pedidos los acepta Administración.</p>';
    if(respondiendo && respondiendo.id === p.id && respondiendo.modo === "rechazar"){
      return '<form class="pedido-form" data-form="rechazar" data-id="' + p.id + '"><fieldset><legend class="etiqueta-campo">¿Por qué no lo tomamos?</legend><div class="chips-panel">' +
        MOTIVOS.map(function(m, i){
          return '<input type="radio" class="chip-check" name="motivo" id="motivo-' + i + "-" + p.id + '" value="' + esc(m) + '"' + (i === 0 ? " checked" : "") + ">" +
            '<label class="pildora" for="motivo-' + i + "-" + p.id + '">' + esc(m) + "</label>";
        }).join("") + '</div></fieldset><p class="nota-chica mt-2">El bot le avisa al cliente por ' + CANAL[p.canal].nombre + ".</p>" +
        '<button type="submit" class="btn-peligro mt-2">Rechazar el pedido</button>' +
        '<button type="button" class="enlace" data-accion="noResponder">Volver</button></form>';
    }
    if(respondiendo && respondiendo.id === p.id && respondiendo.modo === "masDatos"){
      return '<form class="pedido-form" data-form="masDatos" data-id="' + p.id + '">' +
        '<label class="etiqueta-campo" for="consulta-' + p.id + '">¿Qué le preguntamos al cliente?</label>' +
        '<textarea class="entrada mb-1" id="consulta-' + p.id + '" name="consulta" rows="2" maxlength="200" placeholder="Ej.: ¿Las quieren con manija larga o corta?"></textarea>' +
        '<p class="nota-chica">El bot se lo manda por ' + CANAL[p.canal].nombre + " y la respuesta vuelve a esta bandeja.</p>" +
        '<p class="taller-error" data-error role="alert" hidden></p>' +
        '<button type="submit" class="btn-grande">Enviar la pregunta</button>' +
        '<button type="button" class="enlace" data-accion="noResponder">Volver</button></form>';
    }
    return '<div class="pedido-acciones"><button type="button" class="btn-grande" data-accion="aceptar" data-id="' + p.id + '">Aceptar el pedido</button>' +
      '<div class="pedido-acciones-dos"><button type="button" class="btn-linea" data-accion="masDatos" data-id="' + p.id + '">Pedir más datos</button>' +
      '<button type="button" class="btn-linea texto-peligro" data-accion="rechazar" data-id="' + p.id + '">Rechazar</button></div></div>';
  }
  function tarjetaBandeja(p){
    return '<article class="tarjeta pedido-card" id="pedido-' + p.id + '">' +
      '<div class="pedido-top">' + canal(p) + '<span class="nota-chica">' + esc(p.numero) + " · " + hace(p.recibido) + "</span></div>" +
      '<h2 class="pedido-cliente">' + esc(p.cliente) + "</h2>" + datosPedido(p) +
      (p.estado === "masDatos" ? '<p class="aviso-caja"><strong>Esperando respuesta del cliente:</strong> ' + esc(p.consulta) + "</p>" : "") +
      '<details class="pedido-mensaje"><summary>Ver el mensaje original</summary><p>' + esc(p.mensaje) + "</p></details>" +
      accionesBandeja(p) + "</article>";
  }
  function vistaBandeja(lista){
    return '<div class="info-caja bot-caja"><p class="mb-2"><strong>Los pedidos llegan solos.</strong> El bot lee los WhatsApp, los mails y el formulario del sitio, ' +
      "y deja cada pedido ordenado acá. Solo hay que revisarlo y aceptarlo.</p>" +
      '<button type="button" class="pildora" data-accion="simular">Simular un pedido nuevo por WhatsApp</button></div>' +
      (lista.length ? lista.map(tarjetaBandeja).join("") : '<p class="vacio">No hay pedidos nuevos. Todo revisado.</p>');
  }

  /* ----- En producción ----- */
  function barra(valor, total, etiqueta){
    var pct = total ? Math.min(100, valor / total * 100) : 0;
    return '<div class="avance" role="img" aria-label="' + esc(etiqueta) + '"><i style="width:' + pct.toFixed(1) + '%"></i></div>';
  }
  function seccionMaterial(p){
    var html = '<h3 class="pedido-sub">1. Lienzo del depósito</h3>';
    html += p.material.length
      ? '<ul class="pedido-lista">' + p.material.map(function(m){ return "<li><span class=\"etiqueta-codigo\">" + esc(m.fardo) + "</span><span>" + num(m.kg) + " kg</span></li>"; }).join("") + "</ul>"
      : '<p class="nota-chica">Todavía no se pidió lienzo para este pedido.</p>';
    if(!puedeOrganizar) return html;
    if(!fardos) return html + '<p class="nota-chica">Cargando el lienzo del depósito…</p>';
    if(!fardos.length) return html + '<p class="aviso-caja">No hay lienzo en el depósito.</p>';
    return html + '<form class="pedido-form" data-form="material" data-id="' + p.id + '"><fieldset><legend class="etiqueta-campo">¿De qué fardo?</legend><div class="fardos-lista">' +
      fardos.map(function(f, i){
        return '<input type="radio" class="chip-check" name="fardo" id="fardo-' + f.codigo + "-" + p.id + '" value="' + esc(f.codigo) + '"' + (i === 0 ? " checked" : "") + ">" +
          '<label class="fardo-opcion" for="fardo-' + f.codigo + "-" + p.id + '"><span class="etiqueta-codigo">' + esc(f.codigo) + "</span><span>" + num(f.kg) + " kg · " + esc(f.ubicacion) + "</span></label>";
      }).join("") + "</div></fieldset>" +
      '<label class="etiqueta-campo mt-2" for="kg-' + p.id + '">Kilos que se lleva el taller</label>' +
      '<div class="form-linea"><input class="entrada" id="kg-' + p.id + '" name="kg" inputmode="decimal" placeholder="Ej.: 12,5"><button type="submit" class="btn-linea">Pedir al depósito</button></div>' +
      '<p class="taller-error" data-error role="alert" hidden></p></form>';
  }
  function seccionReparto(p){
    var libres = p.cantidad - asignadas(p);
    var html = '<h3 class="pedido-sub">2. Reparto entre las operarias</h3>';
    html += p.reparto.length ? '<ul class="reparto">' + p.reparto.map(function(r, i){
      var faltan = r.asignadas - r.terminadas;
      return '<li><div class="reparto-cabeza"><strong>' + esc(r.operaria) + "</strong><span>" + num(r.terminadas) + " de " + num(r.asignadas) + "</span></div>" +
        barra(r.terminadas, r.asignadas, num(r.terminadas) + " de " + num(r.asignadas) + " bolsas terminadas") +
        (puedeOrganizar && faltan > 0 ? '<form class="pedido-form form-linea mt-2" data-form="terminadas" data-id="' + p.id + '" data-operaria="' + esc(r.operaria) + '">' +
          '<label class="oculto-visual" for="term-' + i + "-" + p.id + '">Bolsas terminadas por ' + esc(r.operaria) + "</label>" +
          '<input class="entrada" id="term-' + i + "-" + p.id + '" name="cantidad" inputmode="numeric" value="' + faltan + '">' +
          '<button type="submit" class="btn-linea">Sumar terminadas</button></form>' : "") + "</li>";
    }).join("") + "</ul>" : '<p class="nota-chica">Todavía no se repartió.</p>';
    if(!puedeOrganizar || libres <= 0) return html;
    var libresOperarias = operarias.filter(function(o){ return !p.reparto.some(function(r){ return r.operaria === o; }); });
    var lista = libresOperarias.length ? libresOperarias : operarias;
    return html + '<form class="pedido-form" data-form="reparto" data-id="' + p.id + '"><p class="mb-2"><strong>Faltan repartir ' + num(libres) + " bolsas.</strong></p>" +
      '<fieldset><legend class="etiqueta-campo">¿A quién?</legend><div class="chips-panel">' +
      lista.map(function(o, i){
        return '<input type="radio" class="chip-check" name="operaria" id="op-' + i + "-" + p.id + '" value="' + esc(o) + '"' + (i === 0 ? " checked" : "") + ">" +
          '<label class="pildora" for="op-' + i + "-" + p.id + '">' + esc(o.split(" ")[0]) + "</label>";
      }).join("") + "</div></fieldset>" +
      '<label class="etiqueta-campo mt-2" for="cant-' + p.id + '">¿Cuántas bolsas?</label>' +
      '<div class="form-linea"><input class="entrada" id="cant-' + p.id + '" name="cantidad" inputmode="numeric" value="' + libres + '"><button type="submit" class="btn-linea">Asignar</button></div>' +
      '<p class="taller-error" data-error role="alert" hidden></p></form>';
  }
  function seccionEntregas(p){
    var listas = terminadas(p) - entregadas(p);
    var html = '<h3 class="pedido-sub">3. Entregas al cliente</h3>';
    html += p.entregas.length ? '<ul class="pedido-lista">' + p.entregas.map(function(e){
      return "<li><span>" + esc(fechaCorta(e.fecha)) + " · <strong>" + num(e.cantidad) + " bolsas</strong></span><span class=\"nota-chica\">Remito " + esc(e.remito) + "</span></li>";
    }).join("") + "</ul>" : '<p class="nota-chica">Todavía no se entregó nada.</p>';
    if(!puedeOrganizar) return html;
    if(listas <= 0) return html + (entregadas(p) < p.cantidad ? '<p class="nota-chica">Cuando haya bolsas terminadas se pueden entregar.</p>' : "");
    return html + '<form class="pedido-form" data-form="entrega" data-id="' + p.id + '"><p class="mb-2"><strong>Hay ' + num(listas) + " bolsas listas para entregar.</strong></p>" +
      '<div class="fila-entrada"><label class="campo-hora"><span>Cantidad</span><input class="entrada" name="cantidad" inputmode="numeric" value="' + listas + '"></label>' +
      '<label class="campo-hora"><span>Número de remito</span><input class="entrada" name="remito" inputmode="numeric" placeholder="0001-00000413"></label></div>' +
      '<p class="taller-error" data-error role="alert" hidden></p>' +
      '<button type="submit" class="btn-grande mt-3">Registrar la entrega</button></form>';
  }
  function tarjetaCurso(p){
    var e = etapa(p), t = terminadas(p), en = entregadas(p), abre = abierto === p.id;
    return '<article class="tarjeta pedido-card" id="pedido-' + p.id + '">' +
      '<div class="pedido-top"><span class="chip ' + e.clase + '">' + e.texto + "</span>" + chipEntrega(p.entrega) + "</div>" +
      '<h2 class="pedido-cliente">' + esc(p.cliente) + "</h2>" +
      '<p class="nota-chica mb-2">' + esc(p.numero) + " · " + esc(p.producto) + " · " + esc(p.medida) + "</p>" +
      barra(t, p.cantidad, num(t) + " de " + num(p.cantidad) + " bolsas terminadas") +
      '<p class="pedido-pie"><b>' + num(t) + "</b> de " + num(p.cantidad) + " terminadas · " + num(en) + " entregadas</p>" +
      (abre ? '<div class="pedido-detalle">' + seccionMaterial(p) + seccionReparto(p) + seccionEntregas(p) + "</div>" : "") +
      '<button type="button" class="btn-linea mt-3" data-accion="abrir" data-id="' + p.id + '" aria-expanded="' + abre + '">' +
        (abre ? "Cerrar" : puedeOrganizar ? "Organizar el pedido" : "Ver el detalle") + "</button></article>";
  }

  /* ----- Cerrados ----- */
  function tarjetaCerrado(p){
    var rechazado = p.estado === "rechazado";
    return '<article class="tarjeta pedido-card cerrado">' +
      '<div class="pedido-top"><span class="chip ' + (rechazado ? "chip-atraso" : "chip-ok") + '">' + (rechazado ? "Rechazado" : "Entregado") + "</span>" +
        '<span class="nota-chica">' + esc(p.numero) + "</span></div>" +
      '<h2 class="pedido-cliente">' + esc(p.cliente) + "</h2>" +
      '<p class="nota-chica mb-0">' + num(p.cantidad) + " " + esc(p.producto.toLowerCase()) + " · " + esc(p.medida) +
        (rechazado ? " · Motivo: " + esc(p.motivo) : " · " + p.entregas.length + (p.entregas.length === 1 ? " entrega" : " entregas")) + "</p></article>";
  }

  /* ----- Pantalla ----- */
  function render(foco){
    var grupos = { bandeja: [], curso: [], cerrados: [] };
    pedidos.forEach(function(p){ grupos[seccion(p)].push(p); });
    // Bandeja: lo más nuevo arriba. En producción: lo que vence primero arriba.
    grupos.bandeja.sort(function(a, b){ return a.recibido < b.recibido ? 1 : -1; });
    grupos.curso.sort(function(a, b){ return a.entrega < b.entrega ? -1 : 1; });
    function pestana(id, texto, n){
      return '<a class="pestana" href="#' + id + '"' + (vista === id ? ' aria-current="page"' : "") + ">" + texto +
        (n !== null ? ' <span class="pestana-num">' + n + "</span>" : "") + "</a>";
    }
    var contenido = vista === "curso"
      ? (grupos.curso.length ? grupos.curso.map(tarjetaCurso).join("") : '<p class="vacio">No hay pedidos en producción.</p>')
      : vista === "cerrados"
        ? (grupos.cerrados.length ? grupos.cerrados.map(tarjetaCerrado).join("") : '<p class="vacio">Todavía no hay pedidos cerrados.</p>')
        : vistaBandeja(grupos.bandeja);
    app.innerHTML = '<h1 class="titulo">Taller textil</h1>' +
      '<p class="bajada">Los pedidos de bolsas, desde que llegan hasta que se entregan.</p>' +
      '<nav class="pestanas pestanas-fila pestanas-tres" aria-label="Secciones del taller">' +
        pestana("bandeja", "Bandeja", grupos.bandeja.length) + pestana("curso", "En producción", grupos.curso.length) + pestana("cerrados", "Cerrados", null) + "</nav>" +
      '<div class="pedidos-lista">' + contenido + "</div>";
    if(foco){ var el = app.querySelector(foco); if(el) el.focus(); }
  }

  function elegirVista(){
    var h = location.hash.slice(1);
    vista = h === "curso" || h === "cerrados" ? h : "bandeja";
    abierto = null; respondiendo = null;
    render();
  }
  window.addEventListener("hashchange", elegirVista);

  async function cargarFardos(){
    try { fardos = await OmasApi.listarFardos("Lienzo para bolsas"); }
    catch(err){ fardos = []; }
    if(abierto) render();
  }

  // Corre una acción de la API sobre un pedido y vuelve a dibujar con el resultado
  async function hacer(boton, promesa, mensaje, foco){
    if(boton) boton.disabled = true;
    try {
      var p = await promesa;
      reemplazar(p);
      render(foco);
      if(mensaje) avisar(typeof mensaje === "function" ? mensaje(p) : mensaje);
      return p;
    } catch(err){
      if(boton) boton.disabled = false;
      var form = boton && boton.closest("form"), error = form && form.querySelector("[data-error]");
      if(error){ error.textContent = err.message; error.hidden = false; } else avisar(err.message || "No se pudo hacer el cambio.");
    }
  }

  /* ----- Clics ----- */
  app.addEventListener("click", async function(e){
    var el = e.target.closest("[data-accion]");
    if(!el) return;
    var id = el.dataset.id;
    switch(el.dataset.accion){
      case "simular":
        el.disabled = true;
        var nuevo = await OmasApi.simularPedidoEntrante();
        pedidos.unshift(nuevo); vista = "bandeja";
        if(location.hash !== "#bandeja") history.replaceState(null, "", "#bandeja");
        render("#pedido-" + nuevo.id + " .btn-grande");
        avisar("Llegó un pedido nuevo por WhatsApp: " + nuevo.cliente);
        break;
      case "aceptar":
        await hacer(el, OmasApi.responderPedido(id, "aceptar"), function(p){ return "Pedido " + p.numero + " aceptado: pasó a En producción"; }, ".pestanas a");
        break;
      case "rechazar": respondiendo = { id: id, modo: "rechazar" }; render("#pedido-" + id + ' input[name="motivo"]'); break;
      case "masDatos": respondiendo = { id: id, modo: "masDatos" }; render("#consulta-" + id); break;
      case "noResponder": var era = respondiendo.id; respondiendo = null; render("#pedido-" + era + " .btn-grande"); break;
      case "abrir":
        abierto = abierto === id ? null : id;
        render('[data-accion="abrir"][data-id="' + id + '"]');
        if(abierto && !fardos) cargarFardos();
        break;
    }
  });

  /* ----- Formularios ----- */
  function errorEn(form, texto, campo){
    var error = form.querySelector("[data-error]");
    if(error){ error.textContent = texto; error.hidden = false; } else avisar(texto);
    if(campo) campo.focus();
  }
  app.addEventListener("input", function(e){
    var form = e.target.closest(".pedido-form"), error = form && form.querySelector("[data-error]");
    if(error) error.hidden = true;
  });

  app.addEventListener("submit", function(e){
    var form = e.target.closest(".pedido-form");
    if(!form) return;
    e.preventDefault();
    var id = form.dataset.id, p = porId(id), boton = form.querySelector('[type="submit"]'), detalle = '[data-accion="abrir"][data-id="' + id + '"]';
    switch(form.dataset.form){
      case "rechazar":
        respondiendo = null;
        hacer(boton, OmasApi.responderPedido(id, "rechazar", form.elements.motivo.value), "Pedido rechazado. El bot ya le avisó al cliente.", ".pestanas a");
        break;
      case "masDatos":
        var consulta = form.elements.consulta.value.trim();
        if(consulta.length < 5) return errorEn(form, "Escribí la pregunta para el cliente.", form.elements.consulta);
        respondiendo = null;
        hacer(boton, OmasApi.responderPedido(id, "masDatos", consulta), "Pregunta enviada. Cuando conteste, aparece acá.", "#pedido-" + id + " .btn-grande");
        break;
      case "material":
        var kg = decimal(form.elements.kg.value), fardo = form.elements.fardo.value;
        if(kg <= 0) return errorEn(form, "Poné cuántos kilos se lleva el taller.", form.elements.kg);
        hacer(boton, OmasApi.pedirMaterial(id, fardo, kg), num(kg) + " kg de " + fardo + " para el pedido " + p.numero, detalle)
          .then(function(r){ if(r) cargarFardos(); });
        break;
      case "reparto":
        var cant = entero(form.elements.cantidad.value), quien = form.elements.operaria.value;
        if(cant <= 0) return errorEn(form, "Poné cuántas bolsas le das.", form.elements.cantidad);
        hacer(boton, OmasApi.asignarTrabajo(id, quien, cant), num(cant) + " bolsas para " + quien.split(" ")[0], detalle);
        break;
      case "terminadas":
        var hechas = entero(form.elements.cantidad.value);
        if(hechas <= 0) return errorEn(form, "Poné cuántas bolsas terminó.", form.elements.cantidad);
        hacer(boton, OmasApi.registrarTerminadas(id, form.dataset.operaria, hechas), num(hechas) + " bolsas terminadas de " + form.dataset.operaria.split(" ")[0], detalle);
        break;
      case "entrega":
        var c = entero(form.elements.cantidad.value), remito = form.elements.remito.value.trim();
        if(c <= 0) return errorEn(form, "Poné cuántas bolsas se entregan.", form.elements.cantidad);
        if(!/^\d[\d-]{3,}\d$/.test(remito)) return errorEn(form, "Poné el número de remito (números y guion).", form.elements.remito);
        hacer(boton, OmasApi.registrarEntrega(id, c, remito), function(r){
          return entregadas(r) >= r.cantidad ? "¡Pedido " + r.numero + " entregado completo! Pasó a Cerrados." : num(c) + " bolsas entregadas con el remito " + remito;
        }, detalle);
        break;
    }
  });

  async function iniciar(){
    yo = await OmasApi.exigirSesion();
    OmasMenu.iniciar(yo);
    puedeAceptar = yo.rol === "Administración";
    puedeOrganizar = ["Administración", "Coordinadora", "Supervisión"].indexOf(yo.rol) >= 0;
    try {
      var r = await Promise.all([OmasApi.listarPedidos(), OmasApi.listarOperariasTaller()]);
      pedidos = r[0]; operarias = r[1];
      elegirVista();
    } catch(err){
      app.innerHTML = '<h1 class="titulo">Taller textil</h1><p class="aviso-caja">' + esc(err.message || "No se pudieron cargar los pedidos.") + "</p>";
    }
  }
  iniciar();
})();
