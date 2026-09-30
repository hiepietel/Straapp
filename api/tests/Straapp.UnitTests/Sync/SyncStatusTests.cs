using Straapp.Application.Sync;

namespace Straapp.UnitTests.Sync;

public class SyncStatusTests
{
    [Fact]
    public void Remaining_counts_what_is_neither_skipped_synced_nor_failed()
    {
        var progress = new SyncProgress { Total = 10, Skipped = 3, Synced = 4, Errors = ["x"] };

        Assert.Equal(2, progress.Remaining);
    }

    [Fact]
    public void Remaining_is_never_negative()
    {
        Assert.Equal(0, new SyncProgress { Total = 1, Synced = 2 }.Remaining);
    }

    [Theory]
    [InlineData(SyncState.Idle, false)]
    [InlineData(SyncState.Queued, true)]
    [InlineData(SyncState.Running, true)]
    [InlineData(SyncState.Completed, false)]
    [InlineData(SyncState.Failed, false)]
    public void Busy_while_queued_or_running(SyncState state, bool busy)
    {
        var status = new SyncStatus();
        status.Update(p => p with { State = state });

        Assert.Equal(busy, status.IsBusy);
    }

    [Fact]
    public async Task Concurrent_updates_are_not_lost()
    {
        var status = new SyncStatus();

        await Task.WhenAll(Enumerable.Range(0, 8).Select(_ => Task.Run(() =>
        {
            for (var i = 0; i < 1000; i++) status.Update(p => p with { Synced = p.Synced + 1 });
        })));

        Assert.Equal(8000, status.Current.Synced);
    }
}
