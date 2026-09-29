using Straapp.Domain.Activities;
using Straapp.Domain.Athletes;

namespace Straapp.Application.Abstractions;

public interface IActivityRepository
{
    /// <summary>Ids of the stored activities that started in [<paramref name="from"/>, <paramref name="to"/>).</summary>
    Task<IReadOnlySet<long>> GetIdsAsync(DateTimeOffset from, DateTimeOffset to, CancellationToken ct = default);

    /// <summary>Stores the activity with all its parts, replacing any earlier copy completely.</summary>
    Task ReplaceAsync(Activity activity, CancellationToken ct = default);

    /// <summary>
    /// The athlete's totals per local day and sport type, for activities on local days in
    /// [<paramref name="from"/>, <paramref name="to"/>). Summed by the database, so no activity is loaded.
    /// </summary>
    Task<IReadOnlyList<DailyTotals>> GetDailyTotalsAsync(long athleteId, DateOnly from, DateOnly to, CancellationToken ct = default);

    /// <summary>
    /// One page of the athlete's activities, newest first, with every column except the raw Strava
    /// payload (too big for lists) and without their parts.
    /// </summary>
    Task<IReadOnlyList<Activity>> GetPageAsync(long athleteId, int skip, int take, CancellationToken ct = default);

    /// <summary>One of the athlete's activities with its raw Strava payload; null if not stored (or not theirs).</summary>
    Task<Activity?> GetAsync(long athleteId, long activityId, CancellationToken ct = default);

    /// <summary>The activity's sensor streams; null if it has none or isn't the athlete's.</summary>
    Task<ActivityStreams?> GetStreamsAsync(long athleteId, long activityId, CancellationToken ct = default);

    /// <summary>Every stored activity of the athlete, just the columns gear statistics need; oldest first.</summary>
    Task<IReadOnlyList<ActivityUsage>> GetUsageAsync(long athleteId, CancellationToken ct = default);

    /// <summary>
    /// The athlete's activities that have a route, on local days in [<paramref name="from"/>, <paramref name="to"/>)
    /// (either side open when null); oldest first.
    /// </summary>
    Task<IReadOnlyList<ActivityRoute>> GetRoutesAsync(long athleteId, DateOnly? from, DateOnly? to, CancellationToken ct = default);
}

/// <summary>One activity's simplified route, with just enough to filter and label it.</summary>
/// <param name="Date">The local calendar day it started on.</param>
/// <param name="Polyline">Strava's Google-encoded summary polyline.</param>
public sealed record ActivityRoute(
    long Id, string Name, string? SportType, string? Type, DateOnly Date, double Distance, string? GearId, string Polyline);

/// <summary>One activity, reduced to what usage statistics need.</summary>
/// <param name="Date">The local calendar day it started on.</param>
/// <param name="Private">Visible only to the athlete ("only me" on Strava).</param>
public sealed record ActivityUsage(
    long Id, string Name, string? GearId, string? SportType, string? Type, DateOnly Date,
    double Distance, int MovingTime, double Elevation, bool Private);

/// <summary>One day's activities of one sport type, summed.</summary>
public sealed record DailyTotals(
    DateOnly Day, string? SportType, string? Type, int Count, double Distance, long MovingTime, double Elevation);

public interface IAthleteRepository
{
    Task<Athlete?> GetAthleteAsync(long athleteId, CancellationToken ct = default);

    Task UpsertAthleteAsync(Athlete athlete, CancellationToken ct = default);

    /// <summary>The athlete's bikes and shoes as last synced.</summary>
    Task<IReadOnlyList<Gear>> GetGearAsync(long athleteId, CancellationToken ct = default);

    Task UpsertGearAsync(Gear gear, CancellationToken ct = default);
}
