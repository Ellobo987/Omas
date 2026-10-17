using System;
using System.Collections.Generic;

namespace LasOmasApi.Models;

public partial class Usuario
{
    public int IdUsuario { get; set; }

    public string Nombre { get; set; } = null!;

    public string Apellido { get; set; } = null!;

    public string Email { get; set; } = null!;

    public string? Telefono { get; set; }

    public int IdRol { get; set; }

    public bool ActivoSn { get; set; }

    public string ClaveHash { get; set; } = null!;

    public virtual Rol IdRolNavigation { get; set; } = null!;

    public virtual ICollection<IngresoDonacion> IngresoDonacions { get; set; } = new List<IngresoDonacion>();
}
