using Microsoft.Extensions.DependencyInjection;
using Straapp.Application.Accounts;
using Straapp.Application.GearStats;
using Straapp.Application.Statistics;
using Straapp.Application.Sync;

namespace Straapp.Application;

public static class DependencyInjection
{
    public static IServiceCollection AddApplication(this IServiceCollection services)
    {
        services.AddScoped<LoginService>();
        services.AddScoped<StatisticsService>();
        services.AddScoped<GearService>();

        services.AddSingleton<SyncStatus>();
        services.AddScoped<ActivitySyncService>();
        return services;
    }
}
