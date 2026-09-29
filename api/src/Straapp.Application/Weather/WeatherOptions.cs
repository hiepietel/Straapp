namespace Straapp.Application.Weather;

/// <summary>The "Weather" config section.</summary>
public sealed class WeatherOptions
{
    public const string SectionName = "Weather";

    /// <summary>Whether the background job fetches weather for new activities.</summary>
    public bool Enabled { get; set; } = true;

    /// <summary>How often the job looks for activities without weather.</summary>
    public double IntervalMinutes { get; set; } = 60;

    /// <summary>
    /// The pause between two requests. Open-Meteo's free tier allows 600 calls a minute, 5,000 an hour
    /// and 10,000 a day, and a request for more than 10 variables counts as more than one call (ours asks
    /// for 14); one every 1.5 seconds stays under the hourly limit however long a backfill runs.
    /// </summary>
    public double RequestDelaySeconds { get; set; } = 1.5;

    /// <summary>
    /// Open-Meteo's historical forecast API: the weather every 15 minutes for any place, back to before 2018.
    /// </summary>
    public Uri ArchiveUrl { get; set; } = new("https://historical-forecast-api.open-meteo.com/v1/");
}
