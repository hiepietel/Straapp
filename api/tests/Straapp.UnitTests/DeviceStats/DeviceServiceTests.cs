using Straapp.Application.DeviceStats;

namespace Straapp.UnitTests.DeviceStats;

public class DeviceServiceTests
{
    [Fact]
    public async Task Groups_device_usage_and_includes_unknown_devices_in_monthly_yearly_and_running_totals()
    {
        var activities = new FakeActivityRepository();
        activities.Usage.AddRange(
        [
            new(1, "Ride one", "Garmin Edge", "b1", "Ride", null, new DateOnly(2025, 1, 4), 12000, 3600, 100, false),
            new(2, "Ride two", " Garmin Edge ", "b1", "Ride", null, new DateOnly(2025, 1, 4), 8000, 2400, 50, false),
            new(3, "Ride three", null, null, "Ride", null, new DateOnly(2025, 2, 2), 5000, 1800, 25, false),
        ]);

        var report = await new DeviceService(activities).GetReportAsync(1, new DateOnly(2025, 3, 1));

        Assert.Equal(["Garmin Edge", "Unknown device"], report.Devices.Select(d => d.Name));
        Assert.Equal(new(2, 20000, 6000, 150), report.Devices[0].Totals);
        Assert.Equal(new(1, 5000, 1800, 25), report.Devices[1].Totals);
        Assert.Equal(new(2, 20000, 6000, 150), report.Months[0].Devices["Garmin Edge"]);
        Assert.Equal(new(1, 5000, 1800, 25), report.Months[1].Devices["Unknown device"]);
        Assert.Equal(new(2, 20000, 6000, 150), Assert.Single(report.Timelines[0].Points).Totals);
        Assert.Equal([2025], report.Devices[0].Years.Select(y => y.Year));
        Assert.Equal(new DateOnly(2025, 1, 4), report.HistoryFrom);
    }

    [Fact]
    public async Task Empty_history_has_no_devices_or_months()
    {
        var report = await new DeviceService(new FakeActivityRepository()).GetReportAsync(1, new DateOnly(2025, 3, 1));

        Assert.Empty(report.Devices);
        Assert.Empty(report.Months);
        Assert.Empty(report.Timelines);
        Assert.Null(report.HistoryFrom);
    }
}