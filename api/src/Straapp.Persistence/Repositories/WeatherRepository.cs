using System.Linq.Expressions;
using Microsoft.EntityFrameworkCore;
using Straapp.Application.Abstractions;
using Straapp.Domain.Activities;

namespace Straapp.Persistence.Repositories;

internal sealed class WeatherRepository(StraappDbContext db) : IWeatherRepository
{
    // A real place outdoors: manual activities have no start point, and trainer or virtual ones
    // either none or a made-up one (Zwift's Watopia sits in the Pacific).
    private static readonly Expression<Func<Activity, bool>> Eligible = a =>
        a.StartLatitude != null && a.StartLongitude != null && !a.Trainer && !a.Manual
        && (a.SportType == null || !a.SportType.StartsWith("Virtual"))
        && (a.Type == null || !a.Type.StartsWith("Virtual"));

    public async Task<IReadOnlyList<WeatherTarget>> GetPendingAsync(DateTimeOffset startedBefore, int take, CancellationToken ct = default) =>
        await db.Activities
            .Where(Eligible)
            .Where(a => a.StartDate < startedBefore && !db.ActivityWeather.Any(w => w.ActivityId == a.Id))
            .OrderByDescending(a => a.StartDate)
            .Take(take)
            .Select(a => new WeatherTarget(a.Id, a.StartDate, a.ElapsedTime, a.UtcOffset, a.StartLatitude, a.StartLongitude, true))
            .ToListAsync(ct);

    private static readonly Func<Activity, bool> IsEligible = Eligible.Compile();

    public async Task<WeatherTarget?> GetTargetAsync(long athleteId, long activityId, CancellationToken ct = default)
    {
        var activity = await db.Activities
            .AsNoTracking()
            .Where(a => a.Id == activityId && a.AthleteId == athleteId)
            .Select(a => new Activity
            {
                Id = a.Id, StartDate = a.StartDate, ElapsedTime = a.ElapsedTime, UtcOffset = a.UtcOffset,
                StartLatitude = a.StartLatitude, StartLongitude = a.StartLongitude,
                Trainer = a.Trainer, Manual = a.Manual, SportType = a.SportType, Type = a.Type,
            })
            .FirstOrDefaultAsync(ct);
        return activity is null
            ? null
            : new WeatherTarget(activity.Id, activity.StartDate, activity.ElapsedTime, activity.UtcOffset,
                activity.StartLatitude, activity.StartLongitude, IsEligible(activity));
    }

    public Task<ActivityWeather?> GetAsync(long activityId, CancellationToken ct = default) =>
        db.ActivityWeather
            .AsNoTracking()
            .Include(w => w.Samples.OrderBy(h => h.Time))
            .FirstOrDefaultAsync(w => w.ActivityId == activityId, ct);

    public async Task<IReadOnlyList<ActivityWeatherSample>> GetSamplesAsync(long athleteId, CancellationToken ct = default) =>
        await (
            from s in db.WeatherSamples
            join a in db.Activities on s.ActivityId equals a.Id
            where a.AthleteId == athleteId
            select new ActivityWeatherSample(
                s.ActivityId, a.StartDate, a.ElapsedTime, s.Time,
                s.Temperature, s.ApparentTemperature, s.Precipitation, s.WindSpeed, s.WindGusts, s.WeatherCode))
            .ToListAsync(ct);

    public async Task ReplaceAsync(ActivityWeather weather, CancellationToken ct = default)
    {
        try
        {
            await using var transaction = await db.Database.BeginTransactionAsync(ct);
            // Cascades to the samples.
            await db.ActivityWeather.Where(w => w.ActivityId == weather.ActivityId).ExecuteDeleteAsync(ct);
            db.ActivityWeather.Add(weather);
            await db.SaveChangesAsync(ct);
            await transaction.CommitAsync(ct);
        }
        finally
        {
            // A backfill stores thousands through one context: keep none tracked.
            db.ChangeTracker.Clear();
        }
    }
}
