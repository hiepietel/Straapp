import { useEffect, useMemo, useState } from "react";
import StatItem from "../molecules/StatItem";
import Spinner from "../atoms/Spinner";
import Notice from "../molecules/Notice";
import DateRangeFilter, { DEFAULT_DATE_RANGE, rangeBounds, rangeLabel } from "../molecules/DateRangeFilter";
import SportMultiSelect from "../molecules/SportMultiSelect";
import { aggregateTotals, speedStat } from "../../utils/activityStats";
import type { Stat } from "../../utils/activityStats";
import { formatDistance, formatDuration, formatElevation, formatSpeed } from "../../utils/format";
import { GROUPS, getGroup } from "../../utils/sports";
import type { SportGroupId } from "../../utils/sports";
import type { ActivitiesStatus } from "../../hooks/useActivities";
import type { Activity } from "../../types/strava";

const GROUP_IDS = Object.keys(GROUPS) as SportGroupId[];

// A hard stop so a very wide range (or a lot of history) can't auto-trigger unbounded
// fetching. 1500 activities is generous — tens of pages — for what a stats view needs.
const AUTO_LOAD_ACTIVITY_CAP = 1500;

export interface SummaryStripProps {
  /** Every activity loaded so far — not just what's currently visible in the grid. */
  activities: readonly Activity[];
  status: ActivitiesStatus;
  hasMore: boolean;
  onLoadMore: () => void;
}

export default function SummaryStrip({ activities, status, hasMore, onLoadMore }: SummaryStripProps) {
  const [dateRange, setDateRange] = useState(DEFAULT_DATE_RANGE);
  const [sportFilter, setSportFilter] = useState<ReadonlySet<SportGroupId>>(new Set());

  // Only offer type filters for sports that exist in the data.
  const sportOptions = useMemo(() => {
    const present = new Set<SportGroupId>(activities.map(getGroup));
    return GROUP_IDS.filter((id) => present.has(id)).map((id) => ({ id, label: GROUPS[id].label }));
  }, [activities]);

  const { since } = rangeBounds(dateRange);

  // Activities load newest-first, so once the oldest one loaded is past `since`, every
  // activity that belongs in the range has necessarily already been loaded.
  const oldestLoaded = useMemo(
    () =>
      activities.length === 0
        ? Infinity
        : activities.reduce((min, a) => Math.min(min, new Date(a.start_date_local).getTime()), Infinity),
    [activities]
  );

  // A blank "custom" range has no lower bound to load toward, so it's left as-is rather than
  // pulling in an account's entire history the moment that range is picked.
  const coverageNeeded = Number.isFinite(since);
  const notYetCovered = coverageNeeded && hasMore && oldestLoaded > since;
  const cappedOut = notYetCovered && activities.length >= AUTO_LOAD_ACTIVITY_CAP;
  const catchingUp = notYetCovered && !cappedOut;

  useEffect(() => {
    if (catchingUp && status === "ready") onLoadMore();
  }, [catchingUp, status, onLoadMore]);

  const filtered = useMemo(() => {
    const { until } = rangeBounds(dateRange);
    return activities.filter((a) => {
      const t = new Date(a.start_date_local).getTime();
      if (t < since || t > until) return false;
      return sportFilter.size === 0 || sportFilter.has(getGroup(a));
    });
  }, [activities, dateRange, since, sportFilter]);

  const totals = useMemo(() => aggregateTotals(filtered), [filtered]);

  // With one type selected, pace/speed can be shown the way that sport reports it.
  const singleGroup = sportFilter.size === 1 ? [...sportFilter][0] : null;

  const secondaryStats = useMemo<Stat[]>(() => {
    const stats: Stat[] = [
      { label: "Avg distance", value: formatDistance(totals.distance / totals.count) },
      { label: "Avg moving time", value: formatDuration(totals.time / totals.count) },
    ];
    if (totals.distance > 0) {
      const avgSpeed = totals.time > 0 ? totals.distance / totals.time : 0;
      const pace = singleGroup ? speedStat(singleGroup, avgSpeed) : null;
      stats.push(pace ?? { label: "Avg speed", value: formatSpeed(avgSpeed) });
      stats.push({ label: "Longest activity", value: formatDistance(totals.longestDistance) });
      stats.push({ label: "Elevation / km", value: `${Math.round(totals.elevation / (totals.distance / 1000))} m` });
    }
    stats.push({ label: "Active days", value: String(totals.activeDays) });
    return stats;
  }, [totals, singleGroup]);

  const sportBreakdown = useMemo(
    () =>
      (Object.entries(totals.bySport) as [SportGroupId, number][]).sort(([, a], [, b]) => b - a),
    [totals.bySport]
  );

  return (
    <section aria-labelledby="summary-title" className="border-y border-line py-5">
      <h2 id="summary-title" className="mb-3 text-sm font-semibold text-mute">
        Statistics · {rangeLabel(dateRange)}
      </h2>

      <div className="mb-5 flex flex-col gap-3">
        <DateRangeFilter value={dateRange} onChange={setDateRange} />
        {sportOptions.length > 1 && (
          <SportMultiSelect options={sportOptions} value={sportFilter} onChange={setSportFilter} />
        )}
      </div>

      {catchingUp && (
        <p className="mb-4">
          <Spinner label="Loading more activities to cover this range…" />
        </p>
      )}
      {cappedOut && (
        <Notice actionLabel="Load more" onAction={onLoadMore}>
          These numbers only cover the most recently loaded activities — load more to reach
          further back into this range.
        </Notice>
      )}

      {totals.count === 0 ? (
        <p className="text-sm text-mute">No activities match these filters.</p>
      ) : (
        <>
          <dl className="flex flex-wrap gap-x-12 gap-y-4">
            <StatItem size="lg" label="Activities" value={totals.count} />
            <StatItem size="lg" label="Distance" value={formatDistance(totals.distance)} />
            <StatItem size="lg" label="Moving time" value={formatDuration(totals.time)} />
            <StatItem size="lg" label="Elevation gain" value={formatElevation(totals.elevation)} />
          </dl>

          <dl className="mt-5 flex flex-wrap gap-x-10 gap-y-3 border-t border-line pt-5">
            {secondaryStats.map((stat) => (
              <StatItem key={stat.label} label={stat.label} value={stat.value} />
            ))}
          </dl>

          {sportBreakdown.length > 1 && (
            <dl className="mt-5 flex flex-wrap gap-x-10 gap-y-3 border-t border-line pt-5">
              {sportBreakdown.map(([group, count]) => (
                <StatItem key={group} label={GROUPS[group].label} value={count} />
              ))}
            </dl>
          )}
        </>
      )}
    </section>
  );
}
