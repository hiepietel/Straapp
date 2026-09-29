using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Straapp.Application.Abstractions;
using Straapp.Domain.Activities;

namespace Straapp.Application.Weather;

/// <summary>
/// Looks up and stores the weather, every 15 minutes, for every outdoor activity that has none yet, newest first.
/// One request per activity, paced to stay inside the archive's free allowance; a run that hits the
/// limit just stops, and the next run carries on where it left off.
/// </summary>
public sealed class WeatherSyncService(
    IWeatherRepository weather,
    IWeatherClient client,
    IOptions<WeatherOptions> options,
    TimeProvider time,
    ILogger<WeatherSyncService> logger)
{
    public const string Source = "open-meteo";

    /// <summary>Hours of weather kept either side of the activity, so the chart shows what came before and after.</summary>
    private static readonly TimeSpan Margin = TimeSpan.FromHours(2);

    /// <summary>
    /// The archive fills the last days in from forecasts and firms them up later; wait until an
    /// activity is this old, so what's stored is the final record.
    /// </summary>
    private static readonly TimeSpan SettleTime = TimeSpan.FromDays(2);

    private const int BatchSize = 100;

    /// <returns>How many activities got their weather.</returns>
    public async Task<int> SyncAsync(CancellationToken ct = default)
    {
        var delay = TimeSpan.FromSeconds(options.Value.RequestDelaySeconds);
        var stored = 0;
        // Activities that failed this run, so the next batch doesn't hand them straight back.
        var failed = new HashSet<long>();

        while (true)
        {
            var pending = (await weather.GetPendingAsync(time.GetUtcNow() - SettleTime, BatchSize + failed.Count, ct))
                .Where(t => !failed.Contains(t.ActivityId))
                .ToList();
            if (pending.Count == 0) break;

            foreach (var target in pending)
            {
                try
                {
                    await weather.ReplaceAsync(await FetchAsync(target, ct), ct);
                    stored++;
                }
                catch (WeatherRateLimitException ex)
                {
                    logger.LogWarning("Weather sync stopped after {Count} activities: {Reason}", stored, ex.Message);
                    return stored;
                }
                catch (Exception ex) when (ex is HttpRequestException or TaskCanceledException && !ct.IsCancellationRequested)
                {
                    // A network hiccup or a timeout: try this one again next run.
                    logger.LogWarning(ex, "Couldn't fetch the weather for activity {Id}", target.ActivityId);
                    failed.Add(target.ActivityId);
                }

                await Task.Delay(delay, time, ct);
            }

            logger.LogInformation("Weather stored for {Count} activities so far", stored);
        }

        if (stored > 0) logger.LogInformation("Weather sync finished: {Count} activities", stored);
        return stored;
    }

    private async Task<ActivityWeather> FetchAsync(WeatherTarget target, CancellationToken ct)
    {
        var from = FloorToQuarter(target.StartDate) - Margin;
        var to = FloorToQuarter(target.StartDate.AddSeconds(target.ElapsedTime)) + Step + Margin;

        try
        {
            var series = await client.GetQuarterHourlyAsync(
                target.Latitude!.Value, target.Longitude!.Value,
                DateOnly.FromDateTime(from.UtcDateTime), DateOnly.FromDateTime(to.UtcDateTime), ct);

            var samples = series.Samples.Where(s => s.Time >= from && s.Time <= to).ToList();
            samples.ForEach(s => s.ActivityId = target.ActivityId);
            return new ActivityWeather
            {
                ActivityId = target.ActivityId,
                Latitude = series.Latitude,
                Longitude = series.Longitude,
                Elevation = series.Elevation,
                Source = Source,
                FetchedAt = time.GetUtcNow(),
                Samples = samples,
            };
        }
        catch (WeatherUnavailableException ex)
        {
            // Stored without samples, so it isn't asked for again and again.
            logger.LogInformation("No weather for activity {Id}: {Reason}", target.ActivityId, ex.Message);
            return new ActivityWeather
            {
                ActivityId = target.ActivityId,
                Latitude = target.Latitude!.Value,
                Longitude = target.Longitude!.Value,
                Source = $"unavailable: {ex.Message}",
                FetchedAt = time.GetUtcNow(),
            };
        }
    }

    private static readonly TimeSpan Step = TimeSpan.FromMinutes(15);

    private static DateTimeOffset FloorToQuarter(DateTimeOffset t) =>
        new(t.UtcTicks - t.UtcTicks % Step.Ticks, TimeSpan.Zero);
}
