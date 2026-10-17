using System.Collections.Concurrent;

namespace LasOmasApi.Seguridad;

// Cuenta los intentos de ingreso fallidos por email. Con 5 seguidos, la cuenta queda bloqueada 15 minutos.
// Se guarda en memoria: si la API se reinicia, los contadores vuelven a cero.
public class ControlIntentos
{
    private const int MaxIntentos = 5;
    private static readonly TimeSpan Bloqueo = TimeSpan.FromMinutes(15);
    private readonly ConcurrentDictionary<string, (int Fallidos, DateTime Hasta)> _intentos = new();

    public bool EstaBloqueado(string email) =>
        _intentos.TryGetValue(email, out var dato) && dato.Fallidos >= MaxIntentos && dato.Hasta > DateTime.UtcNow;

    public void SumarFallido(string email) =>
        _intentos.AddOrUpdate(email,
            _ => (1, DateTime.UtcNow.Add(Bloqueo)),
            // Si ya pasó el bloqueo, se empieza a contar de nuevo
            (_, dato) => dato.Hasta <= DateTime.UtcNow ? (1, DateTime.UtcNow.Add(Bloqueo)) : (dato.Fallidos + 1, DateTime.UtcNow.Add(Bloqueo)));

    public void Limpiar(string email) => _intentos.TryRemove(email, out _);
}
