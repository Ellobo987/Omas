using System;
using System.Collections.Generic;

namespace LasOmasApi.Models;

public partial class Bulto
{
    public int IdBulto { get; set; }

    public decimal PesoKg { get; set; }

    public int IdEstado { get; set; }

    public string? Color { get; set; }

    public int IdCategoria { get; set; }

    public int IdIngresoDonacion { get; set; }

    public virtual CategoriaTela IdCategoriaNavigation { get; set; } = null!;

    public virtual Estado IdEstadoNavigation { get; set; } = null!;

    public virtual IngresoDonacion IdIngresoDonacionNavigation { get; set; } = null!;
}
