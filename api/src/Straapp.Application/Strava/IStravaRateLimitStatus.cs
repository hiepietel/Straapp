namespace Straapp.Application.Strava;

/// <summary>
/// Strava allows a limited number of requests per 15 minutes and per day.
/// When the 15-minute quota runs out, requests wait for the next window instead of failing.
/// </summary>
public interface IStravaRateLimitStatus
{
    /// <summary>Set while requests are held back waiting for the next 15-minute window.</summary>
    DateTimeOffset? PausedUntil { get; }

    /// <summary>The most recent usage Strava reported, e.g. "read 42/100 (15 min), 310/1000 (day)".</summary>
    string? LastUsage { get; }
}
