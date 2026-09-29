import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import DashboardTemplate from "../templates/DashboardTemplate";
import HistogramChart from "../organisms/HistogramChart";
import WeekHourGrid from "../organisms/WeekHourGrid";
import CollapsibleSection from "../molecules/CollapsibleSection";
import FilterTabs from "../molecules/FilterTabs";
import type { FilterOption } from "../molecules/FilterTabs";
import Notice from "../molecules/Notice";
import PeriodFilter, { defaultPeriod, localDay, periodDays } from "../molecules/PeriodFilter";
import PillMultiSelect from "../molecules/PillMultiSelect";
import SportTypeFilter from "../molecules/SportTypeFilter";
import StatItem from "../molecules/StatItem";
import Spinner from "../atoms/Spinner";
import { useInsights } from "../../hooks/useInsights";
import { activityHref } from "../../hooks/useRoute";
import { formatSportSpeed } from "../../utils/activityStats";
import { formatDistance, formatDuration, formatElevation, formatShortDate } from "../../utils/format";
import {
  MEASURES,
  autoStep,
  dayOf,
  defaultRange,
  histogram,
  milestones,
  records,
  streaks,
  totals,
  totalsBy,
  weekHourGrid,
} from "../../utils/insights";
import type { MeasureId } from "../../utils/insights";
import { sportTypeLabel } from "../../utils/sports";
import { formatTemp, formatWind } from "../../utils/weather";
import type { InsightActivity } from "../../types/insights";

const DISTRIBUTION_COLOR = "#2a78d6";
const TEMPERATURE_COLOR = "#e34948";
const LIST_LIMIT = 50;

const MEASURE_OPTIONS: FilterOption<MeasureId>[] = (Object.keys(MEASURES) as MeasureId[]).map((id) => ({
  id,
  label: MEASURES[id].label,
}));

/** "20", "20.5", "0.5": no trailing zeros. */
const num = (n: number) => String(Math.round(n * 100) / 100);

const TH = "px-3 py-2 font-semibold";
const TD = "px-3 py-2";
const INPUT = "num w-20 rounded-md border border-line bg-chalk px-2 py-1 text-ink";

function ActivityLink({ activity, children }: { activity: InsightActivity; children?: ReactNode }) {
  return (
    <a href={activityHref(activity.id)} className="font-semibold hover:underline">
      {children ?? (activity.name || "Untitled")}
    </a>
  );
}

function Tile({ label, value, hint }: { label: string; value: ReactNode; hint?: ReactNode }) {
  return (
    <div className="rounded-lg border border-line bg-chalk p-4">
      <p className="text-sm text-mute">{label}</p>
      <p className="num mt-1 text-2xl leading-tight font-bold">{value}</p>
      {hint && <p className="mt-1 text-sm text-mute">{hint}</p>}
    </div>
  );
}

// Everything about the chosen activities at once: how far and long they usually are, when you go,
// your records, streaks, sports, gear and weather. One request; every filter is instant.
export default function InsightsPage() {
  const { report, status, error, retry } = useInsights();
  const [period, setPeriod] = useState(() => defaultPeriod("all"));
  const [sportTypes, setSportTypes] = useState<ReadonlySet<string>>(new Set());
  const [gearIds, setGearIds] = useState<ReadonlySet<string>>(new Set());

  // ---- Filters
  const { from, to } = periodDays(period);
  const inPeriod = useMemo(
    () => (report?.activities ?? []).filter((a) => (!from || dayOf(a) >= from) && (!to || dayOf(a) <= to)),
    [report, from, to]
  );
  const presentTypes = useMemo(() => [...new Set(inPeriod.map((a) => a.sportType))], [inPeriod]);
  const gearById = useMemo(() => new Map((report?.gear ?? []).map((g) => [g.id, g])), [report]);
  const gearOptions = useMemo(() => {
    const used = new Set(inPeriod.flatMap((a) => (a.gearId ? [a.gearId] : [])));
    return (report?.gear ?? [])
      .filter((g) => used.has(g.id))
      .map((g) => ({ id: g.id, label: g.retired ? `${g.name} (retired)` : g.name }));
  }, [report, inPeriod]);
  const activities = useMemo(
    () =>
      inPeriod.filter(
        (a) =>
          (sportTypes.size === 0 || sportTypes.has(a.sportType)) &&
          (gearIds.size === 0 || (a.gearId !== null && gearIds.has(a.gearId)))
      ),
    [inPeriod, sportTypes, gearIds]
  );

  // The period's real first and last day, for streaks and rest days.
  const span = useMemo(() => {
    const days = activities.map(dayOf).sort();
    return { from: from ?? days[0] ?? localDay(), to: to && to < localDay() ? to : localDay() };
  }, [activities, from, to]);

  const sum = useMemo(() => totals(activities), [activities]);
  const habits = useMemo(() => streaks(activities, span), [activities, span]);
  const grid = useMemo(() => weekHourGrid(activities), [activities]);
  const best = useMemo(() => records(activities), [activities]);
  const passed = useMemo(() => milestones(activities), [activities]);
  const byType = useMemo(() => totalsBy(activities, (a) => a.sportType), [activities]);
  const byGear = useMemo(() => totalsBy(activities.filter((a) => a.gearId), (a) => a.gearId!), [activities]);

  // ---- Distribution: how many activities of each length (or time, climb, speed)
  const [measureId, setMeasureId] = useState<MeasureId>("distance");
  const [stepChoice, setStepChoice] = useState<number | null>(null);
  const [rangeInput, setRangeInput] = useState({ from: "", to: "" });
  const [selectedBin, setSelectedBin] = useState<number | null>(null);
  const measure = MEASURES[measureId];
  const values = useMemo(
    () => activities.map((a) => measure.value(a)).filter((v): v is number => v !== null),
    [activities, measure]
  );
  const auto = useMemo(() => defaultRange(values, measure), [values, measure]);
  const rangeFrom = rangeInput.from === "" ? auto.from : Number(rangeInput.from);
  const rangeTo = rangeInput.to === "" ? auto.to : Math.max(Number(rangeInput.to), rangeFrom + measure.steps[0]!);
  const step = stepChoice ?? autoStep(measure, rangeFrom, rangeTo);
  const hist = useMemo(
    () => histogram(activities, measure, rangeFrom, rangeTo, step),
    [activities, measure, rangeFrom, rangeTo, step]
  );
  const binTitle = (from: number, to: number) => `${num(from)}–${num(to)} ${measure.unit}`;
  const chosenBin = selectedBin !== null ? hist.bins[selectedBin] : undefined;
  const changeMeasure = (id: MeasureId) => {
    setMeasureId(id);
    setStepChoice(null);
    setRangeInput({ from: "", to: "" });
    setSelectedBin(null);
  };

  // ---- Weather while the activities lasted
  const withWeather = activities.filter((a) => a.weather?.temperature != null);
  const tempHist = useMemo(() => {
    const temps = withWeather.map((a) => a.weather!.temperature!);
    if (!temps.length) return null;
    const lo = Math.floor(Math.min(...temps) / 5) * 5;
    const hi = Math.max(lo + 5, Math.ceil(Math.max(...temps) / 5) * 5);
    const tempMeasure = { ...MEASURES.distance, unit: "°C", value: (a: InsightActivity) => a.weather?.temperature ?? null };
    return histogram(withWeather, tempMeasure, lo, hi, 5);
  }, [withWeather]);
  const wet = withWeather.filter((a) => (a.weather?.precipitation ?? 0) >= 0.5);
  const weatherRecord = (pick: (a: InsightActivity) => number | null | undefined, lowest = false) =>
    withWeather.reduce<InsightActivity | null>((bestSoFar, a) => {
      const v = pick(a);
      if (v == null) return bestSoFar;
      const b = bestSoFar ? pick(bestSoFar)! : null;
      return b === null || (lowest ? v < b : v > b) ? a : bestSoFar;
    }, null);
  const hottest = weatherRecord((a) => a.weather?.temperature);
  const coldest = weatherRecord((a) => a.weather?.temperature, true);
  const windiest = weatherRecord((a) => a.weather?.windSpeed);
  const wettest = weatherRecord((a) => a.weather?.precipitation);

  const weeks = Math.max(1, (Date.parse(span.to) - Date.parse(span.from)) / (7 * 24 * 3600 * 1000));
  const favouriteDay = (() => {
    const perDay = grid.map((row) => row.reduce((s, c) => s + c, 0));
    const max = Math.max(...perDay);
    return max > 0 ? ["Mondays", "Tuesdays", "Wednesdays", "Thursdays", "Fridays", "Saturdays", "Sundays"][perDay.indexOf(max)] : null;
  })();
  const usualHour = (() => {
    const perHour = Array.from({ length: 24 }, (_, h) => grid.reduce((s, row) => s + row[h]!, 0));
    const max = Math.max(...perHour);
    return max > 0 ? perHour.indexOf(max) : null;
  })();

  const recordValue = (r: (typeof best)[number]) => {
    switch (r.title) {
      case "Longest distance":
        return formatDistance(r.value);
      case "Longest moving time":
        return formatDuration(r.value);
      case "Most climbing":
        return formatElevation(r.value);
      case "Highest average heart rate":
        return `${Math.round(r.value)} bpm`;
      default:
        return formatSportSpeed(r.activity.sport, r.value);
    }
  };

  const ready = status === "ready" && report !== null;

  return (
    <DashboardTemplate
      header={
        <header className="pt-8">
          <h1 className="text-3xl font-extrabold tracking-tight">General statistics</h1>
          <p className="mt-1 text-mute">Everything about your activities at once. Every filter applies to the whole page.</p>
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
            <PeriodFilter value={period} onChange={setPeriod} />
            {presentTypes.length > 1 && <SportTypeFilter types={presentTypes} value={sportTypes} onChange={setSportTypes} />}
            {gearOptions.length > 0 && (
              <PillMultiSelect options={gearOptions} value={gearIds} onChange={setGearIds} label="Filter by gear" />
            )}
          </div>
        )
      }
    >
      {status === "loading" && (
        <div className="flex justify-center py-24">
          <Spinner label="Loading your activities" />
        </div>
      )}

      {ready && activities.length === 0 && <Notice>No activities match these filters.</Notice>}

      {ready && activities.length > 0 && (
        <div className="space-y-10">
          <section aria-label="Totals" className="border-y border-line py-5">
            <dl className="grid grid-cols-2 gap-x-8 gap-y-5 sm:grid-cols-4">
              <StatItem size="lg" label="Activities" value={sum.count.toLocaleString()} />
              <StatItem size="lg" label="Distance" value={formatDistance(sum.distance)} />
              <StatItem size="lg" label="Moving time" value={formatDuration(sum.movingTime)} />
              <StatItem size="lg" label="Elevation" value={formatElevation(sum.elevation)} />
              <StatItem label="Average distance" value={formatDistance(sum.distance / sum.count)} />
              <StatItem label="Average time" value={formatDuration(sum.movingTime / sum.count)} />
              <StatItem label="Active days" value={sum.activeDays.toLocaleString()} />
              <StatItem label="Per week" value={`${(sum.count / weeks).toFixed(1)} activities`} />
            </dl>
          </section>

          <CollapsibleSection title="Distribution">
            <div className="flex flex-col gap-3">
              <FilterTabs options={MEASURE_OPTIONS} value={measureId} onChange={changeMeasure} label="Count by" />
              <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-mute">
                <label className="flex items-center gap-2">
                  Bucket
                  <select
                    value={step}
                    onChange={(e) => {
                      setStepChoice(Number(e.target.value));
                      setSelectedBin(null);
                    }}
                    className="num rounded-md border border-line bg-chalk px-2 py-1 font-semibold text-ink"
                  >
                    {measure.steps.map((s) => (
                      <option key={s} value={s}>
                        {num(s)} {measure.unit}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="flex items-center gap-2">
                  From
                  <input
                    type="number"
                    min={0}
                    step={step}
                    value={rangeInput.from === "" ? rangeFrom : rangeInput.from}
                    onChange={(e) => {
                      setRangeInput((r) => ({ ...r, from: e.target.value }));
                      setSelectedBin(null);
                    }}
                    className={INPUT}
                  />
                </label>
                <label className="flex items-center gap-2">
                  to
                  <input
                    type="number"
                    min={0}
                    step={step}
                    value={rangeInput.to === "" ? rangeTo : rangeInput.to}
                    onChange={(e) => {
                      setRangeInput((r) => ({ ...r, to: e.target.value }));
                      setSelectedBin(null);
                    }}
                    className={INPUT}
                  />
                  {measure.unit}
                </label>
                {(rangeInput.from !== "" || rangeInput.to !== "" || stepChoice !== null) && (
                  <button
                    type="button"
                    onClick={() => {
                      setRangeInput({ from: "", to: "" });
                      setStepChoice(null);
                      setSelectedBin(null);
                    }}
                    className="font-semibold text-ink hover:underline"
                  >
                    Reset
                  </button>
                )}
              </div>

              <div className="rounded-lg border border-line bg-chalk p-3 sm:p-4">
                <HistogramChart
                  bars={hist.bins.map((b) => ({ label: num(b.from), title: binTitle(b.from, b.to), count: b.activities.length }))}
                  color={DISTRIBUTION_COLOR}
                  selected={selectedBin}
                  onSelect={setSelectedBin}
                  total={values.length}
                />
              </div>

              <p className="text-sm text-mute">
                {hist.mode && hist.mode.activities.length > 0 && (
                  <>
                    Most common: <span className="font-semibold text-ink">{binTitle(hist.mode.from, hist.mode.to)}</span> (
                    {hist.mode.activities.length}×).{" "}
                  </>
                )}
                {hist.median !== null && (
                  <>
                    Median {num(Math.round(hist.median * 10) / 10)} {measure.unit}.{" "}
                  </>
                )}
                {hist.below + hist.above > 0 && (
                  <>
                    {hist.below > 0 && `${hist.below} below ${num(rangeFrom)} ${measure.unit}`}
                    {hist.below > 0 && hist.above > 0 && " and "}
                    {hist.above > 0 && `${hist.above} above ${num(rangeTo)} ${measure.unit}`} aren't in the chart.
                  </>
                )}
              </p>

              {chosenBin && (
                <div className="rounded-lg border border-line bg-chalk">
                  <div className="flex items-center justify-between border-b border-line px-4 py-2">
                    <p className="text-sm font-semibold">
                      {binTitle(chosenBin.from, chosenBin.to)} · {chosenBin.activities.length}×
                    </p>
                    <button type="button" onClick={() => setSelectedBin(null)} className="text-sm font-semibold text-mute hover:text-ink">
                      Close
                    </button>
                  </div>
                  <ul className="max-h-72 divide-y divide-line overflow-y-auto text-sm">
                    {[...chosenBin.activities]
                      .sort((a, b) => b.start.localeCompare(a.start))
                      .slice(0, LIST_LIMIT)
                      .map((a) => (
                        <li key={a.id} className="flex flex-wrap items-baseline justify-between gap-x-4 px-4 py-2">
                          <ActivityLink activity={a} />
                          <span className="num text-mute">
                            {sportTypeLabel(a.sportType)} · {formatShortDate(dayOf(a))} · {num(Math.round(measure.value(a)! * 10) / 10)}{" "}
                            {measure.unit}
                          </span>
                        </li>
                      ))}
                  </ul>
                  {chosenBin.activities.length > LIST_LIMIT && (
                    <p className="border-t border-line px-4 py-2 text-sm text-mute">
                      The newest {LIST_LIMIT} of {chosenBin.activities.length}.
                    </p>
                  )}
                </div>
              )}

              <details className="rounded-lg border border-line bg-chalk">
                <summary className="cursor-pointer px-4 py-2 text-sm font-semibold">As a table</summary>
                <div className="max-h-80 overflow-auto border-t border-line">
                  <table className="w-full text-left text-sm whitespace-nowrap">
                    <thead className="sticky top-0 border-b border-line bg-chalk text-mute">
                      <tr>
                        <th scope="col" className={TH}>{measure.label}</th>
                        <th scope="col" className={TH + " text-right"}>Activities</th>
                        <th scope="col" className={TH + " text-right"}>Share</th>
                        <th scope="col" className={TH + " text-right"}>Up to here</th>
                      </tr>
                    </thead>
                    <tbody>
                      {hist.bins.map((b, i, all) => {
                        const upTo = hist.below + all.slice(0, i + 1).reduce((s, x) => s + x.activities.length, 0);
                        return (
                          <tr key={b.from} className="border-b border-line last:border-b-0">
                            <th scope="row" className={TD + " num font-semibold"}>{binTitle(b.from, b.to)}</th>
                            <td className={TD + " num text-right"}>{b.activities.length}</td>
                            <td className={TD + " num text-right"}>
                              {values.length ? `${Math.round((b.activities.length / values.length) * 100)}%` : "—"}
                            </td>
                            <td className={TD + " num text-right text-mute"}>
                              {values.length ? `${Math.round((upTo / values.length) * 100)}%` : "—"}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </details>
            </div>
          </CollapsibleSection>

          {passed.length > 0 && (
            <CollapsibleSection title="Distance milestones">
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
                {passed.map((m) => (
                  <Tile
                    key={m.km}
                    label={`${m.km === 21.1 ? "Half marathon" : m.km === 42.2 ? "Marathon" : `${m.km} km`} or more`}
                    value={`${m.count}×`}
                    hint={`${Math.round((m.count / sum.count) * 100)}% of activities`}
                  />
                ))}
              </div>
            </CollapsibleSection>
          )}

          <CollapsibleSection title="When you go">
            <div className="space-y-3">
              <p className="text-sm text-mute">
                {favouriteDay && (
                  <>
                    Most often on <span className="font-semibold text-ink">{favouriteDay}</span>
                  </>
                )}
                {usualHour !== null && (
                  <>
                    , usually starting{" "}
                    <span className="num font-semibold text-ink">
                      {String(usualHour).padStart(2, "0")}:00–{String(usualHour + 1).padStart(2, "0")}:00
                    </span>
                  </>
                )}
                . Local time where each activity happened.
              </p>
              <div className="rounded-lg border border-line bg-chalk p-3 sm:p-4">
                <WeekHourGrid grid={grid} />
              </div>
            </div>
          </CollapsibleSection>

          <CollapsibleSection title="Records">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {best.map((r) => (
                <Tile
                  key={r.title}
                  label={r.title}
                  value={recordValue(r)}
                  hint={
                    <>
                      <ActivityLink activity={r.activity} /> · {formatShortDate(dayOf(r.activity))}
                    </>
                  }
                />
              ))}
            </div>
          </CollapsibleSection>

          <CollapsibleSection title="Habits and streaks">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {habits.longest && (
                <Tile
                  label="Longest streak"
                  value={`${habits.longest.days} ${habits.longest.days === 1 ? "day" : "days"}`}
                  hint={`${formatShortDate(habits.longest.from)} – ${formatShortDate(habits.longest.to)}`}
                />
              )}
              <Tile label="Current streak" value={`${habits.current} ${habits.current === 1 ? "day" : "days"}`} />
              {habits.bestWeek && (
                <Tile
                  label="Biggest week"
                  value={formatDistance(habits.bestWeek.totals.distance)}
                  hint={`Week of ${formatShortDate(habits.bestWeek.week)} · ${habits.bestWeek.totals.count} activities`}
                />
              )}
              {habits.bestMonth && (
                <Tile
                  label="Biggest month"
                  value={formatDistance(habits.bestMonth.totals.distance)}
                  hint={`${new Intl.DateTimeFormat(undefined, { month: "long", year: "numeric", timeZone: "UTC" }).format(
                    new Date(`${habits.bestMonth.month}-01T00:00:00Z`)
                  )} · ${habits.bestMonth.totals.count} activities`}
                />
              )}
              {habits.busiestDay && habits.busiestDay.count > 1 && (
                <Tile label="Busiest day" value={`${habits.busiestDay.count} activities`} hint={formatShortDate(habits.busiestDay.day)} />
              )}
              {habits.restShare !== null && (
                <Tile label="Days without an activity" value={`${Math.round(habits.restShare * 100)}%`} hint="of the days in the period" />
              )}
            </div>
          </CollapsibleSection>

          <CollapsibleSection title="By sport type">
            <TotalsTable
              rows={byType.map((r) => ({ key: r.key, label: sportTypeLabel(r.key), totals: r.totals }))}
              total={sum.distance}
              heading="Sport type"
            />
          </CollapsibleSection>

          {byGear.length > 0 && (
            <CollapsibleSection title="By gear">
              <TotalsTable
                rows={byGear.map((r) => ({ key: r.key, label: gearById.get(r.key)?.name ?? `Gear ${r.key}`, totals: r.totals }))}
                total={sum.distance}
                heading="Gear"
              />
            </CollapsibleSection>
          )}

          <CollapsibleSection title="Weather">
            {withWeather.length === 0 ? (
              <Notice>None of these activities has weather yet. The API looks it up in the background for outdoor activities.</Notice>
            ) : (
              <div className="space-y-4">
                <p className="text-sm text-mute">
                  From the {withWeather.length} of {activities.length} activities with weather (outdoor ones, at least two days old):
                  the average while each one lasted.
                </p>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  <Tile
                    label="Wet"
                    value={`${wet.length}×`}
                    hint={`${Math.round((wet.length / withWeather.length) * 100)}% had 0.5 mm of rain or more`}
                  />
                  {hottest && (
                    <Tile
                      label="Hottest"
                      value={formatTemp(hottest.weather!.temperature!)}
                      hint={<ActivityLink activity={hottest} />}
                    />
                  )}
                  {coldest && (
                    <Tile
                      label="Coldest"
                      value={formatTemp(coldest.weather!.temperature!)}
                      hint={<ActivityLink activity={coldest} />}
                    />
                  )}
                  {windiest?.weather?.windSpeed != null && (
                    <Tile label="Windiest" value={formatWind(windiest.weather.windSpeed)} hint={<ActivityLink activity={windiest} />} />
                  )}
                  {wettest && (wettest.weather?.precipitation ?? 0) > 0 && (
                    <Tile
                      label="Wettest"
                      value={`${wettest.weather!.precipitation.toFixed(1)} mm`}
                      hint={<ActivityLink activity={wettest} />}
                    />
                  )}
                </div>
                {tempHist && (
                  <div className="rounded-lg border border-line bg-chalk p-3 sm:p-4">
                    <p className="mb-2 text-sm font-semibold">Temperature</p>
                    <HistogramChart
                      bars={tempHist.bins.map((b) => ({ label: `${b.from}°`, title: `${b.from} to ${b.to} °C`, count: b.activities.length }))}
                      color={TEMPERATURE_COLOR}
                      selected={null}
                      onSelect={() => {}}
                      total={withWeather.length}
                      height={180}
                    />
                  </div>
                )}
              </div>
            )}
          </CollapsibleSection>
        </div>
      )}
    </DashboardTemplate>
  );
}

interface TotalsTableProps {
  rows: { key: string; label: string; totals: ReturnType<typeof totals> }[];
  /** All the distance, for each row's share. */
  total: number;
  heading: string;
}

function TotalsTable({ rows, total, heading }: TotalsTableProps) {
  return (
    <div className="overflow-x-auto rounded-lg border border-line bg-chalk">
      <table className="w-full text-left text-sm whitespace-nowrap">
        <thead className="border-b border-line text-mute">
          <tr>
            <th scope="col" className={TH}>{heading}</th>
            <th scope="col" className={TH + " text-right"}>Activities</th>
            <th scope="col" className={TH + " text-right"}>Distance</th>
            <th scope="col" className={TH + " w-40"}>Share of distance</th>
            <th scope="col" className={TH + " text-right"}>Time</th>
            <th scope="col" className={TH + " text-right"}>Elevation</th>
            <th scope="col" className={TH + " text-right"}>Average</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const share = total > 0 ? r.totals.distance / total : 0;
            return (
              <tr key={r.key} className="border-b border-line last:border-b-0">
                <th scope="row" className={TD + " font-semibold"}>{r.label}</th>
                <td className={TD + " num text-right"}>{r.totals.count}</td>
                <td className={TD + " num text-right"}>{formatDistance(r.totals.distance)}</td>
                <td className={TD}>
                  <div className="flex items-center gap-2">
                    <div className="h-2 flex-1 rounded-full bg-pavement">
                      <div className="h-2 rounded-full" style={{ width: `${share * 100}%`, backgroundColor: DISTRIBUTION_COLOR }} />
                    </div>
                    <span className="num w-9 text-right text-mute">{Math.round(share * 100)}%</span>
                  </div>
                </td>
                <td className={TD + " num text-right"}>{formatDuration(r.totals.movingTime)}</td>
                <td className={TD + " num text-right"}>{formatElevation(r.totals.elevation)}</td>
                <td className={TD + " num text-right text-mute"}>{formatDistance(r.totals.distance / r.totals.count)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
