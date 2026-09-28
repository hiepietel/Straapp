using System.ComponentModel.DataAnnotations;
using System.Security.Claims;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.JsonWebTokens;
using Microsoft.IdentityModel.Tokens;
using Straapp.Domain.Athletes;

namespace Straapp.Api;

/// <summary>The "Auth" config section. Keep <see cref="SigningKey"/> in user secrets.</summary>
public sealed class AuthOptions
{
    public const string SectionName = "Auth";

    /// <summary>At least 32 random bytes, base64. Anyone who has it can mint tokens.</summary>
    [Required, MinLength(44)]
    public string SigningKey { get; set; } = "";

    public string Issuer { get; set; } = "straapp";

    public TimeSpan TokenLifetime { get; set; } = TimeSpan.FromDays(7);

    public SymmetricSecurityKey Key => new(Convert.FromBase64String(SigningKey));
}

/// <summary>Issues the app's own access token (a JWT naming the Strava athlete) after a Strava login.</summary>
public sealed class TokenService(IOptions<AuthOptions> options, TimeProvider time)
{
    public IssuedToken Issue(Athlete athlete)
    {
        var o = options.Value;
        var expires = time.GetUtcNow().Add(o.TokenLifetime);
        var token = new JsonWebTokenHandler().CreateToken(new SecurityTokenDescriptor
        {
            Issuer = o.Issuer,
            Audience = o.Issuer,
            Expires = expires.UtcDateTime,
            Subject = new ClaimsIdentity(
            [
                new Claim(JwtRegisteredClaimNames.Sub, athlete.Id.ToString()),
                new Claim(JwtRegisteredClaimNames.Name, $"{athlete.Firstname} {athlete.Lastname}".Trim()),
            ]),
            SigningCredentials = new SigningCredentials(o.Key, SecurityAlgorithms.HmacSha256),
        });
        return new IssuedToken(token, expires);
    }
}

public sealed record IssuedToken(string AccessToken, DateTimeOffset ExpiresAt);

internal static class Auth
{
    /// <summary>Every protected endpoint expects "Authorization: Bearer {token from /api/auth/token}".</summary>
    public static IServiceCollection AddTokenLogin(this IServiceCollection services, IConfiguration configuration)
    {
        services.AddOptions<AuthOptions>()
            .Bind(configuration.GetSection(AuthOptions.SectionName))
            .ValidateDataAnnotations()
            .ValidateOnStart();
        services.AddSingleton<TokenService>();

        services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme).AddJwtBearer();
        services.AddOptions<JwtBearerOptions>(JwtBearerDefaults.AuthenticationScheme)
            .Configure<IOptions<AuthOptions>>((jwt, auth) =>
            {
                // Keep claim names as issued ("sub"), not remapped to long XML URIs.
                jwt.MapInboundClaims = false;
                jwt.TokenValidationParameters = new TokenValidationParameters
                {
                    ValidIssuer = auth.Value.Issuer,
                    ValidAudience = auth.Value.Issuer,
                    IssuerSigningKey = auth.Value.Key,
                    NameClaimType = JwtRegisteredClaimNames.Name,
                };
            });
        services.AddAuthorization();
        return services;
    }

    public static long GetAthleteId(this ClaimsPrincipal user) =>
        long.Parse(user.FindFirstValue(JwtRegisteredClaimNames.Sub)
            ?? throw new InvalidOperationException("Only call this on endpoints that require login."));
}
