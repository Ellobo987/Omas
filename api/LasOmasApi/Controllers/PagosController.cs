using LasOmasApi.DTOs;
using LasOmasApi.Servicios;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;

namespace LasOmasApi.Controllers;

/* Donaciones en dinero desde el sitio público (Checkout Pro de Mercado Pago).
   Es PÚBLICO (no hace falta sesión): lo usa cualquiera que quiera donar.
   Por eso tiene un límite de pedidos por minuto, para que nadie lo use para molestar.
   La plata no pasa por la API: Mercado Pago cobra y se la acredita a la cuenta del token. */
[ApiController]
[Route("api/pagos")]
[AllowAnonymous]
public class PagosController : ControllerBase
{
    private readonly MercadoPagoServicio _mercadoPago;

    public PagosController(MercadoPagoServicio mercadoPago)
    {
        _mercadoPago = mercadoPago;
    }

    // POST api/pagos/donacion { monto } → 200 { urlPago, prueba } · 503 si Mercado Pago no está configurado
    [HttpPost("donacion")]
    [EnableRateLimiting("pagos")]
    public async Task<ActionResult<PagoCreadoDTO>> CrearDonacion(CrearPagoDTO datos)
    {
        if (!_mercadoPago.Configurado)
            return StatusCode(503, new { mensaje = "Las donaciones con Mercado Pago todavía no están habilitadas. Podés transferir con los datos de abajo." });

        // Vuelve a la página Doná del mismo sitio desde donde se donó
        var urlRegreso = $"{Request.Scheme}://{Request.Host}/dona.html";
        var urlPago = await _mercadoPago.CrearPagoAsync(Math.Round(datos.Monto, 2), urlRegreso);
        if (urlPago == null)
            return StatusCode(502, new { mensaje = "Mercado Pago no respondió. Probá de nuevo en un rato o transferí con los datos de abajo." });

        return new PagoCreadoDTO { UrlPago = urlPago, Prueba = _mercadoPago.EsPrueba };
    }
}
