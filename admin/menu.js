/* ===== SGI-OMAS · Menú lateral compartido =====
   Arma el menú lateral en todas las pantallas del panel, marca la pantalla actual,
   muestra quién ingresó y maneja el menú desplegable en el celular.
   Cada pantalla llama a OmasMenu.iniciar(usuario) después de OmasApi.exigirSesion().
   Para agregar un módulo: sumarlo a MODULOS (y sacarle "pronto" cuando esté hecho). */
window.OmasMenu = (function(){
  "use strict";

  var ICONOS = {
    inicio: '<path d="M4 11l8-7 8 7v9h-5v-6H9v6H4z"/>',
    deposito: '<path d="M12 3v18M7 21h10M3 7h18M6 7l-3 7a3 3 0 0 0 6 0zM18 7l-3 7a3 3 0 0 0 6 0z"/>',
    produccion: '<circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="M20 4L8.1 15.9M14.5 14.5L20 20M8.1 8.1L12 12"/>',
    rendimiento: '<path d="M4 19V5M4 19h16M8 15l3-4 3 2 5-6"/>',
    ventas: '<path d="M5.5 8h13l-1.2 12H6.7z"/><path d="M9 8a3 3 0 0 1 6 0"/>',
    catering: '<path d="M4 14h16a8 8 0 0 1-16 0zM12 6v3M8 7.5l1 2M16 7.5l-1 2M3 19h18"/>',
    talleres: '<path d="M3 8l9-4 9 4-9 4zM7 10v5c0 1.5 2.2 3 5 3s5-1.5 5-3v-5M21 8v5"/>',
    reportes: '<path d="M7 3h7l5 5v13H7z"/><path d="M14 3v5h5M10 13h6M10 17h6"/>',
    usuarios: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.8-3.5 3.4-5.5 6.5-5.5s5.7 2 6.5 5.5M16 4.5a3.5 3.5 0 0 1 0 7M18 14.8c2 .7 3.2 2.5 3.6 5.2"/>'
  };
  var MODULOS = [
    { nombre: "Inicio", icono: "inicio", pagina: "panel.html" },
    { nombre: "Depósito y pesajes", icono: "deposito", pagina: "pesaje.html" },
    { nombre: "Producción", icono: "produccion", pronto: true },
    { nombre: "Rendimiento", icono: "rendimiento", pronto: true },
    { nombre: "Ventas y pedidos", icono: "ventas", pronto: true },
    { nombre: "Catering", icono: "catering", pronto: true },
    { nombre: "Talleres", icono: "talleres", pronto: true },
    { nombre: "Reportes para empresas", icono: "reportes", pronto: true }
  ];
  var ADMINISTRACION = [
    { nombre: "Usuarios", icono: "usuarios", pronto: true }
  ];

  function esc(s){ return String(s).replace(/[&<>"']/g, function(c){ return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }

  function items(lista, actual){
    return '<ul class="menu">' + lista.map(function(m){
      var activo = m.pagina === actual;
      return '<li><a class="menu-item' + (activo ? " activo" : "") + '" href="' + (m.pagina || "#") + '"' +
        (activo ? ' aria-current="page"' : "") + (m.pronto ? " data-pronto" : "") + ">" +
        '<svg viewBox="0 0 24 24" aria-hidden="true">' + ICONOS[m.icono] + "</svg>" + m.nombre +
        (m.pronto ? '<span class="pronto">pronto</span>' : "") + "</a></li>";
    }).join("") + "</ul>";
  }

  function iniciar(usuario){
    var lateral = document.getElementById("lateral"), velo = document.getElementById("velo");
    var actual = location.pathname.split("/").pop() || "panel.html";
    var coordinadora = usuario.rol === "Coordinadora";

    lateral.innerHTML =
      '<a class="lateral-marca" href="panel.html"><img src="../img/logo.png" alt="" width="34" height="40">' +
      "<span><strong>Las Omas</strong><small>Sistema de gestión</small></span></a>" +
      "<nav>" + items(MODULOS, actual) +
      (coordinadora ? '<p class="menu-titulo">Administración</p>' + items(ADMINISTRACION, actual) : "") + "</nav>" +
      '<div class="lateral-usuario"><span class="avatar">' + esc(usuario.nombre.charAt(0)) + "</span>" +
      '<span class="lateral-usuario-texto"><strong>' + esc(usuario.nombre) + "</strong><small>" + esc(usuario.rol) + "</small></span>" +
      '<button type="button" class="salir" id="salir" aria-label="Cerrar sesión" title="Cerrar sesión">' +
      '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 4h4v16h-4M10 8l-4 4 4 4M6 12h10"/></svg></button></div>';

    document.getElementById("salir").addEventListener("click", function(){ OmasApi.cerrarSesion(); });

    // En el celular el menú se despliega desde el botón ☰ de cada pantalla
    var botones = document.querySelectorAll("[data-abrir-menu]");
    function menu(abrir){
      lateral.classList.toggle("abierto", abrir); velo.hidden = !abrir;
      botones.forEach(function(b){ b.setAttribute("aria-expanded", abrir); });
      if(abrir) lateral.querySelector(".menu-item").focus();
    }
    botones.forEach(function(b){ b.addEventListener("click", function(){ menu(true); }); });
    velo.addEventListener("click", function(){ menu(false); });
    document.addEventListener("keydown", function(e){
      if(e.key === "Escape" && lateral.classList.contains("abierto")){ menu(false); if(botones[0]) botones[0].focus(); }
    });
  }

  /* Módulos que todavía no están en el prototipo */
  var avisoReloj;
  document.addEventListener("click", function(e){
    if(!e.target.closest("[data-pronto]")) return;
    e.preventDefault();
    var aviso = document.getElementById("aviso");
    if(!aviso) return;
    aviso.textContent = "Esta parte todavía no está en el prototipo"; aviso.classList.add("ver");
    clearTimeout(avisoReloj); avisoReloj = setTimeout(function(){ aviso.classList.remove("ver"); }, 2400);
  });

  return { iniciar: iniciar };
})();
