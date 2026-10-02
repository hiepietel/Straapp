import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import DashboardTemplate from "../templates/DashboardTemplate";
import FilterTabs from "../molecules/FilterTabs";
import Notice from "../molecules/Notice";
import Spinner from "../atoms/Spinner";
import StatItem from "../molecules/StatItem";
import { useCalendar } from "../../hooks/useCalendar";
import { activityHref } from "../../hooks/useRoute";
import { isDemo } from "../../services/auth";
import { formatDistance, formatDuration, formatElevation } from "../../utils/format";
import { formatMetric, localNow, metricValue, METRIC_LABELS } from "../../utils/periodStats";
import type { Metric } from "../../utils/periodStats";
import type { CalendarDay } from "../../types/calendar";
import type { Totals } from "../../types/statistics";
import type { FilterOption } from "../molecules/FilterTabs";

type CalendarView = "week" | "month" | "year";

const VIEW_OPTIONS: FilterOption<CalendarView>[] = [
  { id: "week", label: "Week" },
  { id: "month", label: "Month" },
  { id: "year", label: "Year" },
];
const METRIC_OPTIONS: FilterOption<Metric>[] = (Object.keys(METRIC_LABELS) as Metric[]).map((id) => ({
  id,
  label: METRIC_LABELS[id],
}));
const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const DAY_MS = 24 * 60 * 60 * 1000;

const dateAt = (time: number) => new Date(time).toISOString().slice(0, 10);
const dateMs = (date: string) => Date.parse(`${date}T00:00:00Z`);
const asDate = (date: string) => new Date(`${date}T00:00:00Z`);
const mondayOffset = (date: Date) => (date.getUTCDay() + 6) % 7;
const monthName = (year: number, month: number, style: "short" | "long" = "long") =>
  new Intl.DateTimeFormat(undefined, { month: style, timeZone: "UTC" }).format(new Date(Date.UTC(year, month, 1)));
const fullDate = (date: string) =>
  new Intl.DateTimeFormat(undefined, { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(asDate(date));

function periodRange(anchor: string, view: CalendarView): { from: string; to: string } {
  const date = asDate(anchor);
  if (view === "week") {
    const start = dateMs(anchor) - mondayOffset(date) * DAY_MS;
    return { from: dateAt(start), to: dateAt(start + 7 * DAY_MS) };
  }
  if (view === "year") {
    return { from: dateAt(Date.UTC(date.getUTCFullYear(), 0, 1)), to: dateAt(Date.UTC(date.getUTCFullYear() + 1, 0, 1)) };
  }
  return { from: dateAt(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1)), to: dateAt(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1)) };
}

function shiftPeriod(anchor: string, view: CalendarView, amount: number): string {
  const date = asDate(anchor);
  if (view === "week") return dateAt(dateMs(anchor) + amount * 7 * DAY_MS);
  if (view === "year") return dateAt(Date.UTC(date.getUTCFullYear() + amount, date.getUTCMonth(), date.getUTCDate()));
  return dateAt(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + amount, 1));
}

function periodLabel(from: string, to: string, view: CalendarView): string {
  const start = asDate(from);
  if (view === "year") return String(start.getUTCFullYear());
  if (view === "month") return `${monthName(start.getUTCFullYear(), start.getUTCMonth())} ${start.getUTCFullYear()}`;
  const end = new Date(dateMs(to) - DAY_MS);
  const startText = new Intl.DateTimeFormat(undefined, { day: "numeric", month: "short", timeZone: "UTC" }).format(start);
  const endText = new Intl.DateTimeFormat(undefined, { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(end);
  return `${startText} – ${endText}`;
}

const sumTotals = (days: readonly CalendarDay[]): Totals =>
  days.reduce(
    (sum, day) => ({
      count: sum.count + day.totals.count,
      distance: sum.distance + day.totals.distance,
      movingTime: sum.movingTime + day.totals.movingTime,
      elevation: sum.elevation + day.totals.elevation,
    }),
    { count: 0, distance: 0, movingTime: 0, elevation: 0 }
  );

const dayStyle = (amount: number, max: number) => ({
  backgroundColor: amount > 0 ? `rgba(27, 175, 122, ${0.08 + (amount / Math.max(max, 1)) * 0.2})` : undefined,
});

export default function CalendarPage() {
  const today = useMemo(() => localNow().toISOString().slice(0, 10), []);
  const [view, setView] = useState<CalendarView>("month");
  const [anchor, setAnchor] = useState(today);
  const [selectedDate, setSelectedDate] = useState(today);
  const [metric, setMetric] = useState<Metric>("distance");
  const { from, to } = periodRange(anchor, view);
  const { report, status, error, retry } = useCalendar(from, to);
  const ready = status === "ready" && report !== null;
  const dayByDate = new Map((report?.days ?? []).map((day) => [day.date, day]));
  const overall = sumTotals(report?.days ?? []);
  const maxMetric = Math.max(1, ...(report?.days ?? []).map((day) => metricValue(day.totals, metric)));
  const selected = dayByDate.get(selectedDate);
  const move = (amount: number) => {
    const next = shiftPeriod(anchor, view, amount);
    setAnchor(next);
    setSelectedDate(periodRange(next, view).from);
  };
  const changeView = (next: CalendarView) => {
    setView(next);
    setSelectedDate(periodRange(anchor, next).from);
  };

  if (isDemo) {
    return (
      <DashboardTemplate
        header={<header className="pt-8"><h1 className="text-3xl font-extrabold tracking-tight">Calendar</h1></header>}
        notice={<Notice>Activity history comes from the Straapp API, which demo mode doesn&apos;t use.</Notice>}
      />
    );
  }

  return (
    <DashboardTemplate
      header={
        <header className="pt-8">
          <h1 className="text-3xl font-extrabold tracking-tight">Calendar</h1>
          <p className="mt-1 text-mute">Your training history, day by day.</p>
        </header>
      }
      notice={error && <Notice tone="error" actionLabel="Try again" onAction={retry}>{error}</Notice>}
      filters={
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <FilterTabs options={VIEW_OPTIONS} value={view} onChange={changeView} label="Calendar view" />
            <div className="flex items-center gap-2">
              <button type="button" aria-label="Previous period" title="Previous period" onClick={() => move(-1)} className="rounded-md border border-line bg-chalk p-2 hover:bg-white">
                <ChevronLeft className="size-4" aria-hidden="true" />
              </button>
              <p className="min-w-36 text-center font-semibold" aria-live="polite">{periodLabel(from, to, view)}</p>
              <button type="button" aria-label="Next period" title="Next period" onClick={() => move(1)} className="rounded-md border border-line bg-chalk p-2 hover:bg-white">
                <ChevronRight className="size-4" aria-hidden="true" />
              </button>
              <button type="button" onClick={() => { setAnchor(today); setSelectedDate(today); }} className="rounded-md border border-line bg-chalk px-3 py-2 text-sm font-semibold hover:bg-white">
                Today
              </button>
            </div>
          </div>
          <FilterTabs options={METRIC_OPTIONS} value={metric} onChange={setMetric} label="Daily measure" />
        </div>
      }
    >
      {status === "loading" && <div className="flex flex-col items-center gap-3 py-12"><Spinner label="Loading activity history" /></div>}

      {ready && (
        <div className="space-y-8">
          <section aria-label="Totals for this period" className="rounded-lg border border-line bg-chalk p-4">
            <p className="text-sm text-mute">{periodLabel(from, to, view)}</p>
            <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-4">
              <StatItem label="Distance" value={formatDistance(overall.distance)} />
              <StatItem label="Moving time" value={formatDuration(overall.movingTime)} />
              <StatItem label="Elevation" value={formatElevation(overall.elevation)} />
              <StatItem label="Activities" value={overall.count.toLocaleString()} />
            </dl>
          </section>

          {view === "year" ? (
            <section aria-label="Activity calendar by month" className="grid grid-cols-1 gap-x-8 gap-y-8 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 12 }, (_, month) => (
                <MiniMonth
                  key={month}
                  year={asDate(from).getUTCFullYear()}
                  month={month}
                  dayByDate={dayByDate}
                  selectedDate={selectedDate}
                  metric={metric}
                  maxMetric={maxMetric}
                  onSelect={setSelectedDate}
                />
              ))}
            </section>
          ) : (
            <section aria-label={`${view} activity calendar`}>
              <div className="grid grid-cols-7 border-b border-line pb-2 text-center text-xs font-semibold text-mute">
                {WEEKDAYS.map((weekday) => <span key={weekday}>{weekday}</span>)}
              </div>
              {view === "week" ? (
                <div className="grid grid-cols-7">
                  {Array.from({ length: 7 }, (_, index) => {
                    const date = dateAt(dateMs(from) + index * DAY_MS);
                    return <DayCell key={date} date={date} day={dayByDate.get(date)} metric={metric} maxMetric={maxMetric} selected={date === selectedDate} onSelect={setSelectedDate} compact={false} />;
                  })}
                </div>
              ) : (
                <MonthGrid
                  year={asDate(from).getUTCFullYear()}
                  month={asDate(from).getUTCMonth()}
                  dayByDate={dayByDate}
                  selectedDate={selectedDate}
                  metric={metric}
                  maxMetric={maxMetric}
                  onSelect={setSelectedDate}
                />
              )}
            </section>
          )}

          <section aria-labelledby="selected-day-title" className="border-t border-line pt-6">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 id="selected-day-title" className="text-xl font-bold">{fullDate(selectedDate)}</h2>
              {selected && <p className="text-sm text-mute">{formatMetric(metric, metricValue(selected.totals, metric))}</p>}
            </div>
            {selected?.activities.length ? (
              <ul className="mt-3 divide-y divide-line border-y border-line">
                {selected.activities.map((activity) => (
                  <li key={activity.id} className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 py-3">
                    <div className="min-w-0">
                      <a href={activityHref(activity.id)} className="font-semibold hover:underline">{activity.name}</a>
                      <p className="text-sm text-mute">{activity.sportType} · {formatDistance(activity.distance)} · {formatDuration(activity.movingTime)}</p>
                    </div>
                    <p className="num text-sm text-mute">{formatElevation(activity.elevation)}</p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 border-y border-line py-4 text-sm text-mute">No activities on this day.</p>
            )}
          </section>
        </div>
      )}
    </DashboardTemplate>
  );
}

interface MonthGridProps {
  year: number;
  month: number;
  dayByDate: ReadonlyMap<string, CalendarDay>;
  selectedDate: string;
  metric: Metric;
  maxMetric: number;
  onSelect: (date: string) => void;
  compact?: boolean;
}

function MonthGrid({ year, month, dayByDate, selectedDate, metric, maxMetric, onSelect, compact = false }: MonthGridProps) {
  const firstDay = new Date(Date.UTC(year, month, 1));
  const offset = mondayOffset(firstDay);
  const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const cellCount = Math.ceil((offset + daysInMonth) / 7) * 7;

  return (
    <>
      {!compact && <h2 className="sr-only">{monthName(year, month)} {year}</h2>}
      <div className={`grid grid-cols-7 ${compact ? "gap-0.5" : "gap-px border-x border-b border-line bg-line"}`}>
        {Array.from({ length: cellCount }, (_, index) => {
          const dayNumber = index - offset + 1;
          if (dayNumber < 1 || dayNumber > daysInMonth) return <div key={index} aria-hidden="true" className={compact ? "aspect-square" : "min-h-24 bg-pavement sm:min-h-32"} />;
          const date = dateAt(Date.UTC(year, month, dayNumber));
          return <DayCell key={date} date={date} day={dayByDate.get(date)} metric={metric} maxMetric={maxMetric} selected={date === selectedDate} onSelect={onSelect} compact={compact} />;
        })}
      </div>
    </>
  );
}

interface DayCellProps {
  date: string;
  day: CalendarDay | undefined;
  metric: Metric;
  maxMetric: number;
  selected: boolean;
  onSelect: (date: string) => void;
  compact: boolean;
}

function DayCell({ date, day, metric, maxMetric, selected, onSelect, compact }: DayCellProps) {
  const dayNumber = asDate(date).getUTCDate();
  const amount = day ? metricValue(day.totals, metric) : 0;
  const label = `${fullDate(date)}: ${day?.totals.count ?? 0} ${(day?.totals.count ?? 0) === 1 ? "activity" : "activities"}${day ? `, ${formatMetric(metric, amount)}` : ""}`;

  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={selected}
      title={label}
      onClick={() => onSelect(date)}
      className={`relative flex w-full flex-col items-start border text-left transition-colors hover:border-ink ${
        compact ? "aspect-square justify-center border-transparent p-0.5 text-[11px]" : "min-h-24 border-line p-2 sm:min-h-32 sm:p-3"
      } ${selected ? "z-10 border-2 border-ink" : ""}`}
      style={dayStyle(amount, maxMetric)}
    >
      <span className={`num font-semibold ${compact ? "mx-auto" : ""}`}>{dayNumber}</span>
      {!compact && (
        <>
          {day && <span className="mt-auto pt-3 text-xs font-semibold leading-tight sm:text-sm">{formatMetric(metric, amount)}</span>}
          {day && <span className="mt-1 text-xs text-mute">{day.totals.count} {day.totals.count === 1 ? "activity" : "activities"}</span>}
        </>
      )}
      {compact && day && <span className="mx-auto mt-0.5 size-1 rounded-full bg-ink" aria-hidden="true" />}
    </button>
  );
}

interface MiniMonthProps {
  year: number;
  month: number;
  dayByDate: ReadonlyMap<string, CalendarDay>;
  selectedDate: string;
  metric: Metric;
  maxMetric: number;
  onSelect: (date: string) => void;
}

function MiniMonth(props: MiniMonthProps) {
  const monthDays = [...props.dayByDate.values()].filter((day) => {
    const date = asDate(day.date);
    return date.getUTCFullYear() === props.year && date.getUTCMonth() === props.month;
  });
  const total = sumTotals(monthDays);

  return (
    <div>
      <button
        type="button"
        onClick={() => props.onSelect(dateAt(Date.UTC(props.year, props.month, 1)))}
        className="mb-2 flex w-full items-baseline justify-between border-b border-line pb-1 text-left hover:text-mute"
      >
        <span className="font-bold">{monthName(props.year, props.month)}</span>
        <span className="num text-xs text-mute">{formatMetric(props.metric, metricValue(total, props.metric))}</span>
      </button>
      <div className="mb-1 grid grid-cols-7 text-center text-[10px] text-mute" aria-hidden="true">
        {WEEKDAYS.map((weekday) => <span key={weekday}>{weekday[0]}</span>)}
      </div>
      <MonthGrid {...props} compact />
    </div>
  );
}