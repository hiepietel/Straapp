using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Straapp.Application.Heatmap;

namespace Straapp.Api.Controllers;

/// <summary>Every route for the heatmap page, from the stored activities only.</summary>
[ApiController]
[Authorize]
[Route("api/heatmap")]
public sealed class HeatmapController(HeatmapService heatmap) : ControllerBase
{
    /// <summary>
    /// The routes of every activity that has one (indoor and manual activities don't), oldest first,
    /// with the gear they used. Leave out both dates for the whole history.
    /// </summary>
    /// <param name="from">First local day to include.</param>
    /// <param name="to">Last local day to include.</param>
    [HttpGet]
    public async Task<ActionResult<HeatmapReport>> Get(DateOnly? from, DateOnly? to, CancellationToken ct)
    {
        if (from > to)
        {
            return Problem("from must not be after to.", statusCode: StatusCodes.Status400BadRequest);
        }
        return await heatmap.GetReportAsync(User.GetAthleteId(), from, to, ct);
    }
}
