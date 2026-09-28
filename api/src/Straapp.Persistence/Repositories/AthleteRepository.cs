using Microsoft.EntityFrameworkCore;
using Straapp.Application.Abstractions;
using Straapp.Domain.Athletes;

namespace Straapp.Persistence.Repositories;

internal sealed class AthleteRepository(StraappDbContext db) : IAthleteRepository
{
    public Task<Athlete?> GetAthleteAsync(long athleteId, CancellationToken ct = default) =>
        db.Athletes.AsNoTracking().FirstOrDefaultAsync(a => a.Id == athleteId, ct);

    public Task UpsertAthleteAsync(Athlete athlete, CancellationToken ct = default) =>
        UpsertAsync(db.Athletes, athlete, athlete.Id, ct);

    public async Task<IReadOnlySet<string>> GetGearIdsAsync(CancellationToken ct = default)
    {
        var ids = await db.Gear.Select(g => g.Id).ToListAsync(ct);
        return ids.ToHashSet();
    }

    public Task UpsertGearAsync(Gear gear, CancellationToken ct = default) =>
        UpsertAsync(db.Gear, gear, gear.Id, ct);

    private async Task UpsertAsync<T>(DbSet<T> set, T entity, object key, CancellationToken ct) where T : class
    {
        var existing = await set.FindAsync([key], ct);
        if (existing is null) set.Add(entity);
        else db.Entry(existing).CurrentValues.SetValues(entity);

        await db.SaveChangesAsync(ct);
        db.ChangeTracker.Clear();
    }
}
