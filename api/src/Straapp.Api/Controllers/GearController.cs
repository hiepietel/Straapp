using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Straapp.Application.GearStats;

namespace Straapp.Api.Controllers;

/// <summary>The athlete's bikes and shoes with their usage, from the stored data only.</summary>
[ApiController]
[Authorize]
[Route("api/gear")]
public sealed class GearController(GearService gear, TimeProvider time) : ControllerBase
{
    /// <summary>
    /// Every item with its totals, records, sport and year breakdowns, plus per-month totals and running
    /// totals over time for the charts. Every measure is included.
    /// </summary>
    /// <param name="today">The viewer's local date, so the month axis ends on their current month.</param>
    [HttpGet]
    public Task<GearReport> Get(DateOnly? today, CancellationToken ct) =>
        gear.GetReportAsync(User.GetAthleteId(), today ?? DateOnly.FromDateTime(time.GetLocalNow().DateTime), ct);
}
