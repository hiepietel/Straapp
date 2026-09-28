import StatItem from "../molecules/StatItem";
import { formatDistance, formatDuration, formatElevation } from "../../utils/format";
import type { ActivityTotal, AthleteStats } from "../../types/strava";

const CELL = "px-3 py-2 sm:px-4";

interface Row {
  label: string;
  totals: ActivityTotal;
}

function TotalsTable({ rows }: { rows: Row[] }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-line bg-chalk">
      <table className="w-full text-left text-sm whitespace-nowrap">
        <thead className="border-b border-line text-mute">
          <tr>
            <th scope="col" className={CELL + " font-semibold"}>
              Sport
            </th>
            <th scope="col" className={CELL + " font-semibold"}>
              Activities
            </th>
            <th scope="col" className={CELL + " font-semibold"}>
              Distance
            </th>
            <th scope="col" className={CELL + " font-semibold"}>
              Time
            </th>
            <th scope="col" className={CELL + " font-semibold"}>
              Elevation
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.label} className="border-b border-line last:border-b-0">
              <th scope="row" className={CELL + " font-semibold"}>
                {row.label}
              </th>
              <td className={CELL + " num"}>{row.totals.count}</td>
              <td className={CELL + " num"}>{formatDistance(row.totals.distance)}</td>
              <td className={CELL + " num"}>{formatDuration(row.totals.moving_time)}</td>
              <td className={CELL + " num"}>{formatElevation(row.totals.elevation_gain)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export interface AthleteStatsPanelProps {
  stats: AthleteStats;
}

// GET /athletes/{id}/stats — lifetime, year-to-date and last-4-weeks totals per sport.
export default function AthleteStatsPanel({ stats }: AthleteStatsPanelProps) {
  const groups: { title: string; rows: Row[] }[] = [
    {
      title: "Last 4 weeks",
      rows: [
        { label: "Run", totals: stats.recent_run_totals },
        { label: "Ride", totals: stats.recent_ride_totals },
        { label: "Swim", totals: stats.recent_swim_totals },
      ],
    },
    {
      title: "Year to date",
      rows: [
        { label: "Run", totals: stats.ytd_run_totals },
        { label: "Ride", totals: stats.ytd_ride_totals },
        { label: "Swim", totals: stats.ytd_swim_totals },
      ],
    },
    {
      title: "All time",
      rows: [
        { label: "Run", totals: stats.all_run_totals },
        { label: "Ride", totals: stats.all_ride_totals },
        { label: "Swim", totals: stats.all_swim_totals },
      ],
    },
  ];

  return (
    <div className="space-y-6">
      {(!!stats.biggest_ride_distance || !!stats.biggest_climb_elevation_gain) && (
        <dl className="flex flex-wrap gap-x-12 gap-y-4">
          {!!stats.biggest_ride_distance && (
            <StatItem label="Biggest ride" value={formatDistance(stats.biggest_ride_distance)} />
          )}
          {!!stats.biggest_climb_elevation_gain && (
            <StatItem
              label="Biggest climb"
              value={formatElevation(stats.biggest_climb_elevation_gain)}
            />
          )}
        </dl>
      )}
      {groups.map((group) => (
        <div key={group.title}>
          <h3 className="mb-2 text-sm font-semibold text-mute">{group.title}</h3>
          <TotalsTable rows={group.rows} />
        </div>
      ))}
    </div>
  );
}
