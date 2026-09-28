using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Straapp.Application.Accounts;

namespace Straapp.Api.Controllers;

/// <summary>
/// The athlete's profile, Strava's totals and training zones, from the database only, in Strava's own
/// JSON format (snake_case). The sync refreshes them on every run.
/// </summary>
[ApiController]
[Authorize]
[StravaJson]
[Route("api/profile")]
public sealed class ProfileController(ProfileService profiles) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<Profile>> Get(CancellationToken ct) =>
        await profiles.GetAsync(User.GetAthleteId(), ct) is { } profile
            ? profile
            : Problem("Your profile isn't stored yet. Log in again.", statusCode: StatusCodes.Status404NotFound);
}
