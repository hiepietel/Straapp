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
}

/// <summary>One day's activities of one sport type, summed.</summary>
public sealed record DailyTotals(
    DateOnly Day, string? SportType, string? Type, int Count, double Distance, long MovingTime, double Elevation);

public interface IAthleteRepository
{
    Task<Athlete?> GetAthleteAsync(long athleteId, CancellationToken ct = default);

    Task UpsertAthleteAsync(Athlete athlete, CancellationToken ct = default);

    Task<IReadOnlySet<string>> GetGearIdsAsync(CancellationToken ct = default);

    Task UpsertGearAsync(Gear gear, CancellationToken ct = default);
}
