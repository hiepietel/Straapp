using System.Net;

namespace Straapp.Infrastructure.Strava;

/// <summary>Keeps Strava API calls inside the rate limit, and retries once in the next window after a 429.</summary>
internal sealed class StravaRateLimitHandler(StravaRateLimiter limiter) : DelegatingHandler
{
    protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken ct)
    {
        await limiter.BeforeRequestAsync(ct);
        var response = await base.SendAsync(request, ct);
        limiter.Update(response);

        if (response.StatusCode != HttpStatusCode.TooManyRequests) return response;

        response.Dispose();
        if (!limiter.IsOnlyShortTermExhausted()) throw limiter.DailyLimitReached();

        await limiter.WaitForNextWindowAsync(ct);
        // Only GETs go through here, so the request can safely be sent again.
        response = await base.SendAsync(request, ct);
        limiter.Update(response);
        return response;
    }
}
