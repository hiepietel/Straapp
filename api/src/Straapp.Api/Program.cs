using System.Text.Json;
using System.Text.Json.Serialization;
using Straapp.Api;
using Straapp.Api.Controllers;
using Straapp.Api.Sync;
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

builder.Services.AddControllers()
    .AddJsonOptions(options => options.JsonSerializerOptions.Converters.Add(new JsonStringEnumConverter(JsonNamingPolicy.CamelCase)));
builder.Services.AddProblemDetails();
builder.Services.AddExceptionHandler<StravaExceptionHandler>();
// Learn more about configuring OpenAPI at https://aka.ms/aspnet/openapi
builder.Services.AddOpenApi();

var app = builder.Build();

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

    await app.Services.MigrateDatabaseAsync();
}

app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();

BrowserLauncher.OpenLoginOnStartup(app);

app.Run();
