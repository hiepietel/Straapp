using Straapp.Application.Calendar;

namespace Straapp.UnitTests.Calendar;

public class CalendarServiceTests
{
    [Fact]
    public async Task Groups_daily_totals_and_activity_history_inside_the_requested_range()
    {
        var activities = new FakeActivityRepository();
        activities.Usage.AddRange(
        [
            new(1, "Morning run", "Watch", null, "Run", null, new DateOnly(2026, 9, 2), 5000, 1800, 40, false),
            new(2, "Evening run", "Watch", null, "Run", null, new DateOnly(2026, 9, 2), 3000, 1200, 20, false),
            new(3, "Outside range", "Watch", null, "Run", null, new DateOnly(2026, 9, 4), 10000, 3600, 100, false),
        ]);

        var report = await new CalendarService(activities).GetReportAsync(
            1, new DateOnly(2026, 9, 1), new DateOnly(2026, 9, 4));

        var day = Assert.Single(report.Days);
        Assert.Equal(new DateOnly(2026, 9, 2), day.Date);
        Assert.Equal(new(2, 8000, 3000, 60), day.Totals);
        Assert.Equal(["Morning run", "Evening run"], day.Activities.Select(activity => activity.Name));
        Assert.Equal("Run", day.Activities[0].SportType);
        Assert.Equal(new DateOnly(2026, 9, 1), report.From);
        Assert.Equal(new DateOnly(2026, 9, 4), report.To);
    }

    [Fact]
    public async Task Rejects_empty_or_reversed_date_ranges()
    {
        var service = new CalendarService(new FakeActivityRepository());

        await Assert.ThrowsAsync<ArgumentOutOfRangeException>(() =>
            service.GetReportAsync(1, new DateOnly(2026, 9, 4), new DateOnly(2026, 9, 4)));
        await Assert.ThrowsAsync<ArgumentOutOfRangeException>(() =>
            service.GetReportAsync(1, new DateOnly(2026, 9, 5), new DateOnly(2026, 9, 4)));
    }
}