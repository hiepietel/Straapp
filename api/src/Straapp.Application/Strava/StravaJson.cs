using System.Text.Json;
using System.Text.Json.Serialization;

namespace Straapp.Application.Strava;

public static class StravaJson
{
    /// <summary>
    /// Strava's wire format: snake_case, which maps onto the PascalCase models without attributes.
    /// Also used to store raw payloads, so they read like Strava's own responses.
    /// </summary>
    public static readonly JsonSerializerOptions Options = new(JsonSerializerDefaults.Web)
    {
        PropertyNamingPolicy = JsonNamingPolicy.SnakeCaseLower,
        DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull,
        Converters = { new LenientInt32Converter() },
    };

    public static string Serialize<T>(T value) => JsonSerializer.Serialize(value, Options);

    /// <summary>
    /// Strava sometimes sends whole-number fields as decimals (e.g. <c>"time": 123.0</c> in zone buckets).
    /// Accept those, rounding, instead of failing the whole response. Also applies to <c>int?</c>.
    /// </summary>
    private sealed class LenientInt32Converter : JsonConverter<int>
    {
        public override int Read(ref Utf8JsonReader reader, Type typeToConvert, JsonSerializerOptions options)
        {
            if (reader.TokenType == JsonTokenType.String && int.TryParse(reader.GetString(), out var parsed)) return parsed;
            if (reader.TryGetInt32(out var value)) return value;
            return (int)Math.Round(reader.GetDouble());
        }

        public override void Write(Utf8JsonWriter writer, int value, JsonSerializerOptions options) => writer.WriteNumberValue(value);
    }
}
