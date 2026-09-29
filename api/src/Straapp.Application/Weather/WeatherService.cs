using Straapp.Application.Abstractions;
using Straapp.Domain.Activities;

namespace Straapp.Application.Weather;

/// <summary>An activity's stored weather for the activity page. Never fetches anything itself.</summary>
public sealed class WeatherService(IWeatherRepository weather)
{
    /// <summary>Null when the activity isn't stored (or isn't the athlete's).</summary>
    public async Task<WeatherReport?> GetAsync(long athleteId, long activityId, CancellationToken ct = default)
    {
        var target = await weather.GetTargetAsync(athleteId, activityId, ct);
        if (target is null) return null;

        var start = target.StartDate;
        var end = start.AddSeconds(target.ElapsedTime);
        var offset = (int)(target.UtcOffset ?? 0);

        if (!target.Eligible) return new WeatherReport(WeatherStatus.NotApplicable, start, end, offset, null, []);

        var stored = await weather.GetAsync(activityId, ct);
        if (stored is null) return new WeatherReport(WeatherStatus.Pending, start, end, offset, null, []);
        if (stored.Samples.Count == 0) return new WeatherReport(WeatherStatus.Unavailable, start, end, offset, null, []);

        return new WeatherReport(
            WeatherStatus.Ready, start, end, offset,
            new WeatherPlace(stored.Latitude, stored.Longitude, stored.Elevation, stored.Source),
            stored.Samples.Select(ToSample).ToList());
    }

    private static WeatherReportSample ToSample(WeatherSample h) => new(
        h.Time, h.Temperature, h.ApparentTemperature, h.RelativeHumidity, h.DewPoint, h.Precipitation, h.Rain,
        h.Snowfall, h.CloudCover, h.WindSpeed, h.WindDirection, h.WindGusts, h.WeatherCode, h.Pressure, h.IsDay);
}

public enum WeatherStatus
{
    /// <summary>The samples are there.</summary>
    Ready,
    /// <summary>Not looked up yet: the background job gets to it (activities under two days old wait).</summary>
    Pending,
    /// <summary>Looked up, but the archive had nothing.</summary>
    Unavailable,
    /// <summary>Indoor, virtual or manual: no real place to have weather at.</summary>
    NotApplicable,
}

/// <param name="Start">When the activity started, UTC.</param>
/// <param name="End">When it ended (start plus elapsed time), UTC.</param>
/// <param name="UtcOffsetSeconds">Where it happened, so times can be shown in local time.</param>
public sealed record WeatherReport(
    WeatherStatus Status,
    DateTimeOffset Start,
    DateTimeOffset End,
    int UtcOffsetSeconds,
    WeatherPlace? Place,
    IReadOnlyList<WeatherReportSample> Samples);

/// <summary>The weather model's grid cell the values are for.</summary>
public sealed record WeatherPlace(double Latitude, double Longitude, double? Elevation, string Source);

/// <summary>One quarter hour; the units are those of <see cref="WeatherSample"/>.</summary>
public sealed record WeatherReportSample(
    DateTimeOffset Time,
    double? Temperature,
    double? ApparentTemperature,
    int? RelativeHumidity,
    double? DewPoint,
    double? Precipitation,
    double? Rain,
    double? Snowfall,
    int? CloudCover,
    double? WindSpeed,
    int? WindDirection,
    double? WindGusts,
    int? WeatherCode,
    double? Pressure,
    bool? IsDay);
