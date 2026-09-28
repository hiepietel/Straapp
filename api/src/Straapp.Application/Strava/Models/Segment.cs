namespace Straapp.Application.Strava.Models;

public record SummarySegment
{
    public long Id { get; init; }
    public int ResourceState { get; init; }
    public string? Name { get; init; }
    /// <summary>"Ride" or "Run".</summary>
    public string? ActivityType { get; init; }
    public double Distance { get; init; }
    public double? AverageGrade { get; init; }
    public double? MaximumGrade { get; init; }
    public double? ElevationHigh { get; init; }
    public double? ElevationLow { get; init; }
    public IReadOnlyList<double>? StartLatlng { get; init; }
    public IReadOnlyList<double>? EndLatlng { get; init; }
    /// <summary>0 (none) to 5 (hors catégorie).</summary>
    public int? ClimbCategory { get; init; }
    public string? City { get; init; }
    public string? State { get; init; }
    public string? Country { get; init; }
    public bool? Private { get; init; }
    public bool? Hazardous { get; init; }
    public bool? Starred { get; init; }
    public DateTimeOffset? StarredDate { get; init; }
    public SegmentEffortSummary? AthletePrEffort { get; init; }
    public SegmentStats? AthleteSegmentStats { get; init; }
}

/// <summary><c>GET /segments/{id}</c>.</summary>
public sealed record DetailedSegment : SummarySegment
{
    public DateTimeOffset? CreatedAt { get; init; }
    public DateTimeOffset? UpdatedAt { get; init; }
    public double? TotalElevationGain { get; init; }
    public PolylineMap? Map { get; init; }
    public int? EffortCount { get; init; }
    public int? AthleteCount { get; init; }
    public int? StarCount { get; init; }
}

/// <summary>The athlete's own record on a segment.</summary>
public sealed record SegmentStats
{
    public int? PrElapsedTime { get; init; }
    public DateTimeOffset? PrDate { get; init; }
    public long? PrActivityId { get; init; }
    public int? EffortCount { get; init; }
}

public sealed record SegmentEffortSummary
{
    public long Id { get; init; }
    public long? ActivityId { get; init; }
    public int ElapsedTime { get; init; }
    public DateTimeOffset StartDate { get; init; }
    public DateTimeOffset StartDateLocal { get; init; }
    public double Distance { get; init; }
    public bool? IsKom { get; init; }
}

/// <summary>
/// An attempt at a segment, or (with no <see cref="Segment"/>) one of an activity's best efforts.
/// </summary>
public sealed record SegmentEffort
{
    public long Id { get; init; }
    public int ResourceState { get; init; }
    public string? Name { get; init; }
    public MetaActivity? Activity { get; init; }
    public MetaAthlete? Athlete { get; init; }
    public int ElapsedTime { get; init; }
    public int MovingTime { get; init; }
    public DateTimeOffset StartDate { get; init; }
    public DateTimeOffset StartDateLocal { get; init; }
    public double Distance { get; init; }
    public int? StartIndex { get; init; }
    public int? EndIndex { get; init; }
    public double? AverageCadence { get; init; }
    public double? AverageWatts { get; init; }
    public bool? DeviceWatts { get; init; }
    public double? AverageHeartrate { get; init; }
    public double? MaxHeartrate { get; init; }
    public SummarySegment? Segment { get; init; }
    /// <summary>1–10 when in the top ten, otherwise null.</summary>
    public int? KomRank { get; init; }
    /// <summary>1–3 when one of the athlete's top three, otherwise null.</summary>
    public int? PrRank { get; init; }
    public bool? Hidden { get; init; }
    public bool? IsKom { get; init; }
}
