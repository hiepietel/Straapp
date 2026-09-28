using Microsoft.AspNetCore.Diagnostics;
using Straapp.Application.Strava;

namespace Straapp.Api;

/// <summary>Turns Strava failures into problem-details responses with a matching status code.</summary>
internal sealed class StravaExceptionHandler(IProblemDetailsService problemDetails) : IExceptionHandler
{
    public async ValueTask<bool> TryHandleAsync(HttpContext context, Exception exception, CancellationToken ct)
    {
        if (exception is not StravaApiException stravaError) return false;

        context.Response.StatusCode = (int)stravaError.StatusCode;
        return await problemDetails.TryWriteAsync(new ProblemDetailsContext
        {
            HttpContext = context,
            Exception = exception,
            ProblemDetails =
            {
                Status = (int)stravaError.StatusCode,
                Title = "Strava request failed",
                Detail = stravaError.Message,
            },
        });
    }
}
