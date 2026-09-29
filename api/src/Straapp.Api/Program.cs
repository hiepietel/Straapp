using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.AspNetCore.Diagnostics.HealthChecks;
using Microsoft.AspNetCore.HttpOverrides;
using Straapp.Api;
using Straapp.Api.Controllers;
using Straapp.Api.Sync;
using Straapp.Api.Weather;
using Straapp.Application;
using Straapp.Infrastructure;
using Straapp.Persistence;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddApplication();
builder.Services.AddInfrastructure(builder.Configuration);
builder.Services.AddPersistence(builder.Configuration);

builder.Services.AddTokenLogin(builder.Configuration);

builder.Services.AddSingleton<SyncQueue>();
builder.Services.AddHostedService<SyncWorker>();
builder.Services.AddHostedService<ScheduledSyncWorker>();
builder.Services.AddHostedService<WeatherWorker>();

builder.Services.AddControllers()
    .AddJsonOptions(options => options.JsonSerializerOptions.Converters.Add(new JsonStringEnumConverter(JsonNamingPolicy.CamelCase)));
builder.Services.AddProblemDetails();
builder.Services.AddExceptionHandler<StravaExceptionHandler>();
// Learn more about configuring OpenAPI at https://aka.ms/aspnet/openapi
builder.Services.AddOpenApi();

// Liveness says the process answers; readiness also needs the database.
builder.Services.AddHealthChecks().AddDbContextCheck<StraappDbContext>("database", tags: ["ready"]);

// Behind the web app's nginx and the cluster's ingress: trust their X-Forwarded-* headers, so the
// API sees the original scheme and client. It is only reachable from inside the cluster.
builder.Services.Configure<ForwardedHeadersOptions>(options =>
{
    options.ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto | ForwardedHeaders.XForwardedHost;
    options.KnownIPNetworks.Clear();
    options.KnownProxies.Clear();
});

var app = builder.Build();

app.UseForwardedHeaders();
app.UseExceptionHandler();

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
    // UI only; the document itself comes from the built-in OpenAPI generator above.
    app.UseSwaggerUI(options =>
    {
        options.SwaggerEndpoint("/openapi/v1.json", "Straapp API");
        // Sends the token saved by the browser login (/api/auth/login) with every "Try it out".
        options.UseRequestInterceptor(
            $"(req) => {{ const t = localStorage.getItem('{AuthController.SwaggerTokenKey}'); if (t) req.headers['Authorization'] = 'Bearer ' + t; return req; }}");
    });
}

// Only one API instance runs, so it brings the schema up to date itself before serving.
if (app.Configuration.GetValue("Database:MigrateOnStartup", true))
{
    await app.Services.MigrateDatabaseAsync();
}

app.UseAuthentication();
app.UseAuthorization();

app.MapHealthChecks("/healthz", new HealthCheckOptions { Predicate = _ => false });
app.MapHealthChecks("/readyz", new HealthCheckOptions { Predicate = check => check.Tags.Contains("ready") });
app.MapControllers();

BrowserLauncher.OpenLoginOnStartup(app);

app.Run();
