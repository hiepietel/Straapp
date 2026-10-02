using Straapp.Application.Statistics;

namespace Straapp.Application.DeviceStats;

public sealed record DeviceYear(int Year, Totals Totals);

public sealed record DeviceItem(
    string Name,
    Totals Totals,
    DateOnly? FirstUsed,
    DateOnly? LastUsed,
    IReadOnlyList<DeviceYear> Years,
    int Color);

public sealed record DeviceMonth(DateOnly Month, IReadOnlyDictionary<string, Totals> Devices);

public sealed record DeviceTimelinePoint(DateOnly Date, Totals Totals);

public sealed record DeviceTimeline(string Name, IReadOnlyList<DeviceTimelinePoint> Points);

public sealed record DeviceReport(
    DateOnly Today,
    IReadOnlyList<DeviceItem> Devices,
    IReadOnlyList<DeviceMonth> Months,
    IReadOnlyList<DeviceTimeline> Timelines,
    DateOnly? HistoryFrom);