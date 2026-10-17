using LasOmasApi.DTOs;
using LasOmasApi.Models;

namespace LasOmasApi.Repositories;

public interface IDonacionRepository
{
    Task<List<DonacionDTO>> ListarAsync(DateTime? desde, int? idEmpresa);
    Task<DonacionDetalleDTO?> ObtenerDetalleAsync(int id);
    Task<bool> ExisteRemitoAsync(int idEmpresa, string numeroRemito);
    Task CrearAsync(IngresoDonacion donacion);
}
