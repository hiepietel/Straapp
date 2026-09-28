using System.Threading.Channels;
using Straapp.Application.Strava;
using Straapp.Application.Sync;

namespace Straapp.Api.Sync;

/// <param name="Year">Null syncs the whole history.</param>
public sealed record SyncRequest(int? Year, bool Force);

/// <summary>Hands sync requests to <see cref="SyncWorker"/>. Holds at most one, and none while a sync runs.</summary>
public sealed class SyncQueue(SyncStatus status, TimeProvider time)
{
    private readonly Channel<SyncRequest> _channel = Channel.CreateBounded<SyncRequest>(1);
    private readonly Lock _lock = new();

    /// <summary>False when a sync is already queued or running.</summary>
    public bool TryStart(SyncRequest request)
    {
        lock (_lock)
        {
            if (status.IsBusy) return false;
            // Mark it queued before the worker can pick it up, so its "running" update isn't overwritten.
            status.Update(_ => new SyncProgress { State = SyncState.Queued, Year = request.Year, StartedAt = time.GetUtcNow() });
            return _channel.Writer.TryWrite(request);
        }
    }

    public IAsyncEnumerable<SyncRequest> ReadAllAsync(CancellationToken ct) => _channel.Reader.ReadAllAsync(ct);
}

/// <summary>
/// Runs syncs in the background, one at a time. A sync can take hours because of Strava's rate limits,
/// far longer than an HTTP request should stay open.
/// </summary>
public sealed class SyncWorker(SyncQueue queue, IServiceScopeFactory scopes) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        await foreach (var request in queue.ReadAllAsync(stoppingToken))
        {
            await using var scope = scopes.CreateAsyncScope();
            var sync = scope.ServiceProvider.GetRequiredService<ActivitySyncService>();
            await sync.SyncAsync(request.Year, request.Force, stoppingToken);
        }
    }
}

/// <summary>
/// The only thing that fetches activities on its own: every <c>Sync:IntervalHours</c> (default 6),
/// and soon after a login, it syncs the whole history, newest first. Stored activities are skipped,
/// so once everything is in, a run costs only a few Strava requests (one per 200 activities to list
/// them, plus one per gear item). Pages never ask Strava themselves.
/// </summary>
public sealed class ScheduledSyncWorker(
    SyncQueue queue,
    IStravaAuthService auth,
    IConfiguration configuration,
    TimeProvider time,
    ILogger<ScheduledSyncWorker> logger) : BackgroundService
{
    private static readonly TimeSpan CheckEvery = TimeSpan.FromMinutes(1);

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        if (!configuration.GetValue("Sync:Enabled", true)) return;
        var interval = TimeSpan.FromHours(configuration.GetValue("Sync:IntervalHours", 6.0));

        DateTimeOffset? lastRun = null;
        using var timer = new PeriodicTimer(CheckEvery, time);
        while (await timer.WaitForNextTickAsync(stoppingToken))
        {
            // The Strava session lives in memory: nothing to sync with until someone logs in.
            if (!auth.IsSignedIn) continue;
            if (lastRun is { } last && time.GetUtcNow() - last < interval) continue;

            if (queue.TryStart(new SyncRequest(Year: null, Force: false)))
            {
                lastRun = time.GetUtcNow();
                logger.LogInformation("Scheduled sync of the whole history started; next one in {Interval}", interval);
            }
        }
    }
}
