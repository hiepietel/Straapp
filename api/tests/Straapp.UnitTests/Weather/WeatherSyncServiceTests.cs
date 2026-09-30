using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using Microsoft.Extensions.Time.Testing;
using Straapp.Application.Abstractions;
using Straapp.Application.Weather;
using Straapp.Domain.Activities;

namespace Straapp.UnitTests.Weather;

public class WeatherSyncServiceTests
{
    private static readonly DateTimeOffset Now = new(2026, 6, 10, 12, 0, 0, TimeSpan.Zero);

    private readonly FakeWeatherRepository _weather = new();
    private readonly FakeWeatherClient _client = new();
    private readonly FakeTimeProvider _time = new(Now);

    private WeatherSyncService Service => new(
        _weather, _client, Options.Create(new WeatherOptions { RequestDelaySeconds = 0 }), _time, NullLogger<WeatherSyncService>.Instance);

    /// <summary>The latitude doubles as the key the fake client answers by.</summary>
    private void AddTarget(long id, DateTimeOffset start, int elapsedSeconds = 2400) =>
        _weather.Pending.Add(new WeatherTarget(id, start, elapsedSeconds, 0, id, 20, true));

    private static WeatherSeries Series(params DateTimeOffset[] times) =>
        new(50.05, 20.05, 230, times.Select(t => new WeatherSample { Time = t, Temperature = 15 }).ToList());

    private static DateTimeOffset At(int day, int hour, int minute) => new(2026, 6, day, hour, minute, 0, TimeSpan.Zero);

    [Fact]
    public async Task Keeps_two_hours_either_side_of_the_activity_on_quarter_hours()
    {
        // 10:07 for 40 minutes: 08:00 to 13:00 is kept.
        AddTarget(1, At(1, 10, 7));
        _client.ByLatitude[1] = () => Series(At(1, 7, 45), At(1, 8, 0), At(1, 10, 30), At(1, 13, 0), At(1, 13, 15));

        var count = await Service.SyncAsync();

        Assert.Equal(1, count);
        Assert.Equal((1d, new DateOnly(2026, 6, 1), new DateOnly(2026, 6, 1)), Assert.Single(_client.Calls));
        var stored = _weather.Stored[1];
        Assert.Equal([At(1, 8, 0), At(1, 10, 30), At(1, 13, 0)], stored.Samples.Select(s => s.Time));
        Assert.All(stored.Samples, s => Assert.Equal(1, s.ActivityId));
        Assert.Equal(WeatherSyncService.Source, stored.Source);
        Assert.Equal(50.05, stored.Latitude);
        Assert.Equal(Now, stored.FetchedAt);
    }

    [Fact]
    public async Task Waits_until_an_activity_is_two_days_old()
    {
        AddTarget(1, Now.AddDays(-1));
        _client.ByLatitude[1] = () => Series();

        Assert.Equal(0, await Service.SyncAsync());
        Assert.Empty(_client.Calls);
    }

    [Fact]
    public async Task No_weather_is_stored_empty_so_it_is_not_asked_for_again()
    {
        AddTarget(1, At(1, 10, 0));
        _client.ByLatitude[1] = () => throw new WeatherUnavailableException("out of range");

        Assert.Equal(1, await Service.SyncAsync());

        var stored = _weather.Stored[1];
        Assert.Empty(stored.Samples);
        Assert.Equal("unavailable: out of range", stored.Source);
        Assert.Single(_client.Calls);
    }

    [Fact]
    public async Task Stops_at_the_rate_limit()
    {
        AddTarget(1, At(3, 10, 0));
        AddTarget(2, At(2, 10, 0));
        AddTarget(3, At(1, 10, 0));
        _client.ByLatitude[1] = () => Series();
        _client.ByLatitude[2] = () => throw new WeatherRateLimitException("daily limit");
        _client.ByLatitude[3] = () => Series();

        Assert.Equal(1, await Service.SyncAsync());

        Assert.Equal([1L], _weather.Stored.Keys);
        Assert.Equal([1d, 2d], _client.Calls.Select(c => c.Latitude));
    }

    [Fact]
    public async Task A_network_error_skips_that_activity_until_the_next_run()
    {
        AddTarget(1, At(3, 10, 0));
        AddTarget(2, At(2, 10, 0));
        _client.ByLatitude[1] = () => throw new HttpRequestException("connection reset");
        _client.ByLatitude[2] = () => Series();

        Assert.Equal(1, await Service.SyncAsync());

        Assert.Equal([2L], _weather.Stored.Keys);
        // Asked once, not again and again in the same run.
        Assert.Equal(1, _client.Calls.Count(c => c.Latitude == 1));
    }
}
