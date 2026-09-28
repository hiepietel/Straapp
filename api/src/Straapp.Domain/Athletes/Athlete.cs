namespace Straapp.Domain.Athletes;

public class Athlete
{
    /// <summary>Strava's athlete id.</summary>
    public long Id { get; set; }
    public string? Username { get; set; }
    public string? Firstname { get; set; }
    public string? Lastname { get; set; }
    public string? City { get; set; }
    public string? Country { get; set; }
    public string? Sex { get; set; }
    public bool Premium { get; set; }
    /// <summary>Kilograms.</summary>
    public double? Weight { get; set; }
    /// <summary>Functional threshold power, watts.</summary>
    public int? Ftp { get; set; }
    public string? MeasurementPreference { get; set; }
    public string? ProfileUrl { get; set; }
    public DateTimeOffset? CreatedAt { get; set; }

    /// <summary>The full <c>GET /athlete</c> response as JSON.</summary>
    public string RawJson { get; set; } = "{}";
    /// <summary>The <c>GET /athlete/zones</c> response as JSON.</summary>
    public string? ZonesJson { get; set; }
    /// <summary>The <c>GET /athletes/{id}/stats</c> response as JSON: Strava's own recent, year and all-time totals.</summary>
    public string? StatsJson { get; set; }
    public DateTimeOffset SyncedAt { get; set; }
}

public enum GearKind
{
    Bike,
    Shoes,
}

public class Gear
{
    /// <summary>Strava's id: "b…" for bikes, "g…" for shoes.</summary>
    public string Id { get; set; } = "";
    public long AthleteId { get; set; }
    public GearKind Kind { get; set; }
    public string? Name { get; set; }
    public string? Nickname { get; set; }
    public string? BrandName { get; set; }
    public string? ModelName { get; set; }
    public string? Description { get; set; }
    /// <summary>Metres, lifetime.</summary>
    public double Distance { get; set; }
    public bool Primary { get; set; }
    public bool Retired { get; set; }

    /// <summary>The full <c>GET /gear/{id}</c> response as JSON.</summary>
    public string RawJson { get; set; } = "{}";
    public DateTimeOffset SyncedAt { get; set; }
}
