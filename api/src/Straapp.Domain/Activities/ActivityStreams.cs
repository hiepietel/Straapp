namespace Straapp.Domain.Activities;

/// <summary>
/// Sample-by-sample sensor data. Every array has the same length and index;
/// an array is null when the device never recorded it.
/// </summary>
public class ActivityStreams
{
    public long ActivityId { get; set; }
    /// <summary>"distance" or "time": what the samples are spaced by.</summary>
    public string? SeriesType { get; set; }
    public string? Resolution { get; set; }
    public int OriginalSize { get; set; }

    /// <summary>Seconds since the start.</summary>
    public int[]? Time { get; set; }
    /// <summary>Metres since the start.</summary>
    public double[]? Distance { get; set; }
    public double[]? Latitude { get; set; }
    public double[]? Longitude { get; set; }
    /// <summary>Metres.</summary>
    public double[]? Altitude { get; set; }
    /// <summary>Metres per second.</summary>
    public double[]? VelocitySmooth { get; set; }
    public int[]? Heartrate { get; set; }
    public int[]? Cadence { get; set; }
    /// <summary>Null samples where the power meter dropped out.</summary>
    public int?[]? Watts { get; set; }
    /// <summary>Degrees Celsius.</summary>
    public int[]? Temp { get; set; }
    public bool[]? Moving { get; set; }
    /// <summary>Percent.</summary>
    public double[]? GradeSmooth { get; set; }
}
