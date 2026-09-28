using System.Text.Json;
using Straapp.Application.Abstractions;
using Straapp.Application.Strava;
using Straapp.Application.Strava.Models;
using Straapp.Domain.Activities;

namespace Straapp.Application.StoredActivities;

/// <summary>
/// The athlete's activities from the database, in Strava's own shapes, so the web app reads them
/// exactly as it used to read Strava. Nothing here reaches Strava; the sync keeps the data current.
/// </summary>
public sealed class ActivityService(IActivityRepository activities)
{
    /// <summary>Strava's largest page size, kept so pages behave the same.</summary>
    public const int MaxPerPage = 200;

    /// <summary>Newest first, like Strava's list.</summary>
    public async Task<IReadOnlyList<SummaryActivity>> GetPageAsync(long athleteId, int page, int perPage, CancellationToken ct = default)
    {
        perPage = Math.Clamp(perPage, 1, MaxPerPage);
        var rows = await activities.GetPageAsync(athleteId, (Math.Max(page, 1) - 1) * perPage, perPage, ct);
        return rows.Select(ToSummary).ToList();
    }

    /// <summary>The full detail Strava sent when the activity was synced; null if it isn't stored.</summary>
    public async Task<DetailedActivity?> GetAsync(long athleteId, long activityId, CancellationToken ct = default)
    {
        var activity = await activities.GetAsync(athleteId, activityId, ct);
        return activity is null ? null : JsonSerializer.Deserialize<DetailedActivity>(activity.RawJson, StravaJson.Options);
    }

    /// <summary>The sensor streams; an empty set when the activity has none (manual, or no sensors).</summary>
    public async Task<StreamSet?> GetStreamsAsync(long athleteId, long activityId, CancellationToken ct = default)
    {
        if (await activities.GetAsync(athleteId, activityId, ct) is null) return null;
        var streams = await activities.GetStreamsAsync(athleteId, activityId, ct);
        return streams is null ? new StreamSet() : ToStreamSet(streams);
    }

    private static SummaryActivity ToSummary(Activity a) => new()
    {
        Id = a.Id,
        ResourceState = 2,
        Athlete = new MetaAthlete { Id = a.AthleteId },
        Name = a.Name,
        Type = a.Type,
        SportType = a.SportType,
        WorkoutType = a.WorkoutType,
        StartDate = a.StartDate,
        // Strava labels local wall-clock time as UTC; keep doing so.
        StartDateLocal = new DateTimeOffset(DateTime.SpecifyKind(a.StartDateLocal, DateTimeKind.Unspecified), TimeSpan.Zero),
        Timezone = a.Timezone,
        UtcOffset = a.UtcOffset,
        Distance = a.Distance,
        MovingTime = a.MovingTime,
        ElapsedTime = a.ElapsedTime,
        TotalElevationGain = a.TotalElevationGain,
        ElevHigh = a.ElevHigh,
        ElevLow = a.ElevLow,
        StartLatlng = LatLng(a.StartLatitude, a.StartLongitude),
        EndLatlng = LatLng(a.EndLatitude, a.EndLongitude),
        LocationCountry = a.LocationCountry,
        Map = new PolylineMap { Id = $"a{a.Id}", SummaryPolyline = a.SummaryPolyline ?? "" },
        AverageSpeed = a.AverageSpeed,
        MaxSpeed = a.MaxSpeed,
        AverageCadence = a.AverageCadence,
        AverageTemp = a.AverageTemp,
        AverageWatts = a.AverageWatts,
        WeightedAverageWatts = a.WeightedAverageWatts,
        MaxWatts = a.MaxWatts,
        Kilojoules = a.Kilojoules,
        DeviceWatts = a.DeviceWatts,
        HasHeartrate = a.AverageHeartrate is not null,
        AverageHeartrate = a.AverageHeartrate,
        MaxHeartrate = a.MaxHeartrate,
        SufferScore = a.SufferScore,
        AchievementCount = a.AchievementCount,
        KudosCount = a.KudosCount,
        CommentCount = a.CommentCount,
        AthleteCount = a.AthleteCount,
        TotalPhotoCount = a.PhotoCount,
        PrCount = a.PrCount,
        Trainer = a.Trainer,
        Commute = a.Commute,
        Manual = a.Manual,
        Private = a.Private,
        Visibility = a.Visibility,
        GearId = a.GearId,
    };

    private static StreamSet ToStreamSet(ActivityStreams s)
    {
        Stream<T>? Wrap<T>(T[]? data) => data is null
            ? null
            : new Stream<T> { Data = data, SeriesType = s.SeriesType, OriginalSize = s.OriginalSize, Resolution = s.Resolution };

        return new StreamSet
        {
            Time = Wrap(s.Time),
            Distance = Wrap(s.Distance),
            Latlng = s.Latitude is { } lat && s.Longitude is { } lng
                ? Wrap(lat.Zip(lng, (la, lo) => (IReadOnlyList<double>)[la, lo]).ToArray())
                : null,
            Altitude = Wrap(s.Altitude),
            VelocitySmooth = Wrap(s.VelocitySmooth),
            Heartrate = Wrap(s.Heartrate),
            Cadence = Wrap(s.Cadence),
            Watts = Wrap(s.Watts),
            Temp = Wrap(s.Temp),
            Moving = Wrap(s.Moving),
            GradeSmooth = Wrap(s.GradeSmooth),
        };
    }

    private static IReadOnlyList<double>? LatLng(double? lat, double? lng) =>
        lat is { } la && lng is { } lo ? [la, lo] : [];
}
