using System.Net;
using System.Net.Http.Json;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Straapp.Application.Strava;
using Straapp.Application.Strava.Models;

namespace Straapp.Infrastructure.Strava;

/// <summary>
/// Holds one athlete's tokens in memory (a restart means logging in again).
/// Registered as a singleton so every request shares the session.
/// </summary>
internal sealed class StravaAuthService(
    IHttpClientFactory httpClientFactory,
    IOptions<StravaOptions> options,
    TimeProvider time,
    ILogger<StravaAuthService> logger) : IStravaAuthService
{
    public const string HttpClientName = "StravaAuth";

    /// <summary>Refresh a little early so a token never expires mid-request.</summary>
    private static readonly TimeSpan ExpiryMargin = TimeSpan.FromSeconds(60);

    private readonly StravaOptions _options = options.Value;

    // The refresh token is single-use, so concurrent callers must share one refresh.
    private readonly SemaphoreSlim _refreshLock = new(1, 1);

    private Session? _session;

    private sealed record Session(string AccessToken, string RefreshToken, DateTimeOffset ExpiresAt, long AthleteId);

    public bool IsSignedIn => _session is not null;

    public Uri BuildAuthorizeUrl(Uri redirectUri, string state)
    {
        return new Uri(QueryString.Append(_options.AuthorizeUrl.ToString(),
            ("client_id", _options.ClientId),
            ("redirect_uri", redirectUri.ToString()),
            ("response_type", "code"),
            ("approval_prompt", "auto"),
            ("scope", string.Join(',', _options.Scopes)),
            ("state", state)));
    }

    public async Task<DetailedAthlete> CompleteLoginAsync(string code, string? grantedScopes, CancellationToken ct = default)
    {
        // People can untick permissions on Strava's page; without them we'd only get 401s later.
        var granted = (grantedScopes ?? "").Split(',', StringSplitOptions.RemoveEmptyEntries);
        var missing = _options.Scopes.Except(granted).ToArray();
        if (missing.Length > 0)
        {
            throw new StravaNotAuthenticatedException(
                $"Strava access was only partly granted. Missing: {string.Join(", ", missing)}. Please log in again and allow everything.");
        }

        var token = await RequestTokenAsync(new()
        {
            ["grant_type"] = "authorization_code",
            ["code"] = code,
        }, ct);

        var athlete = token.Athlete
            ?? throw new StravaApiException(HttpStatusCode.BadGateway, "Strava's login response had no athlete.");

        _session = new Session(token.AccessToken, token.RefreshToken, token.ExpiresAtTime, athlete.Id);
        logger.LogInformation("Logged in to Strava as athlete {AthleteId}", athlete.Id);
        return athlete;
    }

    public async Task<string> GetAccessTokenAsync(CancellationToken ct = default)
    {
        var session = _session ?? throw NotSignedIn();
        if (!IsExpiring(session)) return session.AccessToken;

        await _refreshLock.WaitAsync(ct);
        try
        {
            // Someone else may have refreshed while we waited.
            session = _session ?? throw NotSignedIn();
            if (!IsExpiring(session)) return session.AccessToken;

            TokenResponse token;
            try
            {
                token = await RequestTokenAsync(new()
                {
                    ["grant_type"] = "refresh_token",
                    ["refresh_token"] = session.RefreshToken,
                }, ct);
            }
            catch (StravaNotAuthenticatedException)
            {
                // A rejected refresh token can never work again; a network error might.
                _session = null;
                throw;
            }

            // Strava rotates the refresh token, so always keep the newest one.
            _session = session with
            {
                AccessToken = token.AccessToken,
                RefreshToken = token.RefreshToken,
                ExpiresAt = token.ExpiresAtTime,
            };
            logger.LogInformation("Refreshed the Strava access token");
            return _session.AccessToken;
        }
        finally
        {
            _refreshLock.Release();
        }
    }

    public long GetAthleteId() => (_session ?? throw NotSignedIn()).AthleteId;

    public void SignOut() => _session = null;

    private bool IsExpiring(Session session) => session.ExpiresAt - ExpiryMargin <= time.GetUtcNow();

    private static StravaNotAuthenticatedException NotSignedIn() =>
        new("You are not logged in to Strava. Open /api/auth/login first.");

    private async Task<TokenResponse> RequestTokenAsync(Dictionary<string, string> grant, CancellationToken ct)
    {
        grant["client_id"] = _options.ClientId;
        grant["client_secret"] = _options.ClientSecret;

        var http = httpClientFactory.CreateClient(HttpClientName);
        using var response = await http.PostAsync(_options.TokenUrl, new FormUrlEncodedContent(grant), ct);

        if (response.StatusCode is HttpStatusCode.BadRequest or HttpStatusCode.Unauthorized)
        {
            var body = await response.Content.ReadAsStringAsync(ct);
            logger.LogWarning("Strava refused the token request ({Status}): {Body}", (int)response.StatusCode, body);
            throw new StravaNotAuthenticatedException(
                $"Strava refused the login ({(int)response.StatusCode}). Please log in again; if it keeps failing, check Strava:ClientId and Strava:ClientSecret.");
        }
        if (!response.IsSuccessStatusCode)
        {
            throw new StravaApiException(HttpStatusCode.BadGateway,
                $"Could not get a Strava token ({(int)response.StatusCode}).");
        }

        return await response.Content.ReadFromJsonAsync<TokenResponse>(StravaJson.Options, ct)
            ?? throw new StravaApiException(HttpStatusCode.BadGateway, "Strava sent an empty token response.");
    }

    private sealed record TokenResponse
    {
        public required string AccessToken { get; init; }
        public required string RefreshToken { get; init; }
        /// <summary>Unix seconds.</summary>
        public long ExpiresAt { get; init; }
        /// <summary>Only on the authorization_code grant; the profile without clubs, gear or zones.</summary>
        public DetailedAthlete? Athlete { get; init; }

        public DateTimeOffset ExpiresAtTime => DateTimeOffset.FromUnixTimeSeconds(ExpiresAt);
    }
}
