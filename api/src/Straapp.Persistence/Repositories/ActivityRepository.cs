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
