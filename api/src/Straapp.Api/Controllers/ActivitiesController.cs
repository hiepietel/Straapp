using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Straapp.Application.StoredActivities;
using Straapp.Application.Strava.Models;

namespace Straapp.Api.Controllers;

/// <summary>
/// The athlete's synced activities, from the database only, in Strava's own JSON format (snake_case),
/// so the web app reads them exactly as it would read Strava.
/// </summary>
[ApiController]
[Authorize]
[StravaJson]
[Route("api/activities")]
public sealed class ActivitiesController(ActivityService activities) : ControllerBase
{
    private const string NotSynced = "This activity isn't synced yet. The sync fetches it soon; try again later.";

    /// <summary>Newest first. Activities appear here once the sync has stored them.</summary>
    /// <param name="perPage">Up to 200.</param>
    [HttpGet]
    public Task<IReadOnlyList<SummaryActivity>> GetPage(CancellationToken ct, int page = 1, int perPage = 30) =>
        activities.GetPageAsync(User.GetAthleteId(), page, perPage, ct);

    [HttpGet("{id:long}")]
    public async Task<ActionResult<DetailedActivity>> Get(long id, CancellationToken ct) =>
        await activities.GetAsync(User.GetAthleteId(), id, ct) is { } activity
            ? activity
            : Problem(NotSynced, statusCode: StatusCodes.Status404NotFound);

    /// <summary>Sensor data for the charts; streams the device didn't record are left out.</summary>
    [HttpGet("{id:long}/streams")]
    public async Task<ActionResult<StreamSet>> GetStreams(long id, CancellationToken ct) =>
        await activities.GetStreamsAsync(User.GetAthleteId(), id, ct) is { } streams
            ? streams
            : Problem(NotSynced, statusCode: StatusCodes.Status404NotFound);
}
