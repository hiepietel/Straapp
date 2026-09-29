using Straapp.Domain.Activities;

namespace Straapp.Application.Statistics;

/// <summary>Every measure the statistics page can switch between, so switching needs no new request.</summary>
public sealed record Totals(int Count, double Distance, long MovingTime, double Elevation)
{
    public static readonly Totals Zero = new(0, 0, 0, 0);

    public static Totals operator +(Totals a, Totals b) =>
        new(a.Count + b.Count, a.Distance + b.Distance, a.MovingTime + b.MovingTime, a.Elevation + b.Elevation);
}

/// <summary>An activity worth pointing at, such as the longest ride.</summary>
public sealed record ActivityRef(long Id, string Name, DateOnly Date, double Distance, int MovingTime, double Elevation);

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
/// <param name="Compared">The same month of each year being compared with, in the report's <c>CompareYears</c> order.</param>
/// <param name="PreviousMonth">The month before; for January, December of the year before.</param>
public sealed record MonthTotals(int Month, Totals? Current, IReadOnlyList<Totals> Compared, Totals PreviousMonth);

/// <summary>An ISO week (Monday start) of the chosen year.</summary>
/// <param name="Current">Null for weeks that haven't started yet.</param>
/// <param name="Compared">
/// The week with the same number in each year being compared with, in the report's <c>CompareYears</c> order;
/// null for a year that has no such week (week 53).
/// </param>
/// <param name="PreviousWeek">The week before; for week 1, the last week of the year before.</param>
public sealed record WeekTotals(int Week, DateOnly Start, Totals? Current, IReadOnlyList<Totals?> Compared, Totals PreviousWeek);

/// <summary>One calendar year.</summary>
/// <param name="Total">The whole year (so far, for the current one).</param>
/// <param name="ToDate">1 January up to today's date in that year, for comparing a year in progress fairly.</param>
public sealed record YearTotals(int Year, Totals Total, Totals ToDate);

/// <param name="SportTypes">The Strava sport types counted; empty means all of them.</param>
/// <param name="CompareYears">The years the months and weeks are compared with, newest first.</param>
/// <param name="AvailableSportTypes">The sport types with any stored activity, for the filter.</param>
/// <param name="AvailableYears">Years with any stored activity, newest first, plus the current year.</param>
/// <param name="ToDate">This week, month and year so far; always relative to <paramref name="Today"/>.</param>
/// <param name="Years">Every year from the first stored activity to now, oldest first.</param>
public sealed record StatisticsReport(
    int Year,
    IReadOnlyList<int> CompareYears,
    IReadOnlyList<string> SportTypes,
    DateOnly Today,
    IReadOnlyList<string> AvailableSportTypes,
    IReadOnlyList<int> AvailableYears,
    IReadOnlyList<PeriodComparison> ToDate,
    IReadOnlyList<MonthTotals> Months,
    IReadOnlyList<WeekTotals> Weeks,
    IReadOnlyList<YearTotals> Years);
