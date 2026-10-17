using System.ComponentModel.DataAnnotations;

namespace LasOmasApi.DTOs;

public class BultoDTO
{
    public int Id { get; set; }
    public decimal PesoKg { get; set; }
    public string? Color { get; set; }
    public int IdCategoria { get; set; }
    public string Categoria { get; set; } = "";
    public int IdEstado { get; set; }
    public string Estado { get; set; } = "";
    public int IdIngresoDonacion { get; set; }
    public string NumeroRemito { get; set; } = "";
    public string Empresa { get; set; } = "";
    public DateTime FechaIngreso { get; set; }
}

// Clasificar o mover el bulto entero a otra categoría
public class MoverBultoDTO
{
    [Range(1, int.MaxValue, ErrorMessage = "Elegí la categoría.")]
    public int IdCategoria { get; set; }
}

// Separar una parte del bulto: sale un bulto nuevo de la misma donación
public class DividirBultoDTO
{
    [Range(0.001, 99999, ErrorMessage = "Poné cuántos kilos separás.")]
    public decimal PesoKg { get; set; }

    [Range(1, int.MaxValue, ErrorMessage = "Elegí la categoría.")]
    public int IdCategoria { get; set; }
}

public class BultoDivididoDTO
{
    public BultoDTO Origen { get; set; } = new();
    public BultoDTO Nuevo { get; set; } = new();
}

// Retirado (se lo llevó el taller o una costurera) o Descartado
public class CambiarEstadoBultoDTO
{
    [Range(1, int.MaxValue, ErrorMessage = "Elegí el estado.")]
    public int IdEstado { get; set; }
}

// Cuánto hay de cada categoría en el depósito, comparado con su stock mínimo
public class StockCategoriaDTO
{
    public int IdCategoria { get; set; }
    public string Categoria { get; set; } = "";
    public decimal Kg { get; set; }
    public int Bultos { get; set; }
    public decimal StockMinimoKg { get; set; }
    public bool BajoMinimo { get; set; }
}
