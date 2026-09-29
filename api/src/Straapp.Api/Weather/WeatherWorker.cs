using Microsoft.Extensions.Options;
using Straapp.Application.Weather;

namespace Straapp.Api.Weather;

/// <summary>
/// Every <c>Weather:IntervalMinutes</c> (default 60), looks up the weather for activities that have
/// none yet: the whole history on the first runs (paced, so a long one spreads over a few hours),
/// then just the new ones. Starts a minute after the API, out of the way of start-up.
/// </summary>
public sealed class WeatherWorker(
    IServiceScopeFactory scopes,
    IOptions<WeatherOptions> options,
    TimeProvider time,
    ILogger<WeatherWorker> logger) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        if (!options.Value.Enabled) return;

        await Task.Delay(TimeSpan.FromMinutes(1), time, stoppingToken);
        using var timer = new PeriodicTimer(TimeSpan.FromMinutes(options.Value.IntervalMinutes), time);
        do
        {
            try
            {
                await using var scope = scopes.CreateAsyncScope();
                await scope.ServiceProvider.GetRequiredService<WeatherSyncService>().SyncAsync(stoppingToken);
            }
            catch (Exception ex) when (!stoppingToken.IsCancellationRequested)
            {
                // Try again next time rather than taking the API down.
                logger.LogError(ex, "Weather sync failed");
            }
        } while (await timer.WaitForNextTickAsync(stoppingToken));
    }
}
