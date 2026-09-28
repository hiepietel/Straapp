using System.Net.Http.Headers;
using Straapp.Application.Strava;

namespace Straapp.Infrastructure.Strava;

/// <summary>Puts the athlete's (fresh) access token on every Strava API request.</summary>
internal sealed class StravaAuthHandler(IStravaAuthService auth) : DelegatingHandler
{
    protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken ct)
    {
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", await auth.GetAccessTokenAsync(ct));
        return await base.SendAsync(request, ct);
    }
}
