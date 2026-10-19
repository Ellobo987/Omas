/* ===== SGI-OMAS · Mi contraseña =====
   Cada persona cambia la suya. Pide la actual (así nadie puede cambiarla si encuentra la sesión abierta)
   y la nueva dos veces. Las reglas las controla también la API: 8 o más caracteres, distinta de la actual. */
(function(){
  "use strict";

  var form = document.getElementById("form-clave");
  var actual = document.getElementById("actual"), nueva = document.getElementById("nueva"), repetir = document.getElementById("repetir");
  var error = document.getElementById("error"), avisoEl = document.getElementById("aviso"), avisoReloj;

  function avisar(texto){
    avisoEl.textContent = texto; avisoEl.classList.add("ver");
    clearTimeout(avisoReloj);
    avisoReloj = setTimeout(function(){ avisoEl.classList.remove("ver"); }, 3000);
  }
  function mal(texto, campo){ error.textContent = texto; error.hidden = false; if(campo) campo.focus(); }

  document.getElementById("mostrar").addEventListener("change", function(e){
    [actual, nueva, repetir].forEach(function(c){ c.type = e.target.checked ? "text" : "password"; });
  });
  form.addEventListener("input", function(){ error.hidden = true; });

  form.addEventListener("submit", async function(e){
    e.preventDefault();
    if(!actual.value) return mal("Escribí tu contraseña actual.", actual);
    if(nueva.value.length < 8) return mal("La contraseña nueva tiene que tener al menos 8 caracteres.", nueva);
    if(nueva.value !== repetir.value) return mal("Las dos contraseñas nuevas no coinciden.", repetir);
    if(nueva.value === actual.value) return mal("La contraseña nueva tiene que ser distinta de la actual.", nueva);

    var boton = form.querySelector('[type="submit"]');
    boton.disabled = true; boton.textContent = "Guardando…";
    try {
      await OmasApi.cambiarClave(actual.value, nueva.value);
      form.reset();
      avisar("Listo, tu contraseña cambió. La próxima vez entrá con la nueva.");
    } catch(err){
      mal(err.message || "No se pudo cambiar la contraseña. Probá de nuevo.", err.tipo === "datos" ? actual : null);
    } finally {
      boton.disabled = false; boton.textContent = "Cambiar contraseña";
    }
  });

  OmasApi.exigirSesion().then(function(u){ OmasMenu.iniciar(u); actual.focus(); });
})();
