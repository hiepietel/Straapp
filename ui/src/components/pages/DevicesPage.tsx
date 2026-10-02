import { useMemo, useState } from "react";
import DashboardTemplate from "../templates/DashboardTemplate";
import StackedBarChart from "../organisms/StackedBarChart";
import CumulativeLineChart from "../organisms/CumulativeLineChart";
import CollapsibleSection from "../molecules/CollapsibleSection";
import FilterTabs from "../molecules/FilterTabs";
import Notice from "../molecules/Notice";
import StatItem from "../molecules/StatItem";
import Spinner from "../atoms/Spinner";
import { useDeviceReport } from "../../hooks/useDeviceReport";
import { isDemo } from "../../services/auth";
import { formatDistance, formatDuration, formatElevation, formatShortDate } from "../../utils/format";
import { METRIC_LABELS, formatMetric, formatMetricTick, localNow, metricValue } from "../../utils/periodStats";
import type { Metric } from "../../utils/periodStats";
import { gearColor } from "../../utils/gearStats";
import type { DeviceItem } from "../../types/devices";
import type { Totals } from "../../types/statistics";
import type { FilterOption } from "../molecules/FilterTabs";

type Range = "12m" | "24m" | "all";

const RANGE_OPTIONS: FilterOption<Range>[] = [
  { id: "12m", label: "Last 12 months" },
  { id: "24m", label: "Last 2 years" },
  { id: "all", label: "All time" },
];
const METRIC_OPTIONS: FilterOption<Metric>[] = (Object.keys(METRIC_LABELS) as Metric[]).map((id) => ({
  id,
  label: METRIC_LABELS[id],
}));

const dayMs = (day: string) => Date.parse(`${day}T00:00:00Z`);
const monthLabel = (day: string, withYear: boolean) =>
  new Intl.DateTimeFormat(undefined, { month: "short", ...(withYear && { year: "2-digit" }), timeZone: "UTC" }).format(dayMs(day));
const monthTitle = (day: string) =>
  new Intl.DateTimeFormat(undefined, { month: "long", year: "numeric", timeZone: "UTC" }).format(dayMs(day));
const fullDate = (time: number) =>
  new Intl.DateTimeFormat(undefined, { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(time);

const sum = (all: readonly Totals[]): Totals =>
  all.reduce(
    (total, current) => ({
      count: total.count + current.count,
      distance: total.distance + current.distance,
      movingTime: total.movingTime + current.movingTime,
      elevation: total.elevation + current.elevation,
    }),
    { count: 0, distance: 0, movingTime: 0, elevation: 0 }
  );

export default function DevicesPage() {
  const now = useMemo(() => localNow(), []);
  const today = now.toISOString().slice(0, 10);
  const { report, status, error, retry } = useDeviceReport(today);
  const ready = status === "ready" && report !== null;
  const [metric, setMetric] = useState<Metric>("distance");
  const [range, setRange] = useState<Range>("12m");
  const [hidden, setHidden] = useState<ReadonlySet<string>>(new Set());

  const devices = report?.devices ?? [];
  const charted = devices.filter((device) => !hidden.has(device.name));
  const overall = sum(devices.map((device) => device.totals));
  const value = (totals: Totals | undefined) => (totals ? metricValue(totals, metric) : 0);
  const fmt = (amount: number) => formatMetric(metric, amount);
  const fmtTick = (amount: number) => formatMetricTick(metric, amount);

  const fromMonth = useMemo(() => {
    if (range === "all") return "";
    const back = range === "12m" ? 11 : 23;
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - back, 1)).toISOString().slice(0, 10);
  }, [range, now]);
  const months = (report?.months ?? []).filter((month) => month.month >= fromMonth);
  const multiYear = months.length > 12;
  const labelEvery = Math.max(1, Math.ceil(months.length / 12));
  const windowTotals = new Map(charted.map((device) => [
    device.name,
    sum(months.flatMap((month) => (month.devices[device.name] ? [month.devices[device.name]!] : []))),
  ]));
  const windowSum = [...windowTotals.values()].reduce((total, totals) => total + value(totals), 0);
  const years = [...new Set(devices.flatMap((device) => device.years.map((year) => year.year)))].sort((a, b) => a - b);
  const chartFrom = months.length ? dayMs(months[0]!.month) : now.getTime();

  const toggle = (name: string) =>
    setHidden((current) => {
      const next = new Set(current);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });

  if (isDemo) {
    return (
      <DashboardTemplate
        header={<header className="pt-8"><h1 className="text-3xl font-extrabold tracking-tight">Devices</h1></header>}
        notice={<Notice>Device statistics come from the Straapp API, which demo mode doesn&apos;t use.</Notice>}
      />
    );
  }

  return (
    <DashboardTemplate
      header={
        <header className="pt-8">
          <h1 className="text-3xl font-extrabold tracking-tight">Devices</h1>
          <p className="mt-1 text-mute">Your activity totals grouped by recording device.</p>
        </header>
      }
      notice={error && <Notice tone="error" actionLabel="Try again" onAction={retry}>{error}</Notice>}
      filters={ready && <FilterTabs options={METRIC_OPTIONS} value={metric} onChange={setMetric} label="Measure" />}
    >
      {status === "loading" && <div className="flex flex-col items-center gap-3 py-24"><Spinner label="Loading device statistics" /></div>}

      {ready && devices.length === 0 && (
        <p className="py-16 text-center text-mute">No activities to show yet. Device totals will appear after your activities sync.</p>
      )}

      {ready && devices.length > 0 && (
        <div className="space-y-10">
          <section aria-label="All devices together" className="rounded-lg border border-line bg-chalk p-4">
            <p className="text-sm text-mute">
              {devices.length} {devices.length === 1 ? "device" : "devices"} in your synced history
              {report.historyFrom && ` (since ${formatShortDate(report.historyFrom)})`}
            </p>
            <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-4">
              <StatItem label="Distance" value={formatDistance(overall.distance)} />
              <StatItem label="Moving time" value={formatDuration(overall.movingTime)} />
              <StatItem label="Elevation" value={formatElevation(overall.elevation)} />
              <StatItem label="Activities" value={overall.count.toLocaleString()} />
            </dl>
          </section>

          <div className="flex flex-col gap-3 border-t border-line pt-6">
            <FilterTabs options={RANGE_OPTIONS} value={range} onChange={setRange} label="Time range" />
            <div role="group" aria-label="Devices shown in charts" className="flex flex-wrap gap-2">
              {devices.map((device) => {
                const on = !hidden.has(device.name);
                const color = gearColor(device.color);
                return (
                  <button
                    key={device.name}
                    type="button"
                    aria-pressed={on}
                    onClick={() => toggle(device.name)}
                    className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-sm font-semibold ${
                      on ? "border-ink/30 bg-chalk" : "border-line text-mute hover:bg-chalk"
                    }`}
                  >
                    <span className="size-3.5 rounded-sm border-2" style={{ borderColor: color, backgroundColor: on ? color : "transparent" }} aria-hidden="true" />
                    {device.name}
                  </button>
                );
              })}
            </div>
          </div>

          <CollapsibleSection title={`${METRIC_LABELS[metric]} per month`}>
            <div className="rounded-lg border border-line bg-chalk p-3 sm:p-4">
              <StackedBarChart
                labels={months.map((month) => monthLabel(month.month, multiYear))}
                titles={months.map((month) => monthTitle(month.month))}
                series={charted.map((device) => ({
                  id: device.name,
                  name: device.name,
                  color: gearColor(device.color),
                  values: months.map((month) => value(month.devices[device.name])),
                }))}
                format={fmt}
                formatTick={fmtTick}
                labelEvery={labelEvery}
                height={280}
              />
            </div>
          </CollapsibleSection>

          <CollapsibleSection title={`${METRIC_LABELS[metric]} over time`}>
            <div className="rounded-lg border border-line bg-chalk p-3 sm:p-4">
              <p className="mb-2 text-sm text-mute">Running total per device since its first activity in your synced history.</p>
              <CumulativeLineChart
                series={charted.map((device) => ({
                  id: device.name,
                  name: device.name,
                  color: gearColor(device.color),
                  points: (report.timelines.find((timeline) => timeline.name === device.name)?.points ?? []).map(
                    (point) => [dayMs(point.date), value(point.totals)] as const
                  ),
                }))}
                from={chartFrom}
                to={now.getTime()}
                format={fmt}
                formatTick={fmtTick}
                formatDate={fullDate}
              />
            </div>
          </CollapsibleSection>

          {years.length > 0 && (
            <CollapsibleSection title="Year by year">
              <div className="rounded-lg border border-line bg-chalk p-3 sm:p-4">
                <StackedBarChart
                  labels={years.map(String)}
                  titles={years.map(String)}
                  series={charted.map((device) => ({
                    id: device.name,
                    name: device.name,
                    color: gearColor(device.color),
                    values: years.map((year) => value(device.years.find((entry) => entry.year === year)?.totals)),
                  }))}
                  format={fmt}
                  formatTick={fmtTick}
                  height={240}
                />
              </div>
            </CollapsibleSection>
          )}

          <CollapsibleSection title="Usage in this period">
            <div className="overflow-x-auto rounded-lg border border-line bg-chalk">
              <table className="w-full text-left text-sm whitespace-nowrap">
                <caption className="sr-only">Usage per device in the chosen time range</caption>
                <thead className="border-b border-line text-mute">
                  <tr>
                    <th scope="col" className="px-3 py-2 font-semibold sm:px-4">Device</th>
                    <th scope="col" className="px-3 py-2 font-semibold sm:px-4">Share of {METRIC_LABELS[metric].toLowerCase()}</th>
                    <th scope="col" className="px-3 py-2 text-right font-semibold sm:px-4">Distance</th>
                    <th scope="col" className="px-3 py-2 text-right font-semibold sm:px-4">Time</th>
                    <th scope="col" className="px-3 py-2 text-right font-semibold sm:px-4">Elevation</th>
                    <th scope="col" className="px-3 py-2 text-right font-semibold sm:px-4">Activities</th>
                  </tr>
                </thead>
                <tbody>
                  {charted.map((device: DeviceItem) => {
                    const totals = windowTotals.get(device.name);
                    const share = windowSum > 0 ? value(totals) / windowSum : 0;
                    const color = gearColor(device.color);
                    return (
                      <tr key={device.name} className="border-b border-line last:border-b-0">
                        <th scope="row" className="px-3 py-2 font-semibold sm:px-4">
                          <span className="flex items-center gap-2">
                            <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: color }} />
                            {device.name}
                          </span>
                        </th>
                        <td className="px-3 py-2 sm:px-4">
                          <div className="flex items-center gap-3">
                            <div aria-hidden="true" className="h-2 w-40 min-w-16 rounded-full bg-line">
                              <div className="h-full rounded-full" style={{ width: `${share * 100}%`, backgroundColor: color }} />
                            </div>
                            <span className="num w-10 text-right">{Math.round(share * 100)}%</span>
                          </div>
                        </td>
                        <td className="num px-3 py-2 text-right font-semibold sm:px-4">{formatDistance(totals?.distance ?? 0)}</td>
                        <td className="num px-3 py-2 text-right sm:px-4">{formatDuration(totals?.movingTime ?? 0)}</td>
                        <td className="num px-3 py-2 text-right sm:px-4">{formatElevation(totals?.elevation ?? 0)}</td>
                        <td className="num px-3 py-2 text-right sm:px-4">{totals?.count ?? 0}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CollapsibleSection>
        </div>
      )}
    </DashboardTemplate>
  );
}