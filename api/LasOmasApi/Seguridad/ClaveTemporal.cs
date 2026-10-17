using System.Security.Cryptography;

namespace LasOmasApi.Seguridad;

// Clave temporal para una cuenta nueva o cuando alguien se olvidó la suya. Ej.: "k7mp-3xra".
// Sin letras ni números que se confundan al dictarla (0/o, 1/l/i).
public static class ClaveTemporal
{
    private const string Caracteres = "abcdefghjkmnpqrstuvwxyz23456789";

    public static string Generar()
    {
        var letras = new char[9];
        for (var i = 0; i < letras.Length; i++)
            letras[i] = i == 4 ? '-' : Caracteres[RandomNumberGenerator.GetInt32(Caracteres.Length)];
        return new string(letras);
    }
}
