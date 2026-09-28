namespace Straapp.Application.Sync;

public enum SyncState
{
    Idle,
    Queued,
    Running,
    Completed,
    Failed,
}

/// <summary>A snapshot of the current (or last) sync.</summary>
public sealed record SyncProgress
{
    public SyncState State { get; init; } = SyncState.Idle;
    public int? Year { get; init; }
    /// <summary>Activities Strava has for the year.</summary>
    public int Total { get; init; }
    /// <summary>Already in the database, so not fetched again.</summary>
    public int Skipped { get; init; }
    public int Synced { get; init; }
    public IReadOnlyList<string> Errors { get; init; } = [];
    public string? Current { get; init; }
    public string? Message { get; init; }
    public DateTimeOffset? StartedAt { get; init; }
    public DateTimeOffset? FinishedAt { get; init; }

    public int Remaining => Math.Max(0, Total - Skipped - Synced - Errors.Count);
}

/// <summary>Singleton holding the sync's progress, so the API can report it while the job runs.</summary>
public sealed class SyncStatus
{
    private SyncProgress _progress = new();

    public SyncProgress Current => Volatile.Read(ref _progress);

    public bool IsBusy => Current.State is SyncState.Queued or SyncState.Running;

    public void Update(Func<SyncProgress, SyncProgress> change)
    {
        // Only the one sync job writes, but readers must never see a torn update.
        SyncProgress before, after;
        do
        {
            before = Current;
            after = change(before);
        } while (Interlocked.CompareExchange(ref _progress, after, before) != before);
    }
}
