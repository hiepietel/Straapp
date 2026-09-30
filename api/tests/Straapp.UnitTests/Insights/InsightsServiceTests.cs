using Straapp.Application.Abstractions;
using Straapp.Application.Insights;
using Straapp.Domain.Activities;
using Straapp.Domain.Athletes;

namespace Straapp.UnitTests.Insights;

public class InsightsServiceTests
{
    private readonly FakeActivityRepository _activities = new();
    private readonly FakeWeatherRepository _weather = new();
    private readonly FakeAthleteRepository _athletes = new();

    private static readonly DateTimeOffset Start = new(2026, 6, 1, 10, 7, 0, TimeSpan.Zero);

    private void AddActivity(long id, double distance = 1000, string? gearId = null, string? sportType = "Ride", string? type = null) =>
        _activities.Facts.Add(new ActivityFacts(
            id, $"Activity {id}", sportType, type, Start.DateTime, Start, distance, 2400, 2400, 0, 5, null, null,
            gearId, false, false, false));

    private void AddSample(long id, int hour, int minute, double? temperature, double? precipitation = null, double? gusts = null, int? code = null) =>
        _weather.Samples.Add(new ActivityWeatherSample(
            id, Start, 2400, new DateTimeOffset(2026, 6, 1, hour, minute, 0, TimeSpan.Zero),
            temperature, temperature, precipitation, 10, gusts, code));

    private Task<InsightsReport> ReportAsync() => new InsightsService(_activities, _weather, _athletes).GetReportAsync(1);

    [Fact]
    public async Task Weather_covers_the_activity_rounded_out_to_the_quarter_hour()
    {
        // 10:07 for 40 minutes: 10:00 to 11:00 counts.
        AddActivity(1);
        AddSample(1, 9, 45, 100);
        AddSample(1, 10, 0, 10, precipitation: 0.5, gusts: 20, code: 3);
        AddSample(1, 10, 30, 14, precipitation: 1.0, gusts: 35, code: 61);
        AddSample(1, 11, 0, null, precipitation: null, gusts: 25, code: 2);
        AddSample(1, 11, 15, 100, precipitation: 9);

        var weather = (await ReportAsync()).Activities.Single().Weather;

        Assert.NotNull(weather);
        Assert.Equal(12, weather.Temperature); // the missing reading isn't counted as zero
        Assert.Equal(1.5, weather.Precipitation);
        Assert.Equal(35, weather.WindGusts);
        Assert.Equal(61, weather.WeatherCode);
    }

    [Fact]
    public async Task No_weather_without_samples_during_the_activity()
    {
        AddActivity(1);
        AddActivity(2);
        AddSample(2, 8, 0, 15);

        var activities = (await ReportAsync()).Activities;

        Assert.All(activities, a => Assert.Null(a.Weather));
    }

    [Fact]
    public async Task Rows_use_the_legacy_type_and_drop_empty_gear()
    {
        AddActivity(1, gearId: "", sportType: null, type: "Run");

        var row = (await ReportAsync()).Activities.Single();

        Assert.Equal("Run", row.SportType);
        Assert.Equal(SportGroup.Run, row.Sport);
        Assert.Null(row.GearId);
    }

    [Fact]
    public async Task Gear_is_listed_by_distance_and_named_like_the_gear_page()
    {
        _athletes.Gear.Add(new Gear { Id = "b1", Name = "  Road bike  ", Kind = GearKind.Bike });
        AddActivity(1, distance: 1000, gearId: "b1");
        AddActivity(2, distance: 1000, gearId: "b1");
        AddActivity(3, distance: 5000, gearId: "g7");

        var gear = (await ReportAsync()).Gear;

        Assert.Equal(["g7", "b1"], gear.Select(g => g.Id));
        Assert.Equal("Gear g7", gear[0].Name);
        Assert.Equal(GearKind.Shoes, gear[0].Kind);
        Assert.Equal("Road bike", gear[1].Name);
    }
}
