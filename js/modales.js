/* ===== Ventanas compartidas por todas las páginas =====
   El formulario de donación (paso a paso) y el de inscripción a talleres.
   Antes estaban copiados en cada .html; ahora viven solo acá y se agregan
   a la página al cargar. Tiene que cargarse ANTES de omas.js. */

/* Aviso de datos que va antes de cada botón de enviar: la Ley 25.326 pide
   decir para qué se usan los datos en el momento en que se piden. */
var avisoDatos = `<p class="aviso-datos">Usamos estos datos solo para lo que nos pedís acá. No los compartimos con nadie. <a href="privacidad.html">Cómo cuidamos tus datos</a></p>`;

document.body.insertAdjacentHTML("beforeend", `
<!-- ===== MODAL: DONAR (paso a paso) ===== -->
<div class="modal fade" id="modal-dona" tabindex="-1" aria-labelledby="dona-titulo" aria-hidden="true">
  <div class="modal-dialog modal-dialog-centered modal-dialog-scrollable modal-lg">
    <div class="modal-content">
      <div class="modal-header">
        <div>
          <p class="etiqueta mb-1" id="dona-paso">Paso 1 de 3</p>
          <h2 class="modal-title" id="dona-titulo">¿Quién dona?</h2>
        </div>
        <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Cerrar"></button>
      </div>
      <div class="modal-body">
        <div class="elegido" id="dona-elegido" hidden></div>

        <!-- Paso 1 -->
        <div class="paso" data-paso="1">
          <div class="row g-3">
            <div class="col-sm-6"><button type="button" class="eleccion" data-quien="persona"><span class="eleccion-titulo">Soy una persona</span><span class="eleccion-txt">Dono a título personal</span></button></div>
            <div class="col-sm-6"><button type="button" class="eleccion" data-quien="empresa"><span class="eleccion-titulo">Soy una empresa</span><span class="eleccion-txt">Dono en nombre de una organización</span></button></div>
          </div>
        </div>

        <!-- Paso 2 -->
        <div class="paso" data-paso="2" hidden>
          <div class="row g-3">
            <div class="col-sm-6"><button type="button" class="eleccion" data-que="dinero"><span class="eleccion-titulo">Dinero</span><span class="eleccion-txt">Transferencia o Mercado Pago</span></button></div>
            <div class="col-sm-6"><button type="button" class="eleccion" data-que="ropa"><span class="eleccion-titulo">Ropa y telas</span><span class="eleccion-txt">Prendas, uniformes, retazos</span></button></div>
          </div>
        </div>

        <!-- Paso 3: Persona + Dinero -->
        <form class="paso" data-paso="persona-dinero" hidden novalidate>
          <fieldset class="mb-3">
            <legend class="form-label">Frecuencia</legend>
            <div class="chips">
              <input type="radio" class="btn-check" name="pd-frec" id="pd-unica" value="Única vez" checked><label class="chip" for="pd-unica">Única vez</label>
              <input type="radio" class="btn-check" name="pd-frec" id="pd-mensual" value="Mensual"><label class="chip" for="pd-mensual">Todos los meses</label>
            </div>
          </fieldset>
          <fieldset class="mb-3">
            <legend class="form-label">Monto</legend>
            <div class="chips">
              <input type="radio" class="btn-check" name="pd-monto" id="pd-m1" value="5000"><label class="chip" for="pd-m1">$5.000</label>
              <input type="radio" class="btn-check" name="pd-monto" id="pd-m2" value="10000" checked><label class="chip" for="pd-m2">$10.000</label>
              <input type="radio" class="btn-check" name="pd-monto" id="pd-m3" value="20000"><label class="chip" for="pd-m3">$20.000</label>
              <input type="radio" class="btn-check" name="pd-monto" id="pd-m4" value="otro"><label class="chip" for="pd-m4">Otro monto</label>
            </div>
            <input class="form-control mt-2" id="pd-otro" inputmode="numeric" placeholder="Ingresá el monto en pesos" aria-label="Otro monto, en pesos" hidden>
            <p class="texto-chico mt-2 mb-0" id="pd-equiv">Con $10.000 se cubren materiales para una clase de costura.</p>
          </fieldset>
          <div class="row g-3">
            <div class="col-sm-6"><label class="form-label" for="pd-nombre">Nombre y apellido</label><input class="form-control" id="pd-nombre" required autocomplete="name"></div>
            <div class="col-sm-6"><label class="form-label" for="pd-mail">Email</label><input class="form-control" id="pd-mail" type="email" required autocomplete="email"></div>
          </div>
          <div class="pago mt-3">
            <p class="mb-1"><strong>Datos para transferir</strong></p>
            <p class="mb-0 texto-chico">Alias: LAS.OMAS.DONA · CBU: a completar · Titular: Asociación Civil OMAS</p>
          </div>
          ${avisoDatos}
          <button class="btn btn-principal mt-3" type="submit">Confirmar donación</button>
        </form>

        <!-- Paso 3: Persona + Ropa -->
        <form class="paso" data-paso="persona-ropa" hidden novalidate>
          <fieldset class="mb-3">
            <legend class="form-label">¿Qué vas a donar?</legend>
            <div class="chips">
              <input type="checkbox" class="btn-check" id="pr-t1" value="Ropa de adulto"><label class="chip" for="pr-t1">Ropa de adulto</label>
              <input type="checkbox" class="btn-check" id="pr-t2" value="Ropa de niños"><label class="chip" for="pr-t2">Ropa de niños</label>
              <input type="checkbox" class="btn-check" id="pr-t3" value="Calzado"><label class="chip" for="pr-t3">Calzado</label>
              <input type="checkbox" class="btn-check" id="pr-t4" value="Telas y retazos"><label class="chip" for="pr-t4">Telas y retazos</label>
              <input type="checkbox" class="btn-check" id="pr-t5" value="Blanquería"><label class="chip" for="pr-t5">Sábanas y toallas</label>
            </div>
          </fieldset>
          <div class="row g-3">
            <div class="col-sm-6">
              <label class="form-label" for="pr-bolsas">Cantidad aproximada</label>
              <select class="form-select" id="pr-bolsas"><option>1 o 2 bolsas</option><option>3 a 5 bolsas</option><option>Más de 5 bolsas</option></select>
            </div>
            <div class="col-sm-6"><label class="form-label" for="pr-nombre">Nombre</label><input class="form-control" id="pr-nombre" required autocomplete="name"></div>
            <div class="col-sm-6"><label class="form-label" for="pr-tel">Teléfono</label><input class="form-control" id="pr-tel" type="tel" required autocomplete="tel" aria-describedby="pr-tel-error"><div class="invalid-feedback" id="pr-tel-error">Escribí el número con característica, por ejemplo 351 555-1234.</div></div>
          </div>
          <p class="texto-chico mt-3 mb-0">Recibimos donaciones en la sede, lunes a viernes de 9 a 17 h. Lo que está en buen estado va a la feria, y lo demás se transforma en el taller.</p>
          ${avisoDatos}
          <button class="btn btn-principal mt-3" type="submit">Avisar mi donación</button>
        </form>

        <!-- Paso 3: Empresa + Dinero -->
        <form class="paso" data-paso="empresa-dinero" hidden novalidate>
          <div class="row g-3">
            <div class="col-sm-7"><label class="form-label" for="ed-razon">Razón social</label><input class="form-control" id="ed-razon" required autocomplete="organization"></div>
            <div class="col-sm-5"><label class="form-label" for="ed-cuit">CUIT</label><input class="form-control" id="ed-cuit" required inputmode="numeric" placeholder="30-00000000-0"></div>
            <div class="col-sm-6"><label class="form-label" for="ed-contacto">Persona de contacto</label><input class="form-control" id="ed-contacto" required autocomplete="name"></div>
            <div class="col-sm-6"><label class="form-label" for="ed-mail">Email</label><input class="form-control" id="ed-mail" type="email" required autocomplete="email"></div>
            <div class="col-sm-6"><label class="form-label" for="ed-monto">Monto estimado</label><input class="form-control" id="ed-monto" inputmode="numeric" placeholder="$"></div>
            <div class="col-sm-6">
              <label class="form-label" for="ed-destino">Destino preferido</label>
              <select class="form-select" id="ed-destino"><option>Donde más se necesite</option><option>Talleres y capacitación</option><option>Unidad textil Vuelta de Rosca</option><option>Gastronomía y catering</option></select>
            </div>
          </div>
          <div class="form-check mt-3">
            <input class="form-check-input" type="checkbox" id="ed-cert" checked>
            <label class="form-check-label" for="ed-cert">Necesitamos certificado de donación</label>
          </div>
          <div class="form-check">
            <input class="form-check-input" type="checkbox" id="ed-rse">
            <label class="form-check-label" for="ed-rse">Es parte de nuestro programa de Responsabilidad Social</label>
          </div>
          ${avisoDatos}
          <button class="btn btn-principal mt-3" type="submit">Enviar propuesta de aporte</button>
        </form>

        <!-- Paso 3: Empresa + Ropa -->
        <form class="paso" data-paso="empresa-ropa" hidden novalidate>
          <div class="row g-3">
            <div class="col-sm-7"><label class="form-label" for="er-razon">Razón social</label><input class="form-control" id="er-razon" required autocomplete="organization"></div>
            <div class="col-sm-5"><label class="form-label" for="er-cuit">CUIT</label><input class="form-control" id="er-cuit" required inputmode="numeric" placeholder="30-00000000-0"></div>
          </div>
          <fieldset class="my-3">
            <legend class="form-label">Tipo de material</legend>
            <div class="chips">
              <input type="checkbox" class="btn-check" id="er-t1" value="Uniformes" checked><label class="chip" for="er-t1">Uniformes</label>
              <input type="checkbox" class="btn-check" id="er-t2" value="Ropa de trabajo"><label class="chip" for="er-t2">Ropa de trabajo</label>
              <input type="checkbox" class="btn-check" id="er-t3" value="Telas en rollo"><label class="chip" for="er-t3">Telas en rollo</label>
              <input type="checkbox" class="btn-check" id="er-t4" value="Retazos"><label class="chip" for="er-t4">Retazos</label>
            </div>
          </fieldset>
          <div class="row g-3">
            <div class="col-sm-6">
              <label class="form-label" for="er-kg">Peso estimado</label>
              <div class="input-group"><input class="form-control" id="er-kg" inputmode="numeric" placeholder="Ej: 350"><span class="input-group-text">kg</span></div>
            </div>
            <div class="col-sm-6">
              <label class="form-label" for="er-logos">¿Las prendas tienen logo?</label>
              <select class="form-select" id="er-logos"><option>Sí, hay que desmarcarlas</option><option>No tienen logo</option><option>Algunas sí</option></select>
            </div>
            <div class="col-sm-6"><label class="form-label" for="er-mail">Email de contacto</label><input class="form-control" id="er-mail" type="email" required autocomplete="email"></div>
          </div>
          <p class="texto-chico mt-3 mb-0">El material se entrega en la sede (Camino Chacra de la Merced km 6,5), de lunes a viernes de 9 a 17 h.</p>
          <div class="form-check mt-3">
            <input class="form-check-input" type="checkbox" id="er-reporte" checked>
            <label class="form-check-label" for="er-reporte">Quiero recibir el reporte de impacto (kilos recuperados y trabajo generado)</label>
          </div>
          ${avisoDatos}
          <button class="btn btn-principal mt-3" type="submit">Coordinar la donación</button>
        </form>

        <!-- Gracias -->
        <div class="paso gracias" data-paso="gracias" hidden>
          <svg class="gracias-corazon" viewBox="0 0 32 30" aria-hidden="true"><path d="M16 29 3.6 16.7C.2 13.3.2 7.8 3.6 4.4c3.4-3.4 8.9-3.4 12.4 0 3.4-3.4 9-3.4 12.4 0 3.4 3.4 3.4 8.9 0 12.3L16 29Z"/></svg>
          <h3 id="gracias-titulo">¡Gracias por sumarte!</h3>
          <p id="gracias-txt"></p>
          <p class="texto-chico mb-0">En el boceto no se envía nada. En el sistema real, esto queda registrado en Donaciones.</p>
        </div>
      </div>
      <div class="modal-footer">
        <button type="button" class="btn btn-link volver" id="dona-volver" hidden>← Volver</button>
        <button type="button" class="btn btn-borde" data-bs-dismiss="modal">Cerrar</button>
      </div>
    </div>
  </div>
</div>

<!-- ===== MODAL: INSCRIPCIÓN A TALLER ===== -->
<div class="modal fade" id="modal-taller" tabindex="-1" aria-labelledby="taller-titulo" aria-hidden="true">
  <div class="modal-dialog modal-dialog-centered">
    <div class="modal-content">
      <div class="modal-header">
        <div>
          <p class="etiqueta mb-1">Inscripción</p>
          <h2 class="modal-title" id="taller-titulo">Taller</h2>
        </div>
        <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Cerrar"></button>
      </div>
      <div class="modal-body">
        <form id="form-taller" novalidate>
          <p class="texto-chico" id="taller-detalle"></p>
          <div class="row g-3">
            <div class="col-12"><label class="form-label" for="t-nombre">Nombre y apellido</label><input class="form-control" id="t-nombre" required autocomplete="name"></div>
            <div class="col-sm-6"><label class="form-label" for="t-dni">DNI</label><input class="form-control" id="t-dni" required inputmode="numeric" aria-describedby="t-dni-error"><div class="invalid-feedback" id="t-dni-error">El DNI tiene 7 u 8 números, con o sin puntos.</div></div>
            <div class="col-sm-6"><label class="form-label" for="t-tel">Teléfono (WhatsApp)</label><input class="form-control" id="t-tel" type="tel" required autocomplete="tel" aria-describedby="t-tel-error"><div class="invalid-feedback" id="t-tel-error">Escribí el número con característica, por ejemplo 351 555-1234.</div></div>
          </div>
          ${avisoDatos}
          <button class="btn btn-principal mt-3" type="submit">Inscribirme</button>
          <p class="texto-chico mt-2 mb-0" id="taller-estado" role="status"></p>
        </form>
        <div class="gracias" id="taller-ok" hidden>
          <h3>¡Listo, te anotamos!</h3>
          <p id="taller-ok-txt"></p>
          <p class="texto-chico mb-0">Prototipo: la inscripción se ve en el panel (Talleres → Inscriptas) si lo abrís en esta misma pestaña.</p>
        </div>
      </div>
    </div>
  </div>
</div>
`);