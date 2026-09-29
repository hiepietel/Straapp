import FilterTabs from "./FilterTabs";
import type { FilterOption } from "./FilterTabs";

export type PeriodId = "30d" | "3m" | "12m" | "thisYear" | "year" | "all" | "custom";

export interface Period {
  id: PeriodId;
  /** The calendar year, when `id` is "year". */
  year: number;
  /** `yyyy-mm-dd`, either optional, when `id` is "custom". */
  from: string;
  to: string;
}

export const defaultPeriod = (id: PeriodId = "12m"): Period => ({ id, year: new Date().getFullYear() - 1, from: "", to: "" });

const OPTIONS: FilterOption<PeriodId>[] = [
  { id: "30d", label: "Last 30 days" },
  { id: "3m", label: "Last 3 months" },
  { id: "12m", label: "Last 12 months" },
  { id: "thisYear", label: "This year" },
  { id: "year", label: "Year" },
  { id: "all", label: "All time" },
  { id: "custom", label: "Custom" },
];

/** Strava started in 2009: no activity can be older. */
const FIRST_YEAR = 2009;

/** The browser's local calendar day, "YYYY-MM-DD", `days`/`months` from today. */
export function localDay(offset: { days?: number; months?: number } = {}): string {
  const now = new Date();
  const d = new Date(now.getFullYear(), now.getMonth() + (offset.months ?? 0), now.getDate() + (offset.days ?? 0));
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** The local days a period covers, both included; undefined where it's open. */
export function periodDays(period: Period): { from?: string; to?: string } {
  switch (period.id) {
    case "30d":
      return { from: localDay({ days: -29 }) };
    case "3m":
      return { from: localDay({ months: -3 }) };
    case "12m":
      return { from: localDay({ months: -12 }) };
    case "thisYear":
      return { from: `${new Date().getFullYear()}-01-01` };
    case "year":
      return { from: `${period.year}-01-01`, to: `${period.year}-12-31` };
    case "all":
      return {};
    case "custom":
      return { ...(period.from && { from: period.from }), ...(period.to && { to: period.to }) };
  }
}

export interface PeriodFilterProps {
  value: Period;
  onChange: (value: Period) => void;
}

const INPUT = "rounded-md border border-line bg-chalk px-2 py-1 text-ink";

// Rolling windows, a calendar year of your choice, all time, or any range of days.
export default function PeriodFilter({ value, onChange }: PeriodFilterProps) {
  const thisYear = new Date().getFullYear();
  const years = Array.from({ length: thisYear - FIRST_YEAR + 1 }, (_, i) => thisYear - i);

  return (
    <div className="flex flex-wrap items-center gap-3">
      <FilterTabs options={OPTIONS} value={value.id} onChange={(id) => onChange({ ...value, id })} label="Date range" />
      {value.id === "year" && (
        <label className="flex items-center gap-1.5 text-sm text-mute">
          Year
          <select
            value={value.year}
            onChange={(e) => onChange({ ...value, year: Number(e.target.value) })}
            className={`num font-semibold ${INPUT}`}
          >
            {years.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </label>
      )}
      {value.id === "custom" && (
        <div className="flex flex-wrap items-center gap-2 text-sm text-mute">
          <label className="flex items-center gap-1.5">
            From
            <input
              type="date"
              value={value.from}
              max={value.to || undefined}
              onChange={(e) => onChange({ ...value, from: e.target.value })}
              className={INPUT}
            />
          </label>
          <label className="flex items-center gap-1.5">
            To
            <input
              type="date"
              value={value.to}
              min={value.from || undefined}
              onChange={(e) => onChange({ ...value, to: e.target.value })}
              className={INPUT}
            />
          </label>
        </div>
      )}
    </div>
  );
}
