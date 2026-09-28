namespace Straapp.Domain.Activities;

/// <summary>
/// One Strava activity with everything fetched about it. Typed columns hold what gets queried;
/// <see cref="RawJson"/> keeps the whole Strava payload so nothing is lost.
/// </summary>
public class Activity
{
    /// <summary>Strava's activity id.</summary>
    public long Id { get; set; }
    public long AthleteId { get; set; }
    public string Name { get; set; } = "";
    public string? Description { get; set; }
    public string? SportType { get; set; }
    /// <summary>Legacy Strava type, kept for older activities without <see cref="SportType"/>.</summary>
    public string? Type { get; set; }
    public int? WorkoutType { get; set; }

    public DateTimeOffset StartDate { get; set; }
    /// <summary>Wall-clock time where the activity happened.</summary>
    public DateTime StartDateLocal { get; set; }
    public string? Timezone { get; set; }
    /// <summary>Seconds.</summary>
    public double? UtcOffset { get; set; }

    /// <summary>Metres.</summary>
    public double Distance { get; set; }
    /// <summary>Seconds.</summary>
    public int MovingTime { get; set; }
    /// <summary>Seconds.</summary>
    public int ElapsedTime { get; set; }
    /// <summary>Metres.</summary>
    public double TotalElevationGain { get; set; }
    public double? ElevHigh { get; set; }
    public double? ElevLow { get; set; }

    /// <summary>Metres per second.</summary>
    public double AverageSpeed { get; set; }
    public double? MaxSpeed { get; set; }
    public double? AverageHeartrate { get; set; }
    public double? MaxHeartrate { get; set; }
    public double? AverageCadence { get; set; }
    public double? AverageWatts { get; set; }
    public double? WeightedAverageWatts { get; set; }
    public double? MaxWatts { get; set; }
    public bool? DeviceWatts { get; set; }
    public double? Kilojoules { get; set; }
    public double? Calories { get; set; }
    /// <summary>Degrees Celsius.</summary>
    public double? AverageTemp { get; set; }
    /// <summary>Strava's "Relative Effort".</summary>
    public double? SufferScore { get; set; }

    public double? StartLatitude { get; set; }
    public double? StartLongitude { get; set; }
    public double? EndLatitude { get; set; }
    public double? EndLongitude { get; set; }
    public string? LocationCountry { get; set; }
    /// <summary>Google-encoded, simplified route.</summary>
    public string? SummaryPolyline { get; set; }
    /// <summary>Google-encoded, full-resolution route.</summary>
    public string? Polyline { get; set; }

    public int KudosCount { get; set; }
    public int CommentCount { get; set; }
    public int AchievementCount { get; set; }
    public int PrCount { get; set; }
    public int AthleteCount { get; set; }
    public int PhotoCount { get; set; }

    public bool Trainer { get; set; }
    public bool Commute { get; set; }
    public bool Manual { get; set; }
    public bool Private { get; set; }
    public string? Visibility { get; set; }
    public string? GearId { get; set; }
    public string? DeviceName { get; set; }

    /// <summary>The full <c>GET /activities/{id}</c> response as JSON.</summary>
    public string RawJson { get; set; } = "{}";
    public DateTimeOffset SyncedAt { get; set; }

    public ActivityStreams? Streams { get; set; }
    public List<ActivityLap> Laps { get; set; } = [];
    public List<ActivitySplit> Splits { get; set; } = [];
    public List<ActivityEffort> Efforts { get; set; } = [];
    public List<ActivityZone> Zones { get; set; } = [];
    public List<ActivityComment> Comments { get; set; } = [];
    public List<ActivityKudo> Kudos { get; set; } = [];
}
