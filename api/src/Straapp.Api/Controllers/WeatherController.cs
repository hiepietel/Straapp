using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Straapp.Application.Weather;

namespace Straapp.Api.Controllers;

/// <summary>The weather around an activity, every 15 minutes, from the database only.</summary>
[ApiController]
[Authorize]
[Route("api/activities/{id:long}/weather")]
public sealed class WeatherController(WeatherService weather) : ControllerBase
{
    /// <summary>
    /// Every quarter hour from two hours before the start to two after the end, UTC. <c>status</c> says why
    /// there are none: <c>pending</c> (the background job hasn't got to it; activities wait two days),
    /// <c>unavailable</c> or <c>notApplicable</c> (indoor, virtual, manual).
    /// </summary>
    [HttpGet]
    public async Task<ActionResult<WeatherReport>> Get(long id, CancellationToken ct) =>
        await weather.GetAsync(User.GetAthleteId(), id, ct) is { } report
            ? report
            : Problem("This activity isn't synced yet.", statusCode: StatusCodes.Status404NotFound);
}
