using Straapp.Application.Abstractions;
using Straapp.Application.Weather;
using Straapp.Domain.Activities;

namespace Straapp.UnitTests.Weather;

public class WeatherServiceTests
{
    private static readonly DateTimeOffset Start = new(2026, 6, 1, 10, 0, 0, TimeSpan.Zero);

    private readonly FakeWeatherRepository _weather = new();

    private void AddTarget(bool eligible) =>
        _weather.Targets[1] = new WeatherTarget(1, Start, 3600, 7200, 50, 20, eligible);

    private Task<WeatherReport?> GetAsync() => new WeatherService(_weather).GetAsync(1, 1);

    [Fact]
    public async Task Unknown_activity_has_no_report()
    {
        Assert.Null(await GetAsync());
    }

    [Fact]
    public async Task Indoor_activity_is_not_applicable()
    {
        AddTarget(eligible: false);

        var report = await GetAsync();

        Assert.Equal(WeatherStatus.NotApplicable, report!.Status);
        Assert.Equal(Start.AddHours(1), report.End);
        Assert.Equal(7200, report.UtcOffsetSeconds);
    }

    [Fact]
    public async Task Outdoor_activity_without_stored_weather_is_pending()
    {
        AddTarget(eligible: true);

        Assert.Equal(WeatherStatus.Pending, (await GetAsync())!.Status);
    }

    [Fact]
    public async Task Stored_weather_without_samples_is_unavailable()
    {
        AddTarget(eligible: true);
        _weather.Stored[1] = new ActivityWeather { ActivityId = 1, Source = "unavailable: nothing" };

        Assert.Equal(WeatherStatus.Unavailable, (await GetAsync())!.Status);
    }

    [Fact]
    public async Task Stored_samples_are_ready()
    {
        AddTarget(eligible: true);
        _weather.Stored[1] = new ActivityWeather
        {
            ActivityId = 1,
            Latitude = 50.1,
            Longitude = 20.1,
            Elevation = 220,
            Source = "open-meteo",
            Samples = [new WeatherSample { ActivityId = 1, Time = Start, Temperature = 18.5, WindDirection = 90 }],
        };

        var report = await GetAsync();

        Assert.Equal(WeatherStatus.Ready, report!.Status);
        Assert.Equal(new WeatherPlace(50.1, 20.1, 220, "open-meteo"), report.Place);
        var sample = Assert.Single(report.Samples);
        Assert.Equal(18.5, sample.Temperature);
        Assert.Equal(90, sample.WindDirection);
    }
}
