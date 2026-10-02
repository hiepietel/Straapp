using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Straapp.Application.Calendar;

namespace Straapp.Api.Controllers;

/// <summary>Activity history grouped by local calendar day.</summary>
[ApiController]
[Authorize]
[Route("api/calendar")]
public sealed class CalendarController(CalendarService calendar) : ControllerBase
{
    /// <summary>Returns daily totals and the activities in the requested range; the end is exclusive.</summary>
    [HttpGet]
    public Task<CalendarReport> Get(DateOnly from, DateOnly to, CancellationToken ct) =>
        calendar.GetReportAsync(User.GetAthleteId(), from, to, ct);
}