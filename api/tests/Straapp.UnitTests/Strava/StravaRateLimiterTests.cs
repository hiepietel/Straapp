using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Time.Testing;
using Straapp.Application.Strava;
using Straapp.Infrastructure.Strava;

namespace Straapp.UnitTests.Strava;

public class StravaRateLimiterTests
{
    private readonly FakeTimeProvider _time = new(new DateTimeOffset(2026, 9, 30, 10, 7, 0, TimeSpan.Zero));

    private StravaRateLimiter NewLimiter() => new(_time, NullLogger<StravaRateLimiter>.Instance);

    private static HttpResponseMessage Response(string limit, string usage, string? readLimit = null, string? readUsage = null)
    {
        var response = new HttpResponseMessage();
        response.Headers.Add("X-RateLimit-Limit", limit);
        response.Headers.Add("X-RateLimit-Usage", usage);
        if (readLimit is not null) response.Headers.Add("X-ReadRateLimit-Limit", readLimit);
        if (readUsage is not null) response.Headers.Add("X-ReadRateLimit-Usage", readUsage);
        return response;
    }

    [Fact]
    public async Task Lets_requests_through_with_quota_left()
    {
        var limiter = NewLimiter();
        limiter.Update(Response("200,2000", "10,100", "100,1000", "10,100"));

        await limiter.BeforeRequestAsync(CancellationToken.None);

        Assert.Equal("overall 10/200 (15 min), 100/2000 (day), read 10/100 (15 min), 100/1000 (day)", limiter.LastUsage);
        Assert.Null(limiter.PausedUntil);
    }

    [Fact]
    public void Knows_nothing_before_the_first_response()
    {
        var limiter = NewLimiter();

        Assert.Null(limiter.LastUsage);
        Assert.True(limiter.IsOnlyShortTermExhausted());
    }

    [Fact]
    public void Ignores_malformed_headers()
    {
        var limiter = NewLimiter();
        limiter.Update(Response("200", "x,y"));

        Assert.Null(limiter.LastUsage);
    }

    [Fact]
    public async Task Refuses_when_the_daily_quota_is_nearly_used_up()
    {
        var limiter = NewLimiter();
        limiter.Update(Response("200,2000", "10,1998"));

        var ex = await Assert.ThrowsAsync<StravaRateLimitException>(() => limiter.BeforeRequestAsync(CancellationToken.None));

        Assert.Equal(new DateTimeOffset(2026, 10, 1, 0, 0, 0, TimeSpan.Zero), ex.RetryAfter);
    }

    [Fact]
    public void After_a_429_waiting_helps_unless_the_day_is_used_up()
    {
        var limiter = NewLimiter();
        limiter.Update(Response("200,2000", "200,500"));
        Assert.True(limiter.IsOnlyShortTermExhausted());

        limiter.Update(Response("200,2000", "200,2000"));
        Assert.False(limiter.IsOnlyShortTermExhausted());
    }

    [Fact]
    public async Task Waits_for_the_next_15_minute_window_when_this_one_is_used_up()
    {
        var limiter = NewLimiter();
        limiter.Update(Response("100,1000", "99,300"));

        var wait = limiter.BeforeRequestAsync(CancellationToken.None);

        // 10:07 → the window starting at 10:15, plus a few seconds' margin.
        Assert.False(wait.IsCompleted);
        Assert.Equal(new DateTimeOffset(2026, 9, 30, 10, 15, 5, TimeSpan.Zero), limiter.PausedUntil);

        _time.Advance(TimeSpan.FromMinutes(8));
        Assert.False(wait.IsCompleted);
        _time.Advance(TimeSpan.FromSeconds(5));
        await wait;

        Assert.Null(limiter.PausedUntil);
        // The new window starts from zero, so the next request goes straight through.
        Assert.StartsWith("overall 0/100 (15 min)", limiter.LastUsage);
        await limiter.BeforeRequestAsync(CancellationToken.None);
    }

    [Fact]
    public async Task Waiting_can_be_cancelled()
    {
        var limiter = NewLimiter();
        limiter.Update(Response("100,1000", "100,300"));
        using var cts = new CancellationTokenSource();

        var wait = limiter.BeforeRequestAsync(cts.Token);
        await cts.CancelAsync();

        await Assert.ThrowsAnyAsync<OperationCanceledException>(() => wait);
        Assert.Null(limiter.PausedUntil);
    }
}
