using LasOmasApi.DTOs;
using LasOmasApi.Models;

namespace LasOmasApi.Repositories;

public interface IUsuarioRepository
{
    Task<List<UsuarioDTO>> ListarAsync();
    Task<Usuario?> ObtenerPorIdAsync(int id);
    Task<Usuario?> ObtenerPorEmailAsync(string email);
    Task<bool> ExisteEmailAsync(string email);
    Task<Rol?> ObtenerRolAsync(string nombreRol);
    Task CrearAsync(Usuario usuario);
    Task GuardarAsync();
}
