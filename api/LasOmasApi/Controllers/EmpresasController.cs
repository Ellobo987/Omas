using LasOmasApi.DTOs;
using LasOmasApi.Models;
using LasOmasApi.Repositories;
using LasOmasApi.Seguridad;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace LasOmasApi.Controllers;

/* CRUD de empresas donantes. Cualquiera con sesión las ve y las carga (el depósito puede recibir
   a una empresa nueva). Borrar solo Administración y Coordinadora, y solo si no tiene donaciones:
   la tabla no tiene Activo_SN, así que una empresa con donaciones no se borra (quedarían sin empresa). */
[ApiController]
[Route("api/empresas")]
[Authorize]
public class EmpresasController : ControllerBase
{
    private readonly IEmpresaDonanteRepository _repositorio;

    public EmpresasController(IEmpresaDonanteRepository repositorio)
    {
        _repositorio = repositorio;
    }

    // GET api/empresas
    [HttpGet]
    public async Task<ActionResult<List<EmpresaDonanteDTO>>> Listar() => await _repositorio.ListarAsync();

    // GET api/empresas/5
    [HttpGet("{id:int}")]
    public async Task<ActionResult<EmpresaDonanteDTO>> Obtener(int id)
    {
        var empresa = await _repositorio.ObtenerDtoAsync(id);
        if (empresa == null) return NotFound(new { mensaje = "No encontramos esa empresa." });
        return empresa;
    }

    // POST api/empresas → 201 · 409 si el CUIT ya está cargado
    [HttpPost]
    public async Task<ActionResult<EmpresaDonanteDTO>> Crear(CrearEmpresaDonanteDTO datos)
    {
        if (await _repositorio.ExisteCuitAsync(datos.Cuit))
            return Conflict(new { mensaje = "Ya hay una empresa con ese CUIT." });
        var empresa = new EmpresaDonante
        {
            RazonSocial = datos.RazonSocial.Trim(),
            Cuit = datos.Cuit,
            Telefono = Limpio(datos.Telefono),
            Email = Limpio(datos.Email)?.ToLowerInvariant()
        };
        await _repositorio.CrearAsync(empresa);
        return CreatedAtAction(nameof(Obtener), new { id = empresa.IdEmpresa }, await _repositorio.ObtenerDtoAsync(empresa.IdEmpresa));
    }

    // PUT api/empresas/5 → 200 · 409 si el CUIT es de otra empresa
    [HttpPut("{id:int}")]
    public async Task<ActionResult<EmpresaDonanteDTO>> Actualizar(int id, ActualizarEmpresaDonanteDTO datos)
    {
        var empresa = await _repositorio.ObtenerAsync(id);
        if (empresa == null) return NotFound(new { mensaje = "No encontramos esa empresa." });
        if (await _repositorio.ExisteCuitAsync(datos.Cuit, id))
            return Conflict(new { mensaje = "Ya hay otra empresa con ese CUIT." });
        empresa.RazonSocial = datos.RazonSocial.Trim();
        empresa.Cuit = datos.Cuit;
        empresa.Telefono = Limpio(datos.Telefono);
        empresa.Email = Limpio(datos.Email)?.ToLowerInvariant();
        await _repositorio.GuardarAsync();
        return (await _repositorio.ObtenerDtoAsync(id))!;
    }

    // DELETE api/empresas/5 → 204 · 409 si tiene donaciones
    [HttpDelete("{id:int}")]
    [Authorize(Roles = Roles.Administracion + "," + Roles.Coordinadora)]
    public async Task<IActionResult> Eliminar(int id)
    {
        var empresa = await _repositorio.ObtenerAsync(id);
        if (empresa == null) return NotFound(new { mensaje = "No encontramos esa empresa." });
        if (await _repositorio.TieneDonacionesAsync(id))
            return Conflict(new { mensaje = "La empresa tiene donaciones registradas: no se puede borrar." });
        await _repositorio.EliminarAsync(empresa);
        return NoContent();
    }

    private static string? Limpio(string? texto) => string.IsNullOrWhiteSpace(texto) ? null : texto.Trim();
}
