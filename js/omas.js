(function(){
  /* ===== Talleres =====
     La lista viene de OmasApi (admin/api.js), que talleres.html carga antes que este archivo.
     La coordinación les cambia la fecha desde el panel (módulo Talleres); nombre, foto y
     descripción quedan fijos. El texto de la fecha lo arma OmasApi.textoFecha, igual que en el panel. */
  var talleres = [];
  function escTexto(s){ return String(s == null ? "" : s).replace(/[&<>"']/g, function(c){ return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]; }); }
  function horarioTaller(t){ return t.sinFecha ? "Fecha a confirmar" : OmasApi.textoFecha(t.cuando); }
  var nombresTipo ={oficios:"Oficios", digital:"Digital", bienestar:"Bienestar"};
  /* Colores de las tarjetas (R G B), se turnan: vino, bordó y azul pizarra */
  var temas = ["128 60 71", "158 39 46", "52 70 90"];
  var flecha = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>';

  /* Tarjetas de inscripción, con el mismo estilo que las de Qué hacemos:
     foto de fondo, degradé de color y botón. Toda la tarjeta abre la inscripción. */
  var lista = document.getElementById("lista-talleres");
  function dibujarTalleres(){
    talleres.forEach(function(t, i){
      var col = document.createElement("div");
      col.className = "col-sm-6 col-lg-4";
      col.dataset.tipo = t.tipo;
      col.innerHTML =
        '<article class="ucard ucard-taller" style="--tema:' + temas[i % temas.length] + '">' +
          (t.img ? '<img src="' + escTexto(t.img) + '" alt="" width="400" height="516" loading="lazy">' : '') +
          '<span class="ucard-velo" aria-hidden="true"></span>' +
          '<div class="ucard-cuerpo">' +
            '<span class="ucard-sub">' + escTexto(nombresTipo[t.tipo]) + '</span>' +
            '<h3 class="ucard-titulo">' + escTexto(t.nombre) + '</h3>' +
            '<p class="ucard-dato">' + escTexto(t.desc) + '</p>' +
            '<p class="taller-horario">' + escTexto(horarioTaller(t)) + '</p>' +
            '<button type="button" class="ucard-boton taller-inscribir" data-taller="' + i + '">Inscribirme ' + flecha + '</button>' +
          '</div>' +
        '</article>';
      lista.appendChild(col);
    });
  }
  if(lista){
    var pedidoTalleres = window.OmasApi ? OmasApi.listarTalleres() : Promise.reject();
    pedidoTalleres.then(function(datos){
      /* Las páginas están en "PARTE VISUAL DE OMAS/", las imágenes una carpeta arriba */
      // Si era un día puntual que ya pasó, se muestra "Fecha a confirmar" (y se pueden anotar igual)
      talleres = datos.map(function(t){
        return Object.assign({}, t, { img: t.img ? "../" + t.img : "", sinFecha: !t.cuando || t.cuando.modo === "aConfirmar" || OmasApi.yaPaso(t.cuando) });
      });
      dibujarTalleres();
    }).catch(function(){
      // Si el sistema no responde, la página no queda vacía
      lista.innerHTML = '<p class="col-12">No pudimos cargar los talleres. <a href="contacto.html" data-motivo="Talleres">Escribinos</a> y te contamos cuáles vienen.</p>';
    });
    document.querySelectorAll('input[name="filtro"]').forEach(function(r){
      r.addEventListener("change", function(){
        lista.querySelectorAll("[data-tipo]").forEach(function(c){
          c.hidden = r.value !== "todos" && c.dataset.tipo !== r.value;
        });
      });
    });
  }

  /* ===== Navegación entre páginas =====
     Versión de desarrollo: cada página es un .html distinto (body[data-pagina]).
     Versión boceto: una sola página con vistas que cambian según el #. */
  function marcarMenu(p){
    document.querySelectorAll("[data-pagina]").forEach(function(a){
      if(a.tagName === "A") a.classList.toggle("active", a.dataset.pagina === p);
    });
  }
  function aplicarMotivo(){
    var sel = document.getElementById("c-motivo"); if(!sel) return;
    try { var m = sessionStorage.getItem("omas-motivo"); if(m){ sel.value = m; sessionStorage.removeItem("omas-motivo"); } } catch(e){}
  }
  var vistas = document.querySelectorAll(".vista");
  if(vistas.length > 1){
    var ruta = function(){
      var h = location.hash.slice(1) || "inicio";
      var existe = document.querySelector('.vista[data-vista-id="' + h + '"]');
      var v = existe ? h : "inicio";
      vistas.forEach(function(x){ x.hidden = x.dataset.vistaId !== v; });
      marcarMenu(v);
      window.scrollTo(0, 0);
      aplicarMotivo();
    };
    window.addEventListener("hashchange", ruta);
    ruta();
  } else {
    marcarMenu(document.body.dataset.pagina || "inicio");
    aplicarMotivo();
  }

  /* Si Bootstrap no llega a cargar (servidor caído o firma que no coincide), el resto de la
     página sigue andando: en vez de abrir la ventana, lleva a Contacto para que puedan escribir. */
  function crearModal(el){
    if(window.bootstrap) return new bootstrap.Modal(el);
    return { show: function(){ location.href = "contacto.html"; }, hide: function(){} };
  }

  /* ===== Modal de inscripción ===== */
  var modalTallerEl = document.getElementById("modal-taller");
  var modalTaller = crearModal(modalTallerEl);
  var formTaller = document.getElementById("form-taller");
  var tallerOk = document.getElementById("taller-ok");
  var tallerActual = null;

  if(lista) lista.addEventListener("click", function(e){
    var b = e.target.closest("[data-taller]");
    if(!b) return;
    tallerActual = talleres[+b.dataset.taller];
    document.getElementById("taller-titulo").textContent = tallerActual.nombre;
    document.getElementById("taller-detalle").textContent = horarioTaller(tallerActual) + " · Sede OMAS";
    formTaller.hidden = false; tallerOk.hidden = true; formTaller.reset(); estadoTaller.textContent = "";
    limpiarErrores(formTaller);
    modalTaller.show();
  });

  /* La inscripción va a la API (POST /api/inscripciones) y aparece en el panel,
     en Talleres → Inscriptas. Si no se puede enviar, se avisa y no se pierde lo escrito. */
  var estadoTaller = document.getElementById("taller-estado");
  formTaller.addEventListener("submit", async function(e){
    e.preventDefault();
    if(!validar(formTaller)) return;
    var boton = formTaller.querySelector('[type="submit"]');
    var nombre = document.getElementById("t-nombre").value.trim().split(" ")[0];
    boton.disabled = true; estadoTaller.textContent = "Enviando…";
    try {
      await OmasApi.inscribirTaller({
        tallerId: tallerActual.id,
        nombre: document.getElementById("t-nombre").value,
        dni: document.getElementById("t-dni").value,
        telefono: document.getElementById("t-tel").value
      });
    } catch(err){
      estadoTaller.textContent = "No pudimos enviar la inscripción. Probá de nuevo o escribinos por WhatsApp.";
      boton.disabled = false;
      return;
    }
    boton.disabled = false; estadoTaller.textContent = "";
    document.getElementById("taller-ok-txt").textContent =
      tallerActual.sinFecha
        ? nombre + ", te anotamos en " + tallerActual.nombre + ". Cuando tengamos la fecha te escribimos por WhatsApp."
        : nombre + ", te esperamos en " + tallerActual.nombre + ". Te vamos a escribir por WhatsApp para confirmar.";
    formTaller.hidden = true; tallerOk.hidden = false;
  });

  /* ===== Modal de donación (paso a paso) ===== */
  var modalDonaEl = document.getElementById("modal-dona");
  var modalDona = crearModal(modalDonaEl);
  var pasos = modalDonaEl.querySelectorAll(".paso");
  var elegido = document.getElementById("dona-elegido");
  var btnVolver = document.getElementById("dona-volver");
  var estado = {quien:null, que:null, historial:[]};

  var textos = {
    "1": {n:"Paso 1 de 3", t:"¿Quién dona?"},
    "2": {n:"Paso 2 de 3", t:"¿Qué querés donar?"},
    "persona-dinero": {n:"Paso 3 de 3", t:"Tu aporte"},
    "persona-ropa": {n:"Paso 3 de 3", t:"Tu donación de ropa"},
    "empresa-dinero": {n:"Paso 3 de 3", t:"Aporte de tu empresa"},
    "empresa-ropa": {n:"Paso 3 de 3", t:"Descarte textil de tu empresa"},
    "gracias": {n:"Listo", t:"¡Gracias!"}
  };

  function mostrar(paso, guardar){
    if(guardar !== false){
      var actual = modalDonaEl.querySelector(".paso:not([hidden])");
      if(actual) estado.historial.push(actual.dataset.paso);
    }
    pasos.forEach(function(p){ p.hidden = p.dataset.paso !== paso; });
    document.getElementById("dona-paso").textContent = textos[paso].n;
    document.getElementById("dona-titulo").textContent = textos[paso].t;
    var chips = [];
    if(estado.quien && paso !== "1") chips.push(estado.quien === "persona" ? "Persona" : "Empresa");
    if(estado.que && paso !== "1" && paso !== "2") chips.push(estado.que === "dinero" ? "Dinero" : "Ropa y telas");
    elegido.innerHTML = chips.map(function(c){ return "<span>" + c + "</span>"; }).join("");
    elegido.hidden = chips.length === 0;
    btnVolver.hidden = paso === "1" || paso === "gracias" || estado.historial.length === 0;
    var form = modalDonaEl.querySelector('.paso[data-paso="' + paso + '"]');
    if(form && form.tagName === "FORM") limpiarErrores(form);
  }

  function abrirDona(destino){
    estado.historial = [];
    if(destino && destino !== "inicio"){
      var partes = destino.split("-");
      estado.quien = partes[0]; estado.que = partes[1];
      mostrar(destino, false);
    } else {
      estado.quien = null; estado.que = null;
      mostrar("1", false);
    }
    modalDona.show();
  }

  document.addEventListener("click", function(e){
    var b = e.target.closest("button[data-dona]");
    if(b){ e.preventDefault(); abrirDona(b.dataset.dona); return; }
    var m = e.target.closest("[data-motivo]");
    if(m){
      try { sessionStorage.setItem("omas-motivo", m.dataset.motivo); } catch(err){}
      var sel = document.getElementById("c-motivo"); if(sel) sel.value = m.dataset.motivo;
    }
  });

  modalDonaEl.addEventListener("click", function(e){
    var q = e.target.closest("[data-quien]");
    if(q){ estado.quien = q.dataset.quien; mostrar("2"); return; }
    var w = e.target.closest("[data-que]");
    if(w){ estado.que = w.dataset.que; mostrar(estado.quien + "-" + estado.que); }
  });

  btnVolver.addEventListener("click", function(){
    var anterior = estado.historial.pop();
    if(!anterior) return;
    if(anterior === "1"){ estado.quien = null; estado.que = null; }
    if(anterior === "2"){ estado.que = null; }
    mostrar(anterior, false);
  });

  /* Montos: equivalencias y "otro monto" */
  var equivalencias = {
    "5000":"Con $5.000 se compran hilos y agujas para un mes de taller.",
    "10000":"Con $10.000 se cubren materiales para una clase de costura.",
    "20000":"Con $20.000 se sostiene una semana del espacio de contención.",
    "otro":"Cualquier monto suma. Gracias por acompañar."
  };
  function actualizarMonto(){
    var m = modalDonaEl.querySelector('input[name="pd-monto"]:checked').value;
    var otro = document.getElementById("pd-otro");
    otro.hidden = m !== "otro";
    otro.required = m === "otro";
    document.getElementById("pd-equiv").textContent = equivalencias[m];
  }
  modalDonaEl.querySelectorAll('input[name="pd-monto"]').forEach(function(r){
    r.addEventListener("change", actualizarMonto);
  });

  /* Envío de cada formulario de donación */
  var agradecimientos = {
    "persona-dinero": function(){
      var frec = modalDonaEl.querySelector('input[name="pd-frec"]:checked').value;
      var m = modalDonaEl.querySelector('input[name="pd-monto"]:checked').value;
      if(m === "otro") m = document.getElementById("pd-otro").value.replace(/\D/g, "");
      var monto = m ? "$" + Number(m).toLocaleString("es-AR") : "tu aporte";
      return "Registramos " + monto + (frec === "Mensual" ? " todos los meses" : "") + ". Te enviamos los datos de pago por email.";
    },
    "persona-ropa": function(){
      return "Te esperamos en la sede, de lunes a viernes de 9 a 17 h. Si podés, separá lo que está en buen estado de lo que está roto.";
    },
    "empresa-dinero": function(){
      return "Recibimos la propuesta de " + (document.getElementById("ed-razon").value || "tu empresa") + ". Coordinación se contacta en 48 h hábiles" + (document.getElementById("ed-cert").checked ? " y prepara el certificado de donación." : ".");
    },
    "empresa-ropa": function(){
      var kg = document.getElementById("er-kg").value;
      return "Registramos " + (kg ? "unos " + kg + " kg de material" : "tu donación textil") + ". Coordinación se contacta para acordar la entrega" + (document.getElementById("er-reporte").checked ? ", y al terminar te enviamos el reporte de impacto." : ".");
    }
  };
  modalDonaEl.querySelectorAll("form.paso").forEach(function(f){
    f.addEventListener("submit", function(e){
      e.preventDefault();
      if(!validar(f)) return;
      document.getElementById("gracias-txt").textContent = agradecimientos[f.dataset.paso]();
      mostrar("gracias");
      f.reset();
      actualizarMonto();
    });
  });

  /* ===== Contacto ===== */
  var fc = document.getElementById("form-contacto");
  if(fc) fc.addEventListener("submit", function(e){
    e.preventDefault();
    var st = document.getElementById("c-estado");
    if(!validar(fc)){ st.textContent = "Completá tu nombre y un teléfono o email."; return; }
    st.textContent = "Recibimos tu consulta. (En el boceto no se envía nada.)";
    fc.reset();
  });

  /* Cierra el menú en celular al tocar un enlace */
  document.querySelectorAll("#menu .nav-link").forEach(function(a){
    a.addEventListener("click", function(){
      var menu = document.getElementById("menu");
      if(menu.classList.contains("show") && window.bootstrap) bootstrap.Collapse.getOrCreateInstance(menu).hide();
    });
  });

  var sinMovimiento = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ===== Tira de logos en movimiento =====
     Se duplican los logos para que el bucle no tenga cortes; las copias
     quedan ocultas para lectores de pantalla. */
  if(!sinMovimiento){
    document.querySelectorAll(".logos-carrusel").forEach(function(carrusel){
      var lista = carrusel.querySelector(".logos");
      Array.prototype.slice.call(lista.children).forEach(function(li){
        var copia = li.cloneNode(true);
        copia.setAttribute("aria-hidden", "true");
        lista.appendChild(copia);
      });
      carrusel.classList.add("en-movimiento");
    });

    /* Tira de fotos de la portada: mismo bucle, pero sin frenarse con el cursor */
    document.querySelectorAll(".tal-tira").forEach(function(tira){
      Array.prototype.slice.call(tira.children).forEach(function(img){
        var copia = img.cloneNode(true);
        copia.alt = "";
        copia.setAttribute("aria-hidden", "true");
        tira.appendChild(copia);
      });
      tira.classList.add("en-movimiento");
    });
  }

  /* ===== Aparición suave al bajar ===== */
  if("IntersectionObserver" in window && !sinMovimiento){
    var bloques = [];
    document.querySelectorAll("main .container > *").forEach(function(el){
      if(el.classList.contains("row")){
        Array.prototype.forEach.call(el.children, function(col, i){
          col.style.transitionDelay = (i % 4) * 80 + "ms";
          bloques.push(col);
        });
      } else {
        bloques.push(el);
      }
    });
    var observador = new IntersectionObserver(function(entradas){
      entradas.forEach(function(en){
        if(en.isIntersecting){ en.target.classList.add("visible"); observador.unobserve(en.target); }
      });
    });
    bloques.forEach(function(el){ el.classList.add("revelar"); observador.observe(el); });
    document.documentElement.classList.add("con-revelar");
  }

  /* ===== Corazones que suben en el bloque del título de todas las páginas
     y en la portada de las ventanas que abren las tarjetas =====
     Corazones de distintos tamaños suben ondulando; el filtro "goo" hace que se
     fundan entre sí cuando se cruzan. Se pausa si la portada no está a la vista
     (las ventanas cerradas no están a la vista, así que no gastan batería). */
  var portadasSinFotos = document.querySelectorAll(".tal-hero-arriba, .umodal-portada");
  if(portadasSinFotos.length && !sinMovimiento){
    var svgNS = "http://www.w3.org/2000/svg";
    var CORAZON = "M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z";
    var filtro = document.createElementNS(svgNS, "svg");
    filtro.setAttribute("class", "corazones-filtro");
    filtro.setAttribute("aria-hidden", "true");
    filtro.innerHTML = '<defs><filter id="goo-corazones"><feGaussianBlur in="SourceGraphic" result="blur" stdDeviation="6"/>' +
      '<feColorMatrix in="blur" result="goo" type="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 21 -9"/>' +
      '<feBlend in="SourceGraphic" in2="goo"/></filter></defs>';
    document.body.appendChild(filtro);

    portadasSinFotos.forEach(function(portada){
      var capa = document.createElement("div");
      capa.className = "corazones-fondo";
      capa.setAttribute("aria-hidden", "true");
      portada.insertBefore(capa, portada.firstChild);
      portada.classList.add("con-corazones");
      var lista = [], visible = true;

      function nuevo(){
        var ancho = capa.clientWidth, alto = capa.clientHeight;
        var el = document.createElementNS(svgNS, "svg");
        el.setAttribute("viewBox", "0 0 24 24");
        el.innerHTML = '<path d="' + CORAZON + '"/>';
        capa.appendChild(el);
        lista.push({ el: el, x: Math.random() * ancho, pos: alto + 40, roce: 0.5 + Math.random() * 0.8,
          escala: 0.5 + Math.random() * 1.8, onda: (ancho / 6) * Math.random(), pasos: Math.max(alto, 200) / 2,
          giro: 0, sentido: Math.random() > 0.5 ? 1 : -1 });
      }
      function mover(){
        if(visible && !document.hidden){
          lista = lista.filter(function(p){
            p.pos -= p.roce; p.giro += p.roce * 0.4;
            var izq = p.x + Math.sin(p.pos * Math.PI / p.pasos) * p.onda;
            p.el.style.transform = "translate(" + izq + "px," + p.pos + "px) scale(" + p.escala + ") rotate(" + (p.giro * p.sentido) + "deg)";
            if(p.pos < -60){ p.el.remove(); return false; }
            return true;
          });
        }
        requestAnimationFrame(mover);
      }
      setInterval(function(){ if(visible && !document.hidden) nuevo(); }, 260);
      if("IntersectionObserver" in window){
        new IntersectionObserver(function(e){ visible = e[0].isIntersecting; }).observe(portada);
      }
      mover();
    });
  }

  /* ===== Mapa de la sede (Talleres, pregunta "¿Dónde son los talleres?") =====
     Cerrado: tarjeta chica que se inclina en 3D siguiendo el cursor.
     Al tocarla se agranda y carga el mapa de Google con la ubicación
     (se carga recién ahí, para no hacer lenta la página). */
  document.querySelectorAll(".mapa").forEach(function(mapa){
    var caja = mapa.querySelector(".mapa-caja");
    var boton = mapa.querySelector(".mapa-abrir");
    var marco = mapa.querySelector(".mapa-marco");
    var estado = mapa.querySelector(".mapa-estado-txt");
    var conCursor = window.matchMedia("(hover: hover)").matches && !sinMovimiento;

    function cargarMapa(){
      if(marco.firstChild) return;
      var iframe = document.createElement("iframe");
      /* Con data-cid (el identificador del lugar en Google) el mapa muestra la ficha
         con el nombre; si no está, usa las coordenadas */
      iframe.src = mapa.dataset.cid
        ? "https://maps.google.com/maps?cid=" + mapa.dataset.cid + "&output=embed"
        : "https://maps.google.com/maps?q=" + mapa.dataset.lat + "," + mapa.dataset.lng + "&z=15&output=embed";
      iframe.title = "Mapa con la ubicación de la Sede OMAS";
      iframe.loading = "lazy";
      iframe.referrerPolicy = "no-referrer-when-downgrade";
      marco.appendChild(iframe);
    }
    /* Mapa fijo (Contacto): ya abierto, sin inclinación ni botón para cerrar.
       Si está dentro de una ventana, se carga recién cuando se abre */
    if(mapa.classList.contains("mapa-fija")){
      var ventana = mapa.closest(".modal");
      if(ventana) ventana.addEventListener("show.bs.modal", cargarMapa);
      else cargarMapa();
      return;
    }

    mapa.addEventListener("mousemove", function(e){
      if(!conCursor || mapa.classList.contains("abierto")) return;
      var r = caja.getBoundingClientRect();
      var x = Math.max(-1, Math.min(1, (e.clientX - r.left - r.width / 2) / (r.width / 2)));
      var y = Math.max(-1, Math.min(1, (e.clientY - r.top - r.height / 2) / (r.height / 2)));
      caja.style.setProperty("--giro-x", (-y * 8) + "deg");
      caja.style.setProperty("--giro-y", (x * 8) + "deg");
    });
    mapa.addEventListener("mouseleave", function(){
      caja.style.setProperty("--giro-x", "0deg");
      caja.style.setProperty("--giro-y", "0deg");
    });

    boton.addEventListener("click", function(){
      var abrir = !mapa.classList.contains("abierto");
      if(abrir) cargarMapa();
      mapa.classList.toggle("abierto", abrir);
      boton.setAttribute("aria-expanded", abrir ? "true" : "false");
      estado.textContent = abrir ? "Cerrar" : "Ver mapa";
      caja.style.setProperty("--giro-x", "0deg");
      caja.style.setProperty("--giro-y", "0deg");
    });
  });

  /* ===== Botones "Copiar" (por ejemplo el alias en Doná) ===== */
  document.querySelectorAll("[data-copiar]").forEach(function(b){
    b.addEventListener("click", function(){
      var origen = document.querySelector(b.dataset.copiar);
      if(!origen || !navigator.clipboard) return;
      navigator.clipboard.writeText(origen.textContent.trim()).then(function(){
        var texto = b.textContent;
        b.textContent = "¡Copiado!";
        setTimeout(function(){ b.textContent = texto; }, 1800);
      });
    });
  });

  /* ===== Talleres: lista de propuestas =====
     En compu, al pasar el cursor (o al hacer clic) sobre un nombre se muestra
     su foto y su descripción a la derecha. En el celular funciona como
     desplegable: se toca un nombre y se abre debajo. */
  var propItems = document.querySelectorAll(".prop-item");
  if(propItems.length){
    var conCursor = window.matchMedia("(hover: hover) and (min-width: 992px)");
    function elegir(item){
      propItems.forEach(function(otro){
        var activo = otro === item;
        otro.classList.toggle("activo", activo);
        otro.querySelector(".prop-nombre").setAttribute("aria-expanded", activo ? "true" : "false");
      });
    }
    propItems.forEach(function(item){
      var boton = item.querySelector(".prop-nombre");
      boton.addEventListener("click", function(){ elegir(item); });
      boton.addEventListener("mouseenter", function(){ if(conCursor.matches) elegir(item); });
    });

    /* Pase automático en compu: cuando termina la barrita del taller activo
       (ver .girando en omas.css) pasa al siguiente. Solo corre con la sección
       en pantalla y se respeta a quien pide menos movimiento. */
    var prop = document.querySelector(".prop");
    var sinMovimiento = window.matchMedia("(prefers-reduced-motion: reduce)");
    var enPantalla = false;
    function actualizarGiro(){
      prop.classList.toggle("girando", enPantalla && conCursor.matches && !sinMovimiento.matches);
    }
    if("IntersectionObserver" in window){
      new IntersectionObserver(function(entradas){
        enPantalla = entradas[0].isIntersecting;
        actualizarGiro();
      }, {threshold: .4}).observe(prop);
    }
    conCursor.addEventListener("change", actualizarGiro);
    sinMovimiento.addEventListener("change", actualizarGiro);
    prop.addEventListener("animationend", function(e){
      if(e.animationName !== "prop-avance") return;
      var lista = Array.prototype.slice.call(propItems);
      var actual = lista.indexOf(prop.querySelector(".prop-item.activo"));
      elegir(lista[(actual + 1) % lista.length]);
    });
  }

  /* Un enlace dentro de una ventana que lleva a otra parte de la página
     (por ejemplo "Ver horarios y anotarme"): primero cierra la ventana y después baja */
  document.querySelectorAll(".umodal a[href^='#']").forEach(function(a){
    a.addEventListener("click", function(e){
      var destino = document.querySelector(a.getAttribute("href"));
      if(!destino || !window.bootstrap) return;
      e.preventDefault();
      var modal = a.closest(".modal");
      modal.addEventListener("hidden.bs.modal", function(){ destino.scrollIntoView(); }, { once: true });
      bootstrap.Modal.getOrCreateInstance(modal).hide();
    });
  });

  /* ===== Validación simple =====
     DNI y teléfono se aceptan como los escribe la gente ("12.345.678", "351 555-1234"):
     se sacan puntos, espacios y guiones y se cuentan los dígitos.
     La validación que de verdad protege los datos va también en la API. */
  function soloDigitos(v){ return v.replace(/[\s.\-()]/g, ""); }
  function validar(form){
    var ok = true;
    form.querySelectorAll("[required]").forEach(function(c){
      var v = c.value.trim();
      var bien = v !== "" && (c.type !== "email" || /.+@.+\..+/.test(v));
      if(bien && c.id === "t-dni") bien = /^\d{7,8}$/.test(soloDigitos(v));
      if(bien && c.type === "tel") bien = /^\+?\d{8,13}$/.test(soloDigitos(v));
      c.classList.toggle("is-invalid", !bien);
      if(!bien && ok){ c.focus(); ok = false; }
    });
    return ok;
  }
  function limpiarErrores(form){
    form.querySelectorAll(".is-invalid").forEach(function(c){ c.classList.remove("is-invalid"); });
  }
})();
