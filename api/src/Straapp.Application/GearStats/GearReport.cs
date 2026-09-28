using Straapp.Application.Statistics;
using Straapp.Domain.Athletes;

namespace Straapp.Application.GearStats;

/// <summary>How much one sport type used a piece of gear.</summary>
public sealed record SportUsage(string SportType, Totals Totals);

public sealed record YearUsage(int Year, Totals Totals);

/// <summary>A bike or pair of shoes, with everything the stored activities say about it.</summary>
/// <param name="Known">
/// False when activities mention it but its details aren't stored: the next sync fetches them,
/// unless it was deleted on Strava.
/// </param>
/// <param name="StravaDistance">Strava's own lifetime total in metres, which includes activities older than the stored history.</param>
/// <param name="Totals">Summed over the stored activities that used it.</param>
/// <param name="Color">Index into the web app's palette, fixed by overall distance so it never changes with filters.</param>
public sealed record GearItem(
    string Id,
    string Name,
    GearKind Kind,
    string? Nickname,
    string? BrandName,
    string? ModelName,
    string? Description,
    bool Primary,
    bool Retired,
    bool Known,
    double StravaDistance,
    Totals Totals,
    DateOnly? FirstUsed,
    DateOnly? LastUsed,
    ActivityRef? Longest,
    ActivityRef? BiggestClimb,
    ActivityRef? LongestTime,
    IReadOnlyList<SportUsage> Sports,
    IReadOnlyList<YearUsage> Years,
    int Color);

/// <summary>One calendar month: each gear's totals (gear with nothing that month is left out).</summary>
public sealed record GearMonth(DateOnly Month, IReadOnlyDictionary<string, Totals> Gear);

/// <summary>A gear's running totals after each day it was used, oldest first.</summary>
public sealed record GearTimeline(string GearId, IReadOnlyList<GearTimelinePoint> Points);

public sealed record GearTimelinePoint(DateOnly Date, Totals Totals);

/// <param name="Gear">Most used first (by distance in the stored history).</param>
/// <param name="Months">Every month from the first use of any gear to this month.</param>
/// <param name="WithoutGear">Stored activities with no gear set, which no item counts.</param>
/// <param name="HistoryFrom">The oldest stored activity: totals only cover what has been synced.</param>
public sealed record GearReport(
    DateOnly Today,
    IReadOnlyList<GearItem> Gear,
    IReadOnlyList<GearMonth> Months,
    IReadOnlyList<GearTimeline> Timelines,
    Totals WithoutGear,
    DateOnly? HistoryFrom);
