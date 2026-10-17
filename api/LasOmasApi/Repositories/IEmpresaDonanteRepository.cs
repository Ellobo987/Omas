using LasOmasApi.DTOs;
using LasOmasApi.Models;

namespace LasOmasApi.Repositories;

public interface IEmpresaDonanteRepository
{
    Task<List<EmpresaDonanteDTO>> ListarAsync();
    Task<EmpresaDonanteDTO?> ObtenerDtoAsync(int id);
    Task<EmpresaDonante?> ObtenerAsync(int id);
    Task<bool> ExisteCuitAsync(string cuit, int? sinContarId = null);
    Task<bool> TieneDonacionesAsync(int id);
    Task CrearAsync(EmpresaDonante empresa);
    Task EliminarAsync(EmpresaDonante empresa);
    Task GuardarAsync();
}
