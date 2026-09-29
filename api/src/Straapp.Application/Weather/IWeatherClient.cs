using Straapp.Domain.Activities;

namespace Straapp.Application.Weather;

/// <summary>A historical weather archive, asked for the weather at a place every 15 minutes.</summary>
public interface IWeatherClient
{
    /// <summary>Every quarter hour of the UTC days from <paramref name="from"/> to <paramref name="to"/>, both included.</summary>
    /// <exception cref="WeatherRateLimitException">The archive's daily or hourly allowance is used up.</exception>
    /// <exception cref="WeatherUnavailableException">The archive has nothing for this place or time.</exception>
    Task<WeatherSeries> GetQuarterHourlyAsync(double latitude, double longitude, DateOnly from, DateOnly to, CancellationToken ct = default);
}

/// <param name="Latitude">Of the model's grid cell, which is near but not at the place asked for.</param>
/// <param name="Samples">Oldest first; <see cref="WeatherSample.ActivityId"/> isn't set.</param>
public sealed record WeatherSeries(double Latitude, double Longitude, double? Elevation, IReadOnlyList<WeatherSample> Samples);

public sealed class WeatherRateLimitException(string message) : Exception(message);

public sealed class WeatherUnavailableException(string message) : Exception(message);
