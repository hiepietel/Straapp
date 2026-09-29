namespace Straapp.Domain.Activities;

/// <summary>The broad families the app groups Strava's many sport types into.</summary>
public enum SportGroup
{
    Run,
    Ride,
    Walk,
    Swim,
    Other,
}

public static class SportGroups
{
    private static readonly Dictionary<string, SportGroup> ByType = new(StringComparer.Ordinal)
    {
        ["Run"] = SportGroup.Run,
        ["TrailRun"] = SportGroup.Run,
        ["VirtualRun"] = SportGroup.Run,
        ["Ride"] = SportGroup.Ride,
        ["GravelRide"] = SportGroup.Ride,
        ["MountainBikeRide"] = SportGroup.Ride,
        ["EBikeRide"] = SportGroup.Ride,
        ["EMountainBikeRide"] = SportGroup.Ride,
        ["VirtualRide"] = SportGroup.Ride,
        ["Velomobile"] = SportGroup.Ride,
        ["Handcycle"] = SportGroup.Ride,
        ["Walk"] = SportGroup.Walk,
        ["Hike"] = SportGroup.Walk,
        ["Swim"] = SportGroup.Swim,
    };

    /// <summary>The activity's sport type, or its legacy type for older activities without one.</summary>
    public static string TypeOf(string? sportType, string? type) => sportType ?? type ?? "Other";

    /// <summary>Uses the legacy type when an older activity has no sport type.</summary>
    public static SportGroup Of(string? sportType, string? type) =>
        ByType.GetValueOrDefault(sportType ?? type ?? "", SportGroup.Other);
}
