/* ===== SGI-OMAS · Panel de administración (Inicio) =====
   Responde tres preguntas, en este orden: qué hay que resolver hoy, cómo van los pedidos
   y cómo va el mes. El detalle de cada cosa está en su módulo (Depósito y pesajes, Taller textil).
   Con la API (base de datos): las alertas del depósito, los kilos del mes y la actividad de hoy salen
   de la base. Los pedidos salen del Taller textil y los lotes atrasados de las costureras siguen
   siendo de ejemplo, porque esos módulos todavía no tienen tablas en el modelo.
   La diferencia remito/balanza solo se ve en el prototipo: la base no guarda los kilos del remito. */
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
  // Los pedidos en producción: los mismos que muestra el Taller textil (se cargan al arrancar)
  var PEDIDOS = [];
  function cant(n, unidad){ return num(n) + " " + unidad; }
  var CON_API = OmasApi.usaApi("deposito");
  var DIFERENCIAS = CON_API ? [] : [{ origen: "Holcim", remito: 257, balanza: 245.5 }];
  var SIN_CLASIFICAR_VIEJOS = []; // bultos sin clasificar hace 7 días o más (de la base)
  var DIAS_SIN_CLASIFICAR = 7;
  function leerFecha(iso){ var p = iso.slice(0, 10).split("-"); return new Date(+p[0], +p[1] - 1, +p[2]); }

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
        accion: "Ver pedido", enlace: "textil.html#curso" });
    });
    if(SIN_CLASIFICAR_VIEJOS.length){
      var kgSin = SIN_CLASIFICAR_VIEJOS.reduce(function(s, f){ return s + f.kg; }, 0);
      var masViejo = Math.max.apply(null, SIN_CLASIFICAR_VIEJOS.map(function(f){ return -diasHasta(leerFecha(f.entro)); }));
      tareas.push({ nivel: "atento", etiqueta: "Sin clasificar", icono: CAJA,
        titulo: plural(SIN_CLASIFICAR_VIEJOS.length, "bulto lleva", "bultos llevan") + " una semana o más sin clasificar",
        detalle: num(kgSin) + " kg en el depósito. El más viejo entró hace " + plural(masViejo, "día", "días") + ".",
        accion: "Clasificar", enlace: "stock.html" });
    }
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
        (t.enlace ? '<a class="tarea-accion" href="' + t.enlace + '">' + t.accion + "</a>"
          : '<button type="button" class="tarea-accion" data-pronto>' + t.accion + "</button>") + "</li>";
    }).join("");
    return tareas.length;
  }

  /* ===== 2. Pedidos: cuánto falta y para cuándo, con una barra de un solo color ===== */
  function dibujarPedidos(){
    if(!PEDIDOS.length){ document.getElementById("pedidos").innerHTML = '<li class="nota-chica">No hay pedidos en producción.</li>'; return; }
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
    if(!antes) return ahora ? "En " + nombreAntes + " no hubo donaciones registradas." : "Todavía no hay donaciones este mes.";
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
        // Con la base: lo que hay hoy en el depósito (lo transformado sale de los lotes, que no tienen tabla)
        (CON_API
          ? '<div class="mes-dato"><span class="mes-nombre">En el depósito ahora</span><span class="mes-valor">' + num(MES.enDeposito) + "<small>kg</small></span>" +
            '<span class="mes-frase">' + (MES.sinClasificar ? "De eso, " + num(MES.sinClasificar) + " kg están sin clasificar." : "Todo clasificado.") + "</span></div>"
          : '<div class="mes-dato"><span class="mes-nombre">Se transformaron</span><span class="mes-valor">' + num(MES.transformados) + "<small>kg</small></span>" +
            '<span class="mes-frase">' + comparar(MES.transformados, ant.transformados, ant.nombre) + "</span></div>") +
      "</div>" +
      '<p class="mes-lotes">Ahora hay <b>' + plural(LOTES_ABIERTOS, "lote", "lotes") + "</b> en casa de " + plural(COSTURERAS_CON_LOTES, "costurera", "costureras") + ".</p>";
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
  var DONACIONES_HOY = []; // con la base: las donaciones registradas hoy
  function pesajesGuardados(){ try { return JSON.parse(localStorage.getItem("omas-pesajes")) || []; } catch(e){ return []; } }
  function dibujarFeed(){
    // Con la base, las donaciones salen de ahí; de este celular quedan los retiros y devoluciones (sin tabla)
    var base = CON_API ? DONACIONES_HOY : EJEMPLO;
    var locales = pesajesGuardados().filter(function(r){ return new Date(r.hora) >= HOY && !(CON_API && r.tipo === "donacion"); });
    var lista = base.concat(locales)
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
  // Pedidos en producción del Taller textil, con lo que falta entregar
  function cargarPedidos(lista){
    PEDIDOS = lista.filter(function(p){ return p.estado === "aceptado"; }).map(function(p){
      var entregado = (p.entregas || []).reduce(function(s, e){ return s + e.cantidad; }, 0);
      return { cliente: p.cliente, producto: p.producto, cantidad: p.cantidad, entregado: entregado, unidad: "bolsas", vence: leerFecha(p.entrega) };
    }).filter(function(p){ return p.entregado < p.cantidad; });
  }
  // Con la base: stock del depósito y donaciones de este mes y del anterior
  async function cargarDeposito(){
    var desde = new Date(HOY.getFullYear(), HOY.getMonth() - 1, 1), inicioMes = new Date(HOY.getFullYear(), HOY.getMonth(), 1);
    var fecha = function(d){ return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); };
    var r = await Promise.all([OmasApi.listarFardos(), OmasApi.listarDonaciones(fecha(desde))]);
    var fardos = r[0], donaciones = r[1];
    var sin = fardos.filter(function(f){ return f.material === "Sin clasificar"; });
    SIN_CLASIFICAR_VIEJOS = sin.filter(function(f){ return -diasHasta(leerFecha(f.entro)) >= DIAS_SIN_CLASIFICAR; });
    var suma = function(lista, campo){ return lista.reduce(function(s, x){ return s + Number(x[campo]); }, 0); };
    var esteMes = donaciones.filter(function(d){ return new Date(d.fechaIngreso) >= inicioMes; });
    MES.entraron = suma(esteMes, "totalKg");
    MES.anterior.entraron = suma(donaciones.filter(function(d){ return new Date(d.fechaIngreso) < inicioMes; }), "totalKg");
    MES.enDeposito = suma(fardos, "kg"); MES.sinClasificar = suma(sin, "kg");
    DONACIONES_HOY = donaciones.filter(function(d){ return new Date(d.fechaIngreso) >= HOY; }).map(function(d){
      return { id: "d" + d.id, tipo: "donacion", hora: d.fechaIngreso, por: d.registradaPor.split(" ")[0],
        texto: "Llegó la donación de " + d.empresa + ": " + num(Number(d.totalKg)) + " kg" };
    });
  }

  OmasApi.exigirSesion().then(async function(u){
    OmasMenu.iniciar(u);
    try { cargarPedidos(await OmasApi.listarPedidos()); } catch(e){}
    if(CON_API){
      try { await cargarDeposito(); }
      catch(e){ document.getElementById("saludo-texto").textContent = "No se pudieron cargar los datos del depósito."; }
    }
    var h = new Date().getHours();
    document.getElementById("saludo").textContent = (h < 13 ? "Buen día" : h < 20 ? "Buenas tardes" : "Buenas noches") + ", " + u.nombre;
    var pendientes = dibujarTareas();
    var fecha = HOY.toLocaleDateString("es-AR", { weekday: "long", day: "numeric", month: "long" }).replace(/^./, function(c){ return c.toUpperCase(); });
    document.getElementById("saludo-texto").textContent = fecha + " · " +
      (pendientes ? "Hay " + plural(pendientes, "cosa", "cosas") + " para ver hoy." : "No hay nada pendiente.");
    dibujarPedidos(); dibujarMes(); dibujarFeed();
  });
})();
