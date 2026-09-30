using Straapp.Domain.Activities;

namespace Straapp.UnitTests.Domain;

public class SportGroupsTests
{
    [Theory]
    [InlineData("TrailRun", null, SportGroup.Run)]
    [InlineData("MountainBikeRide", "Ride", SportGroup.Ride)]
    [InlineData("VirtualRide", null, SportGroup.Ride)]
    [InlineData("Hike", null, SportGroup.Walk)]
    [InlineData("Swim", null, SportGroup.Swim)]
    [InlineData("Yoga", null, SportGroup.Other)]
    [InlineData(null, "Run", SportGroup.Run)]
    [InlineData(null, null, SportGroup.Other)]
    [InlineData("run", null, SportGroup.Other)] // Strava's names are case-sensitive
    public void Groups_sport_types(string? sportType, string? type, SportGroup expected)
    {
        Assert.Equal(expected, SportGroups.Of(sportType, type));
    }

    [Theory]
    [InlineData("GravelRide", "Ride", "GravelRide")]
    [InlineData(null, "Ride", "Ride")]
    [InlineData(null, null, "Other")]
    public void Type_falls_back_to_the_legacy_type(string? sportType, string? type, string expected)
    {
        Assert.Equal(expected, SportGroups.TypeOf(sportType, type));
    }
}
