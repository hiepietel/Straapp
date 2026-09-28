using Straapp.Application.Strava;
using Straapp.Application.Strava.Models;
using Straapp.Domain.Activities;
using Straapp.Domain.Athletes;
using StravaZone = Straapp.Application.Strava.Models.ActivityZone;
using ActivityZone = Straapp.Domain.Activities.ActivityZone;
using StravaSplit = Straapp.Application.Strava.Models.ActivitySplit;
using ActivitySplit = Straapp.Domain.Activities.ActivitySplit;

namespace Straapp.Application.Sync;

/// <summary>Turns Strava's responses into what gets stored.</summary>
public static class StravaMapper
{
    public static Activity ToActivity(
        DetailedActivity detail,
        StreamSet? streams,
        IReadOnlyList<StravaZone> zones,
        IReadOnlyList<Comment> comments,
        IReadOnlyList<SummaryAthlete> kudoers,
        DateTimeOffset syncedAt)
    {
        var activity = new Activity
        {
            Id = detail.Id,
            AthleteId = detail.Athlete?.Id ?? 0,
            Name = detail.Name ?? "",
            Description = detail.Description,
            SportType = detail.SportType,
            Type = detail.Type,
            WorkoutType = detail.WorkoutType,
            StartDate = detail.StartDate.ToUniversalTime(),
            // Strava labels local time as UTC; keep the wall-clock reading only.
            StartDateLocal = detail.StartDateLocal.DateTime,
            Timezone = detail.Timezone,
            UtcOffset = detail.UtcOffset,
            Distance = detail.Distance,
            MovingTime = detail.MovingTime,
            ElapsedTime = detail.ElapsedTime,
            TotalElevationGain = detail.TotalElevationGain,
            ElevHigh = detail.ElevHigh,
            ElevLow = detail.ElevLow,
            AverageSpeed = detail.AverageSpeed,
            MaxSpeed = detail.MaxSpeed,
            AverageHeartrate = detail.AverageHeartrate,
            MaxHeartrate = detail.MaxHeartrate,
            AverageCadence = detail.AverageCadence,
            AverageWatts = detail.AverageWatts,
            WeightedAverageWatts = detail.WeightedAverageWatts,
            MaxWatts = detail.MaxWatts,
            DeviceWatts = detail.DeviceWatts,
            Kilojoules = detail.Kilojoules,
            Calories = detail.Calories,
            AverageTemp = detail.AverageTemp,
            SufferScore = detail.SufferScore,
            StartLatitude = Coordinate(detail.StartLatlng, 0),
            StartLongitude = Coordinate(detail.StartLatlng, 1),
            EndLatitude = Coordinate(detail.EndLatlng, 0),
            EndLongitude = Coordinate(detail.EndLatlng, 1),
            LocationCountry = detail.LocationCountry,
            SummaryPolyline = NullIfEmpty(detail.Map?.SummaryPolyline),
            Polyline = NullIfEmpty(detail.Map?.Polyline),
            KudosCount = detail.KudosCount ?? 0,
            CommentCount = detail.CommentCount ?? 0,
            AchievementCount = detail.AchievementCount ?? 0,
            PrCount = detail.PrCount ?? 0,
            AthleteCount = detail.AthleteCount ?? 1,
            PhotoCount = detail.TotalPhotoCount ?? detail.PhotoCount ?? 0,
            Trainer = detail.Trainer ?? false,
            Commute = detail.Commute ?? false,
            Manual = detail.Manual ?? false,
            Private = detail.Private ?? false,
            Visibility = detail.Visibility,
            GearId = detail.GearId,
            DeviceName = detail.DeviceName,
            RawJson = StravaJson.Serialize(detail),
            SyncedAt = syncedAt,
        };

        activity.Streams = ToStreams(detail.Id, streams);

        activity.Laps.AddRange((detail.Laps ?? []).Select(lap => new ActivityLap
        {
            Id = lap.Id,
            ActivityId = detail.Id,
            LapIndex = lap.LapIndex ?? 0,
            Name = lap.Name,
            StartDate = lap.StartDate.ToUniversalTime(),
            ElapsedTime = lap.ElapsedTime,
            MovingTime = lap.MovingTime,
            Distance = lap.Distance,
            StartIndex = lap.StartIndex,
            EndIndex = lap.EndIndex,
            TotalElevationGain = lap.TotalElevationGain,
            AverageSpeed = lap.AverageSpeed,
            MaxSpeed = lap.MaxSpeed,
            AverageCadence = lap.AverageCadence,
            AverageWatts = lap.AverageWatts,
            AverageHeartrate = lap.AverageHeartrate,
            MaxHeartrate = lap.MaxHeartrate,
            PaceZone = lap.PaceZone,
        }).DistinctBy(lap => lap.Id));

        activity.Splits.AddRange(ToSplits(detail.Id, SplitUnit.Kilometre, detail.SplitsMetric));
        activity.Splits.AddRange(ToSplits(detail.Id, SplitUnit.Mile, detail.SplitsStandard));

        activity.Efforts.AddRange(ToEfforts(detail.Id, EffortKind.BestEffort, detail.BestEfforts));
        activity.Efforts.AddRange(ToEfforts(detail.Id, EffortKind.Segment, detail.SegmentEfforts));

        activity.Zones.AddRange(zones
            .Where(zone => zone.Type is not null)
            .DistinctBy(zone => zone.Type)
            .Select(zone => new ActivityZone
            {
                ActivityId = detail.Id,
                Type = zone.Type!,
                Score = zone.Score,
                SensorBased = zone.SensorBased,
                CustomZones = zone.CustomZones,
                Min = zone.DistributionBuckets.Select(b => b.Min).ToArray(),
                Max = zone.DistributionBuckets.Select(b => b.Max).ToArray(),
                Seconds = zone.DistributionBuckets.Select(b => (int)Math.Round(b.Time)).ToArray(),
            }));

        activity.Comments.AddRange(comments.DistinctBy(c => c.Id).Select(comment => new ActivityComment
        {
            Id = comment.Id,
            ActivityId = detail.Id,
            AthleteId = comment.Athlete?.Id is > 0 ? comment.Athlete.Id : null,
            AthleteName = $"{comment.Athlete?.Firstname} {comment.Athlete?.Lastname}".Trim() is { Length: > 0 } name ? name : null,
            Text = comment.Text,
            CreatedAt = comment.CreatedAt.ToUniversalTime(),
        }));

        activity.Kudos.AddRange(kudoers.Select((kudoer, i) => new ActivityKudo
        {
            ActivityId = detail.Id,
            Position = i + 1,
            Firstname = kudoer.Firstname,
            Lastname = kudoer.Lastname,
        }));

        return activity;
    }

    public static Athlete ToAthlete(DetailedAthlete athlete, AthleteZones? zones, DateTimeOffset syncedAt, ActivityStats? stats = null) => new()
    {
        Id = athlete.Id,
        Username = athlete.Username,
        Firstname = athlete.Firstname,
        Lastname = athlete.Lastname,
        City = athlete.City,
        Country = athlete.Country,
        Sex = athlete.Sex,
        Premium = athlete.Premium ?? false,
        Weight = athlete.Weight,
        Ftp = athlete.Ftp,
        MeasurementPreference = athlete.MeasurementPreference,
        ProfileUrl = athlete.Profile,
        CreatedAt = athlete.CreatedAt?.ToUniversalTime(),
        RawJson = StravaJson.Serialize(athlete),
        ZonesJson = zones is null ? null : StravaJson.Serialize(zones),
        StatsJson = stats is null ? null : StravaJson.Serialize(stats),
        SyncedAt = syncedAt,
    };

    public static Gear ToGear(DetailedGear gear, long athleteId, DateTimeOffset syncedAt) => new()
    {
        Id = gear.Id,
        AthleteId = athleteId,
        Kind = gear.Id.StartsWith('b') ? GearKind.Bike : GearKind.Shoes,
        Name = gear.Name,
        Nickname = gear.Nickname,
        BrandName = gear.BrandName,
        ModelName = gear.ModelName,
        Description = gear.Description,
        Distance = gear.Distance,
        Primary = gear.Primary ?? false,
        Retired = gear.Retired ?? false,
        RawJson = StravaJson.Serialize(gear),
        SyncedAt = syncedAt,
    };

    private static ActivityStreams? ToStreams(long activityId, StreamSet? streams)
    {
        object?[] all = [streams?.Time, streams?.Distance, streams?.Latlng, streams?.Altitude, streams?.VelocitySmooth,
            streams?.Heartrate, streams?.Cadence, streams?.Watts, streams?.Temp, streams?.Moving, streams?.GradeSmooth];
        if (streams is null || all.All(s => s is null)) return null;

        // Every stream in a set shares these; time or distance is almost always there.
        var description = streams.Time is { } t ? (t.SeriesType, t.Resolution, t.OriginalSize)
            : streams.Distance is { } d ? (d.SeriesType, d.Resolution, d.OriginalSize)
            : (null, null, 0);

        return new ActivityStreams
        {
            ActivityId = activityId,
            SeriesType = description.SeriesType,
            Resolution = description.Resolution,
            OriginalSize = description.OriginalSize,
            Time = streams.Time?.Data.ToArray(),
            Distance = streams.Distance?.Data.ToArray(),
            Latitude = streams.Latlng?.Data.Select(p => p[0]).ToArray(),
            Longitude = streams.Latlng?.Data.Select(p => p[1]).ToArray(),
            Altitude = streams.Altitude?.Data.ToArray(),
            VelocitySmooth = streams.VelocitySmooth?.Data.ToArray(),
            Heartrate = streams.Heartrate?.Data.ToArray(),
            Cadence = streams.Cadence?.Data.ToArray(),
            Watts = streams.Watts?.Data.ToArray(),
            Temp = streams.Temp?.Data.ToArray(),
            Moving = streams.Moving?.Data.ToArray(),
            GradeSmooth = streams.GradeSmooth?.Data.ToArray(),
        };
    }

    private static IEnumerable<ActivitySplit> ToSplits(long activityId, SplitUnit unit, IReadOnlyList<StravaSplit>? splits) =>
        (splits ?? []).DistinctBy(s => s.Split).Select(split => new ActivitySplit
        {
            ActivityId = activityId,
            Unit = unit,
            Index = split.Split,
            Distance = split.Distance,
            ElapsedTime = split.ElapsedTime,
            MovingTime = split.MovingTime,
            ElevationDifference = split.ElevationDifference,
            AverageSpeed = split.AverageSpeed,
            AverageGradeAdjustedSpeed = split.AverageGradeAdjustedSpeed,
            AverageHeartrate = split.AverageHeartrate,
            PaceZone = split.PaceZone,
        });

    private static IEnumerable<ActivityEffort> ToEfforts(long activityId, EffortKind kind, IReadOnlyList<SegmentEffort>? efforts) =>
        (efforts ?? []).DistinctBy(e => e.Id).Select(effort => new ActivityEffort
        {
            Id = effort.Id,
            ActivityId = activityId,
            Kind = kind,
            Name = effort.Name,
            SegmentId = effort.Segment?.Id,
            StartDate = effort.StartDate.ToUniversalTime(),
            ElapsedTime = effort.ElapsedTime,
            MovingTime = effort.MovingTime,
            Distance = effort.Distance,
            StartIndex = effort.StartIndex,
            EndIndex = effort.EndIndex,
            AverageHeartrate = effort.AverageHeartrate,
            MaxHeartrate = effort.MaxHeartrate,
            AverageWatts = effort.AverageWatts,
            AverageCadence = effort.AverageCadence,
            PrRank = effort.PrRank,
            KomRank = effort.KomRank,
        });

    private static double? Coordinate(IReadOnlyList<double>? latlng, int index) =>
        latlng is { Count: 2 } ? latlng[index] : null;

    private static string? NullIfEmpty(string? value) => string.IsNullOrEmpty(value) ? null : value;
}
