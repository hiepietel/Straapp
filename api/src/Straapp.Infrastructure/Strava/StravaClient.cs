using System.Globalization;
using System.Net;
using System.Net.Http.Json;
using System.Runtime.CompilerServices;
using System.Text.Json;
using Straapp.Application.Strava;
using Straapp.Application.Strava.Models;

namespace Straapp.Infrastructure.Strava;

/// <summary>Typed <see cref="HttpClient"/> over Strava API v3. Tokens are added by <see cref="StravaAuthHandler"/>.</summary>
internal sealed class StravaClient(HttpClient http, IStravaAuthService auth) : IStravaClient
{
    /// <summary>Strava's own maximum page size.</summary>
    private const int MaxPerPage = 200;

    private const string StreamKeys = "time,distance,latlng,altitude,velocity_smooth,heartrate,cadence,watts,temp,moving,grade_smooth";

    // ---- athlete ----

    public Task<DetailedAthlete> GetAthleteAsync(CancellationToken ct = default) =>
        GetAsync<DetailedAthlete>("athlete", ct);

    public Task<AthleteZones> GetAthleteZonesAsync(CancellationToken ct = default) =>
        GetAsync<AthleteZones>("athlete/zones", ct);

    // Note the plural "athletes": this one takes the id in the path.
    public Task<ActivityStats> GetAthleteStatsAsync(CancellationToken ct = default) =>
        GetAsync<ActivityStats>($"athletes/{auth.GetAthleteId()}/stats", ct);

    public Task<DetailedGear> GetGearAsync(string gearId, CancellationToken ct = default) =>
        GetAsync<DetailedGear>($"gear/{Uri.EscapeDataString(gearId)}", ct);

    // ---- activities ----

    public async IAsyncEnumerable<SummaryActivity> GetAllActivitiesAsync(
        DateTimeOffset? before = null, DateTimeOffset? after = null,
        [EnumeratorCancellation] CancellationToken ct = default)
    {
        for (var page = 1; ; page++)
        {
            var batch = await GetListAsync<SummaryActivity>(QueryString.Append("athlete/activities",
                ("before", before),
                ("after", after),
                ("page", page),
                ("per_page", MaxPerPage)), ct);
            foreach (var activity in batch) yield return activity;

            // A short page is the last one; saves the extra empty request.
            if (batch.Count < MaxPerPage) yield break;
        }
    }

    public Task<DetailedActivity> GetActivityAsync(long activityId, bool includeAllEfforts = false, CancellationToken ct = default) =>
        GetAsync<DetailedActivity>(QueryString.Append($"activities/{activityId}",
            ("include_all_efforts", includeAllEfforts)), ct);

    public Task<StreamSet> GetActivityStreamsAsync(long activityId, CancellationToken ct = default) =>
        // key_by_type: {"altitude": {...}, ...}, which is exactly a StreamSet.
        GetAsync<StreamSet>(QueryString.Append($"activities/{activityId}/streams",
            ("keys", StreamKeys),
            ("key_by_type", true)), ct);

    public Task<IReadOnlyList<ActivityZone>> GetActivityZonesAsync(long activityId, CancellationToken ct = default) =>
        GetListAsync<ActivityZone>($"activities/{activityId}/zones", ct);

    public Task<IReadOnlyList<Comment>> GetActivityCommentsAsync(
        long activityId, int pageSize = 30, string? afterCursor = null, CancellationToken ct = default) =>
        GetListAsync<Comment>(QueryString.Append($"activities/{activityId}/comments",
            ("page_size", pageSize),
            ("after_cursor", afterCursor)), ct);

    public Task<IReadOnlyList<SummaryAthlete>> GetActivityKudoersAsync(long activityId, PageQuery page, CancellationToken ct = default) =>
        GetListAsync<SummaryAthlete>(Paged($"activities/{activityId}/kudos", page), ct);

    // ---- plumbing ----

    private static string Paged(string path, PageQuery page) =>
        QueryString.Append(path, ("page", page.Page), ("per_page", Math.Clamp(page.PerPage, 1, MaxPerPage)));

    private async Task<IReadOnlyList<T>> GetListAsync<T>(string path, CancellationToken ct) =>
        await GetAsync<List<T>>(path, ct);

    private async Task<T> GetAsync<T>(string path, CancellationToken ct)
    {
        using var response = await http.GetAsync(path, ct);
        await EnsureSuccessAsync(response, ct);
        try
        {
            return await response.Content.ReadFromJsonAsync<T>(StravaJson.Options, ct)
                ?? throw new StravaApiException(HttpStatusCode.BadGateway, $"Strava sent an empty response for {path}.");
        }
        catch (JsonException ex)
        {
            throw UnreadableResponse(path, ex);
        }
    }

    /// <summary>Strava's data didn't fit our models: a Strava error like any other, so callers can skip and go on.</summary>
    private static StravaApiException UnreadableResponse(string path, JsonException ex) =>
        new(HttpStatusCode.BadGateway, $"Could not read Strava's response for {path}: {ex.Message}");

    private static async Task EnsureSuccessAsync(HttpResponseMessage response, CancellationToken ct)
    {
        if (response.IsSuccessStatusCode) return;

        var detail = await ReadErrorDetailAsync(response, ct);
        var suffix = detail is null ? "" : $" ({detail})";

        throw response.StatusCode switch
        {
            HttpStatusCode.Unauthorized => new StravaNotAuthenticatedException(
                $"Strava rejected the token{suffix}. Log in again at /api/auth/login."),
            HttpStatusCode.Forbidden => new StravaApiException(HttpStatusCode.Forbidden,
                $"Strava refused access{suffix}. A scope may be missing; log in again."),
            HttpStatusCode.PaymentRequired => new StravaApiException(HttpStatusCode.PaymentRequired,
                $"This data needs a Strava subscription{suffix}."),
            HttpStatusCode.NotFound => new StravaApiException(HttpStatusCode.NotFound, $"Not found on Strava{suffix}."),
            HttpStatusCode.TooManyRequests => new StravaRateLimitException(
                "Strava's rate limit is still exceeded after waiting for a new window.", null),
            _ => new StravaApiException(HttpStatusCode.BadGateway,
                $"Strava responded with {(int)response.StatusCode}{suffix}."),
        };
    }

    /// <summary>Strava's error body: {"message": "...", "errors": [{"resource", "field", "code"}]}.</summary>
    private static async Task<string?> ReadErrorDetailAsync(HttpResponseMessage response, CancellationToken ct)
    {
        try
        {
            var body = await response.Content.ReadFromJsonAsync<ErrorBody>(StravaJson.Options, ct);
            var fields = body?.Errors?.Select(e => $"{e.Resource} {e.Field}: {e.Code}".Trim()) ?? [];
            var parts = new[] { body?.Message }.Concat(fields).Where(p => !string.IsNullOrWhiteSpace(p));
            var detail = string.Join("; ", parts);
            return detail.Length > 0 ? detail : null;
        }
        catch (JsonException)
        {
            return null;
        }
    }

    private sealed record ErrorBody(string? Message, IReadOnlyList<ErrorItem>? Errors);

    private sealed record ErrorItem(string? Resource, string? Field, string? Code);
}
