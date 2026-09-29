using Microsoft.EntityFrameworkCore;
using Straapp.Domain.Activities;
using Straapp.Domain.Athletes;

namespace Straapp.Persistence;

public sealed class StraappDbContext(DbContextOptions<StraappDbContext> options) : DbContext(options)
{
    public DbSet<Athlete> Athletes => Set<Athlete>();
    public DbSet<Gear> Gear => Set<Gear>();
    public DbSet<Activity> Activities => Set<Activity>();
    public DbSet<ActivityStreams> ActivityStreams => Set<ActivityStreams>();
    public DbSet<ActivityLap> ActivityLaps => Set<ActivityLap>();
    public DbSet<ActivitySplit> ActivitySplits => Set<ActivitySplit>();
    public DbSet<ActivityEffort> ActivityEfforts => Set<ActivityEffort>();
    public DbSet<ActivityZone> ActivityZones => Set<ActivityZone>();
    public DbSet<ActivityComment> ActivityComments => Set<ActivityComment>();
    public DbSet<ActivityKudo> ActivityKudos => Set<ActivityKudo>();
    public DbSet<ActivityWeather> ActivityWeather => Set<ActivityWeather>();
    public DbSet<WeatherSample> WeatherSamples => Set<WeatherSample>();

    protected override void OnModelCreating(ModelBuilder modelBuilder) =>
        modelBuilder.ApplyConfigurationsFromAssembly(typeof(StraappDbContext).Assembly);
}
