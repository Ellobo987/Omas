using LasOmasApi.DTOs;
using LasOmasApi.Repositories;
using LasOmasApi.Seguridad;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace LasOmasApi.Controllers;

// Las listas para elegir en las pantallas: roles, estados y categorías de tela
[ApiController]
[Route("api")]
[Authorize]
public class CatalogosController : ControllerBase
{
    private readonly ICatalogoRepository _repositorio;

    public CatalogosController(ICatalogoRepository repositorio)
    {
        _repositorio = repositorio;
    }

    // GET api/roles (para la pantalla Usuarios)
    [HttpGet("roles")]
    [Authorize(Roles = Roles.Administracion)]
    public async Task<ActionResult<List<ItemDTO>>> ListarRoles() => await _repositorio.RolesAsync();

    // GET api/estados
    [HttpGet("estados")]
    public async Task<ActionResult<List<ItemDTO>>> ListarEstados() => await _repositorio.EstadosAsync();

    // GET api/categorias
    [HttpGet("categorias")]
    public async Task<ActionResult<List<CategoriaDTO>>> ListarCategorias() => await _repositorio.CategoriasAsync();

    // PUT api/categorias/3/stock-minimo { stockMinimoKg } → 204. Lo define la coordinación.
    [HttpPut("categorias/{id:int}/stock-minimo")]
    [Authorize(Roles = Roles.Organizan)]
    public async Task<IActionResult> CambiarStockMinimo(int id, ActualizarStockMinimoDTO datos)
    {
        var categoria = await _repositorio.ObtenerCategoriaAsync(id);
        if (categoria == null) return NotFound(new { mensaje = "No encontramos esa categoría." });
        categoria.StockMinimoKg = datos.StockMinimoKg;
        await _repositorio.GuardarAsync();
        return NoContent();
    }
}
