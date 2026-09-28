namespace Straapp.Application.Strava.Models;

/// <summary>One sensor's samples. Every stream in a set is indexed the same way.</summary>
public sealed record Stream<T>
{
    public IReadOnlyList<T> Data { get; init; } = [];
    /// <summary>"distance" or "time": what the samples are spaced by.</summary>
    public string? SeriesType { get; init; }
    public int OriginalSize { get; init; }
    /// <summary>"low", "medium" or "high".</summary>
    public string? Resolution { get; init; }
}

/// <summary>
/// Second-by-second (or GPS-point-by-point) data. A stream is null when the device never recorded it.
/// </summary>
public sealed record StreamSet
{
    /// <summary>Seconds since the start.</summary>
    public Stream<int>? Time { get; init; }
    /// <summary>Metres since the start.</summary>
    public Stream<double>? Distance { get; init; }
    /// <summary>[lat, lng] pairs.</summary>
    public Stream<IReadOnlyList<double>>? Latlng { get; init; }
    /// <summary>Metres.</summary>
    public Stream<double>? Altitude { get; init; }
    /// <summary>Metres per second.</summary>
    public Stream<double>? VelocitySmooth { get; init; }
    /// <summary>Beats per minute.</summary>
    public Stream<int>? Heartrate { get; init; }
    /// <summary>Rpm (runs: per leg).</summary>
    public Stream<int>? Cadence { get; init; }
    /// <summary>Samples are null where the power meter dropped out.</summary>
    public Stream<int?>? Watts { get; init; }
    /// <summary>Degrees Celsius.</summary>
    public Stream<int>? Temp { get; init; }
    public Stream<bool>? Moving { get; init; }
    /// <summary>Percent.</summary>
    public Stream<double>? GradeSmooth { get; init; }
}
