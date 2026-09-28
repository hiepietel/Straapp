namespace Straapp.Application.Strava.Models;

/// <summary>A bike ("b…") or pair of shoes ("g…").</summary>
public record SummaryGear
{
    public required string Id { get; init; }
    public int ResourceState { get; init; }
    public string? Name { get; init; }
    public string? Nickname { get; init; }
    /// <summary>The default for new activities of its kind.</summary>
    public bool? Primary { get; init; }
    public bool? Retired { get; init; }
    /// <summary>Metres, lifetime.</summary>
    public double Distance { get; init; }
    /// <summary>Distance in the athlete's preferred unit.</summary>
    public double? ConvertedDistance { get; init; }
}

/// <summary><c>GET /gear/{id}</c>.</summary>
public sealed record DetailedGear : SummaryGear
{
    public string? BrandName { get; init; }
    public string? ModelName { get; init; }
    /// <summary>Bikes only.</summary>
    public int? FrameType { get; init; }
    public string? Description { get; init; }
    public double? Weight { get; init; }
}
