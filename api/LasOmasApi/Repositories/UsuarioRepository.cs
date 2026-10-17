using LasOmasApi.Data;
using LasOmasApi.DTOs;
using LasOmasApi.Models;
using Microsoft.EntityFrameworkCore;

namespace LasOmasApi.Repositories;

public class UsuarioRepository : IUsuarioRepository
{
    private readonly AppDbContext _context;

    public UsuarioRepository(AppDbContext context)
    {
        _context = context;
    }

    public static UsuarioDTO ADto(Usuario u) => new()
    {
        Id = u.IdUsuario,
        Nombre = u.Nombre,
        Apellido = u.Apellido,
        Email = u.Email,
        Telefono = u.Telefono,
        Rol = u.IdRolNavigation.NombreRol,
        Activo = u.ActivoSn
    };

    // Primero las activas, por nombre
    public async Task<List<UsuarioDTO>> ListarAsync()
    {
        var usuarios = await _context.Usuarios
            .Include(u => u.IdRolNavigation)
            .OrderByDescending(u => u.ActivoSn).ThenBy(u => u.Nombre).ThenBy(u => u.Apellido)
            .ToListAsync();
        return usuarios.Select(ADto).ToList();
    }

    public Task<Usuario?> ObtenerPorIdAsync(int id) =>
        _context.Usuarios.Include(u => u.IdRolNavigation).FirstOrDefaultAsync(u => u.IdUsuario == id);

    public Task<Usuario?> ObtenerPorEmailAsync(string email) =>
        _context.Usuarios.Include(u => u.IdRolNavigation).FirstOrDefaultAsync(u => u.Email == email);

    public Task<bool> ExisteEmailAsync(string email) =>
        _context.Usuarios.AnyAsync(u => u.Email == email);

    public Task<Rol?> ObtenerRolAsync(string nombreRol) =>
        _context.Rols.FirstOrDefaultAsync(r => r.NombreRol == nombreRol);

    public async Task CrearAsync(Usuario usuario)
    {
        _context.Usuarios.Add(usuario);
        await _context.SaveChangesAsync();
    }

    public Task GuardarAsync() => _context.SaveChangesAsync();
}
