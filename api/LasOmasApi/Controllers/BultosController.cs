using LasOmasApi.DTOs;
using LasOmasApi.Models;
using LasOmasApi.Repositories;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace LasOmasApi.Controllers;

/* Stock del depósito: los bultos que están "En depósito", por categoría.
   Clasificar o mover un bulto entero cambia su categoría. Separar una parte crea un bulto nuevo
   de la misma donación (así se sabe de qué empresa vino). Retirar o descartar cambia su estado. */
[ApiController]
[Route("api")]
[Authorize]
public class BultosController : ControllerBase
{
    private readonly IBultoRepository _bultos;
    private readonly ICatalogoRepository _catalogo;

    public BultosController(IBultoRepository bultos, ICatalogoRepository catalogo)
    {
        _bultos = bultos;
        _catalogo = catalogo;
    }

    // GET api/bultos?idCategoria=3&idEstado=1 → sin idEstado, los que están en el depósito
    [HttpGet("bultos")]
    public async Task<ActionResult<List<BultoDTO>>> Listar(int? idCategoria, int? idEstado)
    {
        var estado = idEstado ?? (await _catalogo.EstadoPorNombreAsync(Estados.EnDeposito))!.IdEstado;
        return await _bultos.ListarAsync(idCategoria, estado);
    }

    // GET api/bultos/5
    [HttpGet("bultos/{id:int}")]
    public async Task<ActionResult<BultoDTO>> Obtener(int id)
    {
        var bulto = await _bultos.ObtenerDtoAsync(id);
        if (bulto == null) return NotFound(new { mensaje = "No encontramos ese bulto." });
        return bulto;
    }

    // GET api/stock → kilos y bultos de cada categoría, y si está por debajo del stock mínimo
    [HttpGet("stock")]
    public async Task<ActionResult<List<StockCategoriaDTO>>> Stock()
    {
        var enDeposito = await _catalogo.EstadoPorNombreAsync(Estados.EnDeposito);
        return await _bultos.StockAsync(enDeposito!.IdEstado);
    }

    // PUT api/bultos/5/categoria { idCategoria } → 200: clasificar o mover el bulto entero
    [HttpPut("bultos/{id:int}/categoria")]
    public async Task<ActionResult<BultoDTO>> Mover(int id, MoverBultoDTO datos)
    {
        var (bulto, error) = await BultoEnDeposito(id);
        if (error != null) return error;
        if (await _catalogo.ObtenerCategoriaAsync(datos.IdCategoria) == null)
            return BadRequest(new { mensaje = "Esa categoría no existe." });
        if (bulto!.IdCategoria == datos.IdCategoria)
            return BadRequest(new { mensaje = "El bulto ya está en esa categoría." });
        bulto.IdCategoria = datos.IdCategoria;
        await _bultos.GuardarAsync();
        return (await _bultos.ObtenerDtoAsync(id))!;
    }

    // POST api/bultos/5/dividir { pesoKg, idCategoria } → 201 { origen, nuevo }: separar una parte
    [HttpPost("bultos/{id:int}/dividir")]
    public async Task<ActionResult<BultoDivididoDTO>> Dividir(int id, DividirBultoDTO datos)
    {
        var (bulto, error) = await BultoEnDeposito(id);
        if (error != null) return error;
        if (await _catalogo.ObtenerCategoriaAsync(datos.IdCategoria) == null)
            return BadRequest(new { mensaje = "Esa categoría no existe." });
        var kilos = Math.Round(datos.PesoKg, 3);
        // Si se separa todo, no es dividir: es mover el bulto entero
        if (kilos >= bulto!.PesoKg)
            return BadRequest(new { mensaje = $"El bulto tiene {bulto.PesoKg:0.###} kg: para moverlo entero, cambiale la categoría." });

        var nuevo = new Bulto
        {
            PesoKg = kilos,
            IdCategoria = datos.IdCategoria,
            IdEstado = bulto.IdEstado,
            Color = bulto.Color,
            IdIngresoDonacion = bulto.IdIngresoDonacion
        };
        bulto.PesoKg -= kilos;
        _bultos.Agregar(nuevo);
        await _bultos.GuardarAsync(); // los dos cambios en un solo SaveChanges
        var resultado = new BultoDivididoDTO { Origen = (await _bultos.ObtenerDtoAsync(id))!, Nuevo = (await _bultos.ObtenerDtoAsync(nuevo.IdBulto))! };
        return CreatedAtAction(nameof(Obtener), new { id = nuevo.IdBulto }, resultado);
    }

    // PUT api/bultos/5/estado { idEstado } → 200: retirado o descartado (sale del stock)
    [HttpPut("bultos/{id:int}/estado")]
    public async Task<ActionResult<BultoDTO>> CambiarEstado(int id, CambiarEstadoBultoDTO datos)
    {
        var bulto = await _bultos.ObtenerAsync(id);
        if (bulto == null) return NotFound(new { mensaje = "No encontramos ese bulto." });
        if (await _catalogo.ObtenerEstadoAsync(datos.IdEstado) == null)
            return BadRequest(new { mensaje = "Ese estado no existe." });
        bulto.IdEstado = datos.IdEstado;
        await _bultos.GuardarAsync();
        return (await _bultos.ObtenerDtoAsync(id))!;
    }

    // Solo se clasifica o se separa lo que está en el depósito
    private async Task<(Bulto? Bulto, ActionResult? Error)> BultoEnDeposito(int id)
    {
        var bulto = await _bultos.ObtenerAsync(id);
        if (bulto == null) return (null, NotFound(new { mensaje = "No encontramos ese bulto." }));
        var enDeposito = await _catalogo.EstadoPorNombreAsync(Estados.EnDeposito);
        if (bulto.IdEstado != enDeposito!.IdEstado)
            return (null, BadRequest(new { mensaje = "Ese bulto ya no está en el depósito." }));
        return (bulto, null);
    }
}
