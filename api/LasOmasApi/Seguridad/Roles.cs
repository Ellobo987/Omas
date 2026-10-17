namespace LasOmasApi.Seguridad;

// Los nombres de los roles, tal como están en la tabla Rol
public static class Roles
{
    public const string Administracion = "Administración";
    public const string Coordinadora = "Coordinadora";
    public const string Supervision = "Supervisión";
    public const string Deposito = "Depósito";

    // Para [Authorize(Roles = ...)]: quienes organizan (todos menos Depósito)
    public const string Organizan = Administracion + "," + Coordinadora + "," + Supervision;
}
