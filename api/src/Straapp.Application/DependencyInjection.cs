using Microsoft.Extensions.DependencyInjection;
using Straapp.Application.Accounts;
using Straapp.Application.GearStats;
using Straapp.Application.Heatmap;
using Straapp.Application.Insights;
using Straapp.Application.Statistics;
using Straapp.Application.StoredActivities;
using Straapp.Application.Sync;
using Straapp.Application.Weather;

namespace Straapp.Application;

public static class DependencyInjection
{
    public static IServiceCollection AddApplication(this IServiceCollection services)
    {
        services.AddScoped<LoginService>();
        services.AddScoped<ProfileService>();
        services.AddScoped<ProfileTotalsService>();
        services.AddScoped<StatisticsService>();
        services.AddScoped<GearService>();
        services.AddScoped<ActivityService>();
        services.AddScoped<HeatmapService>();
        services.AddScoped<InsightsService>();
        services.AddScoped<WeatherService>();
        services.AddScoped<WeatherSyncService>();

        services.AddSingleton<SyncStatus>();
        services.AddScoped<ActivitySyncService>();
        return services;
    }
}
