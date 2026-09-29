using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Straapp.Application.Insights;

namespace Straapp.Api.Controllers;

/// <summary>Everything the general statistics page counts, from the stored data only.</summary>
[ApiController]
[Authorize]
[Route("api/insights")]
public sealed class InsightsController(InsightsService insights) : ControllerBase
{
    /// <summary>
    /// Every stored activity with its headline figures and the weather while it lasted, oldest first,
    /// and the gear they used. The page filters and counts these itself.
    /// </summary>
    [HttpGet]
    public Task<InsightsReport> Get(CancellationToken ct) => insights.GetReportAsync(User.GetAthleteId(), ct);
}
