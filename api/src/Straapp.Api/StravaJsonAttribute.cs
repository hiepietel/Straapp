using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;
using Microsoft.AspNetCore.Mvc.Formatters;
using Straapp.Application.Strava;

namespace Straapp.Api;

/// <summary>Writes the action's result in Strava's own JSON format (snake_case) instead of the API's camelCase.</summary>
[AttributeUsage(AttributeTargets.Class | AttributeTargets.Method)]
public sealed class StravaJsonAttribute : ResultFilterAttribute
{
    private static readonly SystemTextJsonOutputFormatter Formatter = new(StravaJson.Options);

    public override void OnResultExecuting(ResultExecutingContext context)
    {
        if (context.Result is ObjectResult result) result.Formatters.Add(Formatter);
    }
}
