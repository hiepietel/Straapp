using System.ComponentModel.DataAnnotations;

namespace Straapp.Infrastructure.Strava;

/// <summary>The "Strava" config section. Keep <see cref="ClientSecret"/> in user secrets, not appsettings.</summary>
public sealed class StravaOptions
{
    public const string SectionName = "Strava";

    [Required]
    public string ClientId { get; set; } = "";

    [Required]
    public string ClientSecret { get; set; } = "";

    /// <summary>
    /// read_all: private routes and segments. profile:read_all: zones.
    /// activity:read_all: private activities.
    /// </summary>
    public string[] Scopes { get; set; } = ["read", "read_all", "profile:read_all", "activity:read_all"];

    public Uri ApiBaseUrl { get; set; } = new("https://www.strava.com/api/v3/");

    public Uri AuthorizeUrl { get; set; } = new("https://www.strava.com/oauth/authorize");

    public Uri TokenUrl { get; set; } = new("https://www.strava.com/oauth/token");
}
