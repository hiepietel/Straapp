using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Straapp.Application.DeviceStats;

namespace Straapp.Api.Controllers;

/// <summary>Activity statistics grouped by recording device.</summary>
[ApiController]
[Authorize]
[Route("api/devices")]
public sealed class DevicesController(DeviceService devices, TimeProvider time) : ControllerBase
{
    /// <summary>Totals per device, with monthly, yearly and running-total breakdowns.</summary>
    [HttpGet]
    public Task<DeviceReport> Get(DateOnly? today, CancellationToken ct) =>
        devices.GetReportAsync(User.GetAthleteId(), today ?? DateOnly.FromDateTime(time.GetLocalNow().DateTime), ct);
}