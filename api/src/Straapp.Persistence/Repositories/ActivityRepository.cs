using Microsoft.EntityFrameworkCore;
using Straapp.Application.Abstractions;
using Straapp.Domain.Activities;

namespace Straapp.Persistence.Repositories;

internal sealed class ActivityRepository(StraappDbContext db) : IActivityRepository
{
    public async Task<IReadOnlySet<long>> GetIdsAsync(DateTimeOffset from, DateTimeOffset to, CancellationToken ct = default)
    {
        var ids = await db.Activities
            .Where(a => a.StartDate >= from && a.StartDate < to)
            .Select(a => a.Id)
            .ToListAsync(ct);
        return ids.ToHashSet();
    }

    public async Task<IReadOnlyList<DailyTotals>> GetDailyTotalsAsync(
        long athleteId, DateOnly from, DateOnly to, CancellationToken ct = default)
    {
        var start = from.ToDateTime(TimeOnly.MinValue);
        var end = to.ToDateTime(TimeOnly.MinValue);

        var rows = await db.Activities
            .Where(a => a.AthleteId == athleteId && a.StartDateLocal >= start && a.StartDateLocal < end)
            .GroupBy(a => new { a.StartDateLocal.Date, a.SportType, a.Type })
            .Select(g => new
            {
                g.Key.Date,
                g.Key.SportType,
                g.Key.Type,
                Count = g.Count(),
                Distance = g.Sum(a => a.Distance),
                MovingTime = g.Sum(a => (long)a.MovingTime),
                Elevation = g.Sum(a => a.TotalElevationGain),
            })
            .ToListAsync(ct);

        return rows
            .Select(r => new DailyTotals(
                DateOnly.FromDateTime(r.Date), r.SportType, r.Type, r.Count, r.Distance, r.MovingTime, r.Elevation))
            .ToList();
    }

    public async Task<IReadOnlyList<Activity>> GetPageAsync(long athleteId, int skip, int take, CancellationToken ct = default) =>
        await db.Activities
            .AsNoTracking()
            .Where(a => a.AthleteId == athleteId)
            .OrderByDescending(a => a.StartDate)
            .ThenByDescending(a => a.Id)
            .Skip(skip)
            .Take(take)
            // Everything but the raw payload, which can be hundreds of kilobytes per activity.
            .Select(a => new Activity
            {
                Id = a.Id, AthleteId = a.AthleteId, Name = a.Name, Description = a.Description,
                SportType = a.SportType, Type = a.Type, WorkoutType = a.WorkoutType,
                StartDate = a.StartDate, StartDateLocal = a.StartDateLocal, Timezone = a.Timezone, UtcOffset = a.UtcOffset,
                Distance = a.Distance, MovingTime = a.MovingTime, ElapsedTime = a.ElapsedTime,
                TotalElevationGain = a.TotalElevationGain, ElevHigh = a.ElevHigh, ElevLow = a.ElevLow,
                AverageSpeed = a.AverageSpeed, MaxSpeed = a.MaxSpeed,
                AverageHeartrate = a.AverageHeartrate, MaxHeartrate = a.MaxHeartrate, AverageCadence = a.AverageCadence,
                AverageWatts = a.AverageWatts, WeightedAverageWatts = a.WeightedAverageWatts, MaxWatts = a.MaxWatts,
                DeviceWatts = a.DeviceWatts, Kilojoules = a.Kilojoules, Calories = a.Calories,
                AverageTemp = a.AverageTemp, SufferScore = a.SufferScore,
                StartLatitude = a.StartLatitude, StartLongitude = a.StartLongitude,
                EndLatitude = a.EndLatitude, EndLongitude = a.EndLongitude, LocationCountry = a.LocationCountry,
                SummaryPolyline = a.SummaryPolyline,
                KudosCount = a.KudosCount, CommentCount = a.CommentCount, AchievementCount = a.AchievementCount,
                PrCount = a.PrCount, AthleteCount = a.AthleteCount, PhotoCount = a.PhotoCount,
                Trainer = a.Trainer, Commute = a.Commute, Manual = a.Manual, Private = a.Private,
                Visibility = a.Visibility, GearId = a.GearId, DeviceName = a.DeviceName,
                SyncedAt = a.SyncedAt,
            })
            .ToListAsync(ct);

    public Task<Activity?> GetAsync(long athleteId, long activityId, CancellationToken ct = default) =>
        db.Activities.AsNoTracking().FirstOrDefaultAsync(a => a.Id == activityId && a.AthleteId == athleteId, ct);

    public Task<ActivityStreams?> GetStreamsAsync(long athleteId, long activityId, CancellationToken ct = default) =>
        db.ActivityStreams
            .AsNoTracking()
            .Where(s => s.ActivityId == activityId && db.Activities.Any(a => a.Id == activityId && a.AthleteId == athleteId))
            .FirstOrDefaultAsync(ct);

    public async Task<IReadOnlyList<ActivityUsage>> GetUsageAsync(long athleteId, CancellationToken ct = default)
    {
        var rows = await db.Activities
            .Where(a => a.AthleteId == athleteId)
            .OrderBy(a => a.StartDateLocal)
            .Select(a => new
            {
                a.Id, a.Name, a.GearId, a.SportType, a.Type, a.StartDateLocal,
                a.Distance, a.MovingTime, a.TotalElevationGain,
                Private = a.Private || a.Visibility == "only_me",
            })
            .ToListAsync(ct);

        return rows
            .Select(r => new ActivityUsage(
                r.Id, r.Name, r.GearId, r.SportType, r.Type, DateOnly.FromDateTime(r.StartDateLocal),
                r.Distance, r.MovingTime, r.TotalElevationGain, r.Private))
            .ToList();
    }

    public async Task<IReadOnlyList<ActivityRoute>> GetRoutesAsync(
        long athleteId, DateOnly? from, DateOnly? to, CancellationToken ct = default)
    {
        var query = db.Activities.Where(a => a.AthleteId == athleteId && a.SummaryPolyline != null && a.SummaryPolyline != "");
        if (from is { } f)
        {
            var start = f.ToDateTime(TimeOnly.MinValue);
            query = query.Where(a => a.StartDateLocal >= start);
        }
        if (to is { } t)
        {
            var end = t.ToDateTime(TimeOnly.MinValue);
            query = query.Where(a => a.StartDateLocal < end);
        }

        var rows = await query
            .OrderBy(a => a.StartDateLocal)
            .Select(a => new { a.Id, a.Name, a.SportType, a.Type, a.StartDateLocal, a.Distance, a.GearId, a.SummaryPolyline })
            .ToListAsync(ct);

        return rows
            .Select(r => new ActivityRoute(
                r.Id, r.Name, r.SportType, r.Type, DateOnly.FromDateTime(r.StartDateLocal), r.Distance, r.GearId, r.SummaryPolyline!))
            .ToList();
    }

    public async Task ReplaceAsync(Activity activity, CancellationToken ct = default)
    {
        try
        {
            await using var transaction = await db.Database.BeginTransactionAsync(ct);

            // Cascades to streams, laps, splits, efforts, zones, comments and kudos.
            await db.Activities.Where(a => a.Id == activity.Id).ExecuteDeleteAsync(ct);
            db.Activities.Add(activity);
            await db.SaveChangesAsync(ct);

            await transaction.CommitAsync(ct);
        }
        finally
        {
            // A sync stores hundreds of activities through one context: keep none tracked,
            // and don't let a failed one be saved again with the next.
            db.ChangeTracker.Clear();
        }
    }
}
