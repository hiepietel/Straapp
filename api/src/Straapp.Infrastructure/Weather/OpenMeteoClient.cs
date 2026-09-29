using System.Globalization;
using System.Net;
using System.Net.Http.Json;
using System.Text.Json.Serialization;
using Straapp.Application.Weather;
using Straapp.Domain.Activities;

namespace Straapp.Infrastructure.Weather;

/// <summary>
/// Open-Meteo's historical forecast API (https://open-meteo.com/en/docs/historical-forecast-api):
/// free for non-commercial use, no key, every 15 minutes. From about 2022 the values come from weather
/// models that forecast in 15-minute steps (natively so over central Europe and North America); before
/// that, Open-Meteo smooths its hourly ERA5 reanalysis to 15 minutes. Either way the values are for a
/// grid cell a few kilometres across.
/// </summary>
internal sealed class OpenMeteoClient(HttpClient http) : IWeatherClient
{
    private const string Variables =
        "temperature_2m,apparent_temperature,relative_humidity_2m,dew_point_2m,precipitation,rain,snowfall," +
        "cloud_cover,wind_speed_10m,wind_direction_10m,wind_gusts_10m,weather_code,surface_pressure,is_day";

    public async Task<WeatherSeries> GetQuarterHourlyAsync(double latitude, double longitude, DateOnly from, DateOnly to, CancellationToken ct = default)
    {
        var inv = CultureInfo.InvariantCulture;
        var url = $"forecast?latitude={latitude.ToString("0.####", inv)}&longitude={longitude.ToString("0.####", inv)}" +
                  $"&start_date={from:yyyy-MM-dd}&end_date={to:yyyy-MM-dd}&minutely_15={Variables}" +
                  "&timezone=GMT&timeformat=unixtime&wind_speed_unit=kmh";

        using var response = await http.GetAsync(url, ct);
        if (!response.IsSuccessStatusCode)
        {
            var reason = await ReasonAsync(response, ct);
            if (response.StatusCode == HttpStatusCode.TooManyRequests) throw new WeatherRateLimitException(reason);
            // Open-Meteo answers 400 for a place or date it can't serve.
            if (response.StatusCode == HttpStatusCode.BadRequest) throw new WeatherUnavailableException(reason);
            throw new HttpRequestException($"Open-Meteo responded with {(int)response.StatusCode}: {reason}", null, response.StatusCode);
        }

        var body = await response.Content.ReadFromJsonAsync<Response>(ct)
            ?? throw new WeatherUnavailableException("empty response");
        var h = body.Samples ?? throw new WeatherUnavailableException("no 15-minute data");

        var samples = h.Time.Select((t, i) => new WeatherSample
        {
            Time = DateTimeOffset.FromUnixTimeSeconds(t),
            Temperature = At(h.Temperature, i),
            ApparentTemperature = At(h.ApparentTemperature, i),
            RelativeHumidity = Round(At(h.RelativeHumidity, i)),
            DewPoint = At(h.DewPoint, i),
            Precipitation = At(h.Precipitation, i),
            Rain = At(h.Rain, i),
            Snowfall = At(h.Snowfall, i),
            CloudCover = Round(At(h.CloudCover, i)),
            WindSpeed = At(h.WindSpeed, i),
            WindDirection = Round(At(h.WindDirection, i)),
            WindGusts = At(h.WindGusts, i),
            WeatherCode = Round(At(h.WeatherCode, i)),
            Pressure = At(h.Pressure, i),
            IsDay = At(h.IsDay, i) is { } day ? day > 0 : null,
        }).ToList();

        // Days the archive hasn't filled in yet come back as all nulls.
        if (samples.All(x => x.Temperature is null)) throw new WeatherUnavailableException("no values for these days");

        return new WeatherSeries(body.Latitude, body.Longitude, body.Elevation, samples);
    }

    private static double? At(double?[]? values, int i) => values is not null && i < values.Length ? values[i] : null;

    private static int? Round(double? value) => value is { } v ? (int)Math.Round(v) : null;

    private static async Task<string> ReasonAsync(HttpResponseMessage response, CancellationToken ct)
    {
        try
        {
            var error = await response.Content.ReadFromJsonAsync<ErrorResponse>(ct);
            return error?.Reason ?? response.ReasonPhrase ?? response.StatusCode.ToString();
        }
        catch (Exception)
        {
            return response.ReasonPhrase ?? response.StatusCode.ToString();
        }
    }

    private sealed record ErrorResponse([property: JsonPropertyName("reason")] string? Reason);

    private sealed record Response(
        [property: JsonPropertyName("latitude")] double Latitude,
        [property: JsonPropertyName("longitude")] double Longitude,
        [property: JsonPropertyName("elevation")] double? Elevation,
        [property: JsonPropertyName("minutely_15")] QuarterHours? Samples);

    private sealed record QuarterHours(
        [property: JsonPropertyName("time")] long[] Time,
        [property: JsonPropertyName("temperature_2m")] double?[]? Temperature,
        [property: JsonPropertyName("apparent_temperature")] double?[]? ApparentTemperature,
        [property: JsonPropertyName("relative_humidity_2m")] double?[]? RelativeHumidity,
        [property: JsonPropertyName("dew_point_2m")] double?[]? DewPoint,
        [property: JsonPropertyName("precipitation")] double?[]? Precipitation,
        [property: JsonPropertyName("rain")] double?[]? Rain,
        [property: JsonPropertyName("snowfall")] double?[]? Snowfall,
        [property: JsonPropertyName("cloud_cover")] double?[]? CloudCover,
        [property: JsonPropertyName("wind_speed_10m")] double?[]? WindSpeed,
        [property: JsonPropertyName("wind_direction_10m")] double?[]? WindDirection,
        [property: JsonPropertyName("wind_gusts_10m")] double?[]? WindGusts,
        [property: JsonPropertyName("weather_code")] double?[]? WeatherCode,
        [property: JsonPropertyName("surface_pressure")] double?[]? Pressure,
        [property: JsonPropertyName("is_day")] double?[]? IsDay);
}
