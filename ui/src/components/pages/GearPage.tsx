import { useMemo, useState } from "react";
import { Bike, Check, Footprints } from "lucide-react";
import DashboardTemplate from "../templates/DashboardTemplate";
import StackedBarChart from "../organisms/StackedBarChart";
import CumulativeLineChart from "../organisms/CumulativeLineChart";
import CollapsibleSection from "../molecules/CollapsibleSection";
import FilterTabs from "../molecules/FilterTabs";
import Notice from "../molecules/Notice";
import StatItem from "../molecules/StatItem";
import Spinner from "../atoms/Spinner";
import { useGearReport } from "../../hooks/useGearReport";
import { activityHref } from "../../hooks/useRoute";
import { isDemo } from "../../services/auth";
import {
  formatDistance,
  formatDuration,
  formatElevation,
  formatPacePerKm,
  formatShortDate,
  formatSpeed,
} from "../../utils/format";
import { METRIC_LABELS, formatMetric, formatMetricTick, localNow, metricValue } from "../../utils/periodStats";
import type { Metric } from "../../utils/periodStats";
import { SHOE_LIFESPAN_METRES, gearColor } from "../../utils/gearStats";
import type { ActivityRef, GearItem, GearKind } from "../../types/gear";
import type { Totals } from "../../types/statistics";
import type { FilterOption } from "../molecules/FilterTabs";

type KindFilter = "all" | GearKind;
type Range = "12m" | "24m" | "all";

const KIND_OPTIONS: FilterOption<KindFilter>[] = [
  { id: "all", label: "All gear" },
  { id: "bike", label: "Bikes" },
  { id: "shoes", label: "Shoes" },
];
const RANGE_OPTIONS: FilterOption<Range>[] = [
  { id: "12m", label: "Last 12 months" },
  { id: "24m", label: "Last 2 years" },
  { id: "all", label: "All time" },
];
const METRIC_OPTIONS: FilterOption<Metric>[] = (Object.keys(METRIC_LABELS) as Metric[]).map((id) => ({
  id,
  label: METRIC_LABELS[id],
}));

const DAY_MS = 24 * 3600 * 1000;
const km = (m: number) => `${Math.round(m / 1000).toLocaleString()} km`;
/** "2026-09-28" (a local calendar day) on the wall-clock-as-UTC scale of localNow(). */
const dayMs = (day: string) => Date.parse(`${day}T00:00:00Z`);
const monthLabel = (day: string, withYear: boolean) =>
  new Intl.DateTimeFormat(undefined, { month: "short", ...(withYear && { year: "2-digit" }), timeZone: "UTC" }).format(dayMs(day));
const monthTitle = (day: string) =>
  new Intl.DateTimeFormat(undefined, { month: "long", year: "numeric", timeZone: "UTC" }).format(dayMs(day));
const fullDate = (t: number) =>
  new Intl.DateTimeFormat(undefined, { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(t);
// "MountainBikeRide" -> "Mountain bike ride"
const sportName = (type: string) => {
  const words = type.replace(/([a-z])([A-Z])/g, "$1 $2");
  return words.charAt(0) + words.slice(1).toLowerCase();
};

const KindIcon = ({ kind, className }: { kind: GearKind; className?: string }) =>
  kind === "bike" ? <Bike className={className} aria-hidden="true" /> : <Footprints className={className} aria-hidden="true" />;

const sum = (all: readonly Totals[]): Totals =>
  all.reduce(
    (s, t) => ({
      count: s.count + t.count,
      distance: s.distance + t.distance,
      movingTime: s.movingTime + t.movingTime,
      elevation: s.elevation + t.elevation,
    }),
    { count: 0, distance: 0, movingTime: 0, elevation: 0 }
  );

export default function GearPage() {
  const now = useMemo(() => localNow(), []);
  const today = now.toISOString().slice(0, 10);
  // Everything comes from the API's database; this page never reaches Strava.
  const { report, status, error, retry } = useGearReport(today);
  const ready = status === "ready" && report !== null;

  const [kind, setKind] = useState<KindFilter>("all");
  const [showRetired, setShowRetired] = useState(true);
  const [metric, setMetric] = useState<Metric>("distance");
  const [range, setRange] = useState<Range>("12m");
  const [hidden, setHidden] = useState<ReadonlySet<string>>(new Set());

  const gear = report?.gear ?? [];
  const listed = gear.filter((g) => (kind === "all" || g.kind === kind) && (showRetired || !g.retired));
  const used = listed.filter((g) => g.totals.count > 0);
  const charted = used.filter((g) => !hidden.has(g.id));

  const value = (t: Totals | undefined) => (t ? metricValue(t, metric) : 0);
  const fmt = (v: number) => formatMetric(metric, v);
  const fmtTick = (v: number) => formatMetricTick(metric, v);

  // ---- The chosen time window.
  const fromMonth = useMemo(() => {
    if (range === "all") return "";
    const back = range === "12m" ? 11 : 23;
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - back, 1)).toISOString().slice(0, 10);
  }, [range, now]);
  const months = (report?.months ?? []).filter((m) => m.month >= fromMonth);
  const multiYear = months.length > 12;
  const labelEvery = Math.max(1, Math.ceil(months.length / 12));
  const windowTotals = new Map(charted.map((g) => [g.id, sum(months.flatMap((m) => (m.gear[g.id] ? [m.gear[g.id]!] : [])))]));
  const windowSum = [...windowTotals.values()].reduce((s, t) => s + value(t), 0);
  const chartFrom = months.length ? dayMs(months[0]!.month) : now.getTime();

  // ---- Every year any gear was used, for the year-by-year chart.
  const years = [...new Set(used.flatMap((g) => g.years.map((y) => y.year)))].sort((a, b) => a - b);

  const overall = sum(used.map((g) => g.totals));

  const toggle = (id: string) =>
    setHidden((h) => {
      const next = new Set(h);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  if (isDemo) {
    return (
      <DashboardTemplate
        header={
          <header className="pt-8">
            <h1 className="text-3xl font-extrabold tracking-tight">Gear</h1>
          </header>
        }
        notice={<Notice>Gear statistics come from the Straapp API, which demo mode doesn't use.</Notice>}
      />
    );
  }

  return (
    <DashboardTemplate
      header={
        <header className="pt-8">
          <h1 className="text-3xl font-extrabold tracking-tight">Gear</h1>
          <p className="mt-1 text-mute">Your bikes and shoes, and how you've used them.</p>
        </header>
      }
      notice={
        error && (
          <Notice tone="error" actionLabel="Try again" onAction={retry}>
            {error}
          </Notice>
        )
      }
      filters={
        ready && (
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <FilterTabs options={KIND_OPTIONS} value={kind} onChange={setKind} label="Kind of gear" />
              <label className="flex cursor-pointer items-center gap-2 text-sm font-semibold">
                <input
                  type="checkbox"
                  checked={showRetired}
                  onChange={(e) => setShowRetired(e.target.checked)}
                  className="size-4 accent-ink"
                />
                Show retired
              </label>
            </div>
            <FilterTabs options={METRIC_OPTIONS} value={metric} onChange={setMetric} label="Measure" />
          </div>
        )
      }
    >
      {status === "loading" && (
        <div className="flex flex-col items-center gap-3 py-24">
          <Spinner label="Loading your gear" />
        </div>
      )}

      {ready && listed.length === 0 && (
        <p className="py-16 text-center text-mute">
          No gear to show yet. Add bikes or shoes on Strava and pick them on your activities; the next sync brings them in.
        </p>
      )}

      {ready && listed.length > 0 && (
        <div className="space-y-10">
          <section aria-label="All listed gear together" className="rounded-lg border border-line bg-chalk p-4">
            <p className="text-sm text-mute">
              Together, {used.length} {used.length === 1 ? "item" : "items"} in your synced history
              {report.historyFrom && ` (since ${formatShortDate(report.historyFrom)})`}
            </p>
            <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-4">
              <StatItem label="Distance" value={formatDistance(overall.distance)} />
              <StatItem label="Moving time" value={formatDuration(overall.movingTime)} />
              <StatItem label="Elevation" value={formatElevation(overall.elevation)} />
              <StatItem label="Activities" value={overall.count.toLocaleString()} />
            </dl>
          </section>

          <section aria-label="Gear" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {listed.map((g) => (
              <GearCard key={g.id} gear={g} today={today} />
            ))}
          </section>
          {report.withoutGear.count > 0 && (
            <p className="-mt-6 text-sm text-mute">
              {report.withoutGear.count.toLocaleString()} {report.withoutGear.count === 1 ? "activity has" : "activities have"} no
              gear set ({formatDistance(report.withoutGear.distance)}) and {report.withoutGear.count === 1 ? "isn't" : "aren't"} counted
              here.
            </p>
          )}

          {used.length > 0 && (
            <>
              <div className="flex flex-col gap-3 border-t border-line pt-6">
                <FilterTabs options={RANGE_OPTIONS} value={range} onChange={setRange} label="Time range" />
                {/* The legend doubles as show/hide switches for every chart below. */}
                <div role="group" aria-label="Gear shown in charts" className="flex flex-wrap gap-2">
                  {used.map((g) => {
                    const on = !hidden.has(g.id);
                    const color = gearColor(g.color);
                    return (
                      <button
                        key={g.id}
                        type="button"
                        aria-pressed={on}
                        onClick={() => toggle(g.id)}
                        className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-sm font-semibold ${
                          on ? "border-ink/30 bg-chalk" : "border-line text-mute hover:bg-chalk"
                        }`}
                      >
                        <span
                          className="flex size-4 items-center justify-center rounded-sm border-2"
                          style={{ borderColor: color, backgroundColor: on ? color : "transparent" }}
                          aria-hidden="true"
                        >
                          {on && <Check className="size-3 text-white" strokeWidth={3} />}
                        </span>
                        {g.name}
                      </button>
                    );
                  })}
                </div>
              </div>

              <CollapsibleSection title={`${METRIC_LABELS[metric]} per month`}>
                <div className="rounded-lg border border-line bg-chalk p-3 sm:p-4">
                  <StackedBarChart
                    labels={months.map((m) => monthLabel(m.month, multiYear))}
                    titles={months.map((m) => monthTitle(m.month))}
                    series={charted.map((g) => ({
                      id: g.id,
                      name: g.name,
                      color: gearColor(g.color),
                      values: months.map((m) => value(m.gear[g.id])),
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
                  <p className="mb-2 text-sm text-mute">Running total per item since its first activity in your synced history.</p>
                  <CumulativeLineChart
                    series={charted.map((g) => ({
                      id: g.id,
                      name: g.name,
                      color: gearColor(g.color),
                      points: (report.timelines.find((t) => t.gearId === g.id)?.points ?? []).map(
                        (p) => [dayMs(p.date), value(p.totals)] as const
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
                      series={charted.map((g) => ({
                        id: g.id,
                        name: g.name,
                        color: gearColor(g.color),
                        values: years.map((y) => value(g.years.find((u) => u.year === y)?.totals)),
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
                    <caption className="sr-only">Usage per item in the chosen time range</caption>
                    <thead className="border-b border-line text-mute">
                      <tr>
                        <th scope="col" className="px-3 py-2 font-semibold sm:px-4">Gear</th>
                        <th scope="col" className="px-3 py-2 font-semibold sm:px-4">Share of {METRIC_LABELS[metric].toLowerCase()}</th>
                        <th scope="col" className="px-3 py-2 text-right font-semibold sm:px-4">Distance</th>
                        <th scope="col" className="px-3 py-2 text-right font-semibold sm:px-4">Time</th>
                        <th scope="col" className="px-3 py-2 text-right font-semibold sm:px-4">Elevation</th>
                        <th scope="col" className="px-3 py-2 text-right font-semibold sm:px-4">Activities</th>
                      </tr>
                    </thead>
                    <tbody>
                      {charted.map((g) => {
                        const t = windowTotals.get(g.id);
                        const share = windowSum > 0 ? value(t) / windowSum : 0;
                        const color = gearColor(g.color);
                        return (
                          <tr key={g.id} className="border-b border-line last:border-b-0">
                            <th scope="row" className="px-3 py-2 font-semibold sm:px-4">
                              <span className="flex items-center gap-2">
                                <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: color }} />
                                {g.name}
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
                            <td className="num px-3 py-2 text-right font-semibold sm:px-4">{formatDistance(t?.distance ?? 0)}</td>
                            <td className="num px-3 py-2 text-right sm:px-4">{formatDuration(t?.movingTime ?? 0)}</td>
                            <td className="num px-3 py-2 text-right sm:px-4">{formatElevation(t?.elevation ?? 0)}</td>
                            <td className="num px-3 py-2 text-right sm:px-4">{t?.count ?? 0}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </CollapsibleSection>
            </>
          )}
        </div>
      )}
    </DashboardTemplate>
  );
}

function ActivityLink({ label, activity, detail }: { label: string; activity: ActivityRef; detail: string }) {
  return (
    <div className="col-span-2">
      <dt className="text-sm text-mute">{label}</dt>
      <dd className="truncate font-semibold">
        <a href={activityHref(activity.id)} className="hover:underline">
          {activity.name}
        </a>{" "}
        <span className="num text-mute">
          · {detail} · {formatShortDate(activity.date)}
        </span>
      </dd>
    </div>
  );
}

function GearCard({ gear, today }: { gear: GearItem; today: string }) {
  const t = gear.totals;
  const color = gearColor(gear.color);
  const makeAndModel = [gear.brandName, gear.modelName].filter(Boolean).join(" ");
  const speed = t.movingTime > 0 ? t.distance / t.movingTime : 0;
  const daysSinceUse = gear.lastUsed ? Math.round((dayMs(today) - dayMs(gear.lastUsed)) / DAY_MS) : null;
  // Strava's lifetime total also counts activities from before the synced history.
  const lifetime = Math.max(gear.stravaDistance, t.distance);
  const wear = gear.kind === "shoes" && !gear.retired ? lifetime / SHOE_LIFESPAN_METRES : null;

  return (
    <article className={`rounded-lg border border-line bg-chalk p-4 ${gear.retired ? "opacity-80" : ""}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 text-sm text-mute">
            <KindIcon kind={gear.kind} className="size-4" />
            {gear.kind === "bike" ? "Bike" : "Shoes"}
            {makeAndModel && <span className="truncate">· {makeAndModel}</span>}
          </p>
          <h2 className="mt-0.5 flex items-center gap-2 text-lg leading-tight font-bold">
            <span className="size-3 shrink-0 rounded-full" style={{ backgroundColor: color }} aria-hidden="true" />
            <span className="truncate">{gear.name}</span>
          </h2>
          {gear.nickname && gear.nickname !== gear.name && <p className="truncate text-sm text-mute">“{gear.nickname}”</p>}
        </div>
        <div className="flex shrink-0 flex-wrap justify-end gap-1">
          {gear.primary && <span className="rounded-full bg-ink px-2 py-0.5 text-xs font-semibold text-chalk">Primary</span>}
          {gear.retired && <span className="rounded-full border border-line px-2 py-0.5 text-xs font-semibold text-mute">Retired</span>}
          {!gear.known && (
            <span className="rounded-full border border-line px-2 py-0.5 text-xs font-semibold text-mute">Not synced yet</span>
          )}
        </div>
      </div>

      <p className="num mt-3 text-3xl leading-tight font-bold">{km(lifetime)}</p>
      <p className="text-xs text-mute">
        {gear.known ? "lifetime, as Strava counts it" : "in your synced history; details arrive with the next sync"}
      </p>

      {wear !== null && (
        <div className="mt-3">
          <div className="flex justify-between text-xs text-mute">
            <span>Wear</span>
            <span className="num">
              {Math.round(wear * 100)}% of ~{km(SHOE_LIFESPAN_METRES)}
            </span>
          </div>
          <div
            className="mt-1 h-1.5 rounded-full bg-line"
            role="meter"
            aria-label="Shoe wear"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.min(100, Math.round(wear * 100))}
          >
            <div
              className="h-full rounded-full"
              style={{ width: `${Math.min(1, wear) * 100}%`, backgroundColor: wear >= 1 ? "#e34948" : color }}
            />
          </div>
          {wear >= 1 && <p className="mt-1 text-xs font-semibold">Past the usual lifespan: worth checking the soles.</p>}
        </div>
      )}

      {t.count > 0 ? (
        <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3">
          <StatItem label="Activities" value={t.count.toLocaleString()} />
          <StatItem label="Distance" value={formatDistance(t.distance)} />
          <StatItem label="Moving time" value={formatDuration(t.movingTime)} />
          <StatItem label="Elevation" value={formatElevation(t.elevation)} />
          <StatItem label="Avg per activity" value={formatDistance(t.distance / t.count)} />
          {speed > 0 && (
            <StatItem
              label={gear.kind === "bike" ? "Avg speed" : "Avg pace"}
              value={gear.kind === "bike" ? formatSpeed(speed) : formatPacePerKm(speed)}
            />
          )}
          {gear.firstUsed && <StatItem label="First used" value={formatShortDate(gear.firstUsed)} />}
          {gear.lastUsed && (
            <StatItem
              label="Last used"
              value={
                <>
                  {formatShortDate(gear.lastUsed)}
                  {daysSinceUse !== null && (
                    <span className="block text-sm font-normal text-mute">
                      {daysSinceUse === 0 ? "today" : daysSinceUse === 1 ? "yesterday" : `${daysSinceUse} days ago`}
                    </span>
                  )}
                </>
              }
            />
          )}
          {gear.longest && <ActivityLink label="Longest" activity={gear.longest} detail={formatDistance(gear.longest.distance)} />}
          {gear.longestTime && gear.longestTime.id !== gear.longest?.id && (
            <ActivityLink label="Longest time" activity={gear.longestTime} detail={formatDuration(gear.longestTime.movingTime)} />
          )}
          {gear.biggestClimb && (
            <ActivityLink label="Biggest climb" activity={gear.biggestClimb} detail={formatElevation(gear.biggestClimb.elevation)} />
          )}
          {gear.sports.length > 0 && (
            <div className="col-span-2">
              <dt className="text-sm text-mute">Used for</dt>
              <dd className="mt-1 flex flex-wrap gap-1.5">
                {gear.sports.map((s) => (
                  <span key={s.sportType} className="rounded-full border border-line px-2 py-0.5 text-xs font-semibold">
                    {sportName(s.sportType)} <span className="num font-normal text-mute">· {s.totals.count}</span>
                  </span>
                ))}
              </dd>
            </div>
          )}
        </dl>
      ) : (
        <p className="mt-4 text-sm text-mute">No activities with this in your synced history.</p>
      )}
    </article>
  );
}
