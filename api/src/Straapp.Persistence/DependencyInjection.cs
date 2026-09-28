using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Straapp.Application.Abstractions;
using Straapp.Persistence.Repositories;

namespace Straapp.Persistence;

public static class DependencyInjection
{
    public const string ConnectionStringName = "Straapp";

    public static IServiceCollection AddPersistence(this IServiceCollection services, IConfiguration configuration)
    {
        services.AddDbContext<StraappDbContext>(options => options
            .UseNpgsql(configuration.GetConnectionString(ConnectionStringName))
            .UseSnakeCaseNamingConvention());

        services.AddScoped<IActivityRepository, ActivityRepository>();
        services.AddScoped<IAthleteRepository, AthleteRepository>();
        return services;
    }

    /// <summary>Creates the database if needed and applies any pending migrations.</summary>
    public static async Task MigrateDatabaseAsync(this IServiceProvider services, CancellationToken ct = default)
    {
        await using var scope = services.CreateAsyncScope();
        await scope.ServiceProvider.GetRequiredService<StraappDbContext>().Database.MigrateAsync(ct);
    }
}
