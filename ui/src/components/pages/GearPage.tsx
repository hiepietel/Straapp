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
import { useActivitiesSince } from "../../hooks/useActivitiesSince";
import { useGearList } from "../../hooks/useGearList";
import { activityHref } from "../../hooks/useRoute";
import { formatDistance, formatDuration, formatShortDate } from "../../utils/format";
import { localNow } from "../../utils/periodStats";
import { cumulativeDistance, monthlyDistance, monthsBetween, usageByGear } from "../../utils/gearStats";
import type { GearInfo, GearKind, GearUsage } from "../../utils/gearStats";
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

const km = (m: number) => `${Math.round(m / 1000).toLocaleString()} km`;
const isoDay = (d: Date) => d.toISOString().slice(0, 10);
const monthLabel = (d: Date, withYear: boolean) =>
  new Intl.DateTimeFormat(undefined, { month: "short", ...(withYear && { year: "2-digit" }), timeZone: "UTC" }).format(d);
const fullDate = (t: number) =>
  new Intl.DateTimeFormat(undefined, { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(t);

const KindIcon = ({ kind, className }: { kind: GearKind; className?: string }) =>
  kind === "bike" ? <Bike className={className} aria-hidden="true" /> : <Footprints className={className} aria-hidden="true" />;

export default function GearPage() {
  // Everything: gear history is only meaningful from each item's first use.
  const { activities, status, error, loaded, retry } = useActivitiesSince(0);
  const ready = status === "ready";
  const { gear, loading: gearLoading } = useGearList(activities, ready);

  const [kind, setKind] = useState<KindFilter>("all");
  const [showRetired, setShowRetired] = useState(true);
  const [range, setRange] = useState<Range>("12m");
  const [hidden, setHidden] = useState<ReadonlySet<string>>(new Set());

  const now = useMemo(() => localNow(), []);
  const usage = useMemo(() => usageByGear(activities), [activities]);
  const listed = gear.filter((g) => (kind === "all" || g.kind === kind) && (showRetired || !g.retired));
  const charted = listed.filter((g) => !hidden.has(g.id) && usage.has(g.id));
  const noGear = activities.filter((a) => !a.gear_id).length;

  const firstUse = useMemo(() => {
    const times = [...usage.values()].map((u) => u.first.getTime());
    return times.length ? Math.min(...times) : now.getTime();
  }, [usage, now]);
  const from = useMemo(() => {
    if (range === "all") return new Date(firstUse);
    const back = range === "12m" ? 11 : 23;
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - back, 1));
  }, [range, firstUse, now]);

  const months = useMemo(() => monthsBetween(from, now), [from, now]);
  const chartedIds = charted.map((g) => g.id).join(",");
  const monthly = useMemo(
    () => monthlyDistance(activities, chartedIds ? chartedIds.split(",") : [], months),
    [activities, chartedIds, months]
  );
  const cumulative = useMemo(() => cumulativeDistance(activities), [activities]);

  // Usage within the chosen window, for the share bars.
  const windowUsage = useMemo(
    () => usageByGear(activities.filter((a) => new Date(a.start_date_local) >= from)),
    [activities, from]
  );
  const windowTotal = charted.reduce((sum, g) => sum + (windowUsage.get(g.id)?.distance ?? 0), 0);
  const multiYear = months.length > 12;
  const labelEvery = Math.max(1, Math.ceil(months.length / 12));

  const toggle = (id: string) =>
    setHidden((h) => {
      const next = new Set(h);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

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
        )
      }
    >
      {(!ready || gearLoading) && !error && (
        <div className="flex flex-col items-center gap-3 py-24">
          <Spinner label="Loading your gear history" />
          {loaded > 0 && <p className="text-sm text-mute">{loaded.toLocaleString()} activities so far…</p>}
        </div>
      )}

      {ready && !gearLoading && listed.length === 0 && (
        <p className="py-16 text-center text-mute">No gear to show. Add bikes or shoes on Strava and pick them on your activities.</p>
      )}

      {ready && !gearLoading && listed.length > 0 && (
        <div className="space-y-10">
          <section aria-label="Gear" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {listed.map((g) => (
              <GearCard key={g.id} gear={g} usage={usage.get(g.id)} />
            ))}
          </section>
          {noGear > 0 && (
            <p className="-mt-6 text-sm text-mute">
              {noGear.toLocaleString()} {noGear === 1 ? "activity has" : "activities have"} no gear set and aren't counted here.
            </p>
          )}

          <div className="flex flex-col gap-3 border-t border-line pt-6">
            <FilterTabs options={RANGE_OPTIONS} value={range} onChange={setRange} label="Time range" />
            {/* The legend doubles as show/hide switches for every chart below. */}
            <div role="group" aria-label="Gear shown in charts" className="flex flex-wrap gap-2">
              {listed.filter((g) => usage.has(g.id)).map((g) => {
                const on = !hidden.has(g.id);
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
                      style={{ borderColor: g.color, backgroundColor: on ? g.color : "transparent" }}
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

          <CollapsibleSection title="Distance per month">
            <div className="rounded-lg border border-line bg-chalk p-3 sm:p-4">
              <StackedBarChart
                labels={months.map((m) => monthLabel(m, multiYear))}
                titles={months.map((m) =>
                  new Intl.DateTimeFormat(undefined, { month: "long", year: "numeric", timeZone: "UTC" }).format(m)
                )}
                series={charted.map((g) => ({ id: g.id, name: g.name, color: g.color, values: monthly.get(g.id) ?? [] }))}
                format={formatDistance}
                formatTick={km}
                labelEvery={labelEvery}
                height={280}
              />
            </div>
          </CollapsibleSection>

          <CollapsibleSection title="Distance over time">
            <div className="rounded-lg border border-line bg-chalk p-3 sm:p-4">
              <p className="mb-2 text-sm text-mute">
                Running total per item since its first activity in your history.
              </p>
              <CumulativeLineChart
                series={charted.map((g) => ({ id: g.id, name: g.name, color: g.color, points: cumulative.get(g.id) ?? [] }))}
                from={from.getTime()}
                to={now.getTime()}
                format={formatDistance}
                formatTick={km}
                formatDate={fullDate}
              />
            </div>
          </CollapsibleSection>

          <CollapsibleSection title="Usage in this period">
            <div className="overflow-x-auto rounded-lg border border-line bg-chalk">
              <table className="w-full text-left text-sm whitespace-nowrap">
                <caption className="sr-only">Distance and activities per item in the chosen time range</caption>
                <thead className="border-b border-line text-mute">
                  <tr>
                    <th scope="col" className="px-3 py-2 font-semibold sm:px-4">Gear</th>
                    <th scope="col" className="px-3 py-2 font-semibold sm:px-4">Share of distance</th>
                    <th scope="col" className="px-3 py-2 text-right font-semibold sm:px-4">Distance</th>
                    <th scope="col" className="px-3 py-2 text-right font-semibold sm:px-4">Activities</th>
                    <th scope="col" className="px-3 py-2 text-right font-semibold sm:px-4">Time</th>
                  </tr>
                </thead>
                <tbody>
                  {charted.map((g) => {
                    const u = windowUsage.get(g.id);
                    const share = windowTotal > 0 ? (u?.distance ?? 0) / windowTotal : 0;
                    return (
                      <tr key={g.id} className="border-b border-line last:border-b-0">
                        <th scope="row" className="px-3 py-2 font-semibold sm:px-4">
                          <span className="flex items-center gap-2">
                            <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: g.color }} />
                            {g.name}
                          </span>
                        </th>
                        <td className="px-3 py-2 sm:px-4">
                          <div className="flex items-center gap-3">
                            <div aria-hidden="true" className="h-2 w-40 min-w-16 rounded-full bg-line">
                              <div className="h-full rounded-full" style={{ width: `${share * 100}%`, backgroundColor: g.color }} />
                            </div>
                            <span className="num w-10 text-right">{Math.round(share * 100)}%</span>
                          </div>
                        </td>
                        <td className="num px-3 py-2 text-right font-semibold sm:px-4">{formatDistance(u?.distance ?? 0)}</td>
                        <td className="num px-3 py-2 text-right sm:px-4">{u?.count ?? 0}</td>
                        <td className="num px-3 py-2 text-right sm:px-4">{formatDuration(u?.time ?? 0)}</td>
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

function GearCard({ gear, usage }: { gear: GearInfo; usage: GearUsage | undefined }) {
  return (
    <article className={`rounded-lg border border-line bg-chalk p-4 ${gear.retired ? "opacity-80" : ""}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 text-sm text-mute">
            <KindIcon kind={gear.kind} className="size-4" />
            {gear.kind === "bike" ? "Bike" : "Shoes"}
          </p>
          <h2 className="mt-0.5 flex items-center gap-2 text-lg leading-tight font-bold">
            <span className="size-3 shrink-0 rounded-full" style={{ backgroundColor: gear.color }} aria-hidden="true" />
            <span className="truncate">{gear.name}</span>
          </h2>
        </div>
        <div className="flex shrink-0 gap-1">
          {gear.primary && <span className="rounded-full bg-ink px-2 py-0.5 text-xs font-semibold text-chalk">Primary</span>}
          {gear.retired && <span className="rounded-full border border-line px-2 py-0.5 text-xs font-semibold text-mute">Retired</span>}
        </div>
      </div>

      <p className="num mt-3 text-3xl leading-tight font-bold">{km(gear.lifetimeDistance)}</p>
      <p className="text-xs text-mute">lifetime, as Strava counts it</p>

      {usage ? (
        <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3">
          <StatItem label="Activities" value={usage.count.toLocaleString()} />
          <StatItem label="Moving time" value={formatDuration(usage.time)} />
          <StatItem label="Avg per activity" value={formatDistance(usage.distance / usage.count)} />
          <StatItem label="Elevation" value={`${Math.round(usage.elevation).toLocaleString()} m`} />
          <StatItem label="First used" value={formatShortDate(isoDay(usage.first))} />
          <StatItem label="Last used" value={formatShortDate(isoDay(usage.last))} />
          <div className="col-span-2">
            <dt className="text-sm text-mute">Longest</dt>
            <dd className="truncate font-semibold">
              <a href={activityHref(usage.longest.id)} className="hover:underline">
                {usage.longest.name}
              </a>{" "}
              <span className="num text-mute">· {formatDistance(usage.longest.distance)}</span>
            </dd>
          </div>
        </dl>
      ) : (
        <p className="mt-4 text-sm text-mute">No activities with this in your history.</p>
      )}
    </article>
  );
}
