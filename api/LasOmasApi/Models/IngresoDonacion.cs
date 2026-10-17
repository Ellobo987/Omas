using System;
using System.Collections.Generic;

namespace LasOmasApi.Models;

public partial class IngresoDonacion
{
    public int IdIngresoDonacion { get; set; }

    public string NumeroRemito { get; set; } = null!;

    public DateTime FechaIngreso { get; set; }

    public int IdEmpresa { get; set; }

    public int IdUsuario { get; set; }

    public virtual ICollection<Bulto> Bultos { get; set; } = new List<Bulto>();

    public virtual EmpresaDonante IdEmpresaNavigation { get; set; } = null!;

    public virtual Usuario IdUsuarioNavigation { get; set; } = null!;
}
