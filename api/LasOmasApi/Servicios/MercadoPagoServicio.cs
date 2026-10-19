using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json.Serialization;

namespace LasOmasApi.Servicios;

/* Habla con la API de Mercado Pago (Checkout Pro): crea una "preferencia" de pago por el monto
   exacto de la donación y devuelve la página de pago oficial, con el monto ya cargado.
   El Access Token se lee de la configuración (MercadoPago:AccessToken): en Render es la variable
   de entorno MercadoPago__AccessToken y en la compu un secreto (dotnet user-secrets).
   NUNCA va en el código ni en appsettings.json, porque el repositorio es público.
   Con un token de prueba (empieza con "TEST-") se paga con tarjetas de prueba y no se cobra nada. */
public class MercadoPagoServicio
{
    private readonly HttpClient _http;
    private readonly string? _token;

    public MercadoPagoServicio(HttpClient http, IConfiguration configuracion)
    {
        _http = http;
        _http.BaseAddress = new Uri("https://api.mercadopago.com/");
        _token = configuracion["MercadoPago:AccessToken"];
    }

    public bool Configurado => !string.IsNullOrWhiteSpace(_token);
    public bool EsPrueba => _token?.StartsWith("TEST-") == true;

    // urlRegreso: la página del sitio a la que vuelve la persona después de pagar (dona.html)
    public async Task<string?> CrearPagoAsync(decimal monto, string urlRegreso)
    {
        var preferencia = new Preferencia
        {
            Items = new[] { new Item { Title = "Donación a Las Omas", Quantity = 1, CurrencyId = "ARS", UnitPrice = monto } },
            BackUrls = new Urls
            {
                Success = urlRegreso + "?pago=aprobado",
                Pending = urlRegreso + "?pago=pendiente",
                Failure = urlRegreso + "?pago=rechazado"
            },
            // Mercado Pago solo vuelve solo al sitio si la dirección es pública (no funciona con localhost)
            AutoReturn = urlRegreso.Contains("localhost") ? null : "approved",
            StatementDescriptor = "LAS OMAS",
            ExternalReference = "donacion-" + Guid.NewGuid().ToString("N")
        };

        using var pedido = new HttpRequestMessage(HttpMethod.Post, "checkout/preferences") { Content = JsonContent.Create(preferencia) };
        pedido.Headers.Authorization = new AuthenticationHeaderValue("Bearer", _token);
        using var respuesta = await _http.SendAsync(pedido);
        if (!respuesta.IsSuccessStatusCode) return null;

        var creada = await respuesta.Content.ReadFromJsonAsync<PreferenciaCreada>();
        // Con credenciales de prueba se usa la página de pago de prueba
        return EsPrueba ? creada?.SandboxInitPoint ?? creada?.InitPoint : creada?.InitPoint;
    }

    // Lo que pide y devuelve la API de Mercado Pago (los nombres van como los espera ella)
    private class Preferencia
    {
        [JsonPropertyName("items")] public Item[] Items { get; set; } = Array.Empty<Item>();
        [JsonPropertyName("back_urls")] public Urls BackUrls { get; set; } = new();
        [JsonPropertyName("auto_return"), JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] public string? AutoReturn { get; set; }
        [JsonPropertyName("statement_descriptor")] public string StatementDescriptor { get; set; } = "";
        [JsonPropertyName("external_reference")] public string ExternalReference { get; set; } = "";
    }
    private class Item
    {
        [JsonPropertyName("title")] public string Title { get; set; } = "";
        [JsonPropertyName("quantity")] public int Quantity { get; set; }
        [JsonPropertyName("currency_id")] public string CurrencyId { get; set; } = "";
        [JsonPropertyName("unit_price")] public decimal UnitPrice { get; set; }
    }
    private class Urls
    {
        [JsonPropertyName("success")] public string Success { get; set; } = "";
        [JsonPropertyName("pending")] public string Pending { get; set; } = "";
        [JsonPropertyName("failure")] public string Failure { get; set; } = "";
    }
    private class PreferenciaCreada
    {
        [JsonPropertyName("init_point")] public string? InitPoint { get; set; }
        [JsonPropertyName("sandbox_init_point")] public string? SandboxInitPoint { get; set; }
    }
}
