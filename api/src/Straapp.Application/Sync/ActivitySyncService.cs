using System.Net;
using Microsoft.Extensions.Logging;
using Straapp.Application.Abstractions;
using Straapp.Application.Strava;
using Straapp.Application.Strava.Models;
using StravaZone = Straapp.Application.Strava.Models.ActivityZone;

namespace Straapp.Application.Sync;

/// <summary>
/// Copies the athlete's activities from Strava into the database, with everything Strava has about
/// each one: the whole history, or one year. Newest first, so recent activities are there soonest.
/// Activities already stored are skipped, so a sync that stopped (rate limit, restart) picks up where
/// it left off, working further back, when run again.
/// </summary>
public sealed class ActivitySyncService(
    IStravaClient strava,
    IActivityRepository activities,
    IAthleteRepository athletes,
    SyncStatus status,
    TimeProvider time,
    ILogger<ActivitySyncService> logger)
{
    /// <summary>Strava's largest page size.</summary>
    private const int PageSize = 200;

    /// <param name="year">Null syncs the whole history.</param>
    /// <param name="force">Fetch stored activities again too.</param>
    public async Task SyncAsync(int? year, bool force, CancellationToken ct = default)
    {
        var scope = year?.ToString() ?? "the whole history";
        status.Update(_ => new SyncProgress { State = SyncState.Running, Year = year, StartedAt = time.GetUtcNow() });
        try
        {
            await RunAsync(year, force, ct);
            status.Update(p => p with
            {
                State = SyncState.Completed,
                Current = null,
                Message = p.Errors.Count == 0 ? "Done." : $"Done, but {p.Errors.Count} activities failed; run again to retry them.",
                FinishedAt = time.GetUtcNow(),
            });
        }
        catch (Exception ex) when (ex is StravaApiException or OperationCanceledException)
        {
            var message = ex switch
            {
                StravaRateLimitException limit => $"{limit.Message} Run the sync again after {limit.RetryAfter:u}; stored activities are skipped.",
                OperationCanceledException => "Stopped because the API shut down. Run it again to continue.",
                _ => ex.Message,
            };
            logger.LogWarning(ex, "Sync of {Scope} stopped: {Message}", scope, message);
            status.Update(p => p with { State = SyncState.Failed, Current = null, Message = message, FinishedAt = time.GetUtcNow() });
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Sync of {Scope} failed", scope);
            status.Update(p => p with { State = SyncState.Failed, Current = null, Message = ex.Message, FinishedAt = time.GetUtcNow() });
        }
    }

    private async Task RunAsync(int? year, bool force, CancellationToken ct)
    {
        var athlete = await strava.GetAthleteAsync(ct);
        var zones = await OptionalAsync(() => strava.GetAthleteZonesAsync(ct));
        var stats = await OptionalAsync(() => strava.GetAthleteStatsAsync(ct));
        var profile = StravaMapper.ToAthlete(athlete, zones, time.GetUtcNow(), stats);
        // Zones and totals are optional on Strava's side; keep what an earlier sync got rather than wiping it.
        var storedAthlete = await athletes.GetAthleteAsync(athlete.Id, ct);
        profile.ZonesJson ??= storedAthlete?.ZonesJson;
        profile.StatsJson ??= storedAthlete?.StatsJson;
        await athletes.UpsertAthleteAsync(profile, ct);

        // Strava filters by UTC start; for one year, pad a day each side and cut on the local date,
        // so a New Year's Eve run counts toward the year it was run in.
        DateTimeOffset? from = null, to = null;
        if (year is { } y)
        {
            var yearStart = new DateTimeOffset(y, 1, 1, 0, 0, 0, TimeSpan.Zero);
            from = yearStart.AddDays(-1);
            to = yearStart.AddYears(1).AddDays(1);
        }

        // Listing is cheap (one request per 200 activities) and tells us what's missing.
        var summaries = new List<SummaryActivity>();
        await foreach (var summary in strava.GetAllActivitiesAsync(before: to, after: from, ct))
        {
            if (year is null || summary.StartDateLocal.Year == year) summaries.Add(summary);
        }

        // First, while it's only a few requests: the gear page shouldn't wait for hundreds of activities.
        await SyncGearAsync(athlete, summaries, ct);

        var stored = force
            ? new HashSet<long>()
            : await activities.GetIdsAsync(from ?? DateTimeOffset.UnixEpoch, to ?? time.GetUtcNow().AddDays(1), ct);
        var todo = summaries.Where(s => !stored.Contains(s.Id)).OrderByDescending(s => s.StartDate).ToList();
        status.Update(p => p with { Total = summaries.Count, Skipped = summaries.Count - todo.Count });
        logger.LogInformation("Syncing {Todo} of {Total} activities ({Scope}), newest first",
            todo.Count, summaries.Count, year?.ToString() ?? "whole history");

        // Activity zones need a Strava subscription; after the first refusal, stop asking.
        var zonesAllowed = true;

        foreach (var summary in todo)
        {
            status.Update(p => p with { Current = $"{summary.StartDateLocal:yyyy-MM-dd} {summary.Name} ({summary.Id})" });
            try
            {
                var detail = await strava.GetActivityAsync(summary.Id, includeAllEfforts: true, ct);

                // Manual activities have no streams: Strava answers 404.
                var streams = await OptionalAsync(() => strava.GetActivityStreamsAsync(summary.Id, ct));

                IReadOnlyList<StravaZone> activityZones = [];
                if (zonesAllowed)
                {
                    try
                    {
                        activityZones = await strava.GetActivityZonesAsync(summary.Id, ct);
                    }
                    catch (StravaApiException ex) when (ex.StatusCode is HttpStatusCode.PaymentRequired or HttpStatusCode.Forbidden)
                    {
                        zonesAllowed = false;
                        logger.LogInformation("Skipping activity zones: {Message}", ex.Message);
                    }
                }

                var comments = detail.CommentCount > 0 ? await GetAllCommentsAsync(summary.Id, ct) : [];
                var kudoers = detail.KudosCount > 0 ? await GetAllKudoersAsync(summary.Id, ct) : [];

                var activity = StravaMapper.ToActivity(detail, streams, activityZones, comments, kudoers, time.GetUtcNow());
                await activities.ReplaceAsync(activity, ct);
                status.Update(p => p with { Synced = p.Synced + 1 });
            }
            catch (StravaApiException ex) when (ex is not (StravaRateLimitException or StravaNotAuthenticatedException))
            {
                // One broken activity shouldn't stop the rest; it's retried on the next run.
                logger.LogWarning(ex, "Could not sync activity {ActivityId}", summary.Id);
                status.Update(p => p with { Errors = [.. p.Errors, $"{summary.Id}: {ex.Message}"] });
            }
        }

    }

    /// <summary>
    /// Refreshes every bike and pair of shoes: those on the athlete's profile and those the year's
    /// activities used (retired gear is only found that way). Always re-fetched, one request each,
    /// so names, lifetime distances and retired flags stay current.
    /// </summary>
    private async Task SyncGearAsync(DetailedAthlete athlete, IEnumerable<SummaryActivity> summaries, CancellationToken ct)
    {
        var ids = summaries.Select(s => s.GearId)
            .Concat((athlete.Bikes ?? []).Concat(athlete.Shoes ?? []).Select(g => g.Id))
            .OfType<string>()
            .Where(id => id.Length > 0)
            .ToHashSet();

        foreach (var gearId in ids)
        {
            status.Update(p => p with { Current = $"Gear {gearId}" });
            var gear = await OptionalAsync(() => strava.GetGearAsync(gearId, ct));
            if (gear is not null) await athletes.UpsertGearAsync(StravaMapper.ToGear(gear, athlete.Id, time.GetUtcNow()), ct);
        }
    }

    private async Task<IReadOnlyList<Comment>> GetAllCommentsAsync(long activityId, CancellationToken ct)
    {
        var all = new List<Comment>();
        string? cursor = null;
        while (true)
        {
            var page = await strava.GetActivityCommentsAsync(activityId, PageSize, cursor, ct);
            all.AddRange(page);
            cursor = page.LastOrDefault()?.Cursor;
            if (page.Count < PageSize || cursor is null) return all;
        }
    }

    private async Task<IReadOnlyList<SummaryAthlete>> GetAllKudoersAsync(long activityId, CancellationToken ct)
    {
        var all = new List<SummaryAthlete>();
        for (var page = 1; ; page++)
        {
            var batch = await strava.GetActivityKudoersAsync(activityId, new PageQuery(page, PageSize), ct);
            all.AddRange(batch);
            if (batch.Count < PageSize) return all;
        }
    }

    /// <summary>Null when Strava has nothing (404) or won't share it with this athlete (402/403).</summary>
    private async Task<T?> OptionalAsync<T>(Func<Task<T>> fetch) where T : class
    {
        try
        {
            return await fetch();
        }
        catch (StravaApiException ex) when (ex.StatusCode is HttpStatusCode.NotFound or HttpStatusCode.PaymentRequired or HttpStatusCode.Forbidden)
        {
            logger.LogDebug("Skipped optional Strava data: {Message}", ex.Message);
            return null;
        }
    }
}
