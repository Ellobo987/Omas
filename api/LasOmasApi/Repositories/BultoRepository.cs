using System.Linq.Expressions;
using LasOmasApi.Data;
using LasOmasApi.DTOs;
using LasOmasApi.Models;
using Microsoft.EntityFrameworkCore;

namespace LasOmasApi.Repositories;

public class BultoRepository : IBultoRepository
{
    private readonly AppDbContext _context;

    public BultoRepository(AppDbContext context)
    {
        _context = context;
    }

    // Se usa dentro de las consultas: EF lo traduce a SQL y trae solo estas columnas
    public static readonly Expression<Func<Bulto, BultoDTO>> ADto = b => new BultoDTO
    {
        Id = b.IdBulto,
        PesoKg = b.PesoKg,
        Color = b.Color,
        IdCategoria = b.IdCategoria,
        Categoria = b.IdCategoriaNavigation.Nombre,
        IdEstado = b.IdEstado,
        Estado = b.IdEstadoNavigation.Descripcion,
        IdIngresoDonacion = b.IdIngresoDonacion,
        NumeroRemito = b.IdIngresoDonacionNavigation.NumeroRemito,
        Empresa = b.IdIngresoDonacionNavigation.IdEmpresaNavigation.RazonSocial,
        FechaIngreso = b.IdIngresoDonacionNavigation.FechaIngreso
    };

    // Lo que lleva más tiempo en el depósito, arriba
    public Task<List<BultoDTO>> ListarAsync(int? idCategoria, int idEstado) =>
        _context.Bultos
            .Where(b => b.IdEstado == idEstado && (idCategoria == null || b.IdCategoria == idCategoria))
            .OrderBy(b => b.IdIngresoDonacionNavigation.FechaIngreso).ThenBy(b => b.IdBulto)
            .Select(ADto)
            .ToListAsync();

    public Task<BultoDTO?> ObtenerDtoAsync(int id) =>
        _context.Bultos.Where(b => b.IdBulto == id).Select(ADto).FirstOrDefaultAsync();

    public Task<Bulto?> ObtenerAsync(int id) =>
        _context.Bultos.FirstOrDefaultAsync(b => b.IdBulto == id);

    // Todas las categorías, aunque no tengan bultos (así se ve cuál está por debajo del mínimo)
    public Task<List<StockCategoriaDTO>> StockAsync(int idEstadoEnDeposito) =>
        _context.CategoriaTelas
            .OrderBy(c => c.IdCategoria)
            .Select(c => new
            {
                c.IdCategoria,
                c.Nombre,
                c.StockMinimoKg,
                Kg = c.Bultos.Where(b => b.IdEstado == idEstadoEnDeposito).Sum(b => (decimal?)b.PesoKg) ?? 0,
                Bultos = c.Bultos.Count(b => b.IdEstado == idEstadoEnDeposito)
            })
            .Select(x => new StockCategoriaDTO
            {
                IdCategoria = x.IdCategoria,
                Categoria = x.Nombre,
                Kg = x.Kg,
                Bultos = x.Bultos,
                StockMinimoKg = x.StockMinimoKg,
                BajoMinimo = x.Kg < x.StockMinimoKg
            })
            .ToListAsync();

    public void Agregar(Bulto bulto) => _context.Bultos.Add(bulto);

    public Task GuardarAsync() => _context.SaveChangesAsync();
}
