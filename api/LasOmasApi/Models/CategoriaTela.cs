using System;
using System.Collections.Generic;

namespace LasOmasApi.Models;

public partial class CategoriaTela
{
    public int IdCategoria { get; set; }

    public string Nombre { get; set; } = null!;

    public decimal StockMinimoKg { get; set; }

    public virtual ICollection<Bulto> Bultos { get; set; } = new List<Bulto>();
}
