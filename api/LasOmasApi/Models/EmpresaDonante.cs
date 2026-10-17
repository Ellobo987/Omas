using System;
using System.Collections.Generic;

namespace LasOmasApi.Models;

public partial class EmpresaDonante
{
    public int IdEmpresa { get; set; }

    public string RazonSocial { get; set; } = null!;

    public string Cuit { get; set; } = null!;

    public string? Telefono { get; set; }

    public string? Email { get; set; }

    public virtual ICollection<IngresoDonacion> IngresoDonacions { get; set; } = new List<IngresoDonacion>();
}
