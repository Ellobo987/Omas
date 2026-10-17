using LasOmasApi.Data;
using LasOmasApi.DTOs;
using LasOmasApi.Models;
using Microsoft.EntityFrameworkCore;

namespace LasOmasApi.Repositories;

public class DonacionRepository : IDonacionRepository
{
    private readonly AppDbContext _context;

    public DonacionRepository(AppDbContext context)
    {
        _context = context;
    }

    // Lo más nuevo arriba
    public Task<List<DonacionDTO>> ListarAsync(DateTime? desde, int? idEmpresa) =>
        _context.IngresoDonacions
            .Where(d => (desde == null || d.FechaIngreso >= desde) && (idEmpresa == null || d.IdEmpresa == idEmpresa))
            .OrderByDescending(d => d.FechaIngreso)
            .Select(d => new DonacionDTO
            {
                Id = d.IdIngresoDonacion,
                NumeroRemito = d.NumeroRemito,
                FechaIngreso = d.FechaIngreso,
                IdEmpresa = d.IdEmpresa,
                Empresa = d.IdEmpresaNavigation.RazonSocial,
                RegistradaPor = d.IdUsuarioNavigation.Nombre + " " + d.IdUsuarioNavigation.Apellido,
                TotalKg = d.Bultos.Sum(b => b.PesoKg),
                CantidadBultos = d.Bultos.Count
            })
            .ToListAsync();

    public async Task<DonacionDetalleDTO?> ObtenerDetalleAsync(int id)
    {
        var donacion = await _context.IngresoDonacions
            .Where(d => d.IdIngresoDonacion == id)
            .Select(d => new DonacionDetalleDTO
            {
                Id = d.IdIngresoDonacion,
                NumeroRemito = d.NumeroRemito,
                FechaIngreso = d.FechaIngreso,
                IdEmpresa = d.IdEmpresa,
                Empresa = d.IdEmpresaNavigation.RazonSocial,
                RegistradaPor = d.IdUsuarioNavigation.Nombre + " " + d.IdUsuarioNavigation.Apellido,
                TotalKg = d.Bultos.Sum(b => b.PesoKg),
                CantidadBultos = d.Bultos.Count
            })
            .FirstOrDefaultAsync();
        if (donacion == null) return null;
        donacion.Bultos = await _context.Bultos
            .Where(b => b.IdIngresoDonacion == id)
            .OrderBy(b => b.IdBulto)
            .Select(BultoRepository.ADto)
            .ToListAsync();
        return donacion;
    }

    public Task<bool> ExisteRemitoAsync(int idEmpresa, string numeroRemito) =>
        _context.IngresoDonacions.AnyAsync(d => d.IdEmpresa == idEmpresa && d.NumeroRemito == numeroRemito);

    // La donación y sus bultos se guardan en un solo SaveChanges: si algo falla, no queda nada a medias
    public async Task CrearAsync(IngresoDonacion donacion)
    {
        _context.IngresoDonacions.Add(donacion);
        await _context.SaveChangesAsync();
    }
}
