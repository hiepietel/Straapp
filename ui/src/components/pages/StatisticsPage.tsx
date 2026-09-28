import { useMemo, useState } from "react";
import DashboardTemplate from "../templates/DashboardTemplate";
import CompareBarChart from "../organisms/CompareBarChart";
import CollapsibleSection from "../molecules/CollapsibleSection";
import DeltaBadge from "../molecules/DeltaBadge";
import FilterTabs from "../molecules/FilterTabs";
import Notice from "../molecules/Notice";
import Spinner from "../atoms/Spinner";
import Button from "../atoms/Button";
import { useStatistics } from "../../hooks/useStatistics";
import { isDemo } from "../../services/auth";
import { GROUPS } from "../../utils/sports";
import type { SportGroupId } from "../../utils/sports";
import { METRIC_LABELS, formatMetric, formatMetricTick, localNow } from "../../utils/periodStats";
import type { Metric } from "../../utils/periodStats";
import type { PeriodComparison, Totals } from "../../types/statistics";
import type { FilterOption } from "../molecules/FilterTabs";

type SportFilter = "all" | SportGroupId;

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

const metricValue = (totals: Totals, metric: Metric): number => {
  switch (metric) {
    case "distance":
      return totals.distance;
    case "time":
      return totals.movingTime;
    case "elevation":
      return totals.elevation;
    case "count":
      return totals.count;
  }
};

const PERIOD_LABELS: Record<PeriodComparison["period"], { label: string; previousLabel: string }> = {
  week: { label: "This week", previousLabel: "same days last week" },
  month: { label: "This month", previousLabel: "same days last month" },
  year: { label: "This year", previousLabel: "same date last year" },
};

const TH = "px-3 py-2 font-semibold sm:px-4";
const TD = "px-3 py-2 sm:px-4";
const WEEK_ROWS_COLLAPSED = 10;

/** The compare-with select's value for "the year before whichever year is chosen". */
const YEAR_BEFORE = 0;

export default function StatisticsPage() {
  const now = useMemo(() => localNow(), []);
  const today = now.toISOString().slice(0, 10);
  const thisYear = now.getUTCFullYear();
  const todayLabel = dayMonth.format(parseDay(today));

  const [sport, setSport] = useState<SportFilter>("all");
  const [metric, setMetric] = useState<Metric>("distance");
  const [year, setYear] = useState(thisYear);
  const [compareChoice, setCompareChoice] = useState(YEAR_BEFORE);
  const [allWeeks, setAllWeeks] = useState(false);
  // A comparison year must be earlier; fall back to the year before if the chosen year moved past it.
  const compareYear = compareChoice !== YEAR_BEFORE && compareChoice < year ? compareChoice : year - 1;

  // Everything comes from the API's database; this page never reaches Strava.
  const { report, status, error, retry } = useStatistics({
    year,
    compareYear,
    sport: sport === "all" ? undefined : sport,
    today,
  });

  const sportOptions = useMemo<FilterOption<SportFilter>[]>(() => {
    const present = new Set(report?.sports ?? []);
    // Keep the chosen sport even if the other year has none of it, so the filter doesn't vanish.
    if (sport !== "all") present.add(sport);
    return [
      { id: "all", label: "All sports" },
      ...(Object.keys(GROUPS) as SportGroupId[])
        .filter((id) => present.has(id))
        .map((id) => ({ id, label: GROUPS[id].label })),
    ];
  }, [report, sport]);

  const years = report?.availableYears ?? [thisYear];
  // Earlier years with data, besides the year before (which is always offered first).
  const olderYears = years.filter((y) => y < year - 1);

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
    compared: value(m.compared),
    previousMonth: value(m.previousMonth),
  }));
  const monthsSoFar = monthRows.filter((m) => m.current !== null).length;
  const yearTotal = monthRows.reduce((s, m) => s + (m.current ?? 0), 0);
  // A year still in progress is compared with the same months of the other year.
  const comparedTotal = monthRows.slice(0, monthsSoFar).reduce((s, m) => s + m.compared, 0);

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
              compared: w.compared === null ? null : value(w.compared),
            },
          ]
    ),
    chartCur: allWeekTotals.map((w) => (w.current === null ? null : value(w.current))),
    chartPrev: allWeekTotals.map((w) => (w.compared === null ? null : value(w.compared))),
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
            <FilterTabs options={sportOptions} value={sport} onChange={setSport} />
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
                <label className="flex items-center gap-2 text-sm text-mute">
                  compared with
                  <select
                    value={compareYear === year - 1 ? YEAR_BEFORE : compareYear}
                    onChange={(e) => setCompareChoice(Number(e.target.value))}
                    className={selectClass}
                  >
                    <option value={YEAR_BEFORE}>{year - 1}</option>
                    {olderYears.map((y) => (
                      <option key={y} value={y}>
                        {y}
                      </option>
                    ))}
                  </select>
                </label>
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

          <CollapsibleSection title="Month by month">
            <div className="rounded-lg border border-line bg-chalk p-3 sm:p-4">
              <CompareBarChart
                labels={Array.from({ length: 12 }, (_, m) => monthName(m, "short"))}
                titles={Array.from({ length: 12 }, (_, m) => monthName(m, "long"))}
                current={monthRows.map((m) => m.current)}
                previous={monthRows.map((m) => m.compared)}
                currentName={String(year)}
                previousName={String(compareYear)}
                format={fmt}
                formatTick={fmtTick}
                layout="grouped"
              />
            </div>

            <div className="mt-4 overflow-x-auto rounded-lg border border-line bg-chalk">
              <table className="w-full text-left text-sm whitespace-nowrap">
                <caption className="sr-only">
                  {METRIC_LABELS[metric]} per month of {year}, compared with the month before and with {compareYear}
                </caption>
                <thead className="border-b border-line text-mute">
                  <tr>
                    <th scope="col" className={TH}>Month</th>
                    <th scope="col" className={TH + " text-right"}>{year}</th>
                    <th scope="col" className={TH + " text-right"}>vs previous month</th>
                    <th scope="col" className={TH + " text-right"}>{compareYear}</th>
                    <th scope="col" className={TH + " text-right"}>vs {compareYear}</th>
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
                      <td className={TD + " num text-right text-mute"}>{fmt(m.compared)}</td>
                      <td className={TD + " text-right"}>
                        {m.current === null ? dash : <DeltaBadge current={m.current} previous={m.compared} />}
                      </td>
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
                    <td className={TD + " num text-right font-bold text-mute"}>{fmt(comparedTotal)}</td>
                    <td className={TD + " text-right"}>
                      <DeltaBadge current={yearTotal} previous={comparedTotal} />
                    </td>
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
                previous={weeks.chartPrev}
                currentName={`${year}`}
                previousName={`Same week ${compareYear}`}
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
                    <th scope="col" className={TH + " text-right"}>vs same week {compareYear}</th>
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
                        <td className={TD + " text-right"}>
                          {w.compared === null ? dash : <DeltaBadge current={w.total} previous={w.compared} />}
                        </td>
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
                previous={yearRows.map((y) => y.total)}
                currentName={`By ${todayLabel}`}
                previousName="Whole year"
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
