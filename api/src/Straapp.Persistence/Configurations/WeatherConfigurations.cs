using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Straapp.Domain.Activities;

namespace Straapp.Persistence.Configurations;

// Weather is fetched separately from the activity, but belongs to it: deleted with it (so a
// re-synced activity gets its weather looked up again), and its samples are deleted with the weather.

internal sealed class ActivityWeatherConfiguration : IEntityTypeConfiguration<ActivityWeather>
{
    public void Configure(EntityTypeBuilder<ActivityWeather> builder)
    {
        builder.HasKey(w => w.ActivityId);
        builder.HasOne<Activity>().WithOne().HasForeignKey<ActivityWeather>(w => w.ActivityId).OnDelete(DeleteBehavior.Cascade);
        builder.HasMany(w => w.Samples).WithOne().HasForeignKey(h => h.ActivityId).OnDelete(DeleteBehavior.Cascade);
    }
}

internal sealed class WeatherSampleConfiguration : IEntityTypeConfiguration<WeatherSample>
{
    public void Configure(EntityTypeBuilder<WeatherSample> builder) => builder.HasKey(h => new { h.ActivityId, h.Time });
}
