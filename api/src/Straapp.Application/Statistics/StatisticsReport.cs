using Straapp.Domain.Activities;

namespace Straapp.Application.Statistics;

/// <summary>Every measure the statistics page can switch between, so switching needs no new request.</summary>
public sealed record Totals(int Count, double Distance, long MovingTime, double Elevation)
{
    public static readonly Totals Zero = new(0, 0, 0, 0);

    public static Totals operator +(Totals a, Totals b) =>
        new(a.Count + b.Count, a.Distance + b.Distance, a.MovingTime + b.MovingTime, a.Elevation + b.Elevation);
}

public enum ComparisonPeriod
{
    Week,
    Month,
    Year,
}

/// <summary>
/// A period so far (Monday to today, say) against the previous period up to the same day.
/// Dates are local calendar days; ends are exclusive.
/// </summary>
public sealed record PeriodComparison(
    ComparisonPeriod Period,
    DateOnly Start,
    DateOnly End,
    Totals Current,
    DateOnly PreviousStart,
    DateOnly PreviousEnd,
    Totals Previous);

/// <summary>A calendar month of the chosen year.</summary>
/// <param name="Current">Null for months that haven't started yet.</param>
/// <param name="Compared">The same month of the year being compared with.</param>
/// <param name="PreviousMonth">The month before; for January, December of the year before.</param>
public sealed record MonthTotals(int Month, Totals? Current, Totals Compared, Totals PreviousMonth);

/// <summary>An ISO week (Monday start) of the chosen year.</summary>
/// <param name="Current">Null for weeks that haven't started yet.</param>
/// <param name="Compared">The week with the same number in the year being compared with; null if it has none (week 53).</param>
/// <param name="PreviousWeek">The week before; for week 1, the last week of the year before.</param>
public sealed record WeekTotals(int Week, DateOnly Start, Totals? Current, Totals? Compared, Totals PreviousWeek);

/// <summary>One calendar year.</summary>
/// <param name="Total">The whole year (so far, for the current one).</param>
/// <param name="ToDate">1 January up to today's date in that year, for comparing a year in progress fairly.</param>
public sealed record YearTotals(int Year, Totals Total, Totals ToDate);

/// <param name="Sport">Null means all sports.</param>
/// <param name="CompareYear">The year the months and weeks are compared with.</param>
/// <param name="Sports">The sports with any stored activity, for the filter.</param>
/// <param name="AvailableYears">Years with any stored activity, newest first, plus the current year.</param>
/// <param name="ToDate">This week, month and year so far; always relative to <paramref name="Today"/>.</param>
/// <param name="Years">Every year from the first stored activity to now, oldest first.</param>
public sealed record StatisticsReport(
    int Year,
    int CompareYear,
    SportGroup? Sport,
    DateOnly Today,
    IReadOnlyList<SportGroup> Sports,
    IReadOnlyList<int> AvailableYears,
    IReadOnlyList<PeriodComparison> ToDate,
    IReadOnlyList<MonthTotals> Months,
    IReadOnlyList<WeekTotals> Weeks,
    IReadOnlyList<YearTotals> Years);
