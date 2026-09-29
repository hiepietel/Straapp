namespace Straapp.Domain.Activities;

/// <summary>
/// The weather around an activity, every 15 minutes, looked up at its start point after the fact
/// (from a historical weather archive, not from the athlete's device).
/// </summary>
public class ActivityWeather
{
    public long ActivityId { get; set; }
    /// <summary>The weather model's grid cell the values are for (a few km from the start point).</summary>
    public double Latitude { get; set; }
    public double Longitude { get; set; }
    /// <summary>Metres; of the grid cell, not the activity.</summary>
    public double? Elevation { get; set; }
    /// <summary>Where the values came from, e.g. "open-meteo"; or why there are none.</summary>
    public string Source { get; set; } = "";
    public DateTimeOffset FetchedAt { get; set; }

    /// <summary>From a couple of hours before the start to a couple after the end; empty when none could be had.</summary>
    public List<WeatherSample> Samples { get; set; } = [];
}

/// <summary>The weather at one quarter hour. Values are null where the archive has none.</summary>
public class WeatherSample
{
    public long ActivityId { get; set; }
    /// <summary>UTC, on a quarter hour.</summary>
    public DateTimeOffset Time { get; set; }
    /// <summary>Degrees Celsius, 2 m above ground.</summary>
    public double? Temperature { get; set; }
    /// <summary>"Feels like", degrees Celsius: temperature with wind chill, humidity and sun.</summary>
    public double? ApparentTemperature { get; set; }
    /// <summary>Percent.</summary>
    public int? RelativeHumidity { get; set; }
    /// <summary>Degrees Celsius.</summary>
    public double? DewPoint { get; set; }
    /// <summary>Millimetres in the 15 minutes up to <see cref="Time"/>: rain, showers and snow (as water).</summary>
    public double? Precipitation { get; set; }
    /// <summary>Millimetres in the 15 minutes up to <see cref="Time"/>.</summary>
    public double? Rain { get; set; }
    /// <summary>Centimetres in the 15 minutes up to <see cref="Time"/>.</summary>
    public double? Snowfall { get; set; }
    /// <summary>Percent of the sky.</summary>
    public int? CloudCover { get; set; }
    /// <summary>Km/h, 10 m above ground.</summary>
    public double? WindSpeed { get; set; }
    /// <summary>Degrees the wind comes from (0 = from the north, 90 = from the east).</summary>
    public int? WindDirection { get; set; }
    /// <summary>Km/h, the strongest gust in the 15 minutes up to <see cref="Time"/>.</summary>
    public double? WindGusts { get; set; }
    /// <summary>WMO weather code (0 clear … 95+ thunderstorm).</summary>
    public int? WeatherCode { get; set; }
    /// <summary>Hectopascals, at the surface.</summary>
    public double? Pressure { get; set; }
    public bool? IsDay { get; set; }
}
