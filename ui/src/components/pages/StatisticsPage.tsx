import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import DashboardTemplate from "../templates/DashboardTemplate";
import CompareBarChart, { CURRENT_COLOR, PREVIOUS_COLOR, comparedColors } from "../organisms/CompareBarChart";
import CumulativeLineChart from "../organisms/CumulativeLineChart";
import type { CumulativeSeries } from "../organisms/CumulativeLineChart";
import CollapsibleSection from "../molecules/CollapsibleSection";
import DeltaBadge from "../molecules/DeltaBadge";
import FilterTabs from "../molecules/FilterTabs";
import SportTypeFilter from "../molecules/SportTypeFilter";
import Notice from "../molecules/Notice";
import Spinner from "../atoms/Spinner";
import Button from "../atoms/Button";
import { useStatistics } from "../../hooks/useStatistics";
import { isDemo } from "../../services/auth";
import { METRIC_LABELS, formatMetric, formatMetricTick, localNow, metricValue } from "../../utils/periodStats";
import type { Metric } from "../../utils/periodStats";
import type { PeriodComparison, Totals } from "../../types/statistics";
import type { FilterOption } from "../molecules/FilterTabs";

const METRIC_OPTIONS: FilterOption<Metric>[] = (Object.keys(METRIC_LABELS) as Metric[]).map((id) => ({
  id,
  label: METRIC_LABELS[id],
}));

const monthName = (m: number, style: "short" | "long") =>
  new Intl.DateTimeFormat(undefined, { month: style, timeZone: "UTC" }).format(new Date(Date.UTC(2000, m, 1)));

const dayMonth = new Intl.DateTimeFormat(undefined, { day: "numeric", month: "short", timeZone: "UTC" });

/** "2026-09-28" (a local calendar day) as a Date on the same wall-clock-as-UTC scale as localNow(). */
const parseDay = (day: string) => new Date(`${day}T00:00:00Z`);

/** Day strings compare correctly as text, so ranges can be checked without parsing. */
const addDays = (day: string, days: number) =>
  new Date(parseDay(day).getTime() + days * 24 * 3600 * 1000).toISOString().slice(0, 10);

function weekRange(monday: string): string {
  const start = parseDay(monday);
  const end = new Date(start.getTime() + 6 * 24 * 3600 * 1000);
  return `${dayMonth.format(start)} – ${dayMonth.format(end)}`;
}

const PERIOD_LABELS: Record<PeriodComparison["period"], { label: string; previousLabel: string }> = {
  week: { label: "This week", previousLabel: "same days last week" },
  month: { label: "This month", previousLabel: "same days last month" },
  year: { label: "This year", previousLabel: "same date last year" },
};

const TH = "px-3 py-2 font-semibold sm:px-4";
const TD = "px-3 py-2 sm:px-4";
const WEEK_ROWS_COLLAPSED = 10;

/** The API's limit; past it the charts stop being readable anyway. */
const MAX_COMPARE_YEARS = 10;

// The progress chart lays every year on one calendar: 2001, whose 1 January was a Monday,
// so ISO week n ends n × 7 days in.
const DAY_MS = 24 * 3600 * 1000;
const WEEK_MS = 7 * DAY_MS;
const CALENDAR_START = Date.UTC(2001, 0, 1);
const MONTH_TICKS = Array.from({ length: 12 }, (_, m) => ({ t: Date.UTC(2001, m, 1), label: monthName(m, "short") }));

/** Running totals after each week, as chart points; `null` weeks (not started, or none that year) end the line. */
function runningTotal(values: readonly (number | null)[]): [number, number][] {
  const points: [number, number][] = [];
  let sum = 0;
  for (let i = 0; i < values.length; i++) {
    const v = values[i];
    if (v === null || v === undefined) break;
    sum += v;
    points.push([CALENDAR_START + (i + 1) * WEEK_MS, sum]);
  }
  return points;
}

export default function StatisticsPage() {
  const now = useMemo(() => localNow(), []);
  const today = now.toISOString().slice(0, 10);
  const thisYear = now.getUTCFullYear();
  const todayLabel = dayMonth.format(parseDay(today));

  const [sportTypes, setSportTypes] = useState<ReadonlySet<string>>(new Set());
  const [metric, setMetric] = useState<Metric>("distance");
  const [year, setYear] = useState(thisYear);
  // Null until the viewer picks: then "the year before", whichever year is chosen.
  const [compareChoice, setCompareChoice] = useState<readonly number[] | null>(null);
  const [allWeeks, setAllWeeks] = useState(false);
  // Comparison years must be earlier; fall back to the year before if the chosen year moved past them all.
  const picked = (compareChoice ?? []).filter((y) => y < year).sort((a, b) => b - a);
  const compareYears = picked.length ? picked : [year - 1];

  // Everything comes from the API's database; this page never reaches Strava.
  const { report, status, error, retry } = useStatistics({
    year,
    compareYears,
    sportTypes: [...sportTypes],
    today,
  });

  // Keep the chosen types even when the data has none of them, so the filter doesn't vanish.
  const sportTypeOptions = useMemo(
    () => [...new Set([...(report?.availableSportTypes ?? []), ...sportTypes])],
    [report, sportTypes]
  );

  const years = report?.availableYears ?? [thisYear];
  // The year before is always offered, then every earlier year with data.
  const compareOptions = [year - 1, ...years.filter((y) => y < year - 1)];
  const toggleCompareYear = (y: number) => {
    const next = compareYears.includes(y) ? compareYears.filter((c) => c !== y) : [...compareYears, y];
    // Always compare with something: removing the last one is ignored.
    if (next.length > 0 && next.length <= MAX_COMPARE_YEARS) setCompareChoice(next);
  };

  // What the report on screen was built for (it lags a click while the next one loads).
  const shownCompareYears = report?.compareYears ?? compareYears;
  const colors = comparedColors(shownCompareYears.length);
  const single = shownCompareYears.length === 1;

  const fmt = (v: number) => formatMetric(metric, v);
  const fmtTick = (v: number) => formatMetricTick(metric, v);
  const value = (totals: Totals) => metricValue(totals, metric);

  const toDate = (report?.toDate ?? []).map((c) => ({
    ...PERIOD_LABELS[c.period],
    current: value(c.current),
    previous: value(c.previous),
  }));

  // ---- Month by month: the chosen year against the comparison year, and each month against the one before.
  const isCurrentYear = year === thisYear;
  const monthRows = (report?.months ?? []).map((m) => ({
    month: m.month,
    current: m.current === null ? null : value(m.current),
    compared: m.compared.map(value),
    previousMonth: value(m.previousMonth),
  }));
  const monthsSoFar = monthRows.filter((m) => m.current !== null).length;
  const yearTotal = monthRows.reduce((s, m) => s + (m.current ?? 0), 0);
  // A year still in progress is compared with the same months of the other years.
  const comparedTotals = shownCompareYears.map((_, i) =>
    monthRows.slice(0, monthsSoFar).reduce((s, m) => s + (m.compared[i] ?? 0), 0)
  );

  // ---- Week by week (ISO weeks, Monday start).
  const allWeekTotals = report?.weeks ?? [];
  const weeks = {
    rows: allWeekTotals.flatMap((w) =>
      w.current === null
        ? []
        : [
            {
              week: w.week,
              start: w.start,
              total: value(w.current),
              previousWeek: value(w.previousWeek),
              compared: w.compared.map((c) => (c === null ? null : value(c))),
            },
          ]
    ),
    chartCur: allWeekTotals.map((w) => (w.current === null ? null : value(w.current))),
    chartCompared: shownCompareYears.map((_, i) =>
      allWeekTotals.map((w) => {
        const c = w.compared[i];
        return c === null || c === undefined ? null : value(c);
      })
    ),
    labels: allWeekTotals.map((w) => String(w.week)),
    titles: allWeekTotals.map((w) => `Week ${w.week} · ${weekRange(w.start)}`),
  };
  const weekRowsNewestFirst = [...weeks.rows].reverse();
  const shownWeekRows = allWeeks ? weekRowsNewestFirst : weekRowsNewestFirst.slice(0, WEEK_ROWS_COLLAPSED);

  // ---- Year by year: each year against the one before, both whole and up to today's date
  // (the fair way to compare a year still in progress).
  const yearRows = (report?.years ?? []).map((y, i, all) => {
    const before = all[i - 1];
    return {
      year: y.year,
      total: value(y.total),
      toDate: value(y.toDate),
      totalBefore: before ? value(before.total) : null,
      toDateBefore: before ? value(before.toDate) : null,
    };
  });

  // ---- Progress through the year, week by week: every year's line on one calendar.
  const runningSeries: CumulativeSeries[] = [
    ...shownCompareYears.map((y, i) => ({
      id: String(y),
      name: String(y),
      color: colors[i]!,
      points: runningTotal(weeks.chartCompared[i] ?? []),
    })),
    {
      id: String(year),
      name: String(year),
      color: CURRENT_COLOR,
      points: runningTotal(weeks.chartCur),
      // A year in progress stops at this week, not flat to December.
      until: CALENDAR_START + weeks.chartCur.filter((v) => v !== null).length * WEEK_MS,
    },
  ];
  const calendarEnd = CALENDAR_START + Math.max(52, allWeekTotals.length) * WEEK_MS;
  const weekAt = (t: number) => Math.min(allWeekTotals.length || 52, Math.max(1, Math.ceil((t - CALENDAR_START) / WEEK_MS)));

  const ready = status === "ready" && report !== null;

  if (isDemo) {
    return (
      <DashboardTemplate
        header={
          <header className="pt-8">
            <h1 className="text-3xl font-extrabold tracking-tight">Statistics</h1>
          </header>
        }
        notice={<Notice>Statistics come from the Straapp API, which demo mode doesn't use.</Notice>}
      />
    );
  }

  const selectClass = "rounded-md border border-line bg-chalk px-2 py-1.5 text-sm font-semibold text-ink";
  const dash = <span className="text-mute">—</span>;

  return (
    <DashboardTemplate
      header={
        <header className="pt-8">
          <h1 className="text-3xl font-extrabold tracking-tight">Statistics</h1>
          <p className="mt-1 text-mute">How your training compares with the periods before.</p>
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
            <SportTypeFilter types={sportTypeOptions} value={sportTypes} onChange={setSportTypes} />
            <div className="flex flex-wrap items-center justify-between gap-3">
              <FilterTabs options={METRIC_OPTIONS} value={metric} onChange={setMetric} label="Measure" />
              <div className="flex flex-wrap items-center gap-3">
                <label className="flex items-center gap-2 text-sm text-mute">
                  Year
                  <select value={year} onChange={(e) => setYear(Number(e.target.value))} className={selectClass}>
                    {years.map((y) => (
                      <option key={y} value={y}>
                        {y}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="flex flex-wrap items-center gap-2 text-sm text-mute" role="group" aria-label="Compared with">
                  compared with
                  {compareOptions.map((y) => {
                    const on = compareYears.includes(y);
                    const color = on ? colors[shownCompareYears.indexOf(y)] : undefined;
                    return (
                      <button
                        key={y}
                        type="button"
                        aria-pressed={on}
                        onClick={() => toggleCompareYear(y)}
                        className={`num inline-flex items-center gap-1.5 rounded-full border px-3 py-1 font-semibold transition-colors ${
                          on ? "border-ink bg-ink text-chalk" : "border-line bg-chalk text-ink hover:bg-white"
                        }`}
                      >
                        {color && <span className="size-2.5 rounded-full" style={{ backgroundColor: color }} aria-hidden="true" />}
                        {y}
                      </button>
                    );
                  })}
                  {compareOptions.length > 1 && (
                    <button
                      type="button"
                      onClick={() => setCompareChoice(compareOptions.slice(0, MAX_COMPARE_YEARS))}
                      className="rounded-full px-2 py-1 font-semibold text-ink underline-offset-2 hover:underline"
                    >
                      {compareOptions.length > MAX_COMPARE_YEARS ? `Last ${MAX_COMPARE_YEARS}` : "All"}
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        )
      }
    >
      {status === "loading" && (
        <div className="flex flex-col items-center gap-3 py-24">
          <Spinner label="Loading your statistics" />
        </div>
      )}

      {ready && (
        <div className="space-y-10">
          <section aria-label="So far this period" className="grid gap-4 sm:grid-cols-3">
            {toDate.map((c) => (
              <div key={c.label} className="rounded-lg border border-line bg-chalk p-4">
                <p className="text-sm text-mute">{c.label}</p>
                <p className="num mt-1 text-3xl leading-tight font-bold">{fmt(c.current)}</p>
                <div className="mt-2 flex flex-wrap items-baseline gap-x-2 text-sm">
                  <DeltaBadge current={c.current} previous={c.previous} />
                  <span className="text-mute">
                    vs {fmt(c.previous)} {c.previousLabel}
                  </span>
                </div>
              </div>
            ))}
          </section>

          <CollapsibleSection title="Progress through the year">
            <div className="rounded-lg border border-line bg-chalk p-3 sm:p-4">
              <ul className="mb-2 flex flex-wrap gap-4 text-sm" aria-label="Legend">
                {[...runningSeries].reverse().map((s) => (
                  <li key={s.id} className={`flex items-center gap-2 ${s.id === String(year) ? "" : "text-mute"}`}>
                    <span className="h-1 w-4 rounded-full" style={{ backgroundColor: s.color }} aria-hidden="true" />
                    {s.name}
                  </li>
                ))}
              </ul>
              <CumulativeLineChart
                series={runningSeries}
                from={CALENDAR_START}
                to={calendarEnd}
                format={fmt}
                formatTick={fmtTick}
                formatDate={(t) => `End of week ${weekAt(t)}`}
                xTicks={MONTH_TICKS}
              />
            </div>
          </CollapsibleSection>

          <CollapsibleSection title="Month by month">
            <div className="rounded-lg border border-line bg-chalk p-3 sm:p-4">
              <CompareBarChart
                labels={Array.from({ length: 12 }, (_, m) => monthName(m, "short"))}
                titles={Array.from({ length: 12 }, (_, m) => monthName(m, "long"))}
                current={monthRows.map((m) => m.current)}
                currentName={String(year)}
                compared={shownCompareYears.map((y, i) => ({
                  name: String(y),
                  color: colors[i]!,
                  values: monthRows.map((m) => m.compared[i] ?? null),
                }))}
                format={fmt}
                formatTick={fmtTick}
                layout="grouped"
              />
            </div>

            <div className="mt-4 overflow-x-auto rounded-lg border border-line bg-chalk">
              <table className="w-full text-left text-sm whitespace-nowrap">
                <caption className="sr-only">
                  {METRIC_LABELS[metric]} per month of {year}, compared with the month before and with{" "}
                  {shownCompareYears.join(", ")}
                </caption>
                <thead className="border-b border-line text-mute">
                  <tr>
                    <th scope="col" className={TH}>Month</th>
                    <th scope="col" className={TH + " text-right"}>{year}</th>
                    <th scope="col" className={TH + " text-right"}>vs previous month</th>
                    {shownCompareYears.map((y) => (
                      <th key={y} scope="col" className={TH + " text-right"} colSpan={2}>
                        {single ? y : `vs ${y}`}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {monthRows.map((m) => (
                    <tr key={m.month} className="border-b border-line last:border-b-0">
                      <th scope="row" className={TD + " font-semibold"}>{monthName(m.month - 1, "long")}</th>
                      <td className={TD + " num text-right"}>{m.current === null ? "—" : fmt(m.current)}</td>
                      <td className={TD + " text-right"}>
                        {m.current === null ? dash : <DeltaBadge current={m.current} previous={m.previousMonth} />}
                      </td>
                      {shownCompareYears.map((y, i) => (
                        <ComparedCells key={y} current={m.current} compared={m.compared[i] ?? 0} fmt={fmt} dash={dash} />
                      ))}
                    </tr>
                  ))}
                </tbody>
                <tfoot className="border-t-2 border-line">
                  <tr>
                    <th scope="row" className={TD + " font-bold"}>
                      {isCurrentYear ? `Jan – ${monthName(monthsSoFar - 1, "short")}` : "Total"}
                    </th>
                    <td className={TD + " num text-right font-bold"}>{fmt(yearTotal)}</td>
                    <td className={TD} />
                    {comparedTotals.map((total, i) => (
                      <ComparedCells key={shownCompareYears[i]} current={yearTotal} compared={total} fmt={fmt} dash={dash} bold />
                    ))}
                  </tr>
                </tfoot>
              </table>
            </div>
          </CollapsibleSection>

          <CollapsibleSection title="Week by week">
            <div className="rounded-lg border border-line bg-chalk p-3 sm:p-4">
              <CompareBarChart
                labels={weeks.labels}
                titles={weeks.titles}
                current={weeks.chartCur}
                currentName={`${year}`}
                compared={shownCompareYears.map((y, i) => ({
                  name: single ? `Same week ${y}` : String(y),
                  color: colors[i]!,
                  values: weeks.chartCompared[i] ?? [],
                }))}
                format={fmt}
                formatTick={fmtTick}
                layout="overlay"
                labelEvery={4}
              />
            </div>

            <div className="mt-4 overflow-x-auto rounded-lg border border-line bg-chalk">
              <table className="w-full text-left text-sm whitespace-nowrap">
                <caption className="sr-only">
                  {METRIC_LABELS[metric]} per week of {year}, newest first
                </caption>
                <thead className="border-b border-line text-mute">
                  <tr>
                    <th scope="col" className={TH}>Week</th>
                    <th scope="col" className={TH}>Dates</th>
                    <th scope="col" className={TH + " text-right"}>{METRIC_LABELS[metric]}</th>
                    <th scope="col" className={TH + " text-right"}>vs previous week</th>
                    {shownCompareYears.map((y) => (
                      <th key={y} scope="col" className={TH + " text-right"}>
                        vs same week {y}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {shownWeekRows.map((w) => {
                    const inProgress = w.start <= today && today < addDays(w.start, 7);
                    return (
                      <tr key={w.week} className="border-b border-line last:border-b-0">
                        <th scope="row" className={TD + " num font-semibold"}>
                          {w.week}
                          {inProgress && <span className="ml-2 text-xs font-normal text-mute">so far</span>}
                        </th>
                        <td className={TD + " text-mute"}>{weekRange(w.start)}</td>
                        <td className={TD + " num text-right font-semibold"}>{fmt(w.total)}</td>
                        <td className={TD + " text-right"}>
                          <DeltaBadge current={w.total} previous={w.previousWeek} />
                        </td>
                        {shownCompareYears.map((y, i) => {
                          const c = w.compared[i];
                          return (
                            <td key={y} className={TD + " text-right"}>
                              {c === null || c === undefined ? dash : <DeltaBadge current={w.total} previous={c} />}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {weekRowsNewestFirst.length > WEEK_ROWS_COLLAPSED && (
              <div className="mt-3 flex justify-center">
                <Button variant="ghost" onClick={() => setAllWeeks((v) => !v)}>
                  {allWeeks ? "Show fewer weeks" : `Show all ${weekRowsNewestFirst.length} weeks`}
                </Button>
              </div>
            )}
          </CollapsibleSection>

          <CollapsibleSection title="Year by year">
            <div className="rounded-lg border border-line bg-chalk p-3 sm:p-4">
              <CompareBarChart
                labels={yearRows.map((y) => String(y.year))}
                titles={yearRows.map((y) => String(y.year))}
                current={yearRows.map((y) => y.toDate)}
                currentName={`By ${todayLabel}`}
                compared={[{ name: "Whole year", color: PREVIOUS_COLOR, values: yearRows.map((y) => y.total) }]}
                format={fmt}
                formatTick={fmtTick}
                layout="overlay"
              />
            </div>

            <div className="mt-4 overflow-x-auto rounded-lg border border-line bg-chalk">
              <table className="w-full text-left text-sm whitespace-nowrap">
                <caption className="sr-only">
                  {METRIC_LABELS[metric]} per year, newest first, each compared with the year before
                </caption>
                <thead className="border-b border-line text-mute">
                  <tr>
                    <th scope="col" className={TH}>Year</th>
                    <th scope="col" className={TH + " text-right"}>Whole year</th>
                    <th scope="col" className={TH + " text-right"}>vs year before</th>
                    <th scope="col" className={TH + " text-right"}>By {todayLabel}</th>
                    <th scope="col" className={TH + " text-right"}>vs year before</th>
                  </tr>
                </thead>
                <tbody>
                  {[...yearRows].reverse().map((y) => {
                    const inProgress = y.year === thisYear;
                    return (
                      <tr key={y.year} className="border-b border-line last:border-b-0">
                        <th scope="row" className={TD + " num font-semibold"}>
                          {y.year}
                          {inProgress && <span className="ml-2 text-xs font-normal text-mute">so far</span>}
                        </th>
                        <td className={TD + " num text-right font-semibold"}>{fmt(y.total)}</td>
                        <td className={TD + " text-right"}>
                          {/* A year in progress against a whole one would always look like a drop. */}
                          {inProgress || y.totalBefore === null ? (
                            dash
                          ) : (
                            <DeltaBadge current={y.total} previous={y.totalBefore} />
                          )}
                        </td>
                        <td className={TD + " num text-right"}>{fmt(y.toDate)}</td>
                        <td className={TD + " text-right"}>
                          {y.toDateBefore === null ? dash : <DeltaBadge current={y.toDate} previous={y.toDateBefore} />}
                        </td>
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

interface ComparedCellsProps {
  /** Null for a month that hasn't started. */
  current: number | null;
  compared: number;
  fmt: (v: number) => string;
  dash: ReactNode;
  bold?: boolean;
}

/** A compared year's value and how the chosen year differs from it: two cells of a table row. */
function ComparedCells({ current, compared, fmt, dash, bold = false }: ComparedCellsProps) {
  return (
    <>
      <td className={`${TD} num text-right text-mute ${bold ? "font-bold" : ""}`}>{fmt(compared)}</td>
      <td className={TD + " text-right"}>{current === null ? dash : <DeltaBadge current={current} previous={compared} />}</td>
    </>
  );
}
