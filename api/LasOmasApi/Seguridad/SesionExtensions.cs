using System.Security.Claims;

namespace LasOmasApi.Seguridad;

// Quién hizo el pedido: sale de la cookie de sesión, nunca de lo que manda la pantalla
public static class SesionExtensions
{
    public static int IdUsuario(this ClaimsPrincipal usuario) =>
        int.Parse(usuario.FindFirstValue(ClaimTypes.NameIdentifier)!);
}
