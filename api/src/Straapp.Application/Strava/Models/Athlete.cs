namespace Straapp.Application.Strava.Models;

/// <summary>Just the id, as embedded in other resources.</summary>
public record MetaAthlete
{
    public long Id { get; init; }
}

/// <summary>Another athlete as shown in kudos, comments and similar lists.</summary>
public record SummaryAthlete : MetaAthlete
{
    public int ResourceState { get; init; }
    public string? Firstname { get; init; }
    public string? Lastname { get; init; }
    public string? Profile { get; init; }
    public string? ProfileMedium { get; init; }
    public string? City { get; init; }
    public string? State { get; init; }
    public string? Country { get; init; }
    /// <summary>"M" or "F".</summary>
    public string? Sex { get; init; }
    public bool? Premium { get; init; }
    public bool? Summit { get; init; }
    public DateTimeOffset? CreatedAt { get; init; }
    public DateTimeOffset? UpdatedAt { get; init; }
}

/// <summary><c>GET /athlete</c>: the logged-in athlete.</summary>
public sealed record DetailedAthlete : SummaryAthlete
{
    public string? Username { get; init; }
    public string? Bio { get; init; }
    public int? BadgeTypeId { get; init; }
    /// <summary>Kilograms.</summary>
    public double? Weight { get; init; }
    public int? FollowerCount { get; init; }
    public int? FriendCount { get; init; }
    public int? MutualFriendCount { get; init; }
    public int? AthleteType { get; init; }
    public string? DatePreference { get; init; }
    /// <summary>"feet" or "meters".</summary>
    public string? MeasurementPreference { get; init; }
    /// <summary>Functional threshold power, watts.</summary>
    public int? Ftp { get; init; }
    public IReadOnlyList<SummaryClub>? Clubs { get; init; }
    public IReadOnlyList<SummaryGear>? Bikes { get; init; }
    public IReadOnlyList<SummaryGear>? Shoes { get; init; }
}

/// <summary>One band of a zone set; <see cref="Max"/> is -1 for the open-ended top zone.</summary>
public sealed record ZoneRange
{
    public int Min { get; init; }
    public int Max { get; init; }
}

public sealed record HeartRateZoneRanges
{
    public bool CustomZones { get; init; }
    public IReadOnlyList<ZoneRange> Zones { get; init; } = [];
}

public sealed record PowerZoneRanges
{
    public IReadOnlyList<ZoneRange> Zones { get; init; } = [];
}

/// <summary><c>GET /athlete/zones</c>. Needs the <c>profile:read_all</c> scope.</summary>
public sealed record AthleteZones
{
    public HeartRateZoneRanges? HeartRate { get; init; }
    public PowerZoneRanges? Power { get; init; }
}

/// <summary>One of the nine totals blocks in <see cref="ActivityStats"/>.</summary>
public sealed record ActivityTotal
{
    public int Count { get; init; }
    /// <summary>Metres.</summary>
    public double Distance { get; init; }
    /// <summary>Seconds.</summary>
    public int MovingTime { get; init; }
    /// <summary>Seconds.</summary>
    public int ElapsedTime { get; init; }
    /// <summary>Metres.</summary>
    public double ElevationGain { get; init; }
    /// <summary>Only set on the "recent" (last 4 weeks) totals.</summary>
    public int? AchievementCount { get; init; }
}

/// <summary><c>GET /athletes/{id}/stats</c>: recent, year-to-date and all-time totals.</summary>
public sealed record ActivityStats
{
    public double? BiggestRideDistance { get; init; }
    public double? BiggestClimbElevationGain { get; init; }
    public ActivityTotal? RecentRideTotals { get; init; }
    public ActivityTotal? RecentRunTotals { get; init; }
    public ActivityTotal? RecentSwimTotals { get; init; }
    public ActivityTotal? YtdRideTotals { get; init; }
    public ActivityTotal? YtdRunTotals { get; init; }
    public ActivityTotal? YtdSwimTotals { get; init; }
    public ActivityTotal? AllRideTotals { get; init; }
    public ActivityTotal? AllRunTotals { get; init; }
    public ActivityTotal? AllSwimTotals { get; init; }
}
