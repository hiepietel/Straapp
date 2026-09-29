using Straapp.Application.Abstractions;
using Straapp.Domain.Athletes;

namespace Straapp.Application.GearStats;

/// <summary>A bike or pair of shoes as a filter shows it.</summary>
public sealed record GearLabel(string Id, string Name, GearKind Kind, bool Retired);

/// <summary>Names gear the way the gear page does: stored details, then the profile, then a placeholder.</summary>
public static class GearNames
{
    /// <param name="gearIds">Most used first; the result keeps that order.</param>
    public static async Task<IReadOnlyList<GearLabel>> LabelAsync(
        IAthleteRepository athletes, long athleteId, IReadOnlyList<string> gearIds, CancellationToken ct = default)
    {
        if (gearIds.Count == 0) return [];

        var known = (await athletes.GetGearAsync(athleteId, ct)).ToDictionary(g => g.Id);
        // The profile names current gear the sync may not have fetched details for yet.
        foreach (var gear in GearService.ProfileGear(await athletes.GetAthleteAsync(athleteId, ct)))
        {
            known.TryAdd(gear.Id, gear);
        }

        return gearIds
            .Select(id =>
            {
                var gear = known.GetValueOrDefault(id);
                return new GearLabel(
                    id,
                    string.IsNullOrWhiteSpace(gear?.Name) ? $"Gear {id}" : gear.Name.Trim(),
                    gear?.Kind ?? (id.StartsWith('b') ? GearKind.Bike : GearKind.Shoes),
                    gear?.Retired ?? false);
            })
            .ToList();
    }
}
