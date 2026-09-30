using System.Net;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Time.Testing;
using Straapp.Application.Strava;
using Straapp.Application.Strava.Models;
using Straapp.Application.Sync;

namespace Straapp.UnitTests.Sync;

public class ActivitySyncServiceTests
{
    private static readonly DateTimeOffset Now = new(2026, 9, 30, 12, 0, 0, TimeSpan.Zero);

    private readonly FakeStravaClient _strava = new();
    private readonly FakeActivityRepository _activities = new();
    private readonly FakeAthleteRepository _athletes = new();
    private readonly SyncStatus _status = new();

    private ActivitySyncService Service => new(
        _strava, _activities, _athletes, _status, new FakeTimeProvider(Now), NullLogger<ActivitySyncService>.Instance);

    private void AddActivity(long id, int day, string? gearId = null) =>
        _strava.Activities.Add(new SummaryActivity
        {
            Id = id,
            Name = $"Activity {id}",
            SportType = "Run",
            StartDate = new DateTimeOffset(2026, 9, day, 8, 0, 0, TimeSpan.Zero),
            StartDateLocal = new DateTimeOffset(2026, 9, day, 10, 0, 0, TimeSpan.Zero),
            GearId = gearId,
        });

    [Fact]
    public async Task Fetches_only_missing_activities_newest_first()
    {
        AddActivity(1, 1);
        AddActivity(2, 3);
        AddActivity(3, 2);
        _activities.StoredIds.Add(2);

        await Service.SyncAsync(year: null, force: false);

        Assert.Equal([3L, 1L], _strava.DetailRequests);
        Assert.Equal([3L, 1L], _activities.Replaced.Select(a => a.Id));
        var progress = _status.Current;
        Assert.Equal(SyncState.Completed, progress.State);
        Assert.Equal(3, progress.Total);
        Assert.Equal(1, progress.Skipped);
        Assert.Equal(2, progress.Synced);
        Assert.Equal(0, progress.Remaining);
        Assert.Equal("Done.", progress.Message);
    }

    [Fact]
    public async Task Force_fetches_stored_activities_again()
    {
        AddActivity(1, 1);
        _activities.StoredIds.Add(1);

        await Service.SyncAsync(year: null, force: true);

        Assert.Equal([1L], _strava.DetailRequests);
    }

    [Fact]
    public async Task One_year_counts_activities_by_their_local_date()
    {
        _strava.Activities.Add(new SummaryActivity
        {
            Id = 1,
            StartDate = new DateTimeOffset(2025, 12, 31, 23, 30, 0, TimeSpan.Zero),
            StartDateLocal = new DateTimeOffset(2026, 1, 1, 0, 30, 0, TimeSpan.Zero),
        });
        _strava.Activities.Add(new SummaryActivity
        {
            Id = 2,
            StartDate = new DateTimeOffset(2025, 12, 31, 10, 0, 0, TimeSpan.Zero),
            StartDateLocal = new DateTimeOffset(2025, 12, 31, 11, 0, 0, TimeSpan.Zero),
        });

        await Service.SyncAsync(year: 2026, force: false);

        Assert.Equal([1L], _strava.DetailRequests);
        Assert.Equal(2026, _status.Current.Year);
    }

    [Fact]
    public async Task A_broken_activity_is_reported_and_the_rest_carry_on()
    {
        AddActivity(1, 2);
        AddActivity(2, 1);
        _strava.DetailFailures[1] = new StravaApiException(HttpStatusCode.InternalServerError, "Strava broke");

        await Service.SyncAsync(year: null, force: false);

        Assert.Equal([2L], _activities.Replaced.Select(a => a.Id));
        var progress = _status.Current;
        Assert.Equal(SyncState.Completed, progress.State);
        Assert.Equal(["1: Strava broke"], progress.Errors);
        Assert.Contains("1 activities failed", progress.Message);
    }

    [Fact]
    public async Task The_rate_limit_stops_the_sync_and_says_when_to_retry()
    {
        AddActivity(1, 2);
        AddActivity(2, 1);
        _strava.DetailFailures[1] = new StravaRateLimitException("Limit reached.", new DateTimeOffset(2026, 10, 1, 0, 0, 0, TimeSpan.Zero));

        await Service.SyncAsync(year: null, force: false);

        Assert.Empty(_activities.Replaced);
        Assert.Equal([1L], _strava.DetailRequests);
        var progress = _status.Current;
        Assert.Equal(SyncState.Failed, progress.State);
        Assert.Equal("Limit reached. Run the sync again after 2026-10-01 00:00:00Z; stored activities are skipped.", progress.Message);
        Assert.NotNull(progress.FinishedAt);
    }

    [Fact]
    public async Task Activity_zones_are_not_asked_for_again_after_a_refusal()
    {
        AddActivity(1, 3);
        AddActivity(2, 2);
        AddActivity(3, 1);
        _strava.ZonesAllowed = false;

        await Service.SyncAsync(year: null, force: false);

        Assert.Equal(1, _strava.ZoneRequests);
        Assert.Equal(3, _activities.Replaced.Count);
    }

    [Fact]
    public async Task Stores_the_athlete_and_every_piece_of_gear_used()
    {
        _strava.Athlete = new DetailedAthlete { Id = 7, Firstname = "Ada", Bikes = [new SummaryGear { Id = "b1" }] };
        AddActivity(1, 1, gearId: "g2");
        AddActivity(2, 2, gearId: "");

        await Service.SyncAsync(year: null, force: false);

        Assert.Equal(7, _athletes.Athlete?.Id);
        Assert.Equal(["b1", "g2"], _athletes.Gear.Select(g => g.Id).Order());
        Assert.All(_athletes.Gear, g => Assert.Equal(7, g.AthleteId));
    }
}
