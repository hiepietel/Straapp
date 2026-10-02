using Straapp.Application.Abstractions;
using Straapp.Application.Statistics;

namespace Straapp.Application.DeviceStats;

/// <summary>Device usage statistics from the stored activities only.</summary>
public sealed class DeviceService(IActivityRepository activities)
{
    private const string UnknownDevice = "Unknown device";

    public async Task<DeviceReport> GetReportAsync(long athleteId, DateOnly today, CancellationToken ct = default)
    {
        var usage = await activities.GetUsageAsync(athleteId, ct);
        var grouped = usage
            .GroupBy(a => string.IsNullOrWhiteSpace(a.DeviceName) ? UnknownDevice : a.DeviceName.Trim(), StringComparer.OrdinalIgnoreCase)
            .Select(g => (Name: g.First().DeviceName is { } name && !string.IsNullOrWhiteSpace(name) ? name.Trim() : UnknownDevice, Activities: g.ToList()))
            .OrderByDescending(g => Sum(g.Activities).Distance)
            .ThenByDescending(g => Sum(g.Activities).Count)
            .ToList();

        var devices = grouped.Select((g, color) => new DeviceItem(
            g.Name,
            Sum(g.Activities),
            g.Activities.Min(a => a.Date),
            g.Activities.Max(a => a.Date),
            g.Activities.GroupBy(a => a.Date.Year)
                .Select(year => new DeviceYear(year.Key, Sum(year)))
                .OrderBy(year => year.Year)
                .ToList(),
            color)).ToList();

        var months = Months(usage, today);
        var timelines = grouped.Select(g =>
        {
            var running = Totals.Zero;
            var points = g.Activities
                .GroupBy(a => a.Date)
                .OrderBy(day => day.Key)
                .Select(day =>
                {
                    running += Sum(day);
                    return new DeviceTimelinePoint(day.Key, running);
                })
                .ToList();
            return new DeviceTimeline(g.Name, points);
        }).ToList();

        return new DeviceReport(today, devices, months, timelines, usage.Count > 0 ? usage.Min(a => a.Date) : null);
    }

    private static List<DeviceMonth> Months(IReadOnlyList<Abstractions.ActivityUsage> usage, DateOnly today)
    {
        if (usage.Count == 0) return [];

        var totals = usage
            .GroupBy(a => (a.Date.Year, a.Date.Month))
            .ToDictionary(
                month => month.Key,
                month => (IReadOnlyDictionary<string, Totals>)month
                    .GroupBy(a => string.IsNullOrWhiteSpace(a.DeviceName) ? UnknownDevice : a.DeviceName.Trim(), StringComparer.OrdinalIgnoreCase)
                    .ToDictionary(
                        group => group.First().DeviceName is { } name && !string.IsNullOrWhiteSpace(name) ? name.Trim() : UnknownDevice,
                        Sum,
                        StringComparer.OrdinalIgnoreCase));

        var first = usage.Min(a => a.Date);
        var months = new List<DeviceMonth>();
        for (var month = new DateOnly(first.Year, first.Month, 1); month <= today; month = month.AddMonths(1))
        {
            months.Add(new DeviceMonth(month, totals.GetValueOrDefault((month.Year, month.Month)) ?? new Dictionary<string, Totals>()));
        }
        return months;
    }

    private static Totals Sum(IEnumerable<Abstractions.ActivityUsage> activities) =>
        activities.Aggregate(Totals.Zero, (sum, activity) => sum + new Totals(1, activity.Distance, activity.MovingTime, activity.Elevation));
}