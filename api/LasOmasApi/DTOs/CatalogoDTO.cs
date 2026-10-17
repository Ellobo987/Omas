using System.ComponentModel.DataAnnotations;

namespace LasOmasApi.DTOs;

// Roles, estados: lo que se elige en una lista
public class ItemDTO
{
    public int Id { get; set; }
    public string Nombre { get; set; } = "";
    public string? Descripcion { get; set; }
}

public class CategoriaDTO
{
    public int Id { get; set; }
    public string Nombre { get; set; } = "";
    public decimal StockMinimoKg { get; set; }
}

public class ActualizarStockMinimoDTO
{
    [Range(0, 99999, ErrorMessage = "El stock mínimo no puede ser negativo.")]
    public decimal StockMinimoKg { get; set; }
}
