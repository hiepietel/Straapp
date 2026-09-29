using System.Globalization;
using Straapp.Application.Abstractions;
using Straapp.Domain.Activities;

namespace Straapp.Application.Statistics;

/// <summary>
/// Period totals for the statistics page, built only from the stored activities (Strava is never asked).
/// All dates are the athlete's local calendar days (where each activity happened), so
/// "Monday" and "March" mean what they meant on the day.
/// </summary>
public sealed class StatisticsService(IActivityRepository activities)
{
    /// <summary>Strava started in 2009; nothing can be older.</summary>
    private static readonly DateOnly HistoryStart = new(2009, 1, 1);

    public async Task<StatisticsReport> GetReportAsync(
        long athleteId, int year, IReadOnlyList<int> compareYears, SportGroup? sport, DateOnly today, CancellationToken ct = default)
    {
        // The whole history is only one row per day and sport type, so take all of it: any year can
        // then be compared with any other without working out which days each comparison needs.
        var to = Max(IsoWeekStart(year + 1, 1), today.AddDays(1));
        var days = await activities.GetDailyTotalsAsync(athleteId, HistoryStart, to, ct);

        var sports = days.Select(d => SportGroups.Of(d.SportType, d.Type)).Distinct().Order().ToList();
        var availableYears = days.Select(d => d.Day.Year).Append(today.Year).Distinct().OrderDescending().ToList();

        var totalsByDay = days
            .Where(d => sport is null || SportGroups.Of(d.SportType, d.Type) == sport)
            .GroupBy(d => d.Day)
            .ToDictionary(g => g.Key, g => g.Aggregate(Totals.Zero, (sum, d) => sum + new Totals(d.Count, d.Distance, d.MovingTime, d.Elevation)));

        // Sum over local days in [start, end).
        Totals Between(DateOnly start, DateOnly end) => totalsByDay
            .Where(kv => kv.Key >= start && kv.Key < end)
            .Aggregate(Totals.Zero, (sum, kv) => sum + kv.Value);

        return new StatisticsReport(
            year, compareYears, sport, today, sports, availableYears,
            ToDate(today, Between),
            Months(year, compareYears, today, Between),
            Weeks(year, compareYears, today, Between),
            Years(availableYears.Min(), today, Between));
    }

    /// <summary>
    /// This week, month and year so far, each against the previous one up to the same day
    /// (Monday–Wednesday vs last Monday–Wednesday), so a half-finished period isn't compared
    /// with a whole one. Whole days, so today counts whatever time it is.
    /// </summary>
    private static List<PeriodComparison> ToDate(DateOnly today, Func<DateOnly, DateOnly, Totals> between)
    {
        var end = today.AddDays(1);

        var week = StartOfWeek(today);
        var lastWeek = week.AddDays(-7);

        var month = new DateOnly(today.Year, today.Month, 1);
        var lastMonth = month.AddMonths(-1);
        // The 31st compares with the end of a 30-day month, not with a day that doesn't exist.
        var lastMonthEnd = Min(lastMonth.AddDays(end.DayNumber - month.DayNumber), month);

        var yearStart = new DateOnly(today.Year, 1, 1);

        PeriodComparison Compare(ComparisonPeriod period, DateOnly start, DateOnly previousStart, DateOnly previousEnd) =>
            new(period, start, end, between(start, end), previousStart, previousEnd, between(previousStart, previousEnd));

        return
        [
            Compare(ComparisonPeriod.Week, week, lastWeek, lastWeek.AddDays(end.DayNumber - week.DayNumber)),
            Compare(ComparisonPeriod.Month, month, lastMonth, lastMonthEnd),
            Compare(ComparisonPeriod.Year, yearStart, yearStart.AddYears(-1), SameDateIn(today.Year - 1, today).AddDays(1)),
        ];
    }

    private static List<MonthTotals> Months(int year, IReadOnlyList<int> compareYears, DateOnly today, Func<DateOnly, DateOnly, Totals> between)
    {
        var monthsSoFar = year == today.Year ? today.Month : 12;

        Totals Month(DateOnly start) => between(start, start.AddMonths(1));

        return Enumerable.Range(1, 12).Select(m =>
        {
            var start = new DateOnly(year, m, 1);
            return new MonthTotals(
                m,
                m <= monthsSoFar ? Month(start) : null,
                compareYears.Select(y => Month(new DateOnly(y, m, 1))).ToList(),
                Month(start.AddMonths(-1)));
        }).ToList();
    }

    private static List<WeekTotals> Weeks(int year, IReadOnlyList<int> compareYears, DateOnly today, Func<DateOnly, DateOnly, Totals> between)
    {
        var todayWeekYear = ISOWeek.GetYear(today.ToDateTime(TimeOnly.MinValue));
        var todayWeek = ISOWeek.GetWeekOfYear(today.ToDateTime(TimeOnly.MinValue));
        var count = ISOWeek.GetWeeksInYear(year);
        var lastStarted = todayWeekYear == year ? todayWeek : count;

        Totals Week(DateOnly start) => between(start, start.AddDays(7));

        return Enumerable.Range(1, count).Select(w =>
        {
            var start = IsoWeekStart(year, w);
            return new WeekTotals(
                w,
                start,
                w <= lastStarted ? Week(start) : null,
                compareYears.Select(y => w <= ISOWeek.GetWeeksInYear(y) ? Week(IsoWeekStart(y, w)) : null).ToList(),
                Week(start.AddDays(-7)));
        }).ToList();
    }

    private static List<YearTotals> Years(int firstYear, DateOnly today, Func<DateOnly, DateOnly, Totals> between) =>
        Enumerable.Range(firstYear, today.Year - firstYear + 1).Select(y =>
        {
            var start = new DateOnly(y, 1, 1);
            return new YearTotals(y, between(start, start.AddYears(1)), between(start, SameDateIn(y, today).AddDays(1)));
        }).ToList();

    /// <summary>Today's month and day in <paramref name="year"/>; 29 February becomes the 28th in other years.</summary>
    private static DateOnly SameDateIn(int year, DateOnly today) =>
        new(year, today.Month, Math.Min(today.Day, DateTime.DaysInMonth(year, today.Month)));

    private static DateOnly IsoWeekStart(int year, int week) =>
        DateOnly.FromDateTime(ISOWeek.ToDateTime(year, week, DayOfWeek.Monday));

    private static DateOnly StartOfWeek(DateOnly day) => day.AddDays(-(((int)day.DayOfWeek + 6) % 7));

    private static DateOnly Min(DateOnly a, DateOnly b) => a < b ? a : b;

    private static DateOnly Max(DateOnly a, DateOnly b) => a > b ? a : b;
}
