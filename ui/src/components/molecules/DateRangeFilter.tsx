import type { ChangeEvent } from "react";
import { formatShortDate } from "../../utils/format";

export type DateRangePreset =
  | "7d"
  | "14d"
  | "30d"
  | "week"
  | "month"
  | "3m"
  | "6m"
  | "ytd"
  | "year"
  | "custom";

export interface DateRange {
  preset: DateRangePreset;
  /** `yyyy-mm-dd`; only meaningful (and optional either way) when `preset` is `"custom"`. */
  from: string;
  /** `yyyy-mm-dd`; only meaningful (and optional either way) when `preset` is `"custom"`. */
  to: string;
  /** The calendar year shown when `preset` is `"year"`. */
  year: number;
}

export const DEFAULT_DATE_RANGE: DateRange = { preset: "30d", from: "", to: "", year: new Date().getFullYear() };

/** Strava started in 2009: no activity can be older. */
const FIRST_YEAR = 2009;

const PRESETS: { id: DateRangePreset; label: string }[] = [
  { id: "7d", label: "Last 7 days" },
  { id: "14d", label: "Last 14 days" },
  { id: "30d", label: "Last 30 days" },
  { id: "week", label: "This week" },
  { id: "month", label: "This month" },
  { id: "3m", label: "Last 3 months" },
  { id: "6m", label: "Last 6 months" },
  { id: "ytd", label: "Year to date" },
  { id: "year", label: "Year" },
  { id: "custom", label: "Custom" },
];

const DAY_MS = 24 * 3600 * 1000;

// Strava's start_date_local is local wall-clock time labelled as UTC (see types/strava.ts),
// so a calendar boundary has to be built the same way: read "today" from the browser's own
// local calendar, then stamp it as UTC rather than converting time zones.
function localDateAsUtc(date: Date, dayOffset = 0): number {
  return Date.UTC(date.getFullYear(), date.getMonth(), date.getDate() + dayOffset);
}

/** The `[since, until)` window (epoch ms) a range covers; open-ended where the range leaves a side blank. */
export function rangeBounds({ preset, from, to, year }: DateRange): { since: number; until: number } {
  const now = new Date();
  switch (preset) {
    case "custom":
      return {
        since: from ? new Date(`${from}T00:00:00Z`).getTime() : -Infinity,
        until: to ? new Date(`${to}T23:59:59.999Z`).getTime() : Infinity,
      };
    case "7d":
    case "14d":
    case "30d":
      return { since: Date.now() - Number(preset.slice(0, -1)) * DAY_MS, until: Infinity };
    case "week": {
      const mondayOffset = -((now.getDay() + 6) % 7); // getDay(): Sun=0..Sat=6 -> days back to Monday
      return { since: localDateAsUtc(now, mondayOffset), until: Infinity };
    }
    case "month":
      return { since: Date.UTC(now.getFullYear(), now.getMonth(), 1), until: Infinity };
    case "3m":
      return { since: Date.UTC(now.getFullYear(), now.getMonth() - 3, now.getDate()), until: Infinity };
    case "6m":
      return { since: Date.UTC(now.getFullYear(), now.getMonth() - 6, now.getDate()), until: Infinity };
    case "ytd":
      return { since: Date.UTC(now.getFullYear(), 0, 1), until: Infinity };
    case "year":
      return { since: Date.UTC(year, 0, 1), until: Date.UTC(year + 1, 0, 1) - 1 };
  }
}

/** A short human label for the current range, for use as a heading. */
export function rangeLabel(range: DateRange): string {
  if (range.preset === "year") return String(range.year);
  if (range.preset !== "custom") return PRESETS.find((p) => p.id === range.preset)!.label;
  const { from, to } = range;
  if (from && to) return `${formatShortDate(from)} – ${formatShortDate(to)}`;
  if (from) return `Since ${formatShortDate(from)}`;
  if (to) return `Until ${formatShortDate(to)}`;
  return "All time";
}

export interface DateRangeFilterProps {
  value: DateRange;
  onChange: (value: DateRange) => void;
}

export default function DateRangeFilter({ value, onChange }: DateRangeFilterProps) {
  const setFrom = (e: ChangeEvent<HTMLInputElement>) => onChange({ ...value, from: e.target.value });
  const setTo = (e: ChangeEvent<HTMLInputElement>) => onChange({ ...value, to: e.target.value });
  const thisYear = new Date().getFullYear();
  const years = Array.from({ length: thisYear - FIRST_YEAR + 1 }, (_, i) => thisYear - i);

  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="flex flex-wrap gap-2" role="group" aria-label="Date range">
        {PRESETS.map((preset) => {
          const active = preset.id === value.preset;
          return (
            <button
              key={preset.id}
              type="button"
              aria-pressed={active}
              onClick={() => onChange({ ...value, preset: preset.id })}
              className={`rounded-full px-4 py-1.5 text-sm font-semibold transition-colors ${
                active ? "bg-ink text-chalk" : "bg-chalk text-ink hover:bg-white border border-line"
              }`}
            >
              {preset.label}
            </button>
          );
        })}
      </div>
      {value.preset === "year" && (
        <label className="flex items-center gap-1.5 text-sm text-mute">
          Year
          <select
            value={value.year}
            onChange={(e) => onChange({ ...value, year: Number(e.target.value) })}
            className="num rounded-md border border-line bg-chalk px-2 py-1 font-semibold text-ink"
          >
            {years.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </label>
      )}
      {value.preset === "custom" && (
        <div className="flex flex-wrap items-center gap-2 text-sm text-mute">
          <label className="flex items-center gap-1.5">
            From
            <input
              type="date"
              value={value.from}
              max={value.to || undefined}
              onChange={setFrom}
              className="rounded-md border border-line bg-chalk px-2 py-1 text-ink"
            />
          </label>
          <label className="flex items-center gap-1.5">
            To
            <input
              type="date"
              value={value.to}
              min={value.from || undefined}
              onChange={setTo}
              className="rounded-md border border-line bg-chalk px-2 py-1 text-ink"
            />
          </label>
        </div>
      )}
    </div>
  );
}
