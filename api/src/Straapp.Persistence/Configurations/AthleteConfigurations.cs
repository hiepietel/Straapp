using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Straapp.Domain.Athletes;

namespace Straapp.Persistence.Configurations;

internal sealed class AthleteConfiguration : IEntityTypeConfiguration<Athlete>
{
    public void Configure(EntityTypeBuilder<Athlete> builder)
    {
        builder.HasKey(a => a.Id);
        builder.Property(a => a.Id).ValueGeneratedNever();
        builder.Property(a => a.RawJson).HasColumnType("jsonb");
        builder.Property(a => a.ZonesJson).HasColumnType("jsonb");
    }
}

internal sealed class GearConfiguration : IEntityTypeConfiguration<Gear>
{
    public void Configure(EntityTypeBuilder<Gear> builder)
    {
        builder.HasKey(g => g.Id);
        builder.Property(g => g.Kind).HasConversion<string>();
        builder.Property(g => g.RawJson).HasColumnType("jsonb");
        builder.HasIndex(g => g.AthleteId);
    }
}
