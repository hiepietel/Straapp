using Straapp.Application.Strava.Models;

namespace Straapp.Application.Strava;

/// <summary>
/// Strava's OAuth "authorization code" login for a single athlete.
/// Temporary: the session lives in memory and is lost on restart.
/// </summary>
public interface IStravaAuthService
{
    bool IsSignedIn { get; }

    /// <summary>Strava's "Authorize" page, which sends the browser back to <paramref name="redirectUri"/> with <c>?code=</c>.</summary>
    Uri BuildAuthorizeUrl(Uri redirectUri, string state);

    /// <summary>
    /// Checks the granted scopes and swaps the one-time code for tokens. Returns the athlete's profile
    /// from Strava's login response, so logging in costs no rate-limited API request.
    /// </summary>
    Task<DetailedAthlete> CompleteLoginAsync(string code, string? grantedScopes, CancellationToken ct = default);

    /// <summary>A valid access token, refreshed first if it has (nearly) expired.</summary>
    Task<string> GetAccessTokenAsync(CancellationToken ct = default);

    /// <summary>The logged-in athlete's id, known from the login response.</summary>
    long GetAthleteId();

    void SignOut();
}
