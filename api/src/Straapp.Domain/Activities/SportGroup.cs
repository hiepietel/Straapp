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
        ["VirtualRide"] = SportGroup.Ride,
        ["Walk"] = SportGroup.Walk,
        ["Hike"] = SportGroup.Walk,
        ["Swim"] = SportGroup.Swim,
    };

    /// <summary>Uses the legacy type when an older activity has no sport type.</summary>
    public static SportGroup Of(string? sportType, string? type) =>
        ByType.GetValueOrDefault(sportType ?? type ?? "", SportGroup.Other);
}
