using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Straapp.Application.Accounts;

namespace Straapp.Api.Controllers;

/// <summary>The athlete's profile, training zones and totals, from the database only.</summary>
[ApiController]
[Authorize]
[Route("api/profile")]
public sealed class ProfileController(ProfileService profiles, ProfileTotalsService totals, TimeProvider time) : ControllerBase
{
    /// <summary>The stored Strava profile and zones, in Strava's own JSON format (snake_case).</summary>
    [HttpGet]
    [StravaJson]
    public async Task<ActionResult<Profile>> Get(CancellationToken ct) =>
        await profiles.GetAsync(User.GetAthleteId(), ct) is { } profile
            ? profile
            : Problem("Your profile isn't stored yet. Log in again.", statusCode: StatusCodes.Status404NotFound);

    /// <summary>
    /// Last 4 weeks, year to date and all time, per sport and in total, for all, public and private
    /// activities, with records. Counted from the stored activities.
    /// </summary>
    /// <param name="today">The viewer's local date, so the periods match their calendar. Defaults to the server's.</param>
    [HttpGet("totals")]
    public Task<ProfileTotals> GetTotals(DateOnly? today, CancellationToken ct) =>
        totals.GetAsync(User.GetAthleteId(), today ?? DateOnly.FromDateTime(time.GetLocalNow().DateTime), ct);
}
