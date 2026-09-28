using System.Text.Json;
using Straapp.Application.Abstractions;
using Straapp.Application.Statistics;
using Straapp.Application.Strava;
using Straapp.Application.Strava.Models;
using Straapp.Domain.Athletes;

namespace Straapp.Application.GearStats;

/// <summary>
/// Everything the gear page shows, from the stored gear and activities only (Strava is never asked;
/// the sync keeps gear up to date). One pass over the athlete's activities, which is a few thousand
/// small rows at most.
/// </summary>
public sealed class GearService(IActivityRepository activities, IAthleteRepository athletes)
{
    public async Task<GearReport> GetReportAsync(long athleteId, DateOnly today, CancellationToken ct = default)
    {
        var stored = await athletes.GetGearAsync(athleteId, ct);
        var usage = await activities.GetUsageAsync(athleteId, ct);

        var byGear = usage.Where(a => !string.IsNullOrEmpty(a.GearId)).GroupBy(a => a.GearId!).ToDictionary(g => g.Key, g => g.ToList());
        var gearById = stored.ToDictionary(g => g.Id);

        // The stored athlete profile lists current bikes and shoes by name. It fills in whatever the
        // sync hasn't fetched gear details for yet (it may be waiting out Strava's rate limit).
        foreach (var gear in ProfileGear(await athletes.GetAthleteAsync(athleteId, ct)))
        {
            gearById.TryAdd(gear.Id, gear);
        }

        // Activities can name gear that was never synced or has since been deleted on Strava.
        var ids = gearById.Keys.Union(byGear.Keys);
        var items = ids
            .Select(id => (Id: id, Gear: gearById.GetValueOrDefault(id), Used: byGear.GetValueOrDefault(id) ?? []))
            .OrderByDescending(g => g.Used.Sum(a => a.Distance))
            .ThenByDescending(g => g.Gear?.Distance ?? 0)
            .Select((g, rank) => ToItem(g.Id, g.Gear, g.Used, rank))
            .ToList();

        var withGear = usage.Where(a => !string.IsNullOrEmpty(a.GearId)).ToList();

        return new GearReport(
            today,
            items,
            Months(withGear, today),
            Timelines(byGear),
            Sum(usage.Where(a => string.IsNullOrEmpty(a.GearId))),
            usage.Count > 0 ? usage[0].Date : null);
    }

    /// <summary>The bikes and shoes in the athlete's stored Strava profile: name, distance and primary flag only.</summary>
    private static IEnumerable<Gear> ProfileGear(Athlete? athlete)
    {
        if (athlete is null) return [];
        DetailedAthlete? profile;
        try
        {
            profile = JsonSerializer.Deserialize<DetailedAthlete>(athlete.RawJson, StravaJson.Options);
        }
        catch (JsonException)
        {
            return [];
        }

        return (profile?.Bikes ?? []).Concat(profile?.Shoes ?? []).Select(g => new Gear
        {
            Id = g.Id,
            AthleteId = athlete.Id,
            Kind = g.Id.StartsWith('b') ? GearKind.Bike : GearKind.Shoes,
            Name = g.Name?.Trim(),
            Nickname = g.Nickname?.Trim(),
            Distance = g.Distance,
            Primary = g.Primary ?? false,
            // The profile only lists gear in use.
            Retired = false,
            RawJson = StravaJson.Serialize(g),
            SyncedAt = athlete.SyncedAt,
        });
    }

    private static GearItem ToItem(string id, Gear? gear, List<ActivityUsage> used, int rank) => new(
        id,
        string.IsNullOrWhiteSpace(gear?.Name) ? $"Gear {id}" : gear.Name.Trim(),
        gear?.Kind ?? (id.StartsWith('b') ? GearKind.Bike : GearKind.Shoes),
        gear?.Nickname,
        gear?.BrandName,
        gear?.ModelName,
        gear?.Description,
        gear?.Primary ?? false,
        gear?.Retired ?? false,
        gear is not null,
        gear?.Distance ?? 0,
        Sum(used),
        used.Count > 0 ? used.Min(a => a.Date) : null,
        used.Count > 0 ? used.Max(a => a.Date) : null,
        Ref(used.MaxBy(a => a.Distance)),
        Ref(used.Where(a => a.Elevation > 0).MaxBy(a => a.Elevation)),
        Ref(used.MaxBy(a => a.MovingTime)),
        used.GroupBy(a => a.SportType ?? a.Type ?? "Other")
            .Select(g => new SportUsage(g.Key, Sum(g)))
            .OrderByDescending(s => s.Totals.Distance)
            .ThenByDescending(s => s.Totals.Count)
            .ToList(),
        used.GroupBy(a => a.Date.Year)
            .Select(g => new YearUsage(g.Key, Sum(g)))
            .OrderBy(y => y.Year)
            .ToList(),
        rank);

    private static List<GearMonth> Months(List<ActivityUsage> withGear, DateOnly today)
    {
        if (withGear.Count == 0) return [];

        var totals = withGear
            .GroupBy(a => (a.Date.Year, a.Date.Month))
            .ToDictionary(
                g => g.Key,
                g => (IReadOnlyDictionary<string, Totals>)g.GroupBy(a => a.GearId!).ToDictionary(x => x.Key, Sum));

        // Every month, including empty ones, so charts get an even time axis.
        var first = withGear.Min(a => a.Date);
        var months = new List<GearMonth>();
        for (var month = new DateOnly(first.Year, first.Month, 1); month <= today; month = month.AddMonths(1))
        {
            months.Add(new GearMonth(month, totals.GetValueOrDefault((month.Year, month.Month)) ?? new Dictionary<string, Totals>()));
        }
        return months;
    }

    private static List<GearTimeline> Timelines(Dictionary<string, List<ActivityUsage>> byGear) =>
        byGear.Select(g =>
        {
            var running = Totals.Zero;
            var points = g.Value
                .GroupBy(a => a.Date)
                .OrderBy(d => d.Key)
                .Select(day =>
                {
                    running += Sum(day);
                    return new GearTimelinePoint(day.Key, running);
                })
                .ToList();
            return new GearTimeline(g.Key, points);
        }).ToList();

    private static Totals Sum(IEnumerable<ActivityUsage> used) =>
        used.Aggregate(Totals.Zero, (sum, a) => sum + new Totals(1, a.Distance, a.MovingTime, a.Elevation));

    private static ActivityRef? Ref(ActivityUsage? a) =>
        a is null ? null : new ActivityRef(a.Id, a.Name, a.Date, a.Distance, a.MovingTime, a.Elevation);
}
