using Straapp.Application.Abstractions;
using Straapp.Application.Statistics;

namespace Straapp.UnitTests.Statistics;

public class StatisticsServiceTests
{
    private const long AthleteId = 1;

    private readonly FakeActivityRepository _activities = new();

    private void Add(string day, double distance, string? sportType = "Run", string? type = null) =>
        _activities.DailyTotals.Add(new DailyTotals(DateOnly.Parse(day), sportType, type, 1, distance, 600, 10));

    private Task<StatisticsReport> ReportAsync(string today, int? year = null, int[]? compare = null, string[]? sports = null)
    {
        var day = DateOnly.Parse(today);
        return new StatisticsService(_activities).GetReportAsync(AthleteId, year ?? day.Year, compare ?? [], sports ?? [], day);
    }

    [Fact]
    public async Task Week_so_far_is_compared_with_the_same_days_of_last_week()
    {
        // 2026-09-30 is a Wednesday.
        Add("2026-09-28", 5000);  // this Monday
        Add("2026-09-30", 1000);  // today
        Add("2026-09-21", 3000);  // last Monday
        Add("2026-09-24", 10000); // last Thursday: after "the same day" last week

        var week = (await ReportAsync("2026-09-30")).ToDate.Single(p => p.Period == ComparisonPeriod.Week);

        Assert.Equal(new DateOnly(2026, 9, 28), week.Start);
        Assert.Equal(new DateOnly(2026, 10, 1), week.End);
        Assert.Equal(6000, week.Current.Distance);
        Assert.Equal(new DateOnly(2026, 9, 21), week.PreviousStart);
        Assert.Equal(new DateOnly(2026, 9, 24), week.PreviousEnd);
        Assert.Equal(3000, week.Previous.Distance);
    }

    [Fact]
    public async Task The_31st_compares_with_the_whole_of_a_shorter_previous_month()
    {
        Add("2026-02-28", 4000);
        Add("2026-03-01", 2000);

        var month = (await ReportAsync("2026-03-31")).ToDate.Single(p => p.Period == ComparisonPeriod.Month);

        Assert.Equal(new DateOnly(2026, 2, 1), month.PreviousStart);
        Assert.Equal(new DateOnly(2026, 3, 1), month.PreviousEnd);
        Assert.Equal(4000, month.Previous.Distance);
        Assert.Equal(2000, month.Current.Distance);
    }

    [Fact]
    public async Task Leap_day_compares_with_28_February_of_the_year_before()
    {
        Add("2023-02-28", 1000);
        Add("2023-03-01", 9000);

        var year = (await ReportAsync("2024-02-29")).ToDate.Single(p => p.Period == ComparisonPeriod.Year);

        Assert.Equal(new DateOnly(2023, 1, 1), year.PreviousStart);
        Assert.Equal(new DateOnly(2023, 3, 1), year.PreviousEnd);
        Assert.Equal(1000, year.Previous.Distance);
    }

    [Fact]
    public async Task Sport_filter_counts_only_those_types_but_lists_every_type_present()
    {
        Add("2026-05-01", 5000, "Run");
        Add("2026-05-01", 30000, "Ride");
        // An older activity with only the legacy type.
        Add("2026-05-02", 2000, sportType: null, type: "Run");

        var report = await ReportAsync("2026-09-30", sports: ["Run"]);

        Assert.Equal(["Ride", "Run"], report.AvailableSportTypes);
        Assert.Equal(["Run"], report.SportTypes);
        Assert.Equal(7000, report.Months[4].Current!.Distance);
    }

    [Fact]
    public async Task Months_that_have_not_started_have_no_totals_and_each_compared_year_is_listed()
    {
        Add("2025-10-10", 1500);
        Add("2024-10-10", 2500);
        Add("2026-08-31", 800);

        var report = await ReportAsync("2026-09-30", compare: [2025, 2024]);

        Assert.Equal(12, report.Months.Count);
        Assert.NotNull(report.Months[8].Current);   // September
        Assert.Null(report.Months[9].Current);      // October hasn't started
        Assert.Equal([1500, 2500], report.Months[9].Compared.Select(t => t.Distance));
        Assert.Equal(800, report.Months[8].PreviousMonth.Distance);
    }

    [Fact]
    public async Task Week_53_has_no_comparison_in_a_year_with_52_weeks()
    {
        // 2026 has 53 ISO weeks, 2025 has 52.
        var report = await ReportAsync("2026-09-30", compare: [2025]);

        Assert.Equal(53, report.Weeks.Count);
        Assert.NotNull(report.Weeks[51].Compared[0]);
        Assert.Null(report.Weeks[52].Compared[0]);
        // Today is in week 40: later weeks haven't started.
        Assert.NotNull(report.Weeks[39].Current);
        Assert.Null(report.Weeks[40].Current);
    }

    [Fact]
    public async Task Years_run_from_the_first_activity_to_now_with_year_to_date_totals()
    {
        Add("2024-03-01", 1000);
        Add("2024-11-01", 5000);
        Add("2026-01-15", 2000);

        var report = await ReportAsync("2026-09-30");

        Assert.Equal([2026, 2024], report.AvailableYears);
        Assert.Equal([2024, 2025, 2026], report.Years.Select(y => y.Year));
        var y2024 = report.Years[0];
        Assert.Equal(6000, y2024.Total.Distance);
        Assert.Equal(1000, y2024.ToDate.Distance);
        Assert.Equal(0, report.Years[1].Total.Count);
    }

    [Fact]
    public async Task With_no_activities_the_current_year_is_still_available()
    {
        var report = await ReportAsync("2026-09-30");

        Assert.Equal([2026], report.AvailableYears);
        Assert.Empty(report.AvailableSportTypes);
        Assert.All(report.ToDate, p => Assert.Equal(Totals.Zero, p.Current));
    }
}
