using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Straapp.Domain.Activities;

namespace Straapp.Persistence.Configurations;

// Ids come from Strava, so none of them are generated here.
// Every part of an activity is deleted with it (ON DELETE CASCADE), which is how a re-sync replaces it.

internal sealed class ActivityConfiguration : IEntityTypeConfiguration<Activity>
{
    public void Configure(EntityTypeBuilder<Activity> builder)
    {
        builder.HasKey(a => a.Id);
        builder.Property(a => a.Id).ValueGeneratedNever();
        builder.Property(a => a.StartDateLocal).HasColumnType("timestamp without time zone");
        builder.Property(a => a.RawJson).HasColumnType("jsonb");

        builder.HasIndex(a => a.StartDate);
        builder.HasIndex(a => new { a.AthleteId, a.SportType });
        // Statistics sum per local day.
        builder.HasIndex(a => new { a.AthleteId, a.StartDateLocal });

        builder.HasOne(a => a.Streams).WithOne().HasForeignKey<ActivityStreams>(s => s.ActivityId).OnDelete(DeleteBehavior.Cascade);
        builder.HasMany(a => a.Laps).WithOne().HasForeignKey(l => l.ActivityId).OnDelete(DeleteBehavior.Cascade);
        builder.HasMany(a => a.Splits).WithOne().HasForeignKey(s => s.ActivityId).OnDelete(DeleteBehavior.Cascade);
        builder.HasMany(a => a.Efforts).WithOne().HasForeignKey(e => e.ActivityId).OnDelete(DeleteBehavior.Cascade);
        builder.HasMany(a => a.Zones).WithOne().HasForeignKey(z => z.ActivityId).OnDelete(DeleteBehavior.Cascade);
        builder.HasMany(a => a.Comments).WithOne().HasForeignKey(c => c.ActivityId).OnDelete(DeleteBehavior.Cascade);
        builder.HasMany(a => a.Kudos).WithOne().HasForeignKey(k => k.ActivityId).OnDelete(DeleteBehavior.Cascade);
    }
}

internal sealed class ActivityStreamsConfiguration : IEntityTypeConfiguration<ActivityStreams>
{
    public void Configure(EntityTypeBuilder<ActivityStreams> builder) => builder.HasKey(s => s.ActivityId);
}

internal sealed class ActivityLapConfiguration : IEntityTypeConfiguration<ActivityLap>
{
    public void Configure(EntityTypeBuilder<ActivityLap> builder) => builder.HasKey(l => new { l.ActivityId, l.Id });
}

internal sealed class ActivitySplitConfiguration : IEntityTypeConfiguration<ActivitySplit>
{
    public void Configure(EntityTypeBuilder<ActivitySplit> builder)
    {
        builder.HasKey(s => new { s.ActivityId, s.Unit, s.Index });
        builder.Property(s => s.Unit).HasConversion<string>();
    }
}

internal sealed class ActivityEffortConfiguration : IEntityTypeConfiguration<ActivityEffort>
{
    public void Configure(EntityTypeBuilder<ActivityEffort> builder)
    {
        builder.HasKey(e => new { e.ActivityId, e.Kind, e.Id });
        builder.Property(e => e.Kind).HasConversion<string>();
        builder.HasIndex(e => e.SegmentId);
    }
}

internal sealed class ActivityZoneConfiguration : IEntityTypeConfiguration<ActivityZone>
{
    public void Configure(EntityTypeBuilder<ActivityZone> builder) => builder.HasKey(z => new { z.ActivityId, z.Type });
}

internal sealed class ActivityCommentConfiguration : IEntityTypeConfiguration<ActivityComment>
{
    public void Configure(EntityTypeBuilder<ActivityComment> builder)
    {
        builder.HasKey(c => c.Id);
        builder.Property(c => c.Id).ValueGeneratedNever();
    }
}

internal sealed class ActivityKudoConfiguration : IEntityTypeConfiguration<ActivityKudo>
{
    public void Configure(EntityTypeBuilder<ActivityKudo> builder) => builder.HasKey(k => new { k.ActivityId, k.Position });
}
