using LasOmasApi.DTOs;
using LasOmasApi.Models;
using LasOmasApi.Repositories;
using LasOmasApi.Seguridad;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace LasOmasApi.Controllers;

/* El proceso de ingreso: entra una donación de una empresa, con su remito, y se pesa en bultos.
   Cada bulto queda en una categoría (o "Sin clasificar" para separarlo después) y en estado
   "En depósito", salvo lo que se descarta. Todo se guarda junto: si algo falla, no se guarda nada. */
[ApiController]
[Route("api/donaciones")]
[Authorize]
public class DonacionesController : ControllerBase
{
    private readonly IDonacionRepository _donaciones;
    private readonly IEmpresaDonanteRepository _empresas;
    private readonly ICatalogoRepository _catalogo;

    public DonacionesController(IDonacionRepository donaciones, IEmpresaDonanteRepository empresas, ICatalogoRepository catalogo)
    {
        _donaciones = donaciones;
        _empresas = empresas;
        _catalogo = catalogo;
    }

    // GET api/donaciones?desde=2026-10-01&idEmpresa=2
    [HttpGet]
    public async Task<ActionResult<List<DonacionDTO>>> Listar(DateTime? desde, int? idEmpresa) =>
        await _donaciones.ListarAsync(desde, idEmpresa);

    // GET api/donaciones/5 → con sus bultos
    [HttpGet("{id:int}")]
    public async Task<ActionResult<DonacionDetalleDTO>> Obtener(int id)
    {
        var donacion = await _donaciones.ObtenerDetalleAsync(id);
        if (donacion == null) return NotFound(new { mensaje = "No encontramos esa donación." });
        return donacion;
    }

    // POST api/donaciones { idEmpresa, numeroRemito, bultos: [{ pesoKg, idCategoria, color?, descartado? }] }
    // → 201 la donación con sus bultos · 409 si ese remito ya se cargó para esa empresa
    [HttpPost]
    public async Task<ActionResult<DonacionDetalleDTO>> Registrar(CrearDonacionDTO datos)
    {
        if (await _empresas.ObtenerAsync(datos.IdEmpresa) == null)
            return BadRequest(new { mensaje = "Esa empresa no existe." });
        if (await _donaciones.ExisteRemitoAsync(datos.IdEmpresa, datos.NumeroRemito))
            return Conflict(new { mensaje = "Ese remito ya se cargó para esta empresa." });
        foreach (var idCategoria in datos.Bultos.Select(b => b.IdCategoria).Distinct())
            if (await _catalogo.ObtenerCategoriaAsync(idCategoria) == null)
                return BadRequest(new { mensaje = "Una de las categorías no existe." });

        var enDeposito = await _catalogo.EstadoPorNombreAsync(Estados.EnDeposito);
        var descartado = await _catalogo.EstadoPorNombreAsync(Estados.Descartado);
        if (enDeposito == null || descartado == null)
            return Problem("Faltan los estados en la base: correr el script lasomas.sql.");

        var donacion = new IngresoDonacion
        {
            IdEmpresa = datos.IdEmpresa,
            NumeroRemito = datos.NumeroRemito,
            FechaIngreso = DateTime.Now,
            IdUsuario = User.IdUsuario(),
            Bultos = datos.Bultos.Select(b => new Bulto
            {
                PesoKg = Math.Round(b.PesoKg, 3),
                IdCategoria = b.IdCategoria,
                Color = string.IsNullOrWhiteSpace(b.Color) ? null : b.Color.Trim(),
                IdEstado = b.Descartado ? descartado.IdEstado : enDeposito.IdEstado
            }).ToList()
        };
        await _donaciones.CrearAsync(donacion);
        return CreatedAtAction(nameof(Obtener), new { id = donacion.IdIngresoDonacion },
            await _donaciones.ObtenerDetalleAsync(donacion.IdIngresoDonacion));
    }
}
