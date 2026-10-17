using System;
using System.Collections.Generic;

namespace LasOmasApi.Models;

public partial class Estado
{
    public int IdEstado { get; set; }

    public string Descripcion { get; set; } = null!;

    public virtual ICollection<Bulto> Bultos { get; set; } = new List<Bulto>();
}
