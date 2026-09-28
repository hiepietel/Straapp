using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Straapp.Api.Sync;
using Straapp.Application.Strava;
using Straapp.Application.Sync;

namespace Straapp.Api.Controllers;

/// <summary>Copies Strava activities into the database. Log in at /api/auth/login first.</summary>
[ApiController]
[Authorize]
[Route("api/sync")]
public sealed class SyncController(
    SyncQueue queue, SyncStatus status, IStravaAuthService auth, IStravaRateLimitStatus rateLimit, TimeProvider time)
    : ControllerBase
{
    /// <summary>
    /// Starts syncing the whole history in the background, newest first (the scheduled job does the same
    /// every few hours). Activities already stored are skipped unless <paramref name="force"/> is set.
    /// Follow progress at GET /api/sync/status.
    /// </summary>
    [HttpPost]
    [ProducesResponseType<SyncProgress>(StatusCodes.Status202Accepted)]
    public IActionResult StartAll(bool force = false) => Start(new SyncRequest(Year: null, force));

    /// <summary>Like POST /api/sync, for the activities of one <paramref name="year"/> only.</summary>
    [HttpPost("{year:int}")]
    [ProducesResponseType<SyncProgress>(StatusCodes.Status202Accepted)]
    public IActionResult StartYear(int year, bool force = false)
    {
        if (year < 2009 || year > time.GetUtcNow().Year)
        {
            return Problem($"Pick a year between 2009 (Strava's start) and {time.GetUtcNow().Year}.",
                statusCode: StatusCodes.Status400BadRequest);
        }
        return Start(new SyncRequest(year, force));
    }

    private IActionResult Start(SyncRequest request)
    {
        if (!auth.IsSignedIn)
        {
            return Problem("You are not logged in to Strava. Open /api/auth/login first.",
                statusCode: StatusCodes.Status401Unauthorized);
        }
        if (!queue.TryStart(request))
        {
            return Problem("A sync is already running. Check GET /api/sync/status.", statusCode: StatusCodes.Status409Conflict);
        }

        return AcceptedAtAction(nameof(GetStatus), status.Current);
    }

    [HttpGet("status")]
    public IActionResult GetStatus() => Ok(new
    {
        progress = status.Current,
        rateLimit = new { pausedUntil = rateLimit.PausedUntil, usage = rateLimit.LastUsage },
    });
}
