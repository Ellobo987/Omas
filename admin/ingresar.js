/* ===== SGI-OMAS · Ingreso al sistema =====
   Valida el formulario, pide el ingreso a la API (api.js) y lleva a la pantalla que se pidió.
   No hay registro: las cuentas las crea la coordinación. */
(function(){
  "use strict";

  var form = document.getElementById("form-ingreso");
  var usuario = document.getElementById("usuario");
  var clave = document.getElementById("clave");
  var boton = document.getElementById("btn-ingresar");
  var textoBoton = boton.querySelector(".btn-ingresar-texto");
  var aviso = document.getElementById("aviso-form");

  // A dónde ir después de ingresar. Solo se aceptan páginas del panel, para que nadie
  // pueda armar un enlace que después del ingreso lleve a otro sitio.
  var volver = new URLSearchParams(location.search).get("volver");
  if(!volver || !/^[a-z0-9-]+\.html$/.test(volver) || volver === "ingresar.html") volver = "panel.html";

  // No se recuerda a nadie: llegar a esta pantalla cierra cualquier sesión abierta,
  // y cada vez hay que escribir el usuario y la contraseña de nuevo
  OmasApi.cerrarSesion({ redirigir: false });
  // Al volver con la flecha "atrás", el navegador puede traer el formulario lleno: se vacía
  window.addEventListener("pageshow", function(){
    form.reset(); boton.classList.remove("cargando", "adentro"); textoBoton.textContent = "Ingresar";
  });

  /* ----- Borde que se ilumina siguiendo el mouse ----- */
  document.querySelectorAll(".brillo").forEach(function(caja){
    caja.addEventListener("mousemove", function(e){
      var r = caja.getBoundingClientRect();
      caja.style.setProperty("--x", (e.clientX - r.left) + "px");
      caja.style.setProperty("--y", (e.clientY - r.top) + "px");
    });
  });

  /* ----- Mostrar u ocultar la contraseña ----- */
  var verClave = document.getElementById("ver-clave");
  verClave.addEventListener("click", function(){
    var mostrar = clave.type === "password";
    clave.type = mostrar ? "text" : "password";
    verClave.setAttribute("aria-pressed", mostrar);
    verClave.setAttribute("aria-label", mostrar ? "Ocultar contraseña" : "Mostrar contraseña");
    clave.focus();
  });

  /* ----- Aviso de mayúsculas activadas ----- */
  var errorClave = document.getElementById("error-clave");
  function revisarMayus(e){
    if(!e.getModifierState) return;
    var activas = e.getModifierState("CapsLock");
    if(activas && !errorClave.textContent){ errorClave.textContent = "Ojo: tenés las mayúsculas activadas."; errorClave.classList.add("mayus"); }
    if(!activas && errorClave.classList.contains("mayus")){ errorClave.textContent = ""; errorClave.classList.remove("mayus"); }
  }
  clave.addEventListener("keyup", revisarMayus);
  clave.addEventListener("keydown", revisarMayus);

  /* ----- ¿Te olvidaste la contraseña? ----- */
  var olvide = document.getElementById("olvide"), olvideNota = document.getElementById("olvide-nota");
  olvide.addEventListener("click", function(){
    olvideNota.hidden = !olvideNota.hidden;
    olvide.setAttribute("aria-expanded", !olvideNota.hidden);
  });

  /* ----- Validación ----- */
  function marcar(campo, mensaje){
    var error = document.getElementById("error-" + campo.id);
    error.textContent = mensaje || ""; error.classList.remove("mayus");
    if(mensaje) campo.setAttribute("aria-invalid", "true"); else campo.removeAttribute("aria-invalid");
  }
  function validar(){
    var bien = true;
    if(!usuario.value.trim()){ marcar(usuario, "Escribí tu usuario o email."); bien = false; } else marcar(usuario);
    if(!clave.value){ marcar(clave, "Escribí tu contraseña."); bien = false; } else marcar(clave);
    return bien;
  }
  [usuario, clave].forEach(function(campo){
    campo.addEventListener("input", function(){
      if(campo.getAttribute("aria-invalid")) marcar(campo);
      aviso.hidden = true;
    });
  });

  /* ----- Ingresar ----- */
  form.addEventListener("submit", function(e){
    e.preventDefault();
    aviso.hidden = true;
    if(!validar()){
      (usuario.getAttribute("aria-invalid") ? usuario : clave).focus();
      return;
    }
    boton.classList.add("cargando"); textoBoton.textContent = "Ingresando…";
    OmasApi.iniciarSesion(usuario.value.trim(), clave.value)
      .then(function(u){
        boton.classList.remove("cargando"); boton.classList.add("adentro");
        textoBoton.textContent = "¡Hola, " + u.nombre + "!";
        setTimeout(function(){ location.href = volver; }, 700);
      })
      .catch(function(error){
        boton.classList.remove("cargando"); textoBoton.textContent = "Ingresar";
        aviso.textContent = error.message || "No se pudo ingresar. Probá de nuevo.";
        aviso.hidden = false;
        if(error.tipo === "credenciales"){ clave.value = ""; clave.focus(); }
        form.classList.remove("sacude"); void form.offsetWidth; form.classList.add("sacude");
      });
  });
})();
