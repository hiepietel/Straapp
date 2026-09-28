namespace Straapp.Domain.Activities;

/// <summary>A lap as recorded by the device (or auto-lapped by Strava).</summary>
public class ActivityLap
{
    /// <summary>Strava's lap id.</summary>
    public long Id { get; set; }
    public long ActivityId { get; set; }
    public int LapIndex { get; set; }
    public string? Name { get; set; }
    public DateTimeOffset StartDate { get; set; }
    public int ElapsedTime { get; set; }
    public int MovingTime { get; set; }
    public double Distance { get; set; }
    /// <summary>Index into the streams.</summary>
    public int? StartIndex { get; set; }
    public int? EndIndex { get; set; }
    public double? TotalElevationGain { get; set; }
    public double? AverageSpeed { get; set; }
    public double? MaxSpeed { get; set; }
    public double? AverageCadence { get; set; }
    public double? AverageWatts { get; set; }
    public double? AverageHeartrate { get; set; }
    public double? MaxHeartrate { get; set; }
    public int? PaceZone { get; set; }
}

public enum SplitUnit
{
    Kilometre,
    Mile,
}

/// <summary>One kilometre or mile of an activity.</summary>
public class ActivitySplit
{
    public long ActivityId { get; set; }
    public SplitUnit Unit { get; set; }
    /// <summary>1-based.</summary>
    public int Index { get; set; }
    public double Distance { get; set; }
    public int ElapsedTime { get; set; }
    public int MovingTime { get; set; }
    public double? ElevationDifference { get; set; }
    public double AverageSpeed { get; set; }
    public double? AverageGradeAdjustedSpeed { get; set; }
    public double? AverageHeartrate { get; set; }
    public int? PaceZone { get; set; }
}

public enum EffortKind
{
    /// <summary>Fastest 400 m, 1 k, 5 k… within a run.</summary>
    BestEffort,
    Segment,
}

public class ActivityEffort
{
    /// <summary>Strava's effort id.</summary>
    public long Id { get; set; }
    public long ActivityId { get; set; }
    public EffortKind Kind { get; set; }
    public string? Name { get; set; }
    public long? SegmentId { get; set; }
    public DateTimeOffset StartDate { get; set; }
    public int ElapsedTime { get; set; }
    public int MovingTime { get; set; }
    public double Distance { get; set; }
    public int? StartIndex { get; set; }
    public int? EndIndex { get; set; }
    public double? AverageHeartrate { get; set; }
    public double? MaxHeartrate { get; set; }
    public double? AverageWatts { get; set; }
    public double? AverageCadence { get; set; }
    /// <summary>1–3 when one of the athlete's three best.</summary>
    public int? PrRank { get; set; }
    public int? KomRank { get; set; }
}

/// <summary>Time spent in each heart-rate or power zone.</summary>
public class ActivityZone
{
    public long ActivityId { get; set; }
    /// <summary>"heartrate" or "power".</summary>
    public string Type { get; set; } = "";
    public int? Score { get; set; }
    public bool? SensorBased { get; set; }
    public bool? CustomZones { get; set; }
    /// <summary>Lower bound of each zone.</summary>
    public double[] Min { get; set; } = [];
    /// <summary>Upper bound of each zone; -1 for the open-ended top zone.</summary>
    public double[] Max { get; set; } = [];
    /// <summary>Seconds spent in each zone.</summary>
    public int[] Seconds { get; set; } = [];
}

public class ActivityComment
{
    public long Id { get; set; }
    public long ActivityId { get; set; }
    public long? AthleteId { get; set; }
    public string? AthleteName { get; set; }
    public string? Text { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
}

/// <summary>Strava only reveals a kudoer's name, not their id.</summary>
public class ActivityKudo
{
    public long ActivityId { get; set; }
    public int Position { get; set; }
    public string? Firstname { get; set; }
    public string? Lastname { get; set; }
}
