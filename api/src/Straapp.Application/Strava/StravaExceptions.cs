using System.Net;

namespace Straapp.Application.Strava;

/// <summary>Strava answered with an error status.</summary>
public class StravaApiException(HttpStatusCode statusCode, string message) : Exception(message)
{
    public HttpStatusCode StatusCode { get; } = statusCode;
}

/// <summary>Strava's request quota is used up; nothing more will work before <see cref="RetryAfter"/>.</summary>
public sealed class StravaRateLimitException(string message, DateTimeOffset? retryAfter)
    : StravaApiException(HttpStatusCode.TooManyRequests, message)
{
    public DateTimeOffset? RetryAfter { get; } = retryAfter;
}

/// <summary>Nobody is logged in, or Strava no longer accepts the saved tokens.</summary>
public sealed class StravaNotAuthenticatedException(string message)
    : StravaApiException(HttpStatusCode.Unauthorized, message);
