using Straapp.Application.Abstractions;
using Straapp.Application.Statistics;

namespace Straapp.Application.Calendar;

/// <summary>Daily activity history for the requested local calendar date range.</summary>
public sealed class CalendarService(IActivityRepository activities)
{
    public async Task<CalendarReport> GetReportAsync(
        long athleteId, DateOnly from, DateOnly to, CancellationToken ct = default)
    {
        if (to <= from) throw new ArgumentOutOfRangeException(nameof(to), "The end date must be after the start date.");

        var usage = await activities.GetUsageAsync(athleteId, ct, from, to);
        var days = usage
            .GroupBy(activity => activity.Date)
            .OrderBy(day => day.Key)
            .Select(day => new CalendarDay(
                day.Key,
                day.Aggregate(Totals.Zero, (sum, activity) => sum + new Totals(1, activity.Distance, activity.MovingTime, activity.Elevation)),
                day.OrderBy(activity => activity.Id)
                    .Select(activity => new CalendarActivity(
                        activity.Id,
                        activity.Name,
                        activity.SportType ?? activity.Type ?? "Other",
                        activity.Distance,
                        activity.MovingTime,
                        activity.Elevation))
                    .ToList()))
            .ToList();

        return new CalendarReport(from, to, days);
    }
}