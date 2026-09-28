using System.Text.Json;
using Straapp.Application.Abstractions;
using Straapp.Application.Strava;
using Straapp.Application.Strava.Models;

namespace Straapp.Application.Accounts;

/// <summary>What the profile page shows, as last synced: never fetched from Strava on the way.</summary>
/// <param name="Stats">Null until a sync has fetched Strava's totals.</param>
/// <param name="Zones">Null until a sync has fetched them, or if Strava won't share them.</param>
public sealed record Profile(DetailedAthlete Athlete, ActivityStats? Stats, AthleteZones? Zones);

public sealed class ProfileService(IAthleteRepository athletes)
{
    /// <summary>Null if the athlete isn't stored.</summary>
    public async Task<Profile?> GetAsync(long athleteId, CancellationToken ct = default)
    {
        var athlete = await athletes.GetAthleteAsync(athleteId, ct);
        if (athlete is null) return null;

        return new Profile(
            Read<DetailedAthlete>(athlete.RawJson) ?? new DetailedAthlete { Id = athlete.Id, Firstname = athlete.Firstname, Lastname = athlete.Lastname },
            Read<ActivityStats>(athlete.StatsJson),
            Read<AthleteZones>(athlete.ZonesJson));
    }

    private static T? Read<T>(string? json) where T : class =>
        json is null ? null : JsonSerializer.Deserialize<T>(json, StravaJson.Options);
}
