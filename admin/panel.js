/* ===== SGI-OMAS · Panel de administración (Inicio) =====
   Responde tres preguntas, en este orden: qué hay que resolver hoy, cómo van los pedidos
   y cómo va el mes. Los gráficos y tablas completas van en Rendimiento y Reportes.
   PROTOTIPO: datos de ejemplo; en el sistema real vienen de la API. */
(function(){
  "use strict";

  var HOY = new Date(); HOY.setHours(0, 0, 0, 0);
  function dia(desplazamiento){ var d = new Date(HOY); d.setDate(d.getDate() + desplazamiento); return d; }
  function diasHasta(fecha){ return Math.round((fecha - HOY) / 864e5); }
  function num(n){ return (Math.round(n * 10) / 10).toLocaleString("es-AR"); }
  function esc(s){ return String(s).replace(/[&<>"']/g, function(c){ return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function plural(n, uno, varios){ return n + " " + (n === 1 ? uno : varios); }
  // "hoy", "mañana", "el jueves" (esta semana) o "el 11 de octubre"
  function cuando(fecha){
    var n = diasHasta(fecha);
    if(n === 0) return "hoy";
    if(n === 1) return "mañana";
    if(n > 1 && n < 7) return "el " + fecha.toLocaleDateString("es-AR", { weekday: "long" });
    return "el " + fecha.toLocaleDateString("es-AR", { day: "numeric", month: "long" });
  }

  /* ===== Datos de ejemplo ===== */
  var MES = { nombre: HOY.toLocaleDateString("es-AR", { month: "long" }), entraron: 735, transformados: 386,
    anterior: { nombre: new Date(HOY.getFullYear(), HOY.getMonth() - 1, 1).toLocaleDateString("es-AR", { month: "long" }), entraron: 890, transformados: 419 } };
  var LOTES_ABIERTOS = 6, COSTURERAS_CON_LOTES = 5;
  var ATRASADOS = [
    { nombre: "Marta Quiroga", kg: 8, debia: dia(-3) },
    { nombre: "Noemí Vera", kg: 5.5, debia: dia(-1) }
  ];
  // Las bolsas se piden por unidad (empresas de 1.000 para arriba) y los trapos por kilo
  var PEDIDOS = [
    { cliente: "Muta Objetos", producto: "Bolsas de lienzo a medida", cantidad: 3000, entregado: 2100, unidad: "bolsas", vence: dia(2) },
    { cliente: "ANJOR", producto: "Trapos", cantidad: 50, entregado: 20, unidad: "kg", vence: dia(3) },
    { cliente: "Coca-Cola", producto: "Bolsas de lienzo", cantidad: 1000, entregado: 0, unidad: "bolsas", vence: dia(20) },
    { cliente: "Coca-Cola", producto: "Trapos en bolsas de 10 kg", cantidad: 180, entregado: 100, unidad: "kg", vence: dia(12) }
  ];
  function cant(n, unidad){ return num(n) + " " + unidad; }
  var DIFERENCIAS = [{ origen: "Holcim", remito: 257, balanza: 245.5 }];

  var RELOJ = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>';
  var CAJA = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 8l8-4 8 4v8l-8 4-8-4z"/><path d="M4 8l8 4 8-4M12 12v8"/></svg>';
  var BALANZA = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4v16M7 20h10M5 7h14"/><path d="M5 7l-2.5 6a2.5 2.5 0 0 0 5 0zM19 7l-2.5 6a2.5 2.5 0 0 0 5 0z"/></svg>';

  /* ===== 1. Para hoy: atrasos, pedidos que vencen y diferencias, todo en una lista ===== */
  function dibujarTareas(){
    var tareas = [];
    ATRASADOS.forEach(function(a){
      var n = -diasHasta(a.debia);
      tareas.push({ nivel: "urgente", etiqueta: "Atrasado", icono: RELOJ,
        titulo: a.nombre + " no devolvió su lote",
        detalle: "Se llevó " + num(a.kg) + " kg y tenía que traerlos hace " + plural(n, "día", "días") + ".",
        accion: "Avisarle" });
    });
    PEDIDOS.forEach(function(p){
      var faltan = p.cantidad - p.entregado, n = diasHasta(p.vence);
      if(faltan > 0 && n <= 3) tareas.push({ nivel: "atento", etiqueta: "Vence pronto", icono: CAJA,
        titulo: p.cliente + " necesita " + cant(faltan, p.unidad) + " más " + cuando(p.vence),
        detalle: "Ya se entregaron " + num(p.entregado) + " de " + cant(p.cantidad, p.unidad) + " · " + p.producto + ".",
        accion: "Ver pedido" });
    });
    DIFERENCIAS.forEach(function(d){
      tareas.push({ nivel: "atento", etiqueta: "Revisar peso", icono: BALANZA,
        titulo: "La donación de " + d.origen + " pesó " + num(d.remito - d.balanza) + " kg menos",
        detalle: "El remito dice " + num(d.remito) + " kg y la balanza dio " + num(d.balanza) + " kg.",
        accion: "Revisar" });
    });

    var lista = document.getElementById("tareas");
    if(!tareas.length){
      lista.innerHTML = '<li class="tareas-vacio">No hay nada pendiente. Todo está en fecha.</li>';
      return tareas.length;
    }
    lista.innerHTML = tareas.map(function(t){
      return '<li class="tarea ' + t.nivel + '"><span class="tarea-icono">' + t.icono + "</span>" +
        '<span class="tarea-texto"><span class="tarea-etiqueta">' + t.etiqueta + "</span><strong>" + esc(t.titulo) + "</strong><small>" + esc(t.detalle) + "</small></span>" +
        '<button type="button" class="tarea-accion" data-pronto>' + t.accion + "</button></li>";
    }).join("");
    return tareas.length;
  }

  /* ===== 2. Pedidos: cuánto falta y para cuándo, con una barra de un solo color ===== */
  function dibujarPedidos(){
    document.getElementById("pedidos").innerHTML = PEDIDOS.slice().sort(function(a, b){ return a.vence - b.vence; }).map(function(p){
      var pct = Math.min(100, p.entregado / p.cantidad * 100), faltan = p.cantidad - p.entregado, pronto = diasHasta(p.vence) <= 3;
      var nombreUnidad = p.unidad === "kg" ? "kilos" : p.unidad;
      return "<li>" +
        '<div class="pedido-cabeza"><strong>' + esc(p.cliente) + '</strong><span class="pedido-vence' + (pronto ? " cerca" : "") + '">' +
          (pronto ? RELOJ : "") + "Para " + cuando(p.vence) + "</span></div>" +
        '<div class="avance" role="img" aria-label="' + num(p.entregado) + " de " + num(p.cantidad) + " " + nombreUnidad + ' entregados"><i data-ancho="' + pct.toFixed(1) + '"></i></div>' +
        '<p class="pedido-pie">' + (faltan > 0 ? "Faltan <b>" + esc(cant(faltan, p.unidad)) + "</b>" : "<b>Completo</b>") +
          " · " + num(p.entregado) + " de " + esc(cant(p.cantidad, p.unidad)) + " · " + esc(p.producto) + "</p>" +
        "</li>";
    }).join("");
    setTimeout(function(){
      document.querySelectorAll("#pedidos .avance i").forEach(function(r){ r.style.width = r.dataset.ancho + "%"; });
    }, 60);
  }

  /* ===== 3. Cómo va el mes: dos números y una frase en palabras ===== */
  function comparar(ahora, antes, nombreAntes){
    var pct = (ahora - antes) / antes * 100, a = Math.abs(pct);
    if(a < 5) return "Casi igual que en " + nombreAntes + ".";
    return (a < 20 ? "Un poco " : "Bastante ") + (pct > 0 ? "más" : "menos") + " que en " + nombreAntes + " (" + num(antes) + " kg).";
  }
  function dibujarMes(){
    var ant = MES.anterior;
    document.getElementById("mes-titulo").textContent = "Cómo va " + MES.nombre;
    document.getElementById("mes").innerHTML =
      '<div class="mes-par">' +
        '<div class="mes-dato"><span class="mes-nombre">Entraron</span><span class="mes-valor">' + num(MES.entraron) + "<small>kg</small></span>" +
          '<span class="mes-frase">' + comparar(MES.entraron, ant.entraron, ant.nombre) + "</span></div>" +
        '<div class="mes-dato"><span class="mes-nombre">Se transformaron</span><span class="mes-valor">' + num(MES.transformados) + "<small>kg</small></span>" +
          '<span class="mes-frase">' + comparar(MES.transformados, ant.transformados, ant.nombre) + "</span></div>" +
      "</div>" +
      '<p class="mes-lotes">Ahora hay <b>' + plural(LOTES_ABIERTOS, "lote", "lotes") + "</b> en casa de " + plural(COSTURERAS_CON_LOTES, "costurera", "costureras") + ".</p>" +
      '<button type="button" class="enlace-chico" data-pronto>Ver rendimiento completo →</button>';
  }

  /* ===== Actividad en vivo: lo que se pesa en pesaje.html aparece acá sin recargar ===== */
  var ICONOS = {
    devuelve: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5.5 9h13l-1.2 11H6.7z"/><path d="M9 9a3 3 0 0 1 6 0"/><path d="M9.3 14.6l2 2 3.5-3.8"/></svg>',
    retira: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5.5 9h13l-1.2 11H6.7z"/><path d="M9 9a3 3 0 0 1 6 0"/><path d="M12 17.5v-5.5M9.8 14.2L12 12l2.2 2.2"/></svg>',
    donacion: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2.5 6.5h11v10h-11zM13.5 10h4l3 3.2v3.3h-7"/><circle cx="6.5" cy="17.5" r="1.8"/><circle cx="17" cy="17.5" r="1.8"/></svg>'
  };
  function horaHoy(h, m){ var d = new Date(); d.setHours(h, m, 0, 0); return d.toISOString(); }
  var EJEMPLO = [
    { id: "e1", tipo: "donacion", hora: horaHoy(9, 12), por: "Laura", texto: "Llegó la donación de Holcim: 245,5 kg" },
    { id: "e2", tipo: "retira", hora: horaHoy(10, 40), por: "Florencia", texto: "Lucía Ferreyra se llevó 6 kg" },
    { id: "e3", tipo: "devuelve", hora: horaHoy(11, 5), por: "Laura", texto: "Rosa Aguirre devolvió 11,8 kg" }
  ].filter(function(r){ return new Date(r.hora) <= new Date(); });
  var vistos = {};
  function pesajesGuardados(){ try { return JSON.parse(localStorage.getItem("omas-pesajes")) || []; } catch(e){ return []; } }
  function dibujarFeed(){
    var lista = EJEMPLO.concat(pesajesGuardados().filter(function(r){ return new Date(r.hora) >= HOY; }))
      .sort(function(a, b){ return new Date(b.hora) - new Date(a.hora); });
    var feed = document.getElementById("feed"), primeraVez = !Object.keys(vistos).length;
    if(!lista.length){ feed.innerHTML = '<li><span></span><span class="nota-chica">Todavía no se pesó nada hoy.</span></li>'; return; }
    feed.innerHTML = lista.map(function(r){
      var nuevo = !primeraVez && !vistos[r.id];
      vistos[r.id] = true;
      var h = new Date(r.hora).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" });
      return "<li" + (nuevo ? ' class="nuevo"' : "") + '><span class="feed-icono">' + (ICONOS[r.tipo] || ICONOS.devuelve) + "</span>" +
        "<span>" + esc(r.texto) + "<small>" + h + " · pesó " + esc(r.por) + "</small></span></li>";
    }).join("");
  }
  // Si en otra pestaña se registra un pesaje, aparece acá al instante
  window.addEventListener("storage", function(e){ if(e.key === "omas-pesajes") dibujarFeed(); });

  /* ===== Arranque: solo con sesión iniciada (el menú lateral lo arma menu.js) ===== */
  OmasApi.exigirSesion().then(function(u){
    OmasMenu.iniciar(u);
    var h = new Date().getHours();
    document.getElementById("saludo").textContent = (h < 13 ? "Buen día" : h < 20 ? "Buenas tardes" : "Buenas noches") + ", " + u.nombre;
    var pendientes = dibujarTareas();
    var fecha = HOY.toLocaleDateString("es-AR", { weekday: "long", day: "numeric", month: "long" }).replace(/^./, function(c){ return c.toUpperCase(); });
    document.getElementById("saludo-texto").textContent = fecha + " · " +
      (pendientes ? "Hay " + plural(pendientes, "cosa", "cosas") + " para ver hoy." : "No hay nada pendiente.");
    dibujarPedidos(); dibujarMes(); dibujarFeed();
  });
})();
