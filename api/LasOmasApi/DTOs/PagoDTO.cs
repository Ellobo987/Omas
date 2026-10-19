using System.ComponentModel.DataAnnotations;

namespace LasOmasApi.DTOs;

// Lo que manda el sitio al tocar "Donar con Mercado Pago": solo el monto elegido
public class CrearPagoDTO
{
    [Range(100, 5_000_000, ErrorMessage = "El monto tiene que ser entre $100 y $5.000.000.")]
    public decimal Monto { get; set; }
}

// La página de pago de Mercado Pago a la que se manda a la persona
public class PagoCreadoDTO
{
    public string UrlPago { get; set; } = "";
    // true si se usan credenciales de prueba (no se cobra de verdad)
    public bool Prueba { get; set; }
}
