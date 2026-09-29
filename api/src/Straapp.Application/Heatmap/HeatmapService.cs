using Straapp.Application.Abstractions;
using Straapp.Application.GearStats;
using Straapp.Domain.Activities;

namespace Straapp.Application.Heatmap;

/// <summary>
/// Every route in a date range for the heatmap page, from the stored activities only. Only the
/// simplified summary polylines are sent: a few hundred points each, so thousands of activities
/// stay a few megabytes. The page filters by sport and gear itself, so those need no new request.
/// </summary>
public sealed class HeatmapService(IActivityRepository activities, IAthleteRepository athletes)
{
    /// <param name="from">First local day included; null for no lower bound.</param>
    /// <param name="to">Last local day included; null for no upper bound.</param>
    public async Task<HeatmapReport> GetReportAsync(long athleteId, DateOnly? from, DateOnly? to, CancellationToken ct = default)
    {
        var rows = await activities.GetRoutesAsync(athleteId, from, to?.AddDays(1), ct);

        var routes = rows
            .Select(r => new HeatmapRoute(
                r.Id, r.Name, r.SportType ?? r.Type ?? "Other", SportGroups.Of(r.SportType, r.Type),
                r.Date, r.Distance, NullIfEmpty(r.GearId), r.Polyline))
            .ToList();

        return new HeatmapReport(routes, await GearAsync(athleteId, routes, ct));
    }

    /// <summary>The gear these routes used, most used first, named the same way as on the gear page.</summary>
    private Task<IReadOnlyList<GearLabel>> GearAsync(long athleteId, List<HeatmapRoute> routes, CancellationToken ct) =>
        GearNames.LabelAsync(
            athletes, athleteId,
            routes.Where(r => r.GearId is not null).GroupBy(r => r.GearId!).OrderByDescending(g => g.Count()).Select(g => g.Key).ToList(),
            ct);

    private static string? NullIfEmpty(string? value) => string.IsNullOrEmpty(value) ? null : value;
}

public sealed record HeatmapReport(IReadOnlyList<HeatmapRoute> Routes, IReadOnlyList<GearLabel> Gear);

/// <param name="SportType">Strava's sport type, e.g. "GravelRide".</param>
/// <param name="Date">The local calendar day it started on.</param>
/// <param name="Distance">Metres.</param>
/// <param name="Polyline">Google-encoded, simplified route.</param>
public sealed record HeatmapRoute(
    long Id, string Name, string SportType, SportGroup Sport, DateOnly Date, double Distance, string? GearId, string Polyline);

