using Straapp.Application.Abstractions;
using Straapp.Application.GearStats;
using Straapp.Application.Heatmap;
using Straapp.Domain.Activities;
using Straapp.Domain.Athletes;

namespace Straapp.UnitTests.Heatmap;

public class HeatmapServiceTests
{
    private readonly FakeActivityRepository _activities = new();
    private readonly FakeAthleteRepository _athletes = new();

    private void AddRoute(long id, string? gearId, string? sportType = "Ride", string? type = null) =>
        _activities.Routes.Add(new ActivityRoute(id, $"Route {id}", sportType, type, new DateOnly(2026, 5, 1), 1000, gearId, "abc"));

    private HeatmapService Service => new(_activities, _athletes);

    [Fact]
    public async Task The_last_day_is_included()
    {
        await Service.GetReportAsync(1, new DateOnly(2026, 1, 1), new DateOnly(2026, 1, 31));

        Assert.Equal((new DateOnly(2026, 1, 1), new DateOnly(2026, 2, 1)), _activities.RoutesRange);
    }

    [Fact]
    public async Task Open_ranges_stay_open()
    {
        await Service.GetReportAsync(1, null, null);

        Assert.Equal((null, null), _activities.RoutesRange);
    }

    [Fact]
    public async Task Routes_keep_their_sport_and_drop_empty_gear()
    {
        AddRoute(1, "", sportType: null, type: "Hike");
        AddRoute(2, null, sportType: null, type: null);

        var routes = (await Service.GetReportAsync(1, null, null)).Routes;

        Assert.Equal("Hike", routes[0].SportType);
        Assert.Equal(SportGroup.Walk, routes[0].Sport);
        Assert.Null(routes[0].GearId);
        Assert.Equal("Other", routes[1].SportType);
        Assert.Equal(SportGroup.Other, routes[1].Sport);
    }

    [Fact]
    public async Task Gear_is_listed_most_used_first()
    {
        _athletes.Gear.Add(new Gear { Id = "b2", Name = "Gravel", Kind = GearKind.Bike, Retired = true });
        AddRoute(1, "b1");
        AddRoute(2, "b2");
        AddRoute(3, "b2");
        AddRoute(4, null);

        var gear = (await Service.GetReportAsync(1, null, null)).Gear;

        Assert.Equal(
            [new GearLabel("b2", "Gravel", GearKind.Bike, true), new GearLabel("b1", "Gear b1", GearKind.Bike, false)],
            gear);
    }
}
