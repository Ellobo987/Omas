using System.ComponentModel.DataAnnotations;

namespace LasOmasApi.DTOs;

// Lo que se muestra de una cuenta: nunca la clave
public class UsuarioDTO
{
    public int Id { get; set; }
    public string Nombre { get; set; } = "";
    public string Apellido { get; set; } = "";
    public string Email { get; set; } = "";
    public string? Telefono { get; set; }
    public string Rol { get; set; } = "";
    public bool Activo { get; set; }
}

public class CrearUsuarioDTO
{
    [Required(ErrorMessage = "Poné el nombre."), StringLength(100)]
    public string Nombre { get; set; } = "";

    [Required(ErrorMessage = "Poné el apellido."), StringLength(100)]
    public string Apellido { get; set; } = "";

    [Required(ErrorMessage = "Poné el email."), EmailAddress(ErrorMessage = "El email no es válido."), StringLength(254)]
    public string Email { get; set; } = "";

    [StringLength(30)]
    public string? Telefono { get; set; }

    [Required(ErrorMessage = "Elegí el rol.")]
    public string Rol { get; set; } = "";
}

// El email no se cambia: es con lo que la persona entra
public class ActualizarUsuarioDTO
{
    [Required(ErrorMessage = "Poné el nombre."), StringLength(100)]
    public string Nombre { get; set; } = "";

    [Required(ErrorMessage = "Poné el apellido."), StringLength(100)]
    public string Apellido { get; set; } = "";

    [StringLength(30)]
    public string? Telefono { get; set; }

    [Required(ErrorMessage = "Elegí el rol.")]
    public string Rol { get; set; } = "";
}

// Al crear la cuenta o darle una clave nueva: la clave temporal se muestra una sola vez
public class UsuarioCreadoDTO
{
    public UsuarioDTO Usuario { get; set; } = new();
    public string ClaveTemporal { get; set; } = "";
}

public class ClaveTemporalDTO
{
    public string ClaveTemporal { get; set; } = "";
}
