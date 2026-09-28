using System.Globalization;
using Microsoft.Extensions.Logging;
using Straapp.Application.Strava;

namespace Straapp.Infrastructure.Strava;

/// <summary>
/// Tracks the quota Strava reports on every response and holds requests back instead of hitting it.
/// Strava has an overall limit and a stricter one for reads, each per 15 minutes (windows start at
/// :00, :15, :30, :45 UTC) and per day (resets at midnight UTC).
/// </summary>
internal sealed class StravaRateLimiter(TimeProvider time, ILogger<StravaRateLimiter> logger) : IStravaRateLimitStatus
{
    /// <summary>Keep a couple of requests in hand for the passthrough endpoints while a sync runs.</summary>
    private const int Headroom = 2;

    private readonly Lock _lock = new();
    private readonly Dictionary<string, Quota> _quotas = [];
    private DateTimeOffset? _pausedUntil;

    private sealed record Quota(int ShortUsage, int ShortLimit, int DailyUsage, int DailyLimit);

    public DateTimeOffset? PausedUntil
    {
        get { lock (_lock) return _pausedUntil; }
    }

    public string? LastUsage
    {
        get
        {
            lock (_lock)
            {
                return _quotas.Count == 0 ? null : string.Join(", ", _quotas.Select(q =>
                    $"{q.Key} {q.Value.ShortUsage}/{q.Value.ShortLimit} (15 min), {q.Value.DailyUsage}/{q.Value.DailyLimit} (day)"));
            }
        }
    }

    /// <summary>Waits for the next window if this one is used up; throws if today's quota is gone.</summary>
    public async Task BeforeRequestAsync(CancellationToken ct)
    {
        bool shortExhausted;
        lock (_lock)
        {
            if (_quotas.Values.Any(q => q.DailyUsage >= q.DailyLimit - Headroom)) throw DailyLimitReached();
            shortExhausted = _quotas.Values.Any(q => q.ShortUsage >= q.ShortLimit - Headroom);
        }
        if (shortExhausted) await WaitForNextWindowAsync(ct);
    }

    public void Update(HttpResponseMessage response)
    {
        lock (_lock)
        {
            Read(response, "X-RateLimit", "overall");
            Read(response, "X-ReadRateLimit", "read");
        }
    }

    /// <summary>After a 429: true if waiting for the next window will help, false if the day is used up.</summary>
    public bool IsOnlyShortTermExhausted()
    {
        lock (_lock) return !_quotas.Values.Any(q => q.DailyUsage >= q.DailyLimit);
    }

    public StravaRateLimitException DailyLimitReached() =>
        new("Strava's daily request limit is used up.", NextMidnightUtc());

    public async Task WaitForNextWindowAsync(CancellationToken ct)
    {
        var now = time.GetUtcNow();
        // A few seconds past the boundary, so Strava's clock has rolled over too.
        var until = new DateTimeOffset(now.Year, now.Month, now.Day, now.Hour, now.Minute / 15 * 15, 0, TimeSpan.Zero)
            .AddMinutes(15).AddSeconds(5);

        lock (_lock) _pausedUntil = until;
        logger.LogInformation("Strava 15-minute rate limit reached ({Usage}); waiting until {Until:HH:mm:ss} UTC", LastUsage, until);
        try
        {
            await Task.Delay(until - now, time, ct);
        }
        finally
        {
            lock (_lock)
            {
                _pausedUntil = null;
                // New window: the short-term count starts again; the next response confirms it.
                foreach (var (name, quota) in _quotas) _quotas[name] = quota with { ShortUsage = 0 };
            }
        }
    }

    private void Read(HttpResponseMessage response, string prefix, string name)
    {
        // Both headers are "15-minute,daily", e.g. "100,1000" and "42,310".
        if (Pair(response, $"{prefix}-Limit") is not (var shortLimit, var dailyLimit)) return;
        if (Pair(response, $"{prefix}-Usage") is not (var shortUsage, var dailyUsage)) return;
        _quotas[name] = new Quota(shortUsage, shortLimit, dailyUsage, dailyLimit);
    }

    private static (int, int)? Pair(HttpResponseMessage response, string header)
    {
        if (!response.Headers.TryGetValues(header, out var values)) return null;
        var parts = values.FirstOrDefault()?.Split(',');
        if (parts is not { Length: >= 2 }) return null;
        return int.TryParse(parts[0], CultureInfo.InvariantCulture, out var a) && int.TryParse(parts[1], CultureInfo.InvariantCulture, out var b)
            ? (a, b)
            : null;
    }

    private DateTimeOffset NextMidnightUtc() => new DateTimeOffset(time.GetUtcNow().UtcDateTime.Date, TimeSpan.Zero).AddDays(1);
}
