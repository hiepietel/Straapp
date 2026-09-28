namespace Straapp.Application.Strava.Models;

/// <summary>A planned route, from <c>GET /athletes/{id}/routes</c> or <c>GET /routes/{id}</c>.</summary>
public sealed record StravaRoute
{
    public long Id { get; init; }
    /// <summary>Same as <see cref="Id"/>; route ids overflow JavaScript numbers, so prefer this one in the UI.</summary>
    public string? IdStr { get; init; }
    public SummaryAthlete? Athlete { get; init; }
    public string? Name { get; init; }
    public string? Description { get; init; }
    /// <summary>Metres.</summary>
    public double Distance { get; init; }
    /// <summary>Metres.</summary>
    public double? ElevationGain { get; init; }
    /// <summary>Seconds.</summary>
    public int? EstimatedMovingTime { get; init; }
    public PolylineMap? Map { get; init; }
    public bool? Private { get; init; }
    public bool? Starred { get; init; }
    /// <summary>1 ride, 2 run.</summary>
    public int? Type { get; init; }
    /// <summary>1 road, 2 mountain bike, 3 cross, 4 trail, 5 mixed.</summary>
    public int? SubType { get; init; }
    /// <summary>Unix seconds.</summary>
    public long? Timestamp { get; init; }
    public DateTimeOffset? CreatedAt { get; init; }
    public DateTimeOffset? UpdatedAt { get; init; }
    public IReadOnlyList<SummarySegment>? Segments { get; init; }
}
