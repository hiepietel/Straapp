import { useState } from "react";
import FilterTabs from "../molecules/FilterTabs";
import { activityHref } from "../../hooks/useRoute";
import { formatDistance, formatDuration, formatElevation, formatShortDate } from "../../utils/format";
import { GROUPS } from "../../utils/sports";
import type { ActivityRef } from "../../types/gear";
import type { PeriodTotals, ProfileTotals, TotalsPeriod, Visibility } from "../../types/profile";
import type { Totals } from "../../types/statistics";
import type { FilterOption } from "../molecules/FilterTabs";

const CELL = "px-3 py-2 sm:px-4";

const VISIBILITY_OPTIONS: FilterOption<Visibility>[] = [
  { id: "all", label: "All activities" },
  { id: "public", label: "Public" },
  { id: "private", label: "Private" },
];

const PERIOD_TITLES: Record<TotalsPeriod, string> = {
  recent: "Last 4 weeks",
  year: "Year to date",
  allTime: "All time",
};

function TotalsRow({ label, totals, strong = false }: { label: string; totals: Totals; strong?: boolean }) {
  const weight = strong ? " font-bold" : "";
  return (
    <tr className="border-b border-line last:border-b-0">
      <th scope="row" className={CELL + (strong ? " font-bold" : " font-semibold")}>
        {label}
      </th>
      <td className={CELL + " num text-right" + weight}>{totals.count.toLocaleString()}</td>
      <td className={CELL + " num text-right" + weight}>{formatDistance(totals.distance)}</td>
      <td className={CELL + " num text-right" + weight}>{formatDuration(totals.movingTime)}</td>
      <td className={CELL + " num text-right" + weight}>{formatElevation(totals.elevation)}</td>
    </tr>
  );
}

function PeriodTable({ period }: { period: PeriodTotals }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-line bg-chalk">
      <table className="w-full text-left text-sm whitespace-nowrap">
        <caption className="sr-only">{PERIOD_TITLES[period.period]}, per sport</caption>
        <thead className="border-b border-line text-mute">
          <tr>
            <th scope="col" className={CELL + " font-semibold"}>Sport</th>
            <th scope="col" className={CELL + " text-right font-semibold"}>Activities</th>
            <th scope="col" className={CELL + " text-right font-semibold"}>Distance</th>
            <th scope="col" className={CELL + " text-right font-semibold"}>Time</th>
            <th scope="col" className={CELL + " text-right font-semibold"}>Elevation</th>
          </tr>
        </thead>
        <tbody>
          {period.sports.map((s) => (
            <TotalsRow key={s.sport} label={GROUPS[s.sport].label} totals={s.totals} />
          ))}
        </tbody>
        {period.sports.length > 1 && (
          <tfoot className="border-t-2 border-line">
            <TotalsRow label="All sports" totals={period.all} strong />
          </tfoot>
        )}
      </table>
    </div>
  );
}

function Record({ label, activity, value }: { label: string; activity: ActivityRef; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-sm text-mute">{label}</dt>
      <dd className="num text-xl leading-tight font-bold">{value}</dd>
      <dd className="truncate text-sm">
        <a href={activityHref(activity.id)} className="hover:underline">
          {activity.name}
        </a>{" "}
        <span className="text-mute">· {formatShortDate(activity.date)}</span>
      </dd>
    </div>
  );
}

export interface AthleteStatsPanelProps {
  totals: ProfileTotals;
}

// Counted by the API from the synced activities: every sport, and split by who can see them.
export default function AthleteStatsPanel({ totals }: AthleteStatsPanelProps) {
  const [visibility, setVisibility] = useState<Visibility>("all");
  const shown = totals[visibility];
  const empty = shown.periods.every((p) => p.all.count === 0);

  return (
    <div className="space-y-6">
      <FilterTabs options={VISIBILITY_OPTIONS} value={visibility} onChange={setVisibility} label="Which activities" />

      {empty ? (
        <p className="text-sm text-mute">
          {visibility === "private" ? "No private activities." : visibility === "public" ? "No public activities." : "No activities synced yet."}
        </p>
      ) : (
        <>
          {(shown.longest || shown.biggestClimb || shown.longestTime) && (
            <dl className="grid gap-4 sm:grid-cols-3">
              {shown.longest && <Record label="Longest" activity={shown.longest} value={formatDistance(shown.longest.distance)} />}
              {shown.biggestClimb && (
                <Record label="Biggest climb" activity={shown.biggestClimb} value={formatElevation(shown.biggestClimb.elevation)} />
              )}
              {shown.longestTime && (
                <Record label="Longest time" activity={shown.longestTime} value={formatDuration(shown.longestTime.movingTime)} />
              )}
            </dl>
          )}

          {shown.periods.map((period) => (
            <div key={period.period}>
              <h3 className="mb-2 text-sm font-semibold text-mute">
                {PERIOD_TITLES[period.period]}
                {period.from && <span className="font-normal"> · since {formatShortDate(period.from)}</span>}
              </h3>
              {period.all.count === 0 ? (
                <p className="text-sm text-mute">No activities in this period.</p>
              ) : (
                <PeriodTable period={period} />
              )}
            </div>
          ))}
        </>
      )}
    </div>
  );
}
