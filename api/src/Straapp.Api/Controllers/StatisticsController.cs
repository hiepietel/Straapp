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
    /// <summary>Beyond this many the charts stop being readable.</summary>
    private const int MaxCompareYears = 10;

    /// <summary>
    /// Week, month and year so far against the previous ones; month-by-month and week-by-week totals of
    /// <paramref name="year"/> against each of <paramref name="compareYears"/> and against the period before;
    /// and every year's total. Every measure is included.
    /// </summary>
    /// <param name="year">Defaults to the year of <paramref name="today"/>.</param>
    /// <param name="compareYears">
    /// Earlier years to compare with, repeated (<c>compareYears=2025&amp;compareYears=2024</c>), up to 10;
    /// defaults to the year before <paramref name="year"/>.
    /// </param>
    /// <param name="sport">Leave out for all sports.</param>
    /// <param name="today">The viewer's local date, so "this week" matches their calendar. Defaults to the server's.</param>
    [HttpGet]
    public async Task<ActionResult<StatisticsReport>> Get(
        int? year, [FromQuery] int[]? compareYears, SportGroup? sport, DateOnly? today, CancellationToken ct)
    {
        var day = today ?? DateOnly.FromDateTime(time.GetLocalNow().DateTime);
        var chosenYear = year ?? day.Year;
        var compared = compareYears is { Length: > 0 }
            ? compareYears.Distinct().OrderDescending().ToList()
            : [chosenYear - 1];

        if (chosenYear < FirstYear || chosenYear > day.Year)
        {
            return Problem($"Pick a year between {FirstYear} and {day.Year}.", statusCode: StatusCodes.Status400BadRequest);
        }
        if (compared.Any(y => y < FirstYear - 1 || y >= chosenYear))
        {
            return Problem($"Every compareYears must be before {chosenYear}.", statusCode: StatusCodes.Status400BadRequest);
        }
        if (compared.Count > MaxCompareYears)
        {
            return Problem($"Compare with at most {MaxCompareYears} years.", statusCode: StatusCodes.Status400BadRequest);
        }

        return await statistics.GetReportAsync(User.GetAthleteId(), chosenYear, compared, sport, day, ct);
    }
}
