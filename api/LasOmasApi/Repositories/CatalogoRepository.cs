using LasOmasApi.Data;
using LasOmasApi.DTOs;
using LasOmasApi.Models;
using Microsoft.EntityFrameworkCore;

namespace LasOmasApi.Repositories;

// Los nombres de los estados, tal como los carga el script de la base
public static class Estados
{
    public const string EnDeposito = "En depósito";
    public const string Retirado = "Retirado";
    public const string Descartado = "Descartado";
}

public class CatalogoRepository : ICatalogoRepository
{
    private readonly AppDbContext _context;

    public CatalogoRepository(AppDbContext context)
    {
        _context = context;
    }

    public Task<List<ItemDTO>> RolesAsync() =>
        _context.Rols.OrderBy(r => r.IdRol)
            .Select(r => new ItemDTO { Id = r.IdRol, Nombre = r.NombreRol, Descripcion = r.Descripcion })
            .ToListAsync();

    public Task<List<ItemDTO>> EstadosAsync() =>
        _context.Estados.OrderBy(e => e.IdEstado)
            .Select(e => new ItemDTO { Id = e.IdEstado, Nombre = e.Descripcion })
            .ToListAsync();

    public Task<List<CategoriaDTO>> CategoriasAsync() =>
        _context.CategoriaTelas.OrderBy(c => c.IdCategoria)
            .Select(c => new CategoriaDTO { Id = c.IdCategoria, Nombre = c.Nombre, StockMinimoKg = c.StockMinimoKg })
            .ToListAsync();

    public Task<CategoriaTela?> ObtenerCategoriaAsync(int id) =>
        _context.CategoriaTelas.FirstOrDefaultAsync(c => c.IdCategoria == id);

    public Task<Estado?> ObtenerEstadoAsync(int id) =>
        _context.Estados.FirstOrDefaultAsync(e => e.IdEstado == id);

    public Task<Estado?> EstadoPorNombreAsync(string descripcion) =>
        _context.Estados.FirstOrDefaultAsync(e => e.Descripcion == descripcion);

    public Task GuardarAsync() => _context.SaveChangesAsync();
}
