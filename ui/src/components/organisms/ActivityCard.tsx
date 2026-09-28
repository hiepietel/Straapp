import RouteTrace from "../atoms/RouteTrace";
import SportIcon from "../atoms/SportIcon";
import StatItem from "../molecules/StatItem";
import SportBadge from "../molecules/SportBadge";
import PrivacyBadge from "../molecules/PrivacyBadge";
import { buttonClasses } from "../atoms/Button";
import { activityHref } from "../../hooks/useRoute";
import { getGroup, sportLabel } from "../../utils/sports";
import { buildSummaryStats } from "../../utils/activityStats";
import { formatDate } from "../../utils/format";
import type { Activity } from "../../types/strava";

export interface ActivityCardProps {
  activity: Activity;
}

export default function ActivityCard({ activity }: ActivityCardProps) {
  const group = getGroup(activity);
  const polyline = activity.map?.summary_polyline;
  const stats = buildSummaryStats(activity, group);

  return (
    <article className="overflow-hidden rounded-lg border border-line bg-chalk">
      <div className="flex aspect-[8/5] items-center justify-center bg-asphalt text-paint">
        {polyline ? (
          <RouteTrace polyline={polyline} className="size-full" />
        ) : (
          <SportIcon group={group} className="size-10 text-mute" />
        )}
      </div>

      <div className="p-4">
        <div className="flex items-center justify-between gap-2">
          <SportBadge group={group} label={sportLabel(activity)} />
          {activity.private && <PrivacyBadge />}
        </div>
        <h3 className="mt-1 text-lg leading-snug font-bold">
          <a
            href={`https://www.strava.com/activities/${activity.id}`}
            target="_blank"
            rel="noopener noreferrer"
            className="hover:underline"
          >
            {activity.name}
          </a>
        </h3>
        <p className="text-sm text-mute">{formatDate(activity.start_date_local)}</p>

        <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3">
          {stats.map((s) => (
            <StatItem key={s.label} label={s.label} value={s.value} />
          ))}
        </dl>

        <a href={activityHref(activity.id)} className={buttonClasses("ghost", "mt-5 w-full")}>
          View details
        </a>
      </div>
    </article>
  );
}
