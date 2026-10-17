using System.ComponentModel.DataAnnotations;

namespace LasOmasApi.DTOs;

// Una donación en la lista: sin el detalle de los bultos
public class DonacionDTO
{
    public int Id { get; set; }
    public string NumeroRemito { get; set; } = "";
    public DateTime FechaIngreso { get; set; }
    public int IdEmpresa { get; set; }
    public string Empresa { get; set; } = "";
    public string RegistradaPor { get; set; } = "";
    public decimal TotalKg { get; set; }
    public int CantidadBultos { get; set; }
}

public class DonacionDetalleDTO : DonacionDTO
{
    public List<BultoDTO> Bultos { get; set; } = new();
}

/* El proceso de ingreso: la donación y sus bultos se guardan juntos (todo o nada).
   Quién la registró sale de la sesión, no de lo que manda la pantalla. */
public class CrearDonacionDTO
{
    [Range(1, int.MaxValue, ErrorMessage = "Elegí la empresa.")]
    public int IdEmpresa { get; set; }

    // 13 números y un guion entre ellos, ej. 00012-34567890
    [Required(ErrorMessage = "Poné el número de remito.")]
    [RegularExpression(@"^(?=(?:\D*\d){13}\D*$)\d+-\d+$", ErrorMessage = "El remito tiene 13 números y un guion.")]
    public string NumeroRemito { get; set; } = "";

    [Required, MinLength(1, ErrorMessage = "Cargá al menos un bulto.")]
    public List<CrearBultoDTO> Bultos { get; set; } = new();
}

public class CrearBultoDTO
{
    [Range(0.001, 99999, ErrorMessage = "El peso tiene que ser mayor a 0.")]
    public decimal PesoKg { get; set; }

    // A qué categoría va. Si todavía no se separó: "Sin clasificar".
    [Range(1, int.MaxValue, ErrorMessage = "Elegí la categoría.")]
    public int IdCategoria { get; set; }

    [StringLength(50)]
    public string? Color { get; set; }

    // Lo que no sirve se registra igual (para saber cuánto se descarta), pero no entra al stock
    public bool Descartado { get; set; }
}
