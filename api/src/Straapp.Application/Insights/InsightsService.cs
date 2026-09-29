using Straapp.Application.Abstractions;
using Straapp.Application.GearStats;
using Straapp.Domain.Activities;

namespace Straapp.Application.Insights;

/// <summary>
/// Every activity, reduced to its headline figures and the weather while it lasted, for the general
/// statistics page. The page does the counting itself, so every filter (dates, sport types, gear)
/// answers instantly without another request; even a long history is a few thousand small rows.
/// </summary>
public sealed class InsightsService(IActivityRepository activities, IWeatherRepository weather, IAthleteRepository athletes)
{
    private static readonly TimeSpan Step = TimeSpan.FromMinutes(15);

    public async Task<InsightsReport> GetReportAsync(long athleteId, CancellationToken ct = default)
    {
        var facts = await activities.GetFactsAsync(athleteId, ct);
        var weatherById = WeatherDuring(await weather.GetSamplesAsync(athleteId, ct));

        var rows = facts
            .Select(a =>
            {
                var type = SportGroups.TypeOf(a.SportType, a.Type);
                return new InsightActivity(
                    a.Id, a.Name, type, SportGroups.Of(a.SportType, a.Type), a.StartLocal,
                    a.Distance, a.MovingTime, a.ElapsedTime, a.Elevation, a.AverageSpeed, a.MaxSpeed, a.AverageHeartrate,
                    string.IsNullOrEmpty(a.GearId) ? null : a.GearId, a.Commute, a.Trainer, a.Private,
                    weatherById.GetValueOrDefault(a.Id));
            })
            .ToList();

        var gearIds = rows
            .Where(r => r.GearId is not null)
            .GroupBy(r => r.GearId!)
            .OrderByDescending(g => g.Sum(r => r.Distance))
            .Select(g => g.Key)
            .ToList();

        return new InsightsReport(rows, await GearNames.LabelAsync(athletes, athleteId, gearIds, ct));
    }

    /// <summary>
    /// The weather while each activity lasted: the samples from its start to its end, both rounded out
    /// to the quarter hour (precipitation is for the 15 minutes up to each sample).
    /// </summary>
    private static Dictionary<long, InsightWeather> WeatherDuring(IReadOnlyList<ActivityWeatherSample> samples) =>
        samples
            .GroupBy(s => s.ActivityId)
            .Select(g =>
            {
                var first = g.First();
                var from = Floor(first.StartDate);
                var to = Ceiling(first.StartDate.AddSeconds(first.ElapsedTime));
                var during = g.Where(s => s.Time >= from && s.Time <= to).ToList();
                if (during.Count == 0) return null;
                return new
                {
                    Id = g.Key,
                    Weather = new InsightWeather(
                        Average(during.Select(s => s.Temperature)),
                        Average(during.Select(s => s.ApparentTemperature)),
                        during.Sum(s => s.Precipitation ?? 0),
                        Average(during.Select(s => s.WindSpeed)),
                        during.Max(s => s.WindGusts),
                        during.Max(s => s.WeatherCode)),
                };
            })
            .Where(x => x is not null)
            .ToDictionary(x => x!.Id, x => x!.Weather);

    private static double? Average(IEnumerable<double?> values)
    {
        var present = values.Where(v => v is not null).Select(v => v!.Value).ToList();
        return present.Count == 0 ? null : Math.Round(present.Average(), 1);
    }

    private static DateTimeOffset Floor(DateTimeOffset t) => new(t.UtcTicks - t.UtcTicks % Step.Ticks, TimeSpan.Zero);

    private static DateTimeOffset Ceiling(DateTimeOffset t)
    {
        var floor = Floor(t);
        return floor == t ? floor : floor + Step;
    }
}

/// <param name="Gear">The gear used, most distance first.</param>
public sealed record InsightsReport(IReadOnlyList<InsightActivity> Activities, IReadOnlyList<GearLabel> Gear);

/// <param name="SportType">Strava's sport type, e.g. "MountainBikeRide".</param>
/// <param name="Start">Wall-clock time where it happened.</param>
/// <param name="Distance">Metres.</param>
/// <param name="MovingTime">Seconds.</param>
/// <param name="Elevation">Metres climbed.</param>
/// <param name="AverageSpeed">Metres per second.</param>
/// <param name="Private">Visible only to the athlete.</param>
/// <param name="Weather">Null for indoor activities, or before the weather has been looked up.</param>
public sealed record InsightActivity(
    long Id,
    string Name,
    string SportType,
    SportGroup Sport,
    DateTime Start,
    double Distance,
    int MovingTime,
    int ElapsedTime,
    double Elevation,
    double AverageSpeed,
    double? MaxSpeed,
    double? AverageHeartrate,
    string? GearId,
    bool Commute,
    bool Trainer,
    bool Private,
    InsightWeather? Weather);

/// <summary>The weather while the activity lasted.</summary>
/// <param name="Temperature">Average, °C.</param>
/// <param name="Precipitation">Total, mm.</param>
/// <param name="WindSpeed">Average, km/h.</param>
/// <param name="WindGusts">Strongest, km/h.</param>
/// <param name="WeatherCode">The most notable (highest) WMO code.</param>
public sealed record InsightWeather(
    double? Temperature, double? ApparentTemperature, double Precipitation, double? WindSpeed, double? WindGusts, int? WeatherCode);
