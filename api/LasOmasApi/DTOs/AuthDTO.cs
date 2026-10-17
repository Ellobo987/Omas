using System.ComponentModel.DataAnnotations;

namespace LasOmasApi.DTOs;

// Lo que manda la pantalla de ingreso. "usuario" es el email de la cuenta.
public class LoginDTO
{
    [Required(ErrorMessage = "Poné tu email.")]
    public string Usuario { get; set; } = "";

    [Required(ErrorMessage = "Poné tu contraseña.")]
    public string Clave { get; set; } = "";
}

// Quién ingresó: lo que necesitan las pantallas para el menú y los permisos
public class SesionDTO
{
    public int Id { get; set; }
    public string Nombre { get; set; } = "";
    public string Rol { get; set; } = "";
}
