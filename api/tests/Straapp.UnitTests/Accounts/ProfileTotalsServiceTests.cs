using Straapp.Application.Abstractions;
using Straapp.Application.Accounts;
using Straapp.Domain.Activities;

namespace Straapp.UnitTests.Accounts;

public class ProfileTotalsServiceTests
{
    private static readonly DateOnly Today = new(2026, 9, 30);

    private readonly FakeActivityRepository _activities = new();

    private void Add(long id, string date, double distance, string sportType = "Run", int movingTime = 600, double elevation = 0, bool isPrivate = false) =>
        _activities.Usage.Add(new ActivityUsage(id, $"Activity {id}", null, null, sportType, null, DateOnly.Parse(date), distance, movingTime, elevation, isPrivate));

    private Task<ProfileTotals> TotalsAsync() => new ProfileTotalsService(_activities).GetAsync(1, Today);

    private static PeriodTotals Period(VisibilityTotals totals, TotalsPeriod period) => totals.Periods.Single(p => p.Period == period);

    [Fact]
    public async Task Recent_covers_the_last_four_weeks_including_today()
    {
        Add(1, "2026-09-03", 1000); // 27 days ago: in
        Add(2, "2026-09-02", 2000); // 28 days ago: out
        Add(3, "2026-09-30", 4000);

        var recent = Period((await TotalsAsync()).All, TotalsPeriod.Recent);

        Assert.Equal(new DateOnly(2026, 9, 3), recent.From);
        Assert.Equal(2, recent.All.Count);
        Assert.Equal(5000, recent.All.Distance);
    }

    [Fact]
    public async Task Periods_ignore_activities_dated_after_today()
    {
        Add(1, "2026-10-01", 1000);
        Add(2, "2025-12-31", 2000);
        Add(3, "2026-01-01", 3000);

        var totals = (await TotalsAsync()).All;

        Assert.Equal(3000, Period(totals, TotalsPeriod.Year).All.Distance);
        Assert.Null(Period(totals, TotalsPeriod.AllTime).From);
        Assert.Equal(5000, Period(totals, TotalsPeriod.AllTime).All.Distance);
    }

    [Fact]
    public async Task Totals_are_split_by_visibility()
    {
        Add(1, "2026-09-01", 1000);
        Add(2, "2026-09-01", 2000, isPrivate: true);

        var totals = await TotalsAsync();

        Assert.Equal(3000, Period(totals.All, TotalsPeriod.AllTime).All.Distance);
        Assert.Equal(1000, Period(totals.Public, TotalsPeriod.AllTime).All.Distance);
        Assert.Equal(2000, Period(totals.Private, TotalsPeriod.AllTime).All.Distance);
    }

    [Fact]
    public async Task Sports_are_grouped_and_ordered_by_distance()
    {
        Add(1, "2026-09-01", 5000, "Run");
        Add(2, "2026-09-01", 3000, "TrailRun");
        Add(3, "2026-09-01", 40000, "GravelRide");
        Add(4, "2026-09-01", 0, "Yoga");

        var sports = Period((await TotalsAsync()).All, TotalsPeriod.AllTime).Sports;

        Assert.Equal([SportGroup.Ride, SportGroup.Run, SportGroup.Other], sports.Select(s => s.Sport));
        Assert.Equal(8000, sports[1].Totals.Distance);
        Assert.Equal(2, sports[1].Totals.Count);
    }

    [Fact]
    public async Task Records_point_at_the_biggest_activities_and_skip_zeros()
    {
        Add(1, "2026-09-01", 10000, movingTime: 3600, elevation: 50);
        Add(2, "2026-09-02", 42195, movingTime: 12000, elevation: 20);
        Add(3, "2026-09-03", 0, "Yoga", movingTime: 0, elevation: 900);

        var totals = (await TotalsAsync()).All;

        Assert.Equal(2, totals.Longest?.Id);
        Assert.Equal(3, totals.BiggestClimb?.Id);
        Assert.Equal(2, totals.LongestTime?.Id);
    }

    [Fact]
    public async Task No_activities_means_no_records()
    {
        var totals = (await TotalsAsync()).Private;

        Assert.Null(totals.Longest);
        Assert.Null(totals.BiggestClimb);
        Assert.Null(totals.LongestTime);
        Assert.All(totals.Periods, p => Assert.Empty(p.Sports));
    }
}
