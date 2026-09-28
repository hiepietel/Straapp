namespace Straapp.Application.Strava.Models;

public sealed record PolylineMap
{
    public string? Id { get; init; }
    /// <summary>Full-resolution route. Only on single-resource responses.</summary>
    public string? Polyline { get; init; }
    /// <summary>Google-encoded polyline; empty for indoor activities.</summary>
    public string? SummaryPolyline { get; init; }
}

/// <summary><c>GET /athlete/activities</c> entry.</summary>
public record SummaryActivity
{
    public long Id { get; init; }
    public int ResourceState { get; init; }
    public string? ExternalId { get; init; }
    public long? UploadId { get; init; }
    public MetaAthlete? Athlete { get; init; }
    public string? Name { get; init; }
    /// <summary>Legacy; prefer <see cref="SportType"/>.</summary>
    public string? Type { get; init; }
    public string? SportType { get; init; }
    public int? WorkoutType { get; init; }

    public DateTimeOffset StartDate { get; init; }
    /// <summary>Local wall-clock time, although Strava labels it as UTC.</summary>
    public DateTimeOffset StartDateLocal { get; init; }
    public string? Timezone { get; init; }
    /// <summary>Seconds.</summary>
    public double? UtcOffset { get; init; }

    /// <summary>Metres.</summary>
    public double Distance { get; init; }
    /// <summary>Seconds.</summary>
    public int MovingTime { get; init; }
    /// <summary>Seconds.</summary>
    public int ElapsedTime { get; init; }
    /// <summary>Metres.</summary>
    public double TotalElevationGain { get; init; }
    public double? ElevHigh { get; init; }
    public double? ElevLow { get; init; }

    /// <summary>[lat, lng]; empty for indoor activities.</summary>
    public IReadOnlyList<double>? StartLatlng { get; init; }
    public IReadOnlyList<double>? EndLatlng { get; init; }
    public string? LocationCity { get; init; }
    public string? LocationState { get; init; }
    public string? LocationCountry { get; init; }
    public PolylineMap? Map { get; init; }

    /// <summary>Metres per second.</summary>
    public double AverageSpeed { get; init; }
    public double? MaxSpeed { get; init; }
    public double? AverageCadence { get; init; }
    /// <summary>Degrees Celsius.</summary>
    public double? AverageTemp { get; init; }
    public double? AverageWatts { get; init; }
    public double? WeightedAverageWatts { get; init; }
    public double? MaxWatts { get; init; }
    public double? Kilojoules { get; init; }
    /// <summary>True when power came from a power meter rather than Strava's estimate.</summary>
    public bool? DeviceWatts { get; init; }
    public bool? HasHeartrate { get; init; }
    public double? AverageHeartrate { get; init; }
    public double? MaxHeartrate { get; init; }
    public bool? HeartrateOptOut { get; init; }
    public bool? DisplayHideHeartrateOption { get; init; }
    /// <summary>Strava's "Relative Effort".</summary>
    public double? SufferScore { get; init; }

    public int? AchievementCount { get; init; }
    public int? KudosCount { get; init; }
    public int? CommentCount { get; init; }
    public int? AthleteCount { get; init; }
    public int? PhotoCount { get; init; }
    public int? TotalPhotoCount { get; init; }
    public int? PrCount { get; init; }
    public bool? HasKudoed { get; init; }

    public bool? Trainer { get; init; }
    public bool? Commute { get; init; }
    public bool? Manual { get; init; }
    public bool? Private { get; init; }
    /// <summary>"everyone", "followers_only" or "only_me".</summary>
    public string? Visibility { get; init; }
    public bool? Flagged { get; init; }
    public bool? FromAcceptedTag { get; init; }
    public string? GearId { get; init; }
}

/// <summary><c>GET /activities/{id}</c>: everything in the list entry plus the detail.</summary>
public sealed record DetailedActivity : SummaryActivity
{
    public string? Description { get; init; }
    public double? Calories { get; init; }
    public string? DeviceName { get; init; }
    public string? EmbedToken { get; init; }
    public bool? HideFromHome { get; init; }
    public SummaryGear? Gear { get; init; }
    public PhotosSummary? Photos { get; init; }
    public IReadOnlyList<SegmentEffort>? SegmentEfforts { get; init; }
    /// <summary>Per-kilometre splits.</summary>
    public IReadOnlyList<ActivitySplit>? SplitsMetric { get; init; }
    /// <summary>Per-mile splits.</summary>
    public IReadOnlyList<ActivitySplit>? SplitsStandard { get; init; }
    public IReadOnlyList<Lap>? Laps { get; init; }
    /// <summary>Fastest 400 m, 1 k, 5 k… within a run.</summary>
    public IReadOnlyList<SegmentEffort>? BestEfforts { get; init; }
}

/// <summary>One kilometre (or mile) of an activity.</summary>
public sealed record ActivitySplit
{
    /// <summary>1-based index.</summary>
    public int Split { get; init; }
    public double Distance { get; init; }
    public int ElapsedTime { get; init; }
    public int MovingTime { get; init; }
    public double? ElevationDifference { get; init; }
    public double AverageSpeed { get; init; }
    public double? AverageGradeAdjustedSpeed { get; init; }
    public double? AverageHeartrate { get; init; }
    public int? PaceZone { get; init; }
}

/// <summary><c>GET /activities/{id}/laps</c> entry.</summary>
public sealed record Lap
{
    public long Id { get; init; }
    public int ResourceState { get; init; }
    public string? Name { get; init; }
    public MetaActivity? Activity { get; init; }
    public MetaAthlete? Athlete { get; init; }
    public DateTimeOffset StartDate { get; init; }
    public DateTimeOffset StartDateLocal { get; init; }
    public int ElapsedTime { get; init; }
    public int MovingTime { get; init; }
    public double Distance { get; init; }
    /// <summary>Index into the activity's streams.</summary>
    public int? StartIndex { get; init; }
    public int? EndIndex { get; init; }
    public double? TotalElevationGain { get; init; }
    public double? AverageSpeed { get; init; }
    public double? MaxSpeed { get; init; }
    public double? AverageCadence { get; init; }
    public double? AverageWatts { get; init; }
    public bool? DeviceWatts { get; init; }
    public double? AverageHeartrate { get; init; }
    public double? MaxHeartrate { get; init; }
    public int? LapIndex { get; init; }
    public int? Split { get; init; }
    public int? PaceZone { get; init; }
}

public sealed record MetaActivity
{
    public long Id { get; init; }
}

public sealed record PhotosSummary
{
    public int Count { get; init; }
    public PrimaryPhoto? Primary { get; init; }
    public bool? UsePrimaryPhoto { get; init; }
}

public sealed record PrimaryPhoto
{
    public long? Id { get; init; }
    public string? UniqueId { get; init; }
    /// <summary>Size (e.g. "100", "600") to image URL.</summary>
    public IReadOnlyDictionary<string, string>? Urls { get; init; }
    public int? Source { get; init; }
}

/// <summary>One bucket of <c>GET /activities/{id}/zones</c>: seconds spent between min and max.</summary>
public sealed record TimedZoneRange
{
    public double Min { get; init; }
    public double Max { get; init; }
    /// <summary>Seconds. Strava sends it as a decimal.</summary>
    public double Time { get; init; }
}

/// <summary>Time in heart-rate or power zones for one activity. Only returned for athletes with a Strava subscription.</summary>
public sealed record ActivityZone
{
    /// <summary>"heartrate" or "power".</summary>
    public string? Type { get; init; }
    public int? Score { get; init; }
    public bool? SensorBased { get; init; }
    public int? Points { get; init; }
    public bool? CustomZones { get; init; }
    public int? Max { get; init; }
    public IReadOnlyList<TimedZoneRange> DistributionBuckets { get; init; } = [];
}

/// <summary><c>GET /activities/{id}/comments</c> entry.</summary>
public sealed record Comment
{
    public long Id { get; init; }
    public long ActivityId { get; init; }
    public string? Text { get; init; }
    public SummaryAthlete? Athlete { get; init; }
    public DateTimeOffset CreatedAt { get; init; }
    /// <summary>Pass back as <c>afterCursor</c> to get the next page.</summary>
    public string? Cursor { get; init; }
}
