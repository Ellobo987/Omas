using LasOmasApi.DTOs;
using LasOmasApi.Models;

namespace LasOmasApi.Repositories;

public interface IBultoRepository
{
    Task<List<BultoDTO>> ListarAsync(int? idCategoria, int idEstado);
    Task<BultoDTO?> ObtenerDtoAsync(int id);
    Task<Bulto?> ObtenerAsync(int id);
    Task<List<StockCategoriaDTO>> StockAsync(int idEstadoEnDeposito);
    void Agregar(Bulto bulto);
    Task GuardarAsync();
}
