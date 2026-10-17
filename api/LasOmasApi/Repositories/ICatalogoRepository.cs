using LasOmasApi.DTOs;
using LasOmasApi.Models;

namespace LasOmasApi.Repositories;

// Las tablas de referencia: Rol, Estado y CategoriaTela
public interface ICatalogoRepository
{
    Task<List<ItemDTO>> RolesAsync();
    Task<List<ItemDTO>> EstadosAsync();
    Task<List<CategoriaDTO>> CategoriasAsync();
    Task<CategoriaTela?> ObtenerCategoriaAsync(int id);
    Task<Estado?> ObtenerEstadoAsync(int id);
    Task<Estado?> EstadoPorNombreAsync(string descripcion);
    Task GuardarAsync();
}
