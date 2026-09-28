using System.Diagnostics;
using Microsoft.AspNetCore.Hosting.Server;
using Microsoft.AspNetCore.Hosting.Server.Features;

namespace Straapp.Api;

/// <summary>
/// Temporary dev convenience: once the server is listening, opens the Strava login in the default browser;
/// after login it lands on Swagger.
/// Turn off with "Strava:OpenBrowserOnStartup": false.
/// </summary>
internal static class BrowserLauncher
{
    public static void OpenLoginOnStartup(WebApplication app)
    {
        if (!app.Environment.IsDevelopment() || !app.Configuration.GetValue("Strava:OpenBrowserOnStartup", true)) return;

        app.Lifetime.ApplicationStarted.Register(() =>
        {
            var address = app.Services.GetRequiredService<IServer>().Features.Get<IServerAddressesFeature>()?.Addresses
                .FirstOrDefault();
            if (address is null) return;

            var url = $"{address.TrimEnd('/')}/api/auth/login";
            try
            {
                Process.Start(new ProcessStartInfo(url) { UseShellExecute = true });
            }
            catch (Exception ex)
            {
                app.Logger.LogWarning(ex, "Could not open a browser. Log in at {Url}", url);
            }
        });
    }
}
