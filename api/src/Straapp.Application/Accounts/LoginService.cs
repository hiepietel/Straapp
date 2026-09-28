using Straapp.Application.Abstractions;
using Straapp.Application.Strava;
using Straapp.Application.Sync;
using Straapp.Domain.Athletes;

namespace Straapp.Application.Accounts;

/// <summary>Logging in to the app is logging in with Strava; the athlete is stored so the app knows who you are.</summary>
public sealed class LoginService(
    IStravaAuthService auth,
    IAthleteRepository athletes,
    TimeProvider time)
{
    public Uri BuildLoginUrl(Uri callback, string state) => auth.BuildAuthorizeUrl(callback, state);

    /// <summary>
    /// Swaps Strava's one-time code for tokens and makes sure the athlete is stored. Uses only the
    /// profile in Strava's login response: API calls could be held up for up to 15 minutes while a
    /// sync has used up the rate limit, and nobody should wait that long to log in.
    /// </summary>
    public async Task<Athlete> CompleteLoginAsync(string code, string? grantedScopes, CancellationToken ct = default)
    {
        var profile = await auth.CompleteLoginAsync(code, grantedScopes, ct);

        // A stored athlete came from a sync, with more detail (zones, gear) than the login has; keep it.
        if (await athletes.GetAthleteAsync(profile.Id, ct) is { } stored) return stored;

        var athlete = StravaMapper.ToAthlete(profile, zones: null, time.GetUtcNow());
        await athletes.UpsertAthleteAsync(athlete, ct);
        return athlete;
    }

    /// <summary>
    /// The logged-in athlete, or null when the API no longer holds their Strava session
    /// (it is kept in memory, so a restart ends it) and they need to log in again.
    /// </summary>
    public async Task<Athlete?> GetCurrentAsync(long athleteId, CancellationToken ct = default)
    {
        if (!auth.IsSignedIn || auth.GetAthleteId() != athleteId) return null;
        return await athletes.GetAthleteAsync(athleteId, ct);
    }

    public void Logout() => auth.SignOut();
}
