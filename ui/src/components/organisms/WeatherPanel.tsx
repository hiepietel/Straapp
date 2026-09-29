import WeatherCharts from "./WeatherCharts";
import StatItem from "../molecules/StatItem";
import Notice from "../molecules/Notice";
import { activitySamples, compass, describeWeather, formatRain, formatTemp, formatWind, summarize } from "../../utils/weather";
import type { ActivityWeather } from "../../types/weather";

export interface WeatherPanelProps {
  weather: ActivityWeather;
}

const TH = "px-3 py-2 font-semibold";
const TD = "px-3 py-2";

// The weather during the activity at a glance, then every 15 minutes around it.
export default function WeatherPanel({ weather }: WeatherPanelProps) {
  if (weather.status === "pending") {
    return (
      <Notice>
        The weather for this activity hasn't been looked up yet. The API fetches it in the background, for activities at
        least two days old.
      </Notice>
    );
  }
  if (weather.status !== "ready" || weather.samples.length === 0) {
    return <Notice>No weather is available for this activity.</Notice>;
  }

  const during = summarize(activitySamples(weather.samples, weather.start, weather.end));
  const conditions = describeWeather(during.weatherCode, during.isDay);
  const Icon = conditions.icon;
  const local = new Intl.DateTimeFormat(undefined, { hour: "2-digit", minute: "2-digit", timeZone: "UTC" });
  const localHour = (iso: string) => local.format(new Date(Date.parse(iso) + weather.utcOffsetSeconds * 1000));
  const range =
    during.temperatureMin !== null && during.temperatureMax !== null && Math.round(during.temperatureMin) !== Math.round(during.temperatureMax)
      ? `${Math.round(during.temperatureMin)}–${formatTemp(during.temperatureMax)}`
      : null;

  return (
    <div className="space-y-6">
      <dl className="grid grid-cols-2 gap-x-8 gap-y-5 sm:grid-cols-3 lg:grid-cols-4">
        <StatItem
          label="Conditions"
          value={
            <span className="inline-flex items-center gap-2">
              <Icon className="size-6 shrink-0" aria-hidden="true" />
              {conditions.label}
            </span>
          }
        />
        {during.temperature !== null && (
          <StatItem
            label={range ? `Temperature (${range})` : "Temperature"}
            value={formatTemp(during.temperature)}
          />
        )}
        {during.apparentTemperature !== null && <StatItem label="Feels like" value={formatTemp(during.apparentTemperature)} />}
        {during.windSpeed !== null && (
          <StatItem
            label="Wind"
            value={`${formatWind(during.windSpeed)}${during.windDirection !== null ? ` ${compass(during.windDirection)}` : ""}`}
          />
        )}
        {during.windGusts !== null && <StatItem label="Strongest gust" value={formatWind(during.windGusts)} />}
        <StatItem label="Precipitation" value={formatRain(during.precipitation)} />
        {during.humidity !== null && <StatItem label="Humidity" value={`${Math.round(during.humidity)}%`} />}
        {during.cloudCover !== null && <StatItem label="Cloud cover" value={`${Math.round(during.cloudCover)}%`} />}
      </dl>

      <div className="rounded-lg border border-line bg-chalk p-3 sm:p-4">
        <WeatherCharts
          samples={weather.samples}
          start={weather.start}
          end={weather.end}
          utcOffsetSeconds={weather.utcOffsetSeconds}
        />
      </div>

      <details className="rounded-lg border border-line bg-chalk">
        <summary className="cursor-pointer px-4 py-2 text-sm font-semibold">Every 15 minutes</summary>
        <div className="overflow-x-auto border-t border-line">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="border-b border-line text-mute">
              <tr>
                <th scope="col" className={TH}>Time</th>
                <th scope="col" className={TH}>Conditions</th>
                <th scope="col" className={TH + " text-right"}>Temp.</th>
                <th scope="col" className={TH + " text-right"}>Feels like</th>
                <th scope="col" className={TH + " text-right"}>Precip.</th>
                <th scope="col" className={TH + " text-right"}>Wind</th>
                <th scope="col" className={TH + " text-right"}>Gusts</th>
                <th scope="col" className={TH + " text-right"}>Humidity</th>
                <th scope="col" className={TH + " text-right"}>Clouds</th>
              </tr>
            </thead>
            <tbody>
              {weather.samples.map((h) => (
                <tr key={h.time} className="border-b border-line last:border-b-0">
                  <th scope="row" className={TD + " num font-semibold"}>{localHour(h.time)}</th>
                  <td className={TD}>{describeWeather(h.weatherCode, h.isDay).label}</td>
                  <td className={TD + " num text-right"}>{h.temperature === null ? "—" : formatTemp(h.temperature)}</td>
                  <td className={TD + " num text-right"}>{h.apparentTemperature === null ? "—" : formatTemp(h.apparentTemperature)}</td>
                  <td className={TD + " num text-right"}>{h.precipitation === null ? "—" : formatRain(h.precipitation)}</td>
                  <td className={TD + " num text-right"}>
                    {h.windSpeed === null ? "—" : formatWind(h.windSpeed)}
                    {h.windDirection !== null && <span className="text-mute"> {compass(h.windDirection)}</span>}
                  </td>
                  <td className={TD + " num text-right"}>{h.windGusts === null ? "—" : formatWind(h.windGusts)}</td>
                  <td className={TD + " num text-right"}>{h.relativeHumidity === null ? "—" : `${h.relativeHumidity}%`}</td>
                  <td className={TD + " num text-right"}>{h.cloudCover === null ? "—" : `${h.cloudCover}%`}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>

      <p className="text-xs text-mute">
        Weather at the start every 15 minutes, in local time, from the{" "}
        <a href="https://open-meteo.com/" target="_blank" rel="noopener noreferrer" className="underline hover:text-ink">
          Open-Meteo
        </a>{" "}
        historical archive (CC BY 4.0), for a weather-model grid cell a few kilometres across. Before about 2022 the
        15-minute steps are smoothed from hourly values
        {weather.place?.elevation != null && ` at ${Math.round(weather.place.elevation)} m`}. Wind is where it comes from;
        the arrows show where it blows.
      </p>
    </div>
  );
}
