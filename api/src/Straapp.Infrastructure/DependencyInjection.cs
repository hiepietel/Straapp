using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Microsoft.Extensions.Options;
using Straapp.Application.Strava;
using Straapp.Application.Weather;
using Straapp.Infrastructure.Strava;
using Straapp.Infrastructure.Weather;

namespace Straapp.Infrastructure;

public static class DependencyInjection
{
    public static IServiceCollection AddInfrastructure(this IServiceCollection services, IConfiguration configuration)
    {
        services.AddOptions<StravaOptions>()
            .Bind(configuration.GetSection(StravaOptions.SectionName))
            .ValidateDataAnnotations()
            .ValidateOnStart();

        services.TryAddSingleton(TimeProvider.System);
        services.AddSingleton<IStravaAuthService, StravaAuthService>();
        services.AddHttpClient(StravaAuthService.HttpClientName);

        services.AddSingleton<StravaRateLimiter>();
        services.AddSingleton<IStravaRateLimitStatus>(sp => sp.GetRequiredService<StravaRateLimiter>());

        services.AddTransient<StravaRateLimitHandler>();
        services.AddTransient<StravaAuthHandler>();
        services.AddHttpClient<IStravaClient, StravaClient>((sp, http) =>
            {
                http.BaseAddress = sp.GetRequiredService<IOptions<StravaOptions>>().Value.ApiBaseUrl;
                // A request may sit out the rest of a 15-minute rate-limit window before it's sent.
                http.Timeout = TimeSpan.FromMinutes(20);
            })
            // Outermost first: the rate limiter may wait and retry, and each try gets a fresh token.
            .AddHttpMessageHandler<StravaRateLimitHandler>()
            .AddHttpMessageHandler<StravaAuthHandler>();

        services.AddOptions<WeatherOptions>().Bind(configuration.GetSection(WeatherOptions.SectionName));
        services.AddHttpClient<IWeatherClient, OpenMeteoClient>((sp, http) =>
        {
            http.BaseAddress = sp.GetRequiredService<IOptions<WeatherOptions>>().Value.ArchiveUrl;
            http.Timeout = TimeSpan.FromSeconds(30);
            http.DefaultRequestHeaders.UserAgent.ParseAdd("Straapp/1.0 (personal training log)");
        });

        return services;
    }
}
