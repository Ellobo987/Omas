using LasOmasApi.DTOs;
using LasOmasApi.Models;
using LasOmasApi.Repositories;
using LasOmasApi.Seguridad;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;

namespace LasOmasApi.Controllers;

/* CRUD de usuarios. Solo Administración (Sandra) crea, edita y da de baja cuentas: no hay registro público.
   La baja es LÓGICA (Activo_SN = 0): la cuenta no se borra, así queda quién registró cada donación. */
[ApiController]
[Route("api/usuarios")]
[Authorize(Roles = Roles.Administracion)]
public class UsuariosController : ControllerBase
{
    private readonly IUsuarioRepository _repositorio;
    private readonly IPasswordHasher<Usuario> _hasher;

    public UsuariosController(IUsuarioRepository repositorio, IPasswordHasher<Usuario> hasher)
    {
        _repositorio = repositorio;
        _hasher = hasher;
    }

    // GET api/usuarios
    [HttpGet]
    public async Task<ActionResult<List<UsuarioDTO>>> Listar() => await _repositorio.ListarAsync();

    // GET api/usuarios/5
    [HttpGet("{id:int}")]
    public async Task<ActionResult<UsuarioDTO>> Obtener(int id)
    {
        var usuario = await _repositorio.ObtenerPorIdAsync(id);
        if (usuario == null) return NotFound(new { mensaje = "No encontramos esa cuenta." });
        return UsuarioRepository.ADto(usuario);
    }

    // POST api/usuarios → 201 { usuario, claveTemporal } · 409 si el email ya tiene cuenta
    [HttpPost]
    public async Task<ActionResult<UsuarioCreadoDTO>> Crear(CrearUsuarioDTO datos)
    {
        var email = datos.Email.Trim().ToLowerInvariant();
        if (await _repositorio.ExisteEmailAsync(email))
            return Conflict(new { mensaje = "Ya hay una cuenta con ese email." });
        var rol = await _repositorio.ObtenerRolAsync(datos.Rol);
        if (rol == null) return BadRequest(new { mensaje = "Ese rol no existe." });

        var clave = ClaveTemporal.Generar();
        var usuario = new Usuario
        {
            Nombre = datos.Nombre.Trim(),
            Apellido = datos.Apellido.Trim(),
            Email = email,
            Telefono = string.IsNullOrWhiteSpace(datos.Telefono) ? null : datos.Telefono.Trim(),
            IdRol = rol.IdRol,
            ActivoSn = true
        };
        usuario.ClaveHash = _hasher.HashPassword(usuario, clave);
        await _repositorio.CrearAsync(usuario);
        usuario.IdRolNavigation = rol;

        var creado = new UsuarioCreadoDTO { Usuario = UsuarioRepository.ADto(usuario), ClaveTemporal = clave };
        return CreatedAtAction(nameof(Obtener), new { id = usuario.IdUsuario }, creado);
    }

    // PUT api/usuarios/5 → 200 la cuenta actualizada
    [HttpPut("{id:int}")]
    public async Task<ActionResult<UsuarioDTO>> Actualizar(int id, ActualizarUsuarioDTO datos)
    {
        var usuario = await _repositorio.ObtenerPorIdAsync(id);
        if (usuario == null) return NotFound(new { mensaje = "No encontramos esa cuenta." });
        var rol = await _repositorio.ObtenerRolAsync(datos.Rol);
        if (rol == null) return BadRequest(new { mensaje = "Ese rol no existe." });
        // Si se saca su propio rol de Administración, nadie podría crear más cuentas
        if (id == User.IdUsuario() && rol.NombreRol != Roles.Administracion)
            return BadRequest(new { mensaje = "No podés sacarte a vos misma el rol de Administración." });

        usuario.Nombre = datos.Nombre.Trim();
        usuario.Apellido = datos.Apellido.Trim();
        usuario.Telefono = string.IsNullOrWhiteSpace(datos.Telefono) ? null : datos.Telefono.Trim();
        usuario.IdRol = rol.IdRol;
        usuario.IdRolNavigation = rol;
        await _repositorio.GuardarAsync();
        return UsuarioRepository.ADto(usuario);
    }

    // POST api/usuarios/5/clave → 200 { claveTemporal }: se olvidó la clave y se le da una nueva
    [HttpPost("{id:int}/clave")]
    public async Task<ActionResult<ClaveTemporalDTO>> NuevaClave(int id)
    {
        var usuario = await _repositorio.ObtenerPorIdAsync(id);
        if (usuario == null) return NotFound(new { mensaje = "No encontramos esa cuenta." });
        var clave = ClaveTemporal.Generar();
        usuario.ClaveHash = _hasher.HashPassword(usuario, clave);
        await _repositorio.GuardarAsync();
        return new ClaveTemporalDTO { ClaveTemporal = clave };
    }

    // DELETE api/usuarios/5 → 204 baja lógica
    [HttpDelete("{id:int}")]
    public async Task<IActionResult> DarDeBaja(int id)
    {
        if (id == User.IdUsuario()) return BadRequest(new { mensaje = "No podés darte de baja a vos misma." });
        var usuario = await _repositorio.ObtenerPorIdAsync(id);
        if (usuario == null) return NotFound(new { mensaje = "No encontramos esa cuenta." });
        usuario.ActivoSn = false;
        await _repositorio.GuardarAsync();
        return NoContent();
    }

    // PUT api/usuarios/5/alta → 204 la vuelve a activar
    [HttpPut("{id:int}/alta")]
    public async Task<IActionResult> DarDeAlta(int id)
    {
        var usuario = await _repositorio.ObtenerPorIdAsync(id);
        if (usuario == null) return NotFound(new { mensaje = "No encontramos esa cuenta." });
        usuario.ActivoSn = true;
        await _repositorio.GuardarAsync();
        return NoContent();
    }
}
