using System.Security.Cryptography;
using System.Text.Encodings.Web;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Straapp.Application.Accounts;
using Straapp.Application.Strava;
using Straapp.Domain.Athletes;

namespace Straapp.Api.Controllers;

/// <summary>
/// Logging in to the app with Strava. The web app sends the browser to Strava itself, gets the
/// one-time code back, and swaps it here for the app's access token (the Strava secret never
/// leaves the server). Every other endpoint expects that token as "Authorization: Bearer …".
/// </summary>
[ApiController]
[Route("api/auth")]
public sealed class AuthController(LoginService login, TokenService tokens) : ControllerBase
{
    /// <summary>Strava's "Authorize" page for this app, which comes back to <paramref name="redirectUri"/> with ?code=.</summary>
    /// <param name="redirectUri">An absolute URL on the web app. Strava only allows the domain set on its API settings page.</param>
    /// <param name="state">Random value the web app checks when Strava sends the browser back.</param>
    [HttpGet("authorize-url")]
    public ActionResult<AuthorizeUrl> GetAuthorizeUrl(Uri redirectUri, string state)
    {
        if (!redirectUri.IsAbsoluteUri || redirectUri.Scheme is not ("http" or "https"))
        {
            return Problem("redirectUri must be an absolute http(s) URL.", statusCode: StatusCodes.Status400BadRequest);
        }
        return new AuthorizeUrl(login.BuildLoginUrl(redirectUri, state));
    }

    /// <summary>Swaps Strava's one-time code for the app's access token.</summary>
    [HttpPost("token")]
    public async Task<ActionResult<LoginResult>> CreateToken(TokenRequest request, CancellationToken ct)
    {
        var athlete = await login.CompleteLoginAsync(request.Code, request.Scope, ct);
        var token = tokens.Issue(athlete);
        return new LoginResult(token.AccessToken, token.ExpiresAt, CurrentUser.From(athlete));
    }

    /// <summary>Who the token belongs to. 401 means the web app should show its login screen.</summary>
    [HttpGet("me")]
    [Authorize]
    public async Task<ActionResult<CurrentUser>> Me(CancellationToken ct)
    {
        var athlete = await login.GetCurrentAsync(User.GetAthleteId(), ct);
        // The token outlived the API's in-memory Strava session (e.g. after a restart).
        if (athlete is null) return Problem("Your session has ended. Please log in again.", statusCode: StatusCodes.Status401Unauthorized);
        return CurrentUser.From(athlete);
    }

    /// <summary>Ends the Strava session on the server. The web app forgets its token itself.</summary>
    [HttpPost("logout")]
    [Authorize]
    public IActionResult Logout()
    {
        login.Logout();
        return NoContent();
    }

    // ---- browser-only login for trying the API in Swagger (dev convenience, will change) ----

    private const string StateCookie = "straapp.oauth-state";

    /// <summary>Open in a browser: logs in with Strava, then opens Swagger with the token filled in.</summary>
    [HttpGet("login")]
    [ApiExplorerSettings(IgnoreApi = true)]
    public IActionResult BrowserLogin()
    {
        var state = Convert.ToHexString(RandomNumberGenerator.GetBytes(16));
        Response.Cookies.Append(StateCookie, state, new CookieOptions
        {
            HttpOnly = true,
            SameSite = SameSiteMode.Lax,
            MaxAge = TimeSpan.FromMinutes(10),
        });
        var callback = new Uri(Url.ActionLink(nameof(BrowserCallback))!);
        return Redirect(login.BuildLoginUrl(callback, state).ToString());
    }

    [HttpGet("callback")]
    [ApiExplorerSettings(IgnoreApi = true)]
    public async Task<IActionResult> BrowserCallback(string? code, string? state, string? scope, string? error, CancellationToken ct)
    {
        var expectedState = Request.Cookies[StateCookie];
        Response.Cookies.Delete(StateCookie);

        if (error is not null || code is null || expectedState is null || state != expectedState)
        {
            return Problem(error == "access_denied" ? "Login was cancelled." : "The login could not be verified. Open /api/auth/login again.",
                statusCode: StatusCodes.Status400BadRequest);
        }

        var athlete = await login.CompleteLoginAsync(code, scope, ct);
        var token = tokens.Issue(athlete);

        // Swagger UI picks the token up from here (see the request interceptor in Program.cs).
        var js = JavaScriptEncoder.Default.Encode(token.AccessToken);
        return Content(
            $"<!doctype html><script>localStorage.setItem('{SwaggerTokenKey}', '{js}'); location.replace('/swagger');</script>",
            "text/html");
    }

    public const string SwaggerTokenKey = "straapp.swagger-token";

    public sealed record AuthorizeUrl(Uri Url);

    public sealed record TokenRequest(string Code, string? Scope);

    public sealed record LoginResult(string AccessToken, DateTimeOffset ExpiresAt, CurrentUser User);

    public sealed record CurrentUser(long Id, string? Firstname, string? Lastname, string? ProfileUrl)
    {
        public static CurrentUser From(Athlete athlete) => new(athlete.Id, athlete.Firstname, athlete.Lastname, athlete.ProfileUrl);
    }
}
