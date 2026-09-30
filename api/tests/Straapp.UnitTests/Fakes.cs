using System.Net;
using System.Runtime.CompilerServices;
using Straapp.Application.Abstractions;
using Straapp.Application.Strava;
using Straapp.Application.Strava.Models;
using Straapp.Application.Weather;
using Straapp.Domain.Activities;
using Straapp.Domain.Athletes;
using StravaZone = Straapp.Application.Strava.Models.ActivityZone;

namespace Straapp.UnitTests;

/// <summary>In-memory repositories and clients: each test fills in only what the code under test reads.</summary>
internal sealed class FakeActivityRepository : IActivityRepository
{
    public List<DailyTotals> DailyTotals { get; } = [];
    public List<ActivityUsage> Usage { get; } = [];
    public List<ActivityRoute> Routes { get; } = [];
    public List<ActivityFacts> Facts { get; } = [];
    public HashSet<long> StoredIds { get; } = [];
    public List<Activity> Replaced { get; } = [];

    /// <summary>What <see cref="GetRoutesAsync"/> was last asked for.</summary>
    public (DateOnly? From, DateOnly? To) RoutesRange { get; private set; }

    public Task<IReadOnlySet<long>> GetIdsAsync(DateTimeOffset from, DateTimeOffset to, CancellationToken ct = default) =>
        Task.FromResult<IReadOnlySet<long>>(StoredIds);

    public Task ReplaceAsync(Activity activity, CancellationToken ct = default)
    {
        Replaced.Add(activity);
        StoredIds.Add(activity.Id);
        return Task.CompletedTask;
    }

    public Task<IReadOnlyList<DailyTotals>> GetDailyTotalsAsync(long athleteId, DateOnly from, DateOnly to, CancellationToken ct = default) =>
        Task.FromResult<IReadOnlyList<DailyTotals>>(DailyTotals.Where(d => d.Day >= from && d.Day < to).ToList());

    public Task<IReadOnlyList<Activity>> GetPageAsync(long athleteId, int skip, int take, CancellationToken ct = default) =>
        throw new NotSupportedException();

    public Task<Activity?> GetAsync(long athleteId, long activityId, CancellationToken ct = default) =>
        throw new NotSupportedException();

    public Task<ActivityStreams?> GetStreamsAsync(long athleteId, long activityId, CancellationToken ct = default) =>
        throw new NotSupportedException();

    public Task<IReadOnlyList<ActivityUsage>> GetUsageAsync(long athleteId, CancellationToken ct = default) =>
        Task.FromResult<IReadOnlyList<ActivityUsage>>(Usage);

    public Task<IReadOnlyList<ActivityRoute>> GetRoutesAsync(long athleteId, DateOnly? from, DateOnly? to, CancellationToken ct = default)
    {
        RoutesRange = (from, to);
        return Task.FromResult<IReadOnlyList<ActivityRoute>>(Routes);
    }

    public Task<IReadOnlyList<ActivityFacts>> GetFactsAsync(long athleteId, CancellationToken ct = default) =>
        Task.FromResult<IReadOnlyList<ActivityFacts>>(Facts);
}

internal sealed class FakeAthleteRepository : IAthleteRepository
{
    public Athlete? Athlete { get; set; }
    public List<Gear> Gear { get; } = [];

    public Task<Athlete?> GetAthleteAsync(long athleteId, CancellationToken ct = default) => Task.FromResult(Athlete);

    public Task UpsertAthleteAsync(Athlete athlete, CancellationToken ct = default)
    {
        Athlete = athlete;
        return Task.CompletedTask;
    }

    public Task<IReadOnlyList<Gear>> GetGearAsync(long athleteId, CancellationToken ct = default) =>
        Task.FromResult<IReadOnlyList<Gear>>(Gear);

    public Task UpsertGearAsync(Gear gear, CancellationToken ct = default)
    {
        Gear.RemoveAll(g => g.Id == gear.Id);
        Gear.Add(gear);
        return Task.CompletedTask;
    }
}

internal sealed class FakeWeatherRepository : IWeatherRepository
{
    public List<WeatherTarget> Pending { get; } = [];
    public Dictionary<long, WeatherTarget> Targets { get; } = [];
    public Dictionary<long, ActivityWeather> Stored { get; } = [];
    public List<ActivityWeatherSample> Samples { get; } = [];

    public Task<IReadOnlyList<WeatherTarget>> GetPendingAsync(DateTimeOffset startedBefore, int take, CancellationToken ct = default) =>
        Task.FromResult<IReadOnlyList<WeatherTarget>>(Pending
            .Where(t => t.StartDate < startedBefore && !Stored.ContainsKey(t.ActivityId))
            .OrderByDescending(t => t.StartDate)
            .Take(take)
            .ToList());

    public Task<WeatherTarget?> GetTargetAsync(long athleteId, long activityId, CancellationToken ct = default) =>
        Task.FromResult(Targets.GetValueOrDefault(activityId));

    public Task<ActivityWeather?> GetAsync(long activityId, CancellationToken ct = default) =>
        Task.FromResult(Stored.GetValueOrDefault(activityId));

    public Task ReplaceAsync(ActivityWeather weather, CancellationToken ct = default)
    {
        Stored[weather.ActivityId] = weather;
        return Task.CompletedTask;
    }

    public Task<IReadOnlyList<ActivityWeatherSample>> GetSamplesAsync(long athleteId, CancellationToken ct = default) =>
        Task.FromResult<IReadOnlyList<ActivityWeatherSample>>(Samples);
}

/// <summary>Answers per activity id: a series, or an exception to throw.</summary>
internal sealed class FakeWeatherClient : IWeatherClient
{
    public Dictionary<double, Func<WeatherSeries>> ByLatitude { get; } = [];
    public List<(double Latitude, DateOnly From, DateOnly To)> Calls { get; } = [];

    public Task<WeatherSeries> GetQuarterHourlyAsync(double latitude, double longitude, DateOnly from, DateOnly to, CancellationToken ct = default)
    {
        Calls.Add((latitude, from, to));
        return Task.FromResult(ByLatitude[latitude]());
    }
}

internal sealed class FakeStravaClient : IStravaClient
{
    public DetailedAthlete Athlete { get; set; } = new() { Id = 1, Firstname = "Test" };
    public List<SummaryActivity> Activities { get; } = [];
    /// <summary>Thrown instead of returning the activity's detail.</summary>
    public Dictionary<long, Exception> DetailFailures { get; } = [];
    public List<long> DetailRequests { get; } = [];
    public bool ZonesAllowed { get; set; } = true;
    public int ZoneRequests { get; private set; }

    public Task<DetailedAthlete> GetAthleteAsync(CancellationToken ct = default) => Task.FromResult(Athlete);

    public Task<AthleteZones> GetAthleteZonesAsync(CancellationToken ct = default) =>
        throw new StravaApiException(HttpStatusCode.NotFound, "No zones");

    public Task<DetailedGear> GetGearAsync(string gearId, CancellationToken ct = default) =>
        Task.FromResult(new DetailedGear { Id = gearId, Name = $"Name of {gearId}" });

    public async IAsyncEnumerable<SummaryActivity> GetAllActivitiesAsync(
        DateTimeOffset? before = null, DateTimeOffset? after = null, [EnumeratorCancellation] CancellationToken ct = default)
    {
        foreach (var activity in Activities)
        {
            await Task.Yield();
            yield return activity;
        }
    }

    public Task<DetailedActivity> GetActivityAsync(long activityId, bool includeAllEfforts = false, CancellationToken ct = default)
    {
        DetailRequests.Add(activityId);
        if (DetailFailures.TryGetValue(activityId, out var failure)) throw failure;
        var summary = Activities.Single(a => a.Id == activityId);
        return Task.FromResult(new DetailedActivity
        {
            Id = summary.Id,
            Name = summary.Name,
            Athlete = new MetaAthlete { Id = Athlete.Id },
            StartDate = summary.StartDate,
            StartDateLocal = summary.StartDateLocal,
            SportType = summary.SportType,
        });
    }

    public Task<StreamSet> GetActivityStreamsAsync(long activityId, CancellationToken ct = default) =>
        throw new StravaApiException(HttpStatusCode.NotFound, "Manual activity");

    public Task<IReadOnlyList<StravaZone>> GetActivityZonesAsync(long activityId, CancellationToken ct = default)
    {
        ZoneRequests++;
        if (!ZonesAllowed) throw new StravaApiException(HttpStatusCode.PaymentRequired, "Subscription needed");
        return Task.FromResult<IReadOnlyList<StravaZone>>([]);
    }

    public Task<IReadOnlyList<Comment>> GetActivityCommentsAsync(long activityId, int pageSize = 30, string? afterCursor = null, CancellationToken ct = default) =>
        Task.FromResult<IReadOnlyList<Comment>>([]);

    public Task<IReadOnlyList<SummaryAthlete>> GetActivityKudoersAsync(long activityId, PageQuery page, CancellationToken ct = default) =>
        Task.FromResult<IReadOnlyList<SummaryAthlete>>([]);
}
