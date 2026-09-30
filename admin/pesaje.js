/* ===== SGI-OMAS · Prototipo de pesajes del depósito =====
   Tres registros: entró una donación, retira una costurera, devuelve una costurera.
   Pensado para el celular, al lado de la balanza de piso: todo con el pulgar y sin escribir nombres.
   PROTOTIPO: datos inventados y sin servidor. Los pesajes se guardan en este navegador,
   y si no hay internet quedan "sin subir" hasta que vuelve la conexión. */
(function(){
  "use strict";

  var HOY = new Date(); HOY.setHours(0, 0, 0, 0);
  function dia(desplazamiento){ var d = new Date(HOY); d.setDate(d.getDate() + desplazamiento); return d; }

  /* ===== Datos de ejemplo (en el sistema real vienen de la API) ===== */
  var PERSONAS = [
    { id: "laura", nombre: "Laura", rol: "Coordinadora", aprueba: true },
    { id: "sandra", nombre: "Sandra", rol: "Supervisión", aprueba: true },
    { id: "florencia", nombre: "Florencia", rol: "Depósito", aprueba: false }
  ];
  var COSTURERAS = [
    { id: 1, nombre: "Rosa Aguirre", mes: 21.4, mesPasado: 28.0 },
    { id: 2, nombre: "Marta Quiroga", mes: 34.8, mesPasado: 30.5 },
    { id: 3, nombre: "Lucía Ferreyra", mes: 12.0, mesPasado: 9.6 },
    { id: 4, nombre: "Graciela Luna", mes: 0, mesPasado: 14.2 },
    { id: 5, nombre: "Carla Moyano", mes: 27.3, mesPasado: 25.1 },
    { id: 6, nombre: "Silvia Paz", mes: 8.5, mesPasado: 11.0 },
    { id: 7, nombre: "Noemí Vera", mes: 16.2, mesPasado: 19.8 }
  ];
  var PRODUCTO = {
    "Tela para trapos": "Trapos de 30 × 40",
    "Uniformes para desmarcar": "Prendas desmarcadas",
    "Lienzo para bolsas": "Bolsas de lienzo",
    "Textil para desbastado": "Desbastado"
  };
  // Lotes que las costureras tienen en su casa o en el taller
  var LOTES = [
    { codigo: "T-0231", costurera: 1, material: "Tela para trapos", kg: 12.4, retiro: dia(-7), vence: dia(1) },
    { codigo: "D-0112", costurera: 1, material: "Uniformes para desmarcar", kg: 8.6, retiro: dia(-4), vence: dia(7) },
    { codigo: "T-0228", costurera: 2, material: "Tela para trapos", kg: 10.2, retiro: dia(-14), vence: dia(-3) },
    { codigo: "B-0045", costurera: 3, material: "Lienzo para bolsas", kg: 6.0, retiro: dia(-6), vence: dia(4) },
    { codigo: "T-0233", costurera: 5, material: "Tela para trapos", kg: 14.1, retiro: dia(-5), vence: dia(2) },
    { codigo: "D-0115", costurera: 7, material: "Uniformes para desmarcar", kg: 9.3, retiro: dia(-10), vence: dia(-1) }
  ];
  // Fardos clasificados que están en el depósito, listos para entregar
  var DEPOSITO = [
    { codigo: "T-0240", material: "Tela para trapos", kg: 64.5, ubicacion: "Estante A2" },
    { codigo: "D-0120", material: "Uniformes para desmarcar", kg: 38.0, ubicacion: "Estante B1" },
    { codigo: "B-0051", material: "Lienzo para bolsas", kg: 22.3, ubicacion: "Estante C3" },
    { codigo: "X-0017", material: "Textil para desbastado", kg: 90.0, ubicacion: "Piso, sector D" }
  ];
  var DONANTES = ["Naranja X", "Holcim", "Conci", "Otra empresa"];
  var DESTINOS = [
    { id: "feria", nombre: "Feria", letra: "F", material: "Prendas para feria" },
    { id: "desmarcado", nombre: "Desmarcado", letra: "D", material: "Uniformes para desmarcar" },
    { id: "trapos", nombre: "Trapos", letra: "T", material: "Tela para trapos" },
    { id: "desbastado", nombre: "Desbastado", letra: "X", material: "Textil para desbastado" },
    { id: "descarte", nombre: "Descarte", letra: "Z", material: "Descarte" }
  ];
  var proximoCodigo = { F: 88, D: 121, T: 241, B: 52, X: 18, Z: 9 };
  // Tara: lo que se descuenta porque no es tela (se carga una vez en la configuración)
  var TARAS = [
    { id: "no", nombre: "Sin tara", kg: 0 },
    { id: "bolsa", nombre: "Bolsa grande", kg: 0.3 },
    { id: "carro", nombre: "Carro", kg: 12 },
    { id: "pallet", nombre: "Pallet", kg: 18 }
  ];
  var TOLERANCIA = 0.05; // diferencia aceptada entre lo que retiró y lo que devuelve

  /* ===== Ayudas ===== */
  function num(texto){ var n = parseFloat(String(texto || "").replace(",", ".")); return isNaN(n) ? 0 : n; }
  function cifra(n){ return n.toLocaleString("es-AR", { minimumFractionDigits: 1, maximumFractionDigits: 2 }); }
  function kg(n){ return cifra(n) + " kg"; }
  function esc(s){
    return String(s).replace(/[&<>"']/g, function(c){ return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; });
  }
  function iniciales(nombre){ return nombre.split(" ").map(function(p){ return p.charAt(0); }).slice(0, 2).join(""); }
  function primerNombre(nombre){ return nombre.split(" ")[0]; }
  function diasHasta(fecha){ return Math.round((fecha - HOY) / 864e5); }
  function fechaLarga(fecha){ return fecha.toLocaleDateString("es-AR", { weekday: "long", day: "numeric", month: "long" }); }
  function fechaCorta(fecha){ return fecha.toLocaleDateString("es-AR", { day: "numeric", month: "numeric" }); }
  function hora(iso){ return new Date(iso).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" }); }
  function costurera(id){ return COSTURERAS.filter(function(c){ return c.id === id; })[0]; }
  function lotesDe(id){ return LOTES.filter(function(l){ return l.costurera === id; }); }
  function tara(id){ return TARAS.filter(function(t){ return t.id === id; })[0]; }
  function neto(campo){ return Math.max(0, Math.round((num(campo.bruto) - tara(campo.tara).kg) * 100) / 100); }
  function listaNombres(ids){
    var n = ids.map(function(id){ return primerNombre(costurera(id).nombre); });
    return n.length > 1 ? n.slice(0, -1).join(", ") + " y " + n[n.length - 1] : n[0];
  }
  function nuevoCodigo(letra){ return letra + "-" + String(proximoCodigo[letra]++).padStart(4, "0"); }

  function chipVence(fecha){
    var n = diasHasta(fecha);
    if(n < 0) return '<span class="chip chip-atraso">' + (n === -1 ? "1 día de atraso" : (-n) + " días de atraso") + "</span>";
    if(n === 0) return '<span class="chip chip-alerta">vence hoy</span>';
    if(n === 1) return '<span class="chip chip-alerta">vence mañana</span>';
    if(n === 2) return '<span class="chip chip-alerta">vence en 2 días</span>';
    return '<span class="chip chip-ok">vence en ' + n + " días</span>";
  }

  var ICONO = {
    tilde: '<svg class="tilde" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>',
    borrar: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5h11v14H9l-6-7z"/><path d="M12 9.5l5 5M17 9.5l-5 5"/></svg>',
    camara: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/></svg>',
    bien: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>',
    ojo: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4l9 16H3z"/><path d="M12 10v4M12 17v.5"/></svg>',
    corazon: '<svg class="listo-corazon" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54z"/></svg>',
    camion: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2.5 6.5h11v10h-11zM13.5 10h4l3 3.2v3.3h-7"/><circle cx="6.5" cy="17.5" r="1.8"/><circle cx="17" cy="17.5" r="1.8"/></svg>',
    sale: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5.5 9h13l-1.2 11H6.7z"/><path d="M9 9a3 3 0 0 1 6 0"/><path d="M12 17.5v-5.5M9.8 14.2L12 12l2.2 2.2"/></svg>',
    vuelve: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5.5 9h13l-1.2 11H6.7z"/><path d="M9 9a3 3 0 0 1 6 0"/><path d="M9.3 14.6l2 2 3.5-3.8"/></svg>',
    reloj: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>'
  };

  /* ===== Pesajes guardados en este navegador ===== */
  var CLAVE = "omas-pesajes";
  function leer(){ try { return JSON.parse(localStorage.getItem(CLAVE)) || []; } catch(e){ return []; } }
  function escribir(){ try { localStorage.setItem(CLAVE, JSON.stringify(registros)); } catch(e){} }
  var registros = leer();

  /* ===== Estado de la pantalla ===== */
  var estado = { persona: PERSONAS[0], flujo: null, paso: 0, d: {}, listo: null };
  var deshacer = null; // { id, restaurar, segundos, reloj }
  var app = document.getElementById("app");
  var hoja = document.getElementById("hoja");

  var FLUJOS = {
    devuelve: { titulo: "Devuelve una costurera", pasos: [["quien", "Quién"], ["lote", "Lote"], ["pesar", "Peso"], ["calidad", "Calidad"], ["confirmar", "Guardar"]] },
    retira: { titulo: "Retira una costurera", pasos: [["quien", "Quién"], ["fardo", "Material"], ["pesarRetiro", "Peso"], ["fecha", "Devolución"], ["firma", "Firma"]] },
    donacion: { titulo: "Entró una donación", pasos: [["empresa", "Empresa"], ["pesadas", "Pesadas"], ["clasificar", "Fardos"]] }
  };

  function empezar(flujo){
    terminarDeshacer();
    estado.listo = null; estado.flujo = flujo; estado.paso = 0;
    if(flujo === "devuelve") estado.d = { costureras: [], compartida: false, lote: null, activo: "terminado",
      campos: { terminado: { bruto: "", tara: "no" }, retazos: { bruto: "", tara: "no" } },
      foto: null, calidad: { logos: null, prolijo: null }, nota: "", confirmoRaro: false };
    if(flujo === "retira") estado.d = { costureras: [], fardo: null, activo: "retiro",
      campos: { retiro: { bruto: "", tara: "no" } }, dias: 7, fecha: null, firmado: false };
    if(flujo === "donacion") estado.d = { empresa: null, remito: "", kgRemito: "", activo: "pesada",
      campos: { pesada: { bruto: "", tara: "pallet" } }, pesadas: [], fardos: [], destino: "feria", kgFardo: "", foto: null };
    render();
  }
  function salir(){ estado.flujo = null; estado.listo = null; render(); }
  function pasoActual(){ return FLUJOS[estado.flujo].pasos[estado.paso][0]; }
  function avanzar(){
    var pasos = FLUJOS[estado.flujo].pasos;
    if(estado.paso >= pasos.length - 1) return;
    estado.paso++;
    // Si tiene un solo lote abierto, ya queda elegido
    if(pasoActual() === "lote" && !estado.d.lote){
      var ls = lotesDisponibles();
      if(ls.length === 1) estado.d.lote = ls[0].codigo;
    }
    render();
  }

  /* ===== Pantallas ===== */
  function render(animar){
    var html;
    if(estado.listo) html = pantallaListo();
    else if(!estado.flujo) html = pantallaInicio();
    else html = pantallaFlujo();
    app.innerHTML = html;
    if(animar !== false){
      var primero = app.firstElementChild;
      if(primero) primero.classList.add("entra");
      window.scrollTo(0, 0);
    }
    despuesDeDibujar();
    dibujarPersona();
    actualizarConexion();
  }

  function pantallaInicio(){
    var p = estado.persona;
    var atrasados = LOTES.filter(function(l){ return diasHasta(l.vence) < 0; });
    var hoy = registros.filter(function(r){ return new Date(r.hora) >= HOY; }).slice().reverse();
    var html = '<div>' +
      '<h1 class="titulo">Hola, ' + esc(p.nombre) + "</h1>" +
      '<p class="bajada">Hoy es ' + fechaLarga(HOY) + ". ¿Qué vas a pesar?</p>";
    if(atrasados.length){
      html += '<div class="alerta-lotes">' + ICONO.reloj + "<div><strong>" +
        (atrasados.length === 1 ? "1 lote pasó" : atrasados.length + " lotes pasaron") + " su fecha de devolución.</strong> " +
        atrasados.map(function(l){ return esc(primerNombre(costurera(l.costurera).nombre)) + " (" + l.codigo + ")"; }).join(", ") +
        "</div></div>";
    }
    html += opcion("donacion", ICONO.camion, "Entró una donación", "Fardos que trae una empresa") +
      opcion("retira", ICONO.sale, "Retira una costurera", "Material que sale para trabajar") +
      opcion("devuelve", ICONO.vuelve, "Devuelve una costurera", "Trabajo terminado y retazos");
    html += '<hr class="puntada"><h2 class="seccion">Hoy en el depósito</h2>';
    if(hoy.length){
      html += '<ul class="historial">' + hoy.map(function(r){
        return "<li><time>" + hora(r.hora) + "</time><div>" + esc(r.texto) + "<small>Pesó " + esc(r.por) + "</small></div>" +
          (r.sincronizado ? "" : '<span class="chip chip-alerta">sin subir</span>') + "</li>";
      }).join("") + "</ul>";
    } else {
      html += '<p class="vacio">Todavía no hay pesajes hoy.</p>';
    }
    html += '<p class="nota-chica mt-4">Prototipo con datos inventados. Los pesajes se guardan solo en este navegador.</p></div>';
    return html;
  }
  function opcion(flujo, icono, titulo, texto){
    return '<button type="button" class="opcion" data-accion="empezar" data-flujo="' + flujo + '">' + icono +
      "<div><strong>" + titulo + "</strong><span>" + texto + "</span></div></button>";
  }

  function pantallaFlujo(){
    var f = FLUJOS[estado.flujo], id = pasoActual();
    var p = PASOS[id]();
    var pasos = f.pasos.map(function(par, i){
      var clase = i < estado.paso ? "hecho" : (i === estado.paso ? "actual" : "");
      return '<li class="' + clase + '"' + (i === estado.paso ? ' aria-current="step"' : "") + ">" + par[1] + "</li>";
    }).join("");
    var boton = p.boton ? '<div class="accion"><button type="button" class="btn-grande" data-accion="' + (p.boton.accion || "siguiente") + '"' +
      (p.boton.habilitado ? "" : " disabled") + ">" + p.boton.texto + "</button></div>" : "";
    return '<div><div class="flujo-tope">' +
      '<button type="button" class="enlace" data-accion="volver">‹ Atrás</button>' +
      '<span class="flujo-nombre">' + f.titulo + "</span>" +
      '<button type="button" class="enlace" data-accion="cancelar">Cancelar</button></div>' +
      '<ol class="pasos">' + pasos + "</ol>" + p.html + "</div>" + boton;
  }

  /* ===== Pasos ===== */
  var PASOS = {};

  PASOS.quien = function(){
    var d = estado.d, devuelve = estado.flujo === "devuelve";
    var lista = COSTURERAS.slice();
    // Primero las que tienen lotes para devolver, las más atrasadas arriba
    if(devuelve) lista.sort(function(a, b){ return vencePrimero(a.id) - vencePrimero(b.id); });
    var filas = lista.map(function(c){
      var ls = lotesDe(c.id), elegida = d.costureras.indexOf(c.id) >= 0, detalle;
      if(ls.length){
        detalle = (ls.length === 1 ? "1 lote en su casa" : ls.length + " lotes en su casa") + " " +
          chipVence(ls.map(function(l){ return l.vence; }).sort(function(a, b){ return a - b; })[0]);
      } else detalle = devuelve ? "Sin lotes para devolver" : "Sin lotes en su casa";
      return '<button type="button" class="fila' + (elegida ? " elegida" : "") + (devuelve && !ls.length ? " apagada" : "") +
        '" data-accion="costurera" data-id="' + c.id + '" data-nombre="' + esc(c.nombre.toLowerCase()) + '" aria-pressed="' + elegida + '">' +
        '<span class="avatar' + (ls.length ? "" : " suave") + '">' + iniciales(c.nombre) + "</span>" +
        '<span class="fila-texto"><strong>' + esc(c.nombre) + "</strong><span>" + detalle + "</span></span>" +
        (elegida ? ICONO.tilde : "") + "</button>";
    }).join("");
    var html = '<h1 class="titulo">' + (devuelve ? "¿Quién devuelve?" : "¿Quién retira?") + "</h1>" +
      '<input type="search" class="buscar" id="buscar" placeholder="Buscar por nombre" aria-label="Buscar costurera" autocomplete="off">';
    if(devuelve){
      html += '<label class="interruptor"><input type="checkbox" data-accion="compartida"' + (d.compartida ? " checked" : "") + ">" +
        "<span>Es una bolsa compartida<br><span class=\"nota-chica\">Los kilos se reparten entre varias</span></span></label>";
    }
    html += filas;
    var n = d.costureras.length;
    var boton = d.compartida
      ? { texto: n >= 2 ? "Continuar con " + n : "Elegí al menos 2", habilitado: n >= 2 }
      : { texto: "Continuar", habilitado: n === 1 };
    return { html: html, boton: boton };
  };
  function vencePrimero(id){
    var ls = lotesDe(id);
    return ls.length ? Math.min.apply(null, ls.map(function(l){ return l.vence.getTime(); })) : Infinity;
  }
  function lotesDisponibles(){
    return LOTES.filter(function(l){ return estado.d.costureras.indexOf(l.costurera) >= 0; });
  }

  PASOS.lote = function(){
    var d = estado.d, ls = lotesDisponibles();
    if(!ls.length){
      var nombre = primerNombre(costurera(d.costureras[0]).nombre);
      return { html: '<h1 class="titulo">No tiene lotes abiertos</h1><p class="bajada">' + esc(nombre) +
        " no tiene material retirado. Si viene a buscar trabajo, registralo como retiro.</p>" +
        '<button type="button" class="btn-linea" data-accion="retiroDe">Registrar un retiro de ' + esc(nombre) + "</button>", boton: null };
    }
    var html = '<h1 class="titulo">¿Qué lote trae?</h1>' +
      (ls.length === 1 ? '<p class="bajada">Tiene un solo lote, ya quedó elegido.</p>' : '<p class="bajada">Tocá la etiqueta del lote.</p>') +
      ls.map(function(l){
        return '<button type="button" class="etiqueta' + (d.lote === l.codigo ? " elegida" : "") + '" data-accion="lote" data-codigo="' + l.codigo + '">' +
          '<span class="etiqueta-codigo">' + l.codigo + "</span><strong>" + esc(l.material) + " · " + kg(l.kg) + "</strong>" +
          "<span>Retiró el " + fechaCorta(l.retiro) + (d.costureras.length > 1 ? " · " + esc(primerNombre(costurera(l.costurera).nombre)) : "") +
          " " + chipVence(l.vence) + "</span></button>";
      }).join("");
    return { html: html, boton: { texto: "Continuar", habilitado: !!d.lote } };
  };

  /* Visor con uno o dos campos, taras y teclado numérico.
     "debajo": una línea opcional entre el visor y el teclado (el resultado de la cuenta) */
  function visor(campos, debajo){
    var d = estado.d;
    var html = '<div class="visor' + (campos.length === 1 ? " uno" : "") + '">' + campos.map(function(par){
      var c = d.campos[par[0]], activo = d.activo === par[0], t = tara(c.tara);
      var valor = c.bruto ? esc(c.bruto) : '<span class="vacio-num">0</span>';
      var extra = t.kg && c.bruto ? "Neto " + kg(neto(c)) + " (sin " + t.nombre.toLowerCase() + ")" : "";
      return '<button type="button" class="campo' + (activo ? " activo" : "") + '" data-accion="campo" data-campo="' + par[0] + '" aria-pressed="' + activo + '">' +
        '<span class="campo-nombre">' + par[1] + '</span><span class="campo-valor">' + valor + (activo ? '<span class="cursor"></span>' : "") +
        "<small>kg</small></span>" + '<span class="campo-neto">' + extra + "</span></button>";
    }).join("") + "</div>";
    var actual = d.campos[d.activo];
    if(debajo) html += '<div class="visor-estado">' + debajo + "</div>";
    html += '<div class="taras desliza" role="group" aria-label="Tara">' + TARAS.map(function(t){
      return '<button type="button" class="pildora' + (actual.tara === t.id ? " activa" : "") + '" data-accion="tara" data-tara="' + t.id + '">' +
        t.nombre + (t.kg ? " <small>−" + t.kg.toLocaleString("es-AR") + " kg</small>" : "") + "</button>";
    }).join("") + "</div>";
    html += '<div class="teclado">' + ["1", "2", "3", "4", "5", "6", "7", "8", "9", ",", "0"].map(function(k){
      return '<button type="button" class="tecla" data-accion="tecla" data-tecla="' + k + '">' + k + "</button>";
    }).join("") + '<button type="button" class="tecla" data-accion="tecla" data-tecla="borrar" aria-label="Borrar">' + ICONO.borrar + "</button></div>";
    return html;
  }
  function botonFoto(){
    var d = estado.d;
    return '<div class="foto"><label class="btn-foto">' + ICONO.camara + (d.foto ? "Cambiar foto" : "Foto del visor de la balanza") +
      '<input type="file" accept="image/*" capture="environment" class="oculto-visual" data-foto></label>' +
      (d.foto ? '<img src="' + d.foto + '" alt="Foto del visor de la balanza">' : '<span class="nota-chica">Opcional, queda de respaldo</span>') + "</div>";
  }
  function teclear(tecla){
    var c = estado.d.campos[estado.d.activo], v = c.bruto;
    if(tecla === "borrar") v = v.slice(0, -1);
    else if(tecla === ","){ if(v.indexOf(",") < 0) v = (v || "0") + ","; }
    else {
      var decimales = v.indexOf(",") >= 0 ? v.length - v.indexOf(",") - 1 : 0;
      if(decimales >= 2 || v.replace(",", "").length >= 5) return;
      v = v === "0" ? tecla : v + tecla;
    }
    c.bruto = v;
    estado.d.confirmoRaro = false;
  }

  PASOS.pesar = function(){
    var d = estado.d, lote = LOTES.filter(function(l){ return l.codigo === d.lote; })[0];
    var t = neto(d.campos.terminado), r = neto(d.campos.retazos), total = t + r;
    var dif = Math.round((lote.kg - total) * 100) / 100, rel = Math.abs(dif) / lote.kg;
    var raro = total > lote.kg * 2;
    var producto = PRODUCTO[lote.material] || "Terminado";
    var estadoTexto;
    if(!total) estadoTexto = '<div class="balance-estado">Retiró ' + kg(lote.kg) + ". Cargá lo terminado y los retazos.</div>";
    else if(rel <= TOLERANCIA) estadoTexto = '<div class="balance-estado bien">' + ICONO.bien + "Dentro de lo normal (diferencia " + kg(Math.abs(dif)) + ")</div>";
    else if(dif > 0) estadoTexto = '<div class="balance-estado ojo">' + ICONO.ojo + "Faltan " + kg(dif) + ". Vas a dejar una nota.</div>";
    else estadoTexto = '<div class="balance-estado ojo">' + ICONO.ojo + "Sobran " + kg(-dif) + ": trae más de lo que retiró.</div>";
    // Arriba del teclado, una línea con el resultado; abajo, la cuenta completa
    var html = '<h1 class="titulo">Pesá lo que trae</h1>' +
      visor([["terminado", producto], ["retazos", "Retazos"]], estadoTexto) + botonFoto();
    html += '<h2 class="seccion">La cuenta</h2><div class="balance">' +
      '<div class="balance-fila"><span>Retiró (' + lote.codigo + ")</span><span>" + kg(lote.kg) + "</span></div><hr>" +
      '<div class="balance-fila"><span>' + producto + "</span><span>" + kg(t) + "</span></div>" +
      '<div class="balance-fila"><span>Retazos</span><span>' + kg(r) + "</span></div><hr>" +
      '<div class="balance-fila total"><span>' + (dif >= 0 ? "Diferencia" : "De más") + "</span><span>" + kg(Math.abs(dif)) + "</span></div></div>";
    if(raro && !d.confirmoRaro){
      html += '<div class="aviso-caja"><strong>¿Seguro?</strong> ' + kg(total) + " es mucho más de lo que retiró (" + kg(lote.kg) +
        "). Revisá que no falte una coma.<br><button type=\"button\" class=\"pildora\" data-accion=\"confirmarRaro\">Sí, está bien</button></div>";
    }
    d.faltaNota = !!total && rel > TOLERANCIA;
    return { html: html, boton: { texto: "Continuar", habilitado: t > 0 && (!raro || d.confirmoRaro) } };
  };

  function calidadCompleta(){
    var d = estado.d;
    var notaOk = !d.faltaNota || d.nota.trim().length > 0;
    if(!estado.persona.aprueba) return notaOk;
    return d.calidad.logos !== null && d.calidad.prolijo !== null && notaOk;
  }
  PASOS.calidad = function(){
    var d = estado.d, p = estado.persona, html = '<h1 class="titulo">¿Cómo vino?</h1>';
    if(!p.aprueba){
      html += '<div class="info-caja">' + esc(p.nombre) + ", la calidad la revisa Laura o Sandra. " +
        "Esta entrega queda guardada como <strong>pendiente de revisión</strong>.</div>";
    } else {
      html += pregunta("logos", "¿Quedó sin logos ni marcas?") + pregunta("prolijo", "¿Las costuras y los cortes están bien?");
      if(d.calidad.logos === false || d.calidad.prolijo === false){
        html += '<div class="aviso-caja"><strong>Vuelve para corregir.</strong> El lote sigue abierto y queda marcado como reproceso.</div>';
      }
    }
    html += '<label class="etiqueta-campo" for="nota">Nota' + (d.faltaNota ? " (necesaria: faltan kilos)" : " (opcional)") + "</label>" +
      '<textarea class="entrada" id="nota" data-dato="nota" placeholder="Ej.: se mojó una bolsa, trajo solo una parte">' + esc(d.nota) + "</textarea>";
    return { html: html, boton: { texto: "Continuar", habilitado: calidadCompleta() } };
  };
  function pregunta(clave, texto){
    var v = estado.d.calidad[clave];
    return '<div class="pregunta"><p>' + texto + '</p><div class="sino">' +
      '<button type="button" class="si' + (v === true ? " activa" : "") + '" data-accion="calidad" data-q="' + clave + '" data-v="si" aria-pressed="' + (v === true) + '">Sí</button>' +
      '<button type="button" class="no' + (v === false ? " activa" : "") + '" data-accion="calidad" data-q="' + clave + '" data-v="no" aria-pressed="' + (v === false) + '">No</button></div></div>';
  }
  function estadoCalidad(){
    var d = estado.d;
    if(!estado.persona.aprueba) return "pendiente";
    return d.calidad.logos && d.calidad.prolijo ? "aprobado" : "reproceso";
  }
  var NOMBRE_CALIDAD = { aprobado: "Aprobado", reproceso: "Vuelve para corregir", pendiente: "Pendiente de revisión" };

  PASOS.confirmar = function(){
    var d = estado.d, lote = LOTES.filter(function(l){ return l.codigo === d.lote; })[0];
    var t = neto(d.campos.terminado), n = d.costureras.length;
    var filas = [
      [n > 1 ? "Costureras" : "Costurera", d.costureras.map(function(id){ return esc(costurera(id).nombre); }).join("<br>")],
      ["Lote", lote.codigo + " · " + esc(lote.material)],
      [PRODUCTO[lote.material], kg(t)],
      ["Retazos", kg(neto(d.campos.retazos))],
      ["Calidad", NOMBRE_CALIDAD[estadoCalidad()]]
    ];
    if(n > 1) filas.push(["A cada una", kg(Math.round(t / n * 100) / 100)]);
    if(d.nota.trim()) filas.push(["Nota", esc(d.nota.trim())]);
    if(d.foto) filas.push(["Foto de la balanza", "Adjunta"]);
    filas.push(["Pesó", esc(estado.persona.nombre)]);
    return { html: '<h1 class="titulo">Revisá y guardá</h1>' + resumen(filas), boton: { texto: "Guardar pesaje", habilitado: true, accion: "guardar" } };
  };
  function resumen(filas){
    return '<ul class="resumen">' + filas.map(function(f){ return "<li><span>" + f[0] + "</span><strong>" + f[1] + "</strong></li>"; }).join("") + "</ul>";
  }

  /* ----- Retiro ----- */
  PASOS.fardo = function(){
    var d = estado.d;
    var html = '<h1 class="titulo">¿Qué se lleva?</h1><p class="bajada">Fardos clasificados que hay en el depósito.</p>' +
      DEPOSITO.filter(function(f){ return f.kg > 0; }).map(function(f){
        return '<button type="button" class="etiqueta' + (d.fardo === f.codigo ? " elegida" : "") + '" data-accion="fardo" data-codigo="' + f.codigo + '">' +
          '<span class="etiqueta-codigo">' + f.codigo + "</span><strong>" + esc(f.material) + "</strong>" +
          "<span>" + kg(f.kg) + " disponibles · " + esc(f.ubicacion) + "</span></button>";
      }).join("");
    return { html: html, boton: { texto: "Continuar", habilitado: !!d.fardo } };
  };
  function fardoElegido(){ var d = estado.d; return DEPOSITO.filter(function(f){ return f.codigo === d.fardo; })[0]; }

  PASOS.pesarRetiro = function(){
    var d = estado.d, f = fardoElegido(), n = neto(d.campos.retiro);
    var html = '<h1 class="titulo">¿Cuánto se lleva?</h1><p class="bajada">' + esc(f.material) + " del fardo " + f.codigo + ".</p>" +
      visor([["retiro", "Peso en la balanza"]]);
    var pasa = n > f.kg + 0.05;
    if(pasa) html += '<div class="aviso-caja"><strong>Es más de lo que hay.</strong> El fardo ' + f.codigo + " tiene " + kg(f.kg) + ".</div>";
    return { html: html, boton: { texto: "Continuar", habilitado: n > 0 && !pasa } };
  };

  function fechaDevolucion(){
    var d = estado.d;
    if(d.fecha) return new Date(d.fecha + "T00:00:00");
    return dia(d.dias);
  }
  PASOS.fecha = function(){
    var d = estado.d, opciones = [[3, "3 días"], [7, "Una semana"], [14, "Dos semanas"]];
    var nombre = primerNombre(costurera(d.costureras[0]).nombre);
    var html = '<h1 class="titulo">¿Cuándo lo devuelve?</h1><p class="bajada">Acordalo con ' + esc(nombre) + ".</p>" +
      '<div class="taras">' + opciones.map(function(o){
        return '<button type="button" class="pildora' + (!d.fecha && d.dias === o[0] ? " activa" : "") + '" data-accion="dias" data-dias="' + o[0] + '">' + o[1] + "</button>";
      }).join("") + "</div>" +
      '<label class="etiqueta-campo mt-3" for="fecha">O elegí el día</label>' +
      '<input type="date" class="entrada" id="fecha" data-dato="fecha" min="' + iso(dia(1)) + '" value="' + (d.fecha || "") + '">' +
      '<div class="info-caja">Devuelve el <strong>' + fechaLarga(fechaDevolucion()) + "</strong>.</div>";
    return { html: html, boton: { texto: "Continuar", habilitado: true } };
  };
  function iso(fecha){ return fecha.getFullYear() + "-" + String(fecha.getMonth() + 1).padStart(2, "0") + "-" + String(fecha.getDate()).padStart(2, "0"); }

  PASOS.firma = function(){
    var d = estado.d, c = costurera(d.costureras[0]), f = fardoElegido();
    var html = '<h1 class="titulo">Firma de ' + esc(primerNombre(c.nombre)) + "</h1>" +
      '<p class="bajada">Se lleva ' + kg(neto(d.campos.retiro)) + " de " + esc(f.material.toLowerCase()) +
      " y lo devuelve el " + fechaLarga(fechaDevolucion()) + ".</p>" +
      '<div class="firma-caja"><canvas class="firma" id="firma" aria-label="Espacio para firmar con el dedo"></canvas>' +
      '<span class="firma-linea"></span><span class="firma-texto">Firmá con el dedo</span></div>' +
      '<button type="button" class="enlace" data-accion="borrarFirma">Borrar firma</button>';
    return { html: html, boton: { texto: "Guardar retiro", habilitado: d.firmado, accion: "guardar" } };
  };

  /* ----- Donación ----- */
  PASOS.empresa = function(){
    var d = estado.d;
    var html = '<h1 class="titulo">¿De qué empresa?</h1>' + DONANTES.map(function(e){
      var elegida = d.empresa === e;
      return '<button type="button" class="fila' + (elegida ? " elegida" : "") + '" data-accion="empresa" data-nombre="' + esc(e) + '" aria-pressed="' + elegida + '">' +
        '<span class="avatar suave">' + esc(e.charAt(0)) + '</span><span class="fila-texto"><strong>' + esc(e) + "</strong></span>" +
        (elegida ? ICONO.tilde : "") + "</button>";
    }).join("") +
      '<hr class="puntada">' +
      '<label class="etiqueta-campo" for="remito">Número de remito</label>' +
      '<input class="entrada" id="remito" inputmode="numeric" data-dato="remito" placeholder="Ej.: 0004-00012345" value="' + esc(d.remito) + '">' +
      '<label class="etiqueta-campo" for="kgRemito">Kilos que dice el remito</label>' +
      '<input class="entrada" id="kgRemito" inputmode="decimal" data-dato="kgRemito" placeholder="Ej.: 250" value="' + esc(d.kgRemito) + '">';
    return { html: html, boton: { texto: "Empezar a pesar", habilitado: !!d.empresa && num(d.kgRemito) > 0 } };
  };

  function totalPesadas(){ return estado.d.pesadas.reduce(function(s, p){ return s + p; }, 0); }
  PASOS.pesadas = function(){
    var d = estado.d, n = neto(d.campos.pesada), total = totalPesadas(), remito = num(d.kgRemito);
    var html = '<h1 class="titulo">Pesada ' + (d.pesadas.length + 1) + "</h1>" +
      '<p class="bajada">Si no entra todo junto en la balanza, pesá de a partes y sumalas.</p>' +
      visor([["pesada", "Peso en la balanza"]]) + botonFoto() +
      '<button type="button" class="btn-linea" data-accion="sumarPesada"' + (n > 0 ? "" : " disabled") + ">Sumar esta pesada" + (n > 0 ? " (" + kg(n) + ")" : "") + "</button>";
    if(d.pesadas.length){
      var dif = Math.round((total - remito) * 100) / 100, bien = Math.abs(dif) / remito <= TOLERANCIA;
      html += '<div class="balance mt-3">' + d.pesadas.map(function(p, i){
        return '<div class="balance-fila"><span>Pesada ' + (i + 1) + ' <button type="button" class="enlace py-0 ms-2" data-accion="quitarPesada" data-i="' + i + '" aria-label="Quitar pesada ' + (i + 1) + '">quitar</button></span><span>' + kg(p) + "</span></div>";
      }).join("") + "<hr>" +
        '<div class="balance-fila total"><span>Total en balanza</span><span>' + kg(total) + "</span></div>" +
        '<div class="balance-fila"><span>Dice el remito</span><span>' + kg(remito) + "</span></div>" +
        '<div class="balance-estado ' + (bien ? "bien" : "ojo") + '">' + (bien ? ICONO.bien + "Coincide con el remito" :
          ICONO.ojo + (dif < 0 ? "Faltan " + kg(-dif) + " respecto del remito" : "Hay " + kg(dif) + " más que en el remito")) + "</div></div>";
    }
    return { html: html, boton: { texto: "Clasificar en fardos", habilitado: d.pesadas.length > 0 } };
  };

  function restante(){
    var usado = estado.d.fardos.reduce(function(s, f){ return s + f.kg; }, 0);
    return Math.round((totalPesadas() - usado) * 100) / 100;
  }
  PASOS.clasificar = function(){
    var d = estado.d, falta = restante();
    var html = '<h1 class="titulo">Separá en fardos</h1>' +
      '<p class="bajada">Entraron ' + kg(totalPesadas()) + ". Elegí el destino de cada fardo.</p>" +
      '<div class="taras">' + DESTINOS.map(function(x){
        return '<button type="button" class="pildora' + (d.destino === x.id ? " activa" : "") + '" data-accion="destino" data-destino="' + x.id + '">' + x.nombre + "</button>";
      }).join("") + "</div>" +
      '<label class="etiqueta-campo mt-2" for="kgFardo">Kilos del fardo</label>' +
      '<div class="fila-entrada"><input class="entrada" id="kgFardo" inputmode="decimal" data-dato="kgFardo" placeholder="Ej.: 40,5" value="' + esc(d.kgFardo) + '">' +
      '<button type="button" class="pildora" data-accion="todoLoQueQueda"' + (falta > 0 ? "" : " disabled") + ">Todo lo que queda</button></div>" +
      '<button type="button" class="btn-linea mt-3" data-accion="agregarFardo">Agregar fardo</button>';
    html += '<div class="info-caja mt-3">' + (Math.abs(falta) < 0.05 ? "<strong>Todo clasificado.</strong>" :
      falta > 0 ? "Faltan clasificar <strong>" + kg(falta) + "</strong>." : "Te pasaste por <strong>" + kg(-falta) + "</strong>. Revisá los fardos.") + "</div>";
    if(d.fardos.length){
      html += '<h2 class="seccion">Fardos</h2>' + d.fardos.map(function(f, i){
        return '<div class="etiqueta"><span class="etiqueta-codigo">' + f.codigo + "</span><strong>" + esc(f.destino) + " · " + kg(f.kg) + "</strong>" +
          '<button type="button" class="enlace quitar py-0" data-accion="quitarFardo" data-i="' + i + '">quitar</button></div>';
      }).join("");
    }
    return { html: html, boton: { texto: "Guardar donación", habilitado: d.fardos.length > 0 && Math.abs(falta) < 0.05, accion: "guardar" } };
  };
  function agregarFardo(){
    var d = estado.d, k = Math.round(num(d.kgFardo) * 100) / 100;
    if(k <= 0){ avisar("Poné los kilos del fardo"); return; }
    var destino = DESTINOS.filter(function(x){ return x.id === d.destino; })[0];
    d.fardos.push({ codigo: nuevoCodigo(destino.letra), destino: destino.nombre, material: destino.material, kg: k });
    d.kgFardo = "";
    render(false);
  }

  /* ===== Guardar ===== */
  function guardar(){
    var d = estado.d, p = estado.persona, registro = { id: Date.now(), tipo: estado.flujo, hora: new Date().toISOString(), por: p.nombre, sincronizado: false };
    var restaurar;

    if(estado.flujo === "devuelve"){
      var lote = LOTES.filter(function(l){ return l.codigo === d.lote; })[0];
      var t = neto(d.campos.terminado), calidad = estadoCalidad(), parte = Math.round(t / d.costureras.length * 100) / 100;
      var mesAntes = d.costureras.map(function(id){ return costurera(id).mes; });
      var restaurarLote = function(){};
      // Aprobado o pendiente de revisión: el lote se cierra. Reproceso: sigue abierto.
      if(calidad !== "reproceso"){
        var posicion = LOTES.indexOf(lote);
        LOTES.splice(posicion, 1);
        restaurarLote = function(){ LOTES.splice(posicion, 0, lote); };
      }
      if(calidad === "aprobado") d.costureras.forEach(function(id){ costurera(id).mes += parte; });
      restaurar = function(){ restaurarLote(); d.costureras.forEach(function(id, j){ costurera(id).mes = mesAntes[j]; }); };
      registro.texto = listaNombres(d.costureras) + " devolvió " + kg(t) + " (" + lote.codigo + ")";
      registro.kg = t; registro.calidad = calidad; registro.lote = lote.codigo; registro.costureras = d.costureras.slice(); registro.parte = parte;
    }

    if(estado.flujo === "retira"){
      var f = fardoElegido(), n = neto(d.campos.retiro), letra = f.codigo.charAt(0);
      var nuevo = { codigo: nuevoCodigo(letra), costurera: d.costureras[0], material: f.material, kg: n, retiro: HOY, vence: fechaDevolucion() };
      LOTES.push(nuevo); f.kg = Math.round((f.kg - n) * 100) / 100;
      restaurar = function(){ LOTES.splice(LOTES.indexOf(nuevo), 1); f.kg = Math.round((f.kg + n) * 100) / 100; };
      registro.texto = costurera(d.costureras[0]).nombre + " retiró " + kg(n) + " (" + nuevo.codigo + ")";
      registro.kg = n; registro.lote = nuevo.codigo; registro.material = f.material; registro.vence = nuevo.vence.toISOString();
      registro.costureras = d.costureras.slice();
    }

    if(estado.flujo === "donacion"){
      var agregados = d.fardos.filter(function(x){ return x.destino !== "Descarte"; }).map(function(x){
        var fardo = { codigo: x.codigo, material: x.material, kg: x.kg, ubicacion: "Sin ubicar" };
        DEPOSITO.push(fardo); return fardo;
      });
      restaurar = function(){ agregados.forEach(function(x){ DEPOSITO.splice(DEPOSITO.indexOf(x), 1); }); };
      registro.texto = d.empresa + ": " + kg(totalPesadas()) + " en " + d.fardos.length + (d.fardos.length === 1 ? " fardo" : " fardos");
      registro.kg = totalPesadas(); registro.fardos = d.fardos.slice(); registro.empresa = d.empresa;
    }

    registros.push(registro); escribir();
    estado.listo = registro; estado.flujo = null;
    deshacer = { id: registro.id, restaurar: restaurar, segundos: 10, reloj: null };
    render();
  }
  function terminarDeshacer(){
    if(deshacer && deshacer.reloj) clearInterval(deshacer.reloj);
    deshacer = null;
  }

  function pantallaListo(){
    var r = estado.listo, html = '<div class="listo">' + ICONO.corazon + '<span class="costura" aria-hidden="true"></span>';
    if(r.tipo === "devuelve"){
      var nombres = listaNombres(r.costureras);
      var texto = r.calidad === "aprobado" ? (r.costureras.length > 1 ? "aprobados para " + esc(nombres) + ", " + kg(r.parte) + " a cada una." : "aprobados para " + esc(nombres) + ".")
        : r.calidad === "reproceso" ? "vuelven a " + esc(nombres) + " para corregir. El lote " + r.lote + " sigue abierto."
        : "quedan pendientes de revisión de calidad.";
      html += '<div class="listo-kg"><span data-contar="' + r.kg + '">' + cifra(r.kg) + "</span><small>kg</small></div>" +
        '<p class="listo-texto">' + texto + "</p>";
      if(r.calidad === "aprobado") html += cinta(costurera(r.costureras[0]));
    }
    if(r.tipo === "retira"){
      html += '<div class="listo-kg"><span data-contar="' + r.kg + '">' + cifra(r.kg) + "</span><small>kg</small></div>" +
        '<p class="listo-texto">' + esc(primerNombre(costurera(r.costureras[0]).nombre)) + " se los lleva. Devuelve el " + fechaLarga(new Date(r.vence)) + ".</p>" +
        '<div class="etiqueta"><span class="etiqueta-codigo grande">' + r.lote + "</span><strong>" + esc(r.material) + " · " + kg(r.kg) + "</strong>" +
        "<span>Escribí este código en la bolsa.</span></div>";
    }
    if(r.tipo === "donacion"){
      html += '<div class="listo-kg"><span data-contar="' + r.kg + '">' + cifra(r.kg) + "</span><small>kg</small></div>" +
        '<p class="listo-texto">entraron de ' + esc(r.empresa) + ". Escribí estos códigos en las etiquetas de los fardos:</p>" +
        r.fardos.map(function(f){
          return '<div class="etiqueta"><span class="etiqueta-codigo grande">' + f.codigo + "</span><strong>" + esc(f.destino) + " · " + kg(f.kg) + "</strong></div>";
        }).join("");
    }
    var otra = { devuelve: "Registrar otra devolución", retira: "Registrar otro retiro", donacion: "Registrar otra donación" }[r.tipo];
    html += '<div class="listo-botones">' +
      (deshacer ? '<button type="button" class="btn-linea" data-accion="deshacer">Deshacer (<span id="segundos">' + deshacer.segundos + "</span>)</button>" : "") +
      '<button type="button" class="btn-linea" data-accion="empezar" data-flujo="' + r.tipo + '">' + otra + "</button>" +
      '<button type="button" class="btn-grande" data-accion="inicio">Volver al inicio</button></div></div>';
    return html;
  }
  // Kilos del mes en una cinta métrica, con la marca del mes pasado (sin comparar con otras)
  function cinta(c){
    var tope = Math.max(40, Math.ceil(Math.max(c.mes, c.mesPasado) / 10) * 10 + 10);
    return '<div class="cinta-bloque"><div class="cinta-titulo"><strong>' + esc(primerNombre(c.nombre)) + " este mes</strong><span>" + kg(c.mes) + "</span></div>" +
      '<div class="cinta" role="img" aria-label="' + kg(c.mes) + " este mes; el mes pasado " + kg(c.mesPasado) + '">' +
      '<div class="cinta-relleno" data-ancho="' + (c.mes / tope * 100).toFixed(1) + '"></div>' +
      '<span class="cinta-marca" style="left:' + (c.mesPasado / tope * 100).toFixed(1) + '%"></span></div>' +
      '<div class="cinta-escala"><span>0</span><span>' + tope / 2 + '</span><span>' + tope + " kg</span></div>" +
      '<div class="cinta-leyenda"><span><i></i>Este mes</span><span><i class="marca"></i>Mes pasado: ' + kg(c.mesPasado) + "</span></div></div>";
  }

  /* ===== Cosas que pasan después de dibujar ===== */
  var sinMovimiento = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  function despuesDeDibujar(){
    // La cinta métrica se llena
    var relleno = app.querySelector(".cinta-relleno");
    if(relleno) setTimeout(function(){ relleno.style.width = relleno.dataset.ancho + "%"; }, 30);
    // El número sube como en una balanza
    app.querySelectorAll("[data-contar]").forEach(contar);
    // Cuenta regresiva para deshacer
    if(estado.listo && deshacer && !deshacer.reloj){
      deshacer.reloj = setInterval(function(){
        deshacer.segundos--;
        var s = document.getElementById("segundos");
        if(deshacer.segundos <= 0){
          var boton = app.querySelector('[data-accion="deshacer"]');
          if(boton) boton.remove();
          terminarDeshacer();
        } else if(s) s.textContent = deshacer.segundos;
      }, 1000);
    }
    // Firma con el dedo
    var lienzo = document.getElementById("firma");
    if(lienzo) prepararFirma(lienzo);
  }
  function contar(el){
    var fin = parseFloat(el.dataset.contar);
    if(sinMovimiento || !fin) return;
    var inicio = Date.now(), duracion = 900, terminado = false;
    function paso(){
      if(terminado) return;
      var avance = Math.min(1, (Date.now() - inicio) / duracion), suave = 1 - Math.pow(1 - avance, 3);
      el.textContent = cifra(Math.round(fin * suave * 10) / 10);
      if(avance < 1) requestAnimationFrame(paso); else terminado = true;
    }
    requestAnimationFrame(paso);
    // Por si el navegador frena la animación (pestaña en segundo plano): el número final queda igual
    setTimeout(function(){ terminado = true; el.textContent = cifra(fin); }, duracion + 150);
  }
  function prepararFirma(lienzo){
    var dpr = window.devicePixelRatio || 1, ctx = lienzo.getContext("2d"), dibujando = false;
    lienzo.width = lienzo.clientWidth * dpr; lienzo.height = lienzo.clientHeight * dpr;
    ctx.scale(dpr, dpr); ctx.lineWidth = 2.4; ctx.lineCap = "round"; ctx.lineJoin = "round";
    ctx.strokeStyle = getComputedStyle(document.body).color;
    function punto(e){ var r = lienzo.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; }
    lienzo.addEventListener("pointerdown", function(e){
      dibujando = true; lienzo.setPointerCapture(e.pointerId);
      var p = punto(e); ctx.beginPath(); ctx.moveTo(p.x, p.y);
    });
    lienzo.addEventListener("pointermove", function(e){
      if(!dibujando) return;
      var p = punto(e); ctx.lineTo(p.x, p.y); ctx.stroke();
      if(!estado.d.firmado){ estado.d.firmado = true; refrescarBoton(); }
    });
    lienzo.addEventListener("pointerup", function(){ dibujando = false; });
    lienzo.addEventListener("pointercancel", function(){ dibujando = false; });
  }
  function refrescarBoton(){
    var boton = document.querySelector(".accion .btn-grande");
    if(boton && estado.flujo) boton.disabled = !PASOS[pasoActual()]().boton.habilitado;
  }

  /* ===== Clics ===== */
  app.addEventListener("click", function(e){
    var el = e.target.closest("[data-accion]");
    if(!el || !app.contains(el) || el.disabled) return;
    var d = estado.d;
    switch(el.dataset.accion){
      case "empezar": empezar(el.dataset.flujo); break;
      case "retiroDe":
        // Vino a devolver pero no tenía lotes: pasa a retiro con ella ya elegida
        var quien = d.costureras[0];
        empezar("retira"); estado.d.costureras = [quien]; estado.paso = 1; render();
        break;
      case "volver": if(estado.paso > 0){ estado.paso--; render(); } else salir(); break;
      case "cancelar": salir(); break;
      case "inicio": terminarDeshacer(); salir(); break;
      case "siguiente": avanzar(); break;
      case "costurera":
        var id = +el.dataset.id;
        if(d.compartida){
          var i = d.costureras.indexOf(id);
          if(i >= 0) d.costureras.splice(i, 1); else d.costureras.push(id);
          d.lote = null; render(false);
        } else {
          d.costureras = [id]; d.lote = null; render(false);
          setTimeout(avanzar, 180);
        }
        break;
      case "compartida":
        d.compartida = el.checked;
        if(!d.compartida) d.costureras = d.costureras.slice(0, 1);
        render(false); break;
      case "lote": d.lote = el.dataset.codigo; d.confirmoRaro = false; render(false); setTimeout(avanzar, 180); break;
      case "campo": d.activo = el.dataset.campo; render(false); break;
      case "tara": d.campos[d.activo].tara = el.dataset.tara; render(false); break;
      case "tecla": teclear(el.dataset.tecla); render(false); break;
      case "confirmarRaro": d.confirmoRaro = true; render(false); break;
      case "calidad": d.calidad[el.dataset.q] = el.dataset.v === "si"; render(false); break;
      case "guardar": guardar(); break;
      case "fardo": d.fardo = el.dataset.codigo; d.campos.retiro.bruto = ""; render(false); setTimeout(avanzar, 180); break;
      case "dias": d.dias = +el.dataset.dias; d.fecha = null; render(false); break;
      case "borrarFirma": d.firmado = false; render(false); break;
      case "empresa": d.empresa = el.dataset.nombre; render(false); break;
      case "sumarPesada":
        d.pesadas.push(neto(d.campos.pesada)); d.campos.pesada.bruto = "";
        avisar("Pesada " + d.pesadas.length + " sumada"); render(false); break;
      case "quitarPesada": d.pesadas.splice(+el.dataset.i, 1); render(false); break;
      case "destino": d.destino = el.dataset.destino; render(false); break;
      case "todoLoQueQueda": d.kgFardo = cifra(restante()).replace(/\./g, ""); render(false); break;
      case "agregarFardo": agregarFardo(); break;
      case "quitarFardo": d.fardos.splice(+el.dataset.i, 1); render(false); break;
      case "deshacer":
        if(!deshacer) break;
        deshacer.restaurar();
        var id2 = deshacer.id;
        registros = registros.filter(function(r){ return r.id !== id2; }); escribir();
        terminarDeshacer(); estado.listo = null; render();
        avisar("Listo, se deshizo el pesaje"); break;
    }
  });

  // Lo que se escribe en campos de texto se guarda sin volver a dibujar (así no se pierde el foco)
  app.addEventListener("input", function(e){
    var el = e.target;
    if(el.id === "buscar"){
      var q = el.value.trim().toLowerCase();
      app.querySelectorAll('.fila[data-nombre]').forEach(function(f){ f.hidden = q && f.dataset.nombre.indexOf(q) < 0; });
      return;
    }
    if(el.dataset.dato){ estado.d[el.dataset.dato] = el.value; refrescarBoton(); }
  });
  app.addEventListener("change", function(e){
    var el = e.target;
    if(el.dataset.dato === "fecha"){ estado.d.fecha = el.value || null; render(false); }
    if(el.hasAttribute("data-foto") && el.files && el.files[0]){
      if(estado.d.foto) URL.revokeObjectURL(estado.d.foto);
      estado.d.foto = URL.createObjectURL(el.files[0]);
      render(false);
    }
  });

  /* ===== Quién está pesando (celular compartido, cambio rápido con PIN) ===== */
  var botonPersona = document.getElementById("persona");
  function dibujarPersona(){
    var p = estado.persona;
    botonPersona.innerHTML = '<span class="avatar">' + iniciales(p.nombre) + "</span>" + esc(p.nombre);
  }
  var pin = { persona: null, digitos: "" };
  function abrirHoja(){ pin.persona = null; pin.digitos = ""; dibujarHoja(); hoja.hidden = false; }
  function cerrarHoja(){ hoja.hidden = true; hoja.innerHTML = ""; botonPersona.focus(); }
  function dibujarHoja(){
    var html = '<div class="hoja-panel" role="dialog" aria-modal="true" aria-labelledby="hoja-titulo">';
    if(!pin.persona){
      html += '<h2 class="hoja-titulo" id="hoja-titulo">¿Quién está pesando?</h2><p class="bajada">Cada pesaje guarda quién lo hizo.</p>' +
        PERSONAS.map(function(p){
          var actual = p.id === estado.persona.id;
          return '<button type="button" class="fila' + (actual ? " elegida" : "") + '" data-persona="' + p.id + '">' +
            '<span class="avatar">' + iniciales(p.nombre) + '</span><span class="fila-texto"><strong>' + esc(p.nombre) + "</strong><span>" + p.rol + "</span></span>" +
            (actual ? ICONO.tilde : "") + "</button>";
        }).join("") +
        '<hr class="puntada"><button type="button" class="btn-linea" data-salir>Cerrar sesión</button>';
    } else {
      var p = PERSONAS.filter(function(x){ return x.id === pin.persona; })[0];
      html += '<h2 class="hoja-titulo" id="hoja-titulo">PIN de ' + esc(p.nombre) + "</h2>" +
        '<p class="nota-chica">En el prototipo sirve cualquier número de 4 cifras.</p>' +
        '<div class="pin-puntos" aria-label="' + pin.digitos.length + ' de 4 números">' +
        [0, 1, 2, 3].map(function(i){ return '<span class="' + (i < pin.digitos.length ? "lleno" : "") + '"></span>'; }).join("") + "</div>" +
        '<div class="teclado">' + ["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0"].map(function(k){
          return k ? '<button type="button" class="tecla" data-pin="' + k + '">' + k + "</button>" : "<span></span>";
        }).join("") + '<button type="button" class="tecla" data-pin="borrar" aria-label="Borrar">' + ICONO.borrar + "</button></div>";
    }
    hoja.innerHTML = html + "</div>";
  }
  botonPersona.addEventListener("click", abrirHoja);
  hoja.addEventListener("click", function(e){
    if(e.target === hoja){ cerrarHoja(); return; }
    if(e.target.closest("[data-salir]")){ OmasApi.cerrarSesion(); return; }
    var elegir = e.target.closest("[data-persona]"), tecla = e.target.closest("[data-pin]");
    if(elegir){
      if(elegir.dataset.persona === estado.persona.id){ cerrarHoja(); return; }
      pin.persona = elegir.dataset.persona; dibujarHoja();
    }
    if(tecla){
      if(tecla.dataset.pin === "borrar") pin.digitos = pin.digitos.slice(0, -1);
      else if(pin.digitos.length < 4) pin.digitos += tecla.dataset.pin;
      dibujarHoja();
      if(pin.digitos.length === 4){
        setTimeout(function(){
          estado.persona = PERSONAS.filter(function(x){ return x.id === pin.persona; })[0];
          cerrarHoja(); render(false); avisar("Ahora pesa " + estado.persona.nombre);
        }, 200);
      }
    }
  });
  document.addEventListener("keydown", function(e){
    if(e.key === "Escape" && !hoja.hidden){ cerrarHoja(); return; }
    // En la notebook también se puede escribir el peso con el teclado
    if(!hoja.hidden || !estado.flujo || !app.querySelector(".teclado")) return;
    if(e.target.closest("input, textarea") || e.ctrlKey || e.metaKey || e.altKey) return;
    var tecla = /^[0-9]$/.test(e.key) ? e.key : (e.key === "," || e.key === ".") ? "," : e.key === "Backspace" ? "borrar" : null;
    if(!tecla) return;
    e.preventDefault(); teclear(tecla); render(false);
  });

  /* ===== Sin internet: se guarda en el celular y se sube al volver la conexión ===== */
  var conexion = document.getElementById("conexion"), subiendo = false;
  function actualizarConexion(){
    var pendientes = registros.filter(function(r){ return !r.sincronizado; }).length;
    if(!navigator.onLine){
      conexion.className = "conexion sin"; conexion.hidden = false;
      conexion.innerHTML = "<i></i>Sin conexión · " + (pendientes ? (pendientes === 1 ? "1 pesaje guardado" : pendientes + " pesajes guardados") + " en el celular" : "lo que cargues se guarda en el celular");
    } else if(pendientes){
      conexion.className = "conexion sube"; conexion.hidden = false;
      conexion.innerHTML = "<i></i>Subiendo " + (pendientes === 1 ? "1 pesaje" : pendientes + " pesajes") + "…";
      if(!subiendo){
        subiendo = true;
        // Simula el envío a la API
        setTimeout(function(){
          subiendo = false;
          if(!navigator.onLine) return actualizarConexion();
          registros.forEach(function(r){ r.sincronizado = true; }); escribir();
          actualizarConexion();
          if(!estado.flujo && !estado.listo) render(false);
        }, 1400);
      }
    } else {
      conexion.hidden = true;
    }
  }
  window.addEventListener("online", function(){ avisar("Volvió la conexión"); actualizarConexion(); });
  window.addEventListener("offline", actualizarConexion);

  var avisoEl = document.getElementById("aviso"), avisoReloj = null;
  function avisar(texto){
    avisoEl.textContent = texto; avisoEl.classList.add("ver");
    clearTimeout(avisoReloj);
    avisoReloj = setTimeout(function(){ avisoEl.classList.remove("ver"); }, 2200);
  }

  // Solo se entra con sesión iniciada. Quien ingresó es quien pesa, hasta que cambie con su PIN.
  OmasApi.exigirSesion().then(function(u){
    OmasMenu.iniciar(u);
    var p = PERSONAS.filter(function(x){ return x.id === u.id; })[0];
    if(!p){ p = { id: u.id, nombre: u.nombre, rol: u.rol, aprueba: u.rol === "Coordinadora" || u.rol === "Supervisión" }; PERSONAS.push(p); }
    estado.persona = p;
    render();
  });
})();
