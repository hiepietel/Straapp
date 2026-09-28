using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Straapp.Application.Statistics;
using Straapp.Domain.Activities;

namespace Straapp.Api.Controllers;

/// <summary>Ready-made totals for the statistics page, computed from the stored activities only.</summary>
[ApiController]
[Authorize]
[Route("api/statistics")]
public sealed class StatisticsController(StatisticsService statistics, TimeProvider time) : ControllerBase
{
    private const int FirstYear = 2009;

    /// <summary>
    /// Week, month and year so far against the previous ones; month-by-month and week-by-week totals of
    /// <paramref name="year"/> against <paramref name="compareYear"/> and against the period before; and
    /// every year's total. Every measure is included.
    /// </summary>
    /// <param name="year">Defaults to the year of <paramref name="today"/>.</param>
    /// <param name="compareYear">Any earlier year; defaults to the year before <paramref name="year"/>.</param>
    /// <param name="sport">Leave out for all sports.</param>
    /// <param name="today">The viewer's local date, so "this week" matches their calendar. Defaults to the server's.</param>
    [HttpGet]
    public async Task<ActionResult<StatisticsReport>> Get(
        int? year, int? compareYear, SportGroup? sport, DateOnly? today, CancellationToken ct)
    {
        var day = today ?? DateOnly.FromDateTime(time.GetLocalNow().DateTime);
        var chosenYear = year ?? day.Year;
        var comparedYear = compareYear ?? chosenYear - 1;

        if (chosenYear < FirstYear || chosenYear > day.Year)
        {
            return Problem($"Pick a year between {FirstYear} and {day.Year}.", statusCode: StatusCodes.Status400BadRequest);
        }
        if (comparedYear < FirstYear - 1 || comparedYear >= chosenYear)
        {
            return Problem($"compareYear must be before {chosenYear}.", statusCode: StatusCodes.Status400BadRequest);
        }

        return await statistics.GetReportAsync(User.GetAthleteId(), chosenYear, comparedYear, sport, day, ct);
    }
}
