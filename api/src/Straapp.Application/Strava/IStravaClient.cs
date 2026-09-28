using Straapp.Application.Strava.Models;

namespace Straapp.Application.Strava;

/// <summary>
/// Read-only access to what the sync copies from Strava about the logged-in athlete.
/// Every call goes to Strava; nothing is cached or stored.
/// </summary>
public interface IStravaClient
{
    // ---- athlete ----

    Task<DetailedAthlete> GetAthleteAsync(CancellationToken ct = default);

    Task<AthleteZones> GetAthleteZonesAsync(CancellationToken ct = default);

    Task<ActivityStats> GetAthleteStatsAsync(CancellationToken ct = default);

    /// <summary>Also works for retired gear, which the athlete no longer lists.</summary>
    Task<DetailedGear> GetGearAsync(string gearId, CancellationToken ct = default);

    // ---- activities ----

    /// <summary>Walks every page until Strava runs out. One request per 200 activities.</summary>
    IAsyncEnumerable<SummaryActivity> GetAllActivitiesAsync(
        DateTimeOffset? before = null, DateTimeOffset? after = null, CancellationToken ct = default);

    Task<DetailedActivity> GetActivityAsync(long activityId, bool includeAllEfforts = false, CancellationToken ct = default);

    Task<StreamSet> GetActivityStreamsAsync(long activityId, CancellationToken ct = default);

    Task<IReadOnlyList<ActivityZone>> GetActivityZonesAsync(long activityId, CancellationToken ct = default);

    Task<IReadOnlyList<Comment>> GetActivityCommentsAsync(
        long activityId, int pageSize = 30, string? afterCursor = null, CancellationToken ct = default);

    Task<IReadOnlyList<SummaryAthlete>> GetActivityKudoersAsync(long activityId, PageQuery page, CancellationToken ct = default);
}

/// <summary>Strava's page-number paging. Strava caps <see cref="PerPage"/> at 200.</summary>
public sealed record PageQuery(int Page = 1, int PerPage = 30);
