using Straapp.Application.Abstractions;
using Straapp.Application.Statistics;
using Straapp.Domain.Activities;

namespace Straapp.Application.Accounts;

public enum TotalsPeriod
{
    /// <summary>The last 4 weeks, today included.</summary>
    Recent,
    Year,
    AllTime,
}

public sealed record SportTotals(SportGroup Sport, Totals Totals);

/// <param name="From">The first day counted; null for all time.</param>
/// <param name="Sports">One entry per sport with activities in the period, most distance first.</param>
public sealed record PeriodTotals(TotalsPeriod Period, DateOnly? From, Totals All, IReadOnlyList<SportTotals> Sports);

/// <summary>The totals and records of one set of activities: all of them, the public ones or the private ones.</summary>
public sealed record VisibilityTotals(
    IReadOnlyList<PeriodTotals> Periods,
    ActivityRef? Longest,
    ActivityRef? BiggestClimb,
    ActivityRef? LongestTime);

/// <param name="Public">Activities others can see (everyone or followers).</param>
/// <param name="Private">Activities only the athlete can see.</param>
public sealed record ProfileTotals(DateOnly Today, VisibilityTotals All, VisibilityTotals Public, VisibilityTotals Private);

/// <summary>
/// The profile page's totals, counted from the stored activities (every sport, not just Strava's run,
/// ride and swim) and split by who can see them. Covers whatever the sync has stored so far.
/// </summary>
public sealed class ProfileTotalsService(IActivityRepository activities)
{
    public async Task<ProfileTotals> GetAsync(long athleteId, DateOnly today, CancellationToken ct = default)
    {
        var usage = await activities.GetUsageAsync(athleteId, ct);

        return new ProfileTotals(
            today,
            Summarise(usage, today),
            Summarise(usage.Where(a => !a.Private).ToList(), today),
            Summarise(usage.Where(a => a.Private).ToList(), today));
    }

    private static VisibilityTotals Summarise(IReadOnlyList<ActivityUsage> used, DateOnly today)
    {
        PeriodTotals Period(TotalsPeriod period, DateOnly? from)
        {
            var inPeriod = used.Where(a => (from is null || a.Date >= from) && a.Date <= today).ToList();
            return new PeriodTotals(
                period,
                from,
                Sum(inPeriod),
                inPeriod.GroupBy(a => SportGroups.Of(a.SportType, a.Type))
                    .Select(g => new SportTotals(g.Key, Sum(g)))
                    .OrderByDescending(s => s.Totals.Distance)
                    .ThenByDescending(s => s.Totals.Count)
                    .ToList());
        }

        return new VisibilityTotals(
            [
                Period(TotalsPeriod.Recent, today.AddDays(-27)),
                Period(TotalsPeriod.Year, new DateOnly(today.Year, 1, 1)),
                Period(TotalsPeriod.AllTime, null),
            ],
            Ref(used.Where(a => a.Distance > 0).MaxBy(a => a.Distance)),
            Ref(used.Where(a => a.Elevation > 0).MaxBy(a => a.Elevation)),
            Ref(used.Where(a => a.MovingTime > 0).MaxBy(a => a.MovingTime)));
    }

    private static Totals Sum(IEnumerable<ActivityUsage> used) =>
        used.Aggregate(Totals.Zero, (sum, a) => sum + new Totals(1, a.Distance, a.MovingTime, a.Elevation));

    private static ActivityRef? Ref(ActivityUsage? a) =>
        a is null ? null : new ActivityRef(a.Id, a.Name, a.Date, a.Distance, a.MovingTime, a.Elevation);
}
