using System.Security.Claims;
using LasOmasApi.Data;
using LasOmasApi.Models;
using LasOmasApi.Repositories;
using LasOmasApi.Seguridad;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.HttpOverrides;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.FileProviders;

var builder = WebApplication.CreateBuilder(args);

// Base de datos (Database First: los modelos se generaron con Scaffold-DbContext desde LasOmas)
builder.Services.AddDbContext<AppDbContext>(opciones =>
    opciones.UseSqlServer(builder.Configuration.GetConnectionString("ConexionOmas")));

// Repositorios
builder.Services.AddScoped<IUsuarioRepository, UsuarioRepository>();
builder.Services.AddScoped<IEmpresaDonanteRepository, EmpresaDonanteRepository>();
builder.Services.AddScoped<IDonacionRepository, DonacionRepository>();
builder.Services.AddScoped<IBultoRepository, BultoRepository>();
builder.Services.AddScoped<ICatalogoRepository, CatalogoRepository>();

// Seguridad: la clave se guarda con hash (PBKDF2) y se cuentan los intentos fallidos
builder.Services.AddScoped<IPasswordHasher<Usuario>, PasswordHasher<Usuario>>();
builder.Services.AddSingleton<ControlIntentos>();

// Sesión con cookie: HttpOnly, solo por HTTPS y no persistente (se borra al cerrar el navegador)
builder.Services.AddAuthentication(CookieAuthenticationDefaults.AuthenticationScheme)
    .AddCookie(opciones =>
    {
        opciones.Cookie.Name = "omas_sesion";
        opciones.Cookie.HttpOnly = true;
        opciones.Cookie.SecurePolicy = CookieSecurePolicy.Always;
        opciones.Cookie.SameSite = SameSiteMode.Strict;
        opciones.ExpireTimeSpan = TimeSpan.FromHours(8);
        opciones.SlidingExpiration = true;
        // Es una API: sin sesión responde 401 y sin permiso 403 (no redirige a una página de login)
        opciones.Events.OnRedirectToLogin = contexto => { contexto.Response.StatusCode = 401; return Task.CompletedTask; };
        opciones.Events.OnRedirectToAccessDenied = contexto => { contexto.Response.StatusCode = 403; return Task.CompletedTask; };
        // Si a una usuaria la dan de baja o le cambian el rol, su sesión deja de valer en el próximo pedido
        opciones.Events.OnValidatePrincipal = async contexto =>
        {
            var id = contexto.Principal?.FindFirstValue(ClaimTypes.NameIdentifier);
            var rol = contexto.Principal?.FindFirstValue(ClaimTypes.Role);
            var repositorio = contexto.HttpContext.RequestServices.GetRequiredService<IUsuarioRepository>();
            var usuario = int.TryParse(id, out var idUsuario) ? await repositorio.ObtenerPorIdAsync(idUsuario) : null;
            if (usuario == null || !usuario.ActivoSn || usuario.IdRolNavigation.NombreRol != rol)
            {
                contexto.RejectPrincipal();
                await contexto.HttpContext.SignOutAsync(CookieAuthenticationDefaults.AuthenticationScheme);
            }
        };
    });
builder.Services.AddAuthorization();

// CORS: deja llamar a la API desde otro origen (por ejemplo Live Server). Con cookies no se puede usar AllowAnyOrigin.
// Para el panel conviene abrirlo desde la misma API (ver abajo): la cookie es SameSite=Strict.
var origenes = builder.Configuration.GetSection("Cors:OrigenesPermitidos").Get<string[]>() ?? Array.Empty<string>();
builder.Services.AddCors(opciones =>
{
    opciones.AddPolicy("PoliticaCors", politica =>
        politica.WithOrigins(origenes).AllowAnyHeader().AllowAnyMethod().AllowCredentials());
});

builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

// Detrás de un proxy (Render): el HTTPS termina en el proxy y llega como HTTP al contenedor.
// Con esto la API respeta X-Forwarded-Proto/For y sabe que el pedido original fue HTTPS.
builder.Services.Configure<ForwardedHeadersOptions>(opciones =>
{
    opciones.ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto;
    opciones.KnownNetworks.Clear();
    opciones.KnownProxies.Clear();
});

var app = builder.Build();

app.UseForwardedHeaders();

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

// La API también sirve el sitio público y el panel, así todo está en el mismo dominio y la cookie
// de sesión (SameSite=Strict) viaja sola. En desarrollo los archivos se toman del repositorio;
// en el contenedor de Docker vienen copiados en la carpeta que indica Panel:Raiz.
//   /            → sitio público (carpeta "PARTE VISUAL DE OMAS", arranca en index.html)
//   /admin       → panel de administración
//   /css /js /img → recursos compartidos (las páginas los piden como ../css, ../js, ../img)
var raiz = builder.Configuration["Panel:Raiz"]
    ?? Path.GetFullPath(Path.Combine(builder.Environment.ContentRootPath, "..", ".."));

var sitioPublico = Path.Combine(raiz, "PARTE VISUAL DE OMAS");
if (Directory.Exists(sitioPublico))
{
    var archivosSitio = new PhysicalFileProvider(sitioPublico);
    app.UseDefaultFiles(new DefaultFilesOptions { FileProvider = archivosSitio });
    app.UseStaticFiles(new StaticFileOptions { FileProvider = archivosSitio });
}
foreach (var carpeta in new[] { "admin", "img", "css", "js" })
{
    var ruta = Path.Combine(raiz, carpeta);
    if (!Directory.Exists(ruta)) continue;
    app.UseStaticFiles(new StaticFileOptions
    {
        FileProvider = new PhysicalFileProvider(ruta),
        RequestPath = "/" + carpeta
    });
}
app.MapGet("/admin", () => Results.Redirect("/admin/ingresar.html")).ExcludeFromDescription();

app.UseHttpsRedirection();
app.UseCors("PoliticaCors");
app.UseAuthentication();
app.UseAuthorization();
app.MapControllers();

// Para el health check de Render: responde 200 sin tocar la base de datos
app.MapGet("/salud", () => Results.Ok(new { estado = "ok" })).AllowAnonymous().ExcludeFromDescription();

app.Run();
