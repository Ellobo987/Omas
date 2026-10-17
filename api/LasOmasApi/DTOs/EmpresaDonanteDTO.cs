using System.ComponentModel.DataAnnotations;

namespace LasOmasApi.DTOs;

public class EmpresaDonanteDTO
{
    public int Id { get; set; }
    public string RazonSocial { get; set; } = "";
    public string Cuit { get; set; } = "";
    public string? Telefono { get; set; }
    public string? Email { get; set; }
    public int Donaciones { get; set; }
}

public class CrearEmpresaDonanteDTO
{
    [Required(ErrorMessage = "Poné la razón social."), StringLength(150)]
    public string RazonSocial { get; set; } = "";

    // 11 números, sin guiones (la base lo controla igual)
    [Required(ErrorMessage = "Poné el CUIT."), RegularExpression(@"^\d{11}$", ErrorMessage = "El CUIT tiene 11 números, sin guiones.")]
    public string Cuit { get; set; } = "";

    [StringLength(30)]
    public string? Telefono { get; set; }

    [EmailAddress(ErrorMessage = "El email no es válido."), StringLength(254)]
    public string? Email { get; set; }
}

public class ActualizarEmpresaDonanteDTO : CrearEmpresaDonanteDTO
{
}
