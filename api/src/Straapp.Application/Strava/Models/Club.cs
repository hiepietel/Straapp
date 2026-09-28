namespace Straapp.Application.Strava.Models;

/// <summary><c>GET /athlete/clubs</c> entry.</summary>
public sealed record SummaryClub
{
    public long Id { get; init; }
    public int ResourceState { get; init; }
    public string? Name { get; init; }
    public string? Profile { get; init; }
    public string? ProfileMedium { get; init; }
    public string? CoverPhoto { get; init; }
    public string? CoverPhotoSmall { get; init; }
    /// <summary>Deprecated by Strava in favour of <see cref="ActivityTypes"/>.</summary>
    public string? SportType { get; init; }
    public IReadOnlyList<string>? ActivityTypes { get; init; }
    public string? City { get; init; }
    public string? State { get; init; }
    public string? Country { get; init; }
    public bool? Private { get; init; }
    public int? MemberCount { get; init; }
    public bool? Featured { get; init; }
    public bool? Verified { get; init; }
    /// <summary>The club's vanity URL slug.</summary>
    public string? Url { get; init; }
    public string? Membership { get; init; }
    public bool? Admin { get; init; }
    public bool? Owner { get; init; }
}
