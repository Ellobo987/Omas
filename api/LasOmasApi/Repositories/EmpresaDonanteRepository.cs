using LasOmasApi.Data;
using LasOmasApi.DTOs;
using LasOmasApi.Models;
using Microsoft.EntityFrameworkCore;

namespace LasOmasApi.Repositories;

public class EmpresaDonanteRepository : IEmpresaDonanteRepository
{
    private readonly AppDbContext _context;

    public EmpresaDonanteRepository(AppDbContext context)
    {
        _context = context;
    }

    private IQueryable<EmpresaDonanteDTO> Consulta() =>
        _context.EmpresaDonantes.Select(e => new EmpresaDonanteDTO
        {
            Id = e.IdEmpresa,
            RazonSocial = e.RazonSocial,
            Cuit = e.Cuit,
            Telefono = e.Telefono,
            Email = e.Email,
            Donaciones = e.IngresoDonacions.Count
        });

    public Task<List<EmpresaDonanteDTO>> ListarAsync() =>
        Consulta().OrderBy(e => e.RazonSocial).ToListAsync();

    public Task<EmpresaDonanteDTO?> ObtenerDtoAsync(int id) =>
        Consulta().FirstOrDefaultAsync(e => e.Id == id);

    public Task<EmpresaDonante?> ObtenerAsync(int id) =>
        _context.EmpresaDonantes.FirstOrDefaultAsync(e => e.IdEmpresa == id);

    public Task<bool> ExisteCuitAsync(string cuit, int? sinContarId = null) =>
        _context.EmpresaDonantes.AnyAsync(e => e.Cuit == cuit && e.IdEmpresa != sinContarId);

    public Task<bool> TieneDonacionesAsync(int id) =>
        _context.IngresoDonacions.AnyAsync(d => d.IdEmpresa == id);

    public async Task CrearAsync(EmpresaDonante empresa)
    {
        _context.EmpresaDonantes.Add(empresa);
        await _context.SaveChangesAsync();
    }

    public async Task EliminarAsync(EmpresaDonante empresa)
    {
        _context.EmpresaDonantes.Remove(empresa);
        await _context.SaveChangesAsync();
    }

    public Task GuardarAsync() => _context.SaveChangesAsync();
}
