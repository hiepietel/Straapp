using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Straapp.Application.Strava;
using Straapp.Application.Strava.Models;

namespace Straapp.Api.Controllers;

/// <summary>
/// Straight pass-through to Strava for the logged-in athlete, in Strava's own JSON format
/// (snake_case), so the web app reads it exactly as it would read Strava. Nothing is stored.
/// </summary>
[ApiController]
[Authorize]
[StravaJson]
[Route("api/strava")]
public sealed class StravaController(IStravaClient strava) : ControllerBase
{
    // ---- athlete ----

    [HttpGet("athlete")]
    public Task<DetailedAthlete> GetAthlete(CancellationToken ct) => strava.GetAthleteAsync(ct);

    [HttpGet("athlete/zones")]
    public Task<AthleteZones> GetAthleteZones(CancellationToken ct) => strava.GetAthleteZonesAsync(ct);

    [HttpGet("athlete/stats")]
    public Task<ActivityStats> GetAthleteStats(CancellationToken ct) => strava.GetAthleteStatsAsync(ct);

    [HttpGet("athlete/clubs")]
    public Task<IReadOnlyList<SummaryClub>> GetClubs([FromQuery] PageQuery page, CancellationToken ct) =>
        strava.GetAthleteClubsAsync(page, ct);

    [HttpGet("gear/{id}")]
    public Task<DetailedGear> GetGear(string id, CancellationToken ct) => strava.GetGearAsync(id, ct);

    // ---- activities ----

    [HttpGet("activities")]
    public Task<IReadOnlyList<SummaryActivity>> GetActivities([FromQuery] ActivityQuery query, CancellationToken ct) =>
        strava.GetActivitiesAsync(query, ct);

    /// <summary>Every activity, streamed as Strava's pages arrive (one request per 200).</summary>
    [HttpGet("activities/all")]
    public IAsyncEnumerable<SummaryActivity> GetAllActivities(
        DateTimeOffset? before, DateTimeOffset? after, CancellationToken ct) =>
        strava.GetAllActivitiesAsync(before, after, ct);

    [HttpGet("activities/{id:long}")]
    public Task<DetailedActivity> GetActivity(long id, bool includeAllEfforts, CancellationToken ct) =>
        strava.GetActivityAsync(id, includeAllEfforts, ct);

    [HttpGet("activities/{id:long}/streams")]
    public Task<StreamSet> GetActivityStreams(long id, CancellationToken ct) => strava.GetActivityStreamsAsync(id, ct);

    [HttpGet("activities/{id:long}/laps")]
    public Task<IReadOnlyList<Lap>> GetActivityLaps(long id, CancellationToken ct) => strava.GetActivityLapsAsync(id, ct);

    [HttpGet("activities/{id:long}/zones")]
    public Task<IReadOnlyList<ActivityZone>> GetActivityZones(long id, CancellationToken ct) =>
        strava.GetActivityZonesAsync(id, ct);

    [HttpGet("activities/{id:long}/comments")]
    public Task<IReadOnlyList<Comment>> GetActivityComments(
        long id, string? afterCursor, CancellationToken ct, int pageSize = 30) =>
        strava.GetActivityCommentsAsync(id, pageSize, afterCursor, ct);

    [HttpGet("activities/{id:long}/kudos")]
    public Task<IReadOnlyList<SummaryAthlete>> GetActivityKudoers(long id, [FromQuery] PageQuery page, CancellationToken ct) =>
        strava.GetActivityKudoersAsync(id, page, ct);

    // ---- routes ----

    [HttpGet("routes")]
    public Task<IReadOnlyList<StravaRoute>> GetRoutes([FromQuery] PageQuery page, CancellationToken ct) =>
        strava.GetRoutesAsync(page, ct);

    [HttpGet("routes/{id:long}")]
    public Task<StravaRoute> GetRoute(long id, CancellationToken ct) => strava.GetRouteAsync(id, ct);

    [HttpGet("routes/{id:long}/streams")]
    public Task<StreamSet> GetRouteStreams(long id, CancellationToken ct) => strava.GetRouteStreamsAsync(id, ct);

    // ---- segments ----

    [HttpGet("segments/starred")]
    public Task<IReadOnlyList<SummarySegment>> GetStarredSegments([FromQuery] PageQuery page, CancellationToken ct) =>
        strava.GetStarredSegmentsAsync(page, ct);

    [HttpGet("segments/{id:long}")]
    public Task<DetailedSegment> GetSegment(long id, CancellationToken ct) => strava.GetSegmentAsync(id, ct);

    [HttpGet("segments/{id:long}/efforts")]
    public Task<IReadOnlyList<SegmentEffort>> GetSegmentEfforts(
        long id, DateTimeOffset? start, DateTimeOffset? end, CancellationToken ct, int perPage = 30) =>
        strava.GetSegmentEffortsAsync(id, start, end, perPage, ct);
}
