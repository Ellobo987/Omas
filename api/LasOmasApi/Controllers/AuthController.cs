using System.Security.Claims;
using LasOmasApi.DTOs;
using LasOmasApi.Models;
using LasOmasApi.Repositories;
using LasOmasApi.Seguridad;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;

namespace LasOmasApi.Controllers;

[ApiController]
[Route("api/auth")]
public class AuthController : ControllerBase
{
    private readonly IUsuarioRepository _usuarios;
    private readonly IPasswordHasher<Usuario> _hasher;
    private readonly ControlIntentos _intentos;

    // Si el email no existe se verifica igual contra esta clave, así la respuesta tarda lo mismo
    // y no se puede adivinar qué emails tienen cuenta
    private static readonly string HashDeRelleno = new PasswordHasher<Usuario>().HashPassword(new Usuario(), "relleno");

    public AuthController(IUsuarioRepository usuarios, IPasswordHasher<Usuario> hasher, ControlIntentos intentos)
    {
        _usuarios = usuarios;
        _hasher = hasher;
        _intentos = intentos;
    }

    // POST api/auth/login → 200 { id, nombre, rol } y la cookie · 401 datos incorrectos · 423 bloqueada
    [HttpPost("login")]
    [AllowAnonymous]
    public async Task<ActionResult<SesionDTO>> Login(LoginDTO datos)
    {
        var email = datos.Usuario.Trim().ToLowerInvariant();
        if (_intentos.EstaBloqueado(email))
            return StatusCode(423, new { mensaje = "La cuenta quedó bloqueada por varios intentos fallidos. Probá de nuevo en 15 minutos." });

        var usuario = await _usuarios.ObtenerPorEmailAsync(email);
        var puedeEntrar = usuario != null && usuario.ActivoSn && usuario.ClaveHash != "";
        var resultado = _hasher.VerifyHashedPassword(usuario ?? new Usuario(), puedeEntrar ? usuario!.ClaveHash : HashDeRelleno, datos.Clave);
        if (!puedeEntrar || resultado == PasswordVerificationResult.Failed)
        {
            _intentos.SumarFallido(email);
            return Unauthorized(new { mensaje = "Usuario o contraseña incorrectos." });
        }

        // Si la clave se guardó con una configuración más vieja, se vuelve a guardar con la actual
        if (resultado == PasswordVerificationResult.SuccessRehashNeeded)
        {
            usuario!.ClaveHash = _hasher.HashPassword(usuario, datos.Clave);
            await _usuarios.GuardarAsync();
        }
        _intentos.Limpiar(email);

        var claims = new List<Claim>
        {
            new(ClaimTypes.NameIdentifier, usuario!.IdUsuario.ToString()),
            new(ClaimTypes.Name, usuario.Nombre),
            new(ClaimTypes.Role, usuario.IdRolNavigation.NombreRol)
        };
        var identidad = new ClaimsIdentity(claims, CookieAuthenticationDefaults.AuthenticationScheme);
        // IsPersistent = false: la cookie se borra al cerrar el navegador (no hay "recordarme")
        await HttpContext.SignInAsync(CookieAuthenticationDefaults.AuthenticationScheme, new ClaimsPrincipal(identidad),
            new AuthenticationProperties { IsPersistent = false });

        return new SesionDTO { Id = usuario.IdUsuario, Nombre = usuario.Nombre, Rol = usuario.IdRolNavigation.NombreRol };
    }

    // POST api/auth/logout → 204
    [HttpPost("logout")]
    [AllowAnonymous]
    public async Task<IActionResult> Logout()
    {
        await HttpContext.SignOutAsync(CookieAuthenticationDefaults.AuthenticationScheme);
        return NoContent();
    }

    // POST api/auth/clave { claveActual, claveNueva } → 204 · 400 si la actual no es correcta · 423 bloqueada
    // Cada persona cambia la suya (la temporal que le dio Administración, o cuando quiera).
    [HttpPost("clave")]
    [Authorize]
    public async Task<IActionResult> CambiarClave(CambiarClaveDTO datos)
    {
        var usuario = await _usuarios.ObtenerPorIdAsync(User.IdUsuario());
        if (usuario == null) return Unauthorized();
        // Mismo bloqueo que el ingreso: 5 intentos fallidos y 15 minutos de espera
        if (_intentos.EstaBloqueado(usuario.Email))
            return StatusCode(423, new { mensaje = "Por varios intentos fallidos, esperá 15 minutos para volver a probar." });
        if (_hasher.VerifyHashedPassword(usuario, usuario.ClaveHash, datos.ClaveActual) == PasswordVerificationResult.Failed)
        {
            _intentos.SumarFallido(usuario.Email);
            return BadRequest(new { mensaje = "La contraseña actual no es correcta." });
        }
        if (datos.ClaveNueva == datos.ClaveActual)
            return BadRequest(new { mensaje = "La contraseña nueva tiene que ser distinta de la actual." });
        if (string.Equals(datos.ClaveNueva, usuario.Email, StringComparison.OrdinalIgnoreCase))
            return BadRequest(new { mensaje = "La contraseña no puede ser tu email." });

        _intentos.Limpiar(usuario.Email);
        usuario.ClaveHash = _hasher.HashPassword(usuario, datos.ClaveNueva);
        await _usuarios.GuardarAsync();
        return NoContent();
    }

    // GET api/auth/yo → 200 { id, nombre, rol } · 401 sin sesión
    [HttpGet("yo")]
    [Authorize]
    public ActionResult<SesionDTO> Yo() => new SesionDTO
    {
        Id = User.IdUsuario(),
        Nombre = User.FindFirstValue(ClaimTypes.Name)!,
        Rol = User.FindFirstValue(ClaimTypes.Role)!
    };
}
