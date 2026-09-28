import { useMemo, useState } from "react";
import { ArrowLeft, ExternalLink } from "lucide-react";
import DashboardTemplate from "../templates/DashboardTemplate";
import RouteMap from "../organisms/RouteMap";
import Spinner from "../atoms/Spinner";
import { buttonClasses } from "../atoms/Button";
import CollapsibleSection from "../molecules/CollapsibleSection";
import Notice from "../molecules/Notice";
import SportBadge from "../molecules/SportBadge";
import PrivacyBadge from "../molecules/PrivacyBadge";
import StatItem from "../molecules/StatItem";
import SplitsTable from "../organisms/SplitsTable";
import ActivityCharts, { hasChartableStreams } from "../organisms/ActivityCharts";
import { useActivity } from "../../hooks/useActivity";
import { useActivityStreams } from "../../hooks/useActivityStreams";
import { LIST_HREF } from "../../hooks/useRoute";
import { buildDetailStats } from "../../utils/activityStats";
import { formatDate } from "../../utils/format";
import { getGroup, sportLabel } from "../../utils/sports";
import { rangeIndexAt, splitRanges } from "../../utils/routeFraction";
import { buildChartSeries } from "../../utils/chartSeries";
import type { RouteMeasure } from "../../utils/routeStyling";

const backLink = (
  <a
    href={LIST_HREF}
    className="inline-flex items-center gap-1 text-sm font-semibold text-mute hover:text-ink hover:underline"
  >
    <ArrowLeft className="size-4" aria-hidden="true" />
    All activities
  </a>
);

export interface ActivityDetailPageProps {
  id: number;
}

export default function ActivityDetailPage({ id }: ActivityDetailPageProps) {
  const { status, activity, error, retry } = useActivity(id);
  const streams = useActivityStreams(id);
  // Where along the route (0–1) a chart is hovered/focused — shared by every chart and the map.
  const [hoverFraction, setHoverFraction] = useState<number | null>(null);
  // The split row under the pointer, if any — it wins over the charts' hover position.
  const [hoveredSplit, setHoveredSplit] = useState<number | null>(null);
  const splitsData = activity?.splits_metric;
  const ranges = useMemo(() => splitRanges(splitsData ?? []), [splitsData]);
  // What the map can colour the route by — the same series (and formatting) the charts use.
  const measures = useMemo(() => {
    const distance = streams.streams?.distance?.data;
    if (!activity || !streams.streams || !distance) return {};
    const series = buildChartSeries(streams.streams, getGroup(activity));
    const measure = (key: string): RouteMeasure | undefined => {
      const s = series.find((c) => c.key === key);
      return s && { title: s.title, distance, values: s.values, format: s.format };
    };
    const speed = measure("speed");
    const elevation = measure("altitude");
    return { ...(speed && { speed }), ...(elevation && { elevation }) };
  }, [activity, streams.streams]);

  // Nothing to show yet, or the load failed.
  if (!activity) {
    return (
      <DashboardTemplate
        header={<div className="pt-10">{backLink}</div>}
        notice={
          error && (
            <Notice tone="error" actionLabel="Try again" onAction={retry}>
              {error}
            </Notice>
          )
        }
      >
        {status === "loading" && (
          <div className="flex justify-center py-24">
            <Spinner label="Loading activity" />
          </div>
        )}
      </DashboardTemplate>
    );
  }

  const group = getGroup(activity);
  // Stream-derived figures (descent, max cadence…) join in once the streams have loaded.
  const [overview, ...statGroups] = buildDetailStats(activity, group, streams.streams ?? null);
  const polyline = activity.map?.polyline || activity.map?.summary_polyline;
  const splits = activity.splits_metric ?? [];
  // One split is "active" at a time, linking the table, the charts and the map: the row
  // being hovered, or else whichever split the chart/map cursor is in.
  const activeSplit =
    hoveredSplit ?? (hoverFraction !== null ? rangeIndexAt(ranges, hoverFraction) : null);
  const activeRange = activeSplit !== null ? (ranges[activeSplit] ?? null) : null;
  const activeLabel = activeSplit !== null ? `Km ${splits[activeSplit]?.split ?? activeSplit + 1}` : undefined;
  const meta = [activity.device_name, activity.gear?.name].filter(Boolean).join(" · ");

  return (
    <DashboardTemplate
      header={
        <header className="pt-10 pb-2">
          {backLink}
          <div className="mt-6 flex flex-wrap items-end justify-between gap-4">
            <div>
              <div className="flex items-center gap-3">
                <SportBadge group={group} label={sportLabel(activity)} />
                {activity.private && <PrivacyBadge />}
              </div>
              <h1 className="num mt-1 text-4xl leading-none font-extrabold tracking-tight sm:text-5xl">
                {activity.name}
              </h1>
              <p className="mt-3 text-mute">{formatDate(activity.start_date_local)}</p>
            </div>
            <a
              href={`https://www.strava.com/activities/${activity.id}`}
              target="_blank"
              rel="noopener noreferrer"
              className={buttonClasses("ghost", "gap-2")}
            >
              Open on Strava
              <ExternalLink className="size-4" aria-hidden="true" />
            </a>
          </div>
          {activity.description && (
            <p className="mt-5 max-w-prose whitespace-pre-line">{activity.description}</p>
          )}
          {meta && <p className="mt-2 text-sm text-mute">{meta}</p>}
        </header>
      }
      summary={
        <section aria-label="Activity statistics" className="border-y border-line py-5">
          <dl className="grid grid-cols-2 gap-x-8 gap-y-5 sm:grid-cols-3 lg:grid-cols-4">
            {overview?.stats.map((s) => (
              <StatItem key={s.label} size="lg" label={s.label} value={s.value} />
            ))}
          </dl>
        </section>
      }
    >
      <div className="space-y-10">
        {statGroups.length > 0 && (
          <CollapsibleSection title="Statistics">
            <div className="grid gap-x-10 gap-y-8 md:grid-cols-2">
              {statGroups.map((g) => (
                <section key={g.title} aria-label={g.title}>
                  <h3 className="mb-3 text-sm font-bold tracking-wide text-mute uppercase">{g.title}</h3>
                  <dl className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3">
                    {g.stats.map((s) => (
                      <StatItem key={s.label} label={s.label} value={s.value} />
                    ))}
                  </dl>
                </section>
              ))}
            </div>
          </CollapsibleSection>
        )}

        {polyline && (
          <CollapsibleSection title="Route">
            <RouteMap
              polyline={polyline}
              hoverFraction={hoverFraction}
              highlightRange={activeRange}
              measures={measures}
              className="aspect-[8/5] max-h-[32rem] w-full sm:aspect-[2/1]"
            />
          </CollapsibleSection>
        )}

        {streams.status === "error" && (
          <Notice tone="error" actionLabel="Try again" onAction={streams.retry}>
            Couldn't load the charts. {streams.error}
          </Notice>
        )}
        {streams.streams && hasChartableStreams(streams.streams, group) && (
          <CollapsibleSection title="Charts">
            <ActivityCharts
              streams={streams.streams}
              group={group}
              hoverFraction={hoverFraction}
              onHoverFractionChange={setHoverFraction}
              highlightRange={activeRange}
              highlightLabel={activeLabel}
            />
          </CollapsibleSection>
        )}

        {splits.length > 0 && (
          <CollapsibleSection title="Splits">
            <SplitsTable
              splits={splits}
              group={group}
              activeIndex={activeSplit}
              onActiveIndexChange={setHoveredSplit}
            />
          </CollapsibleSection>
        )}
      </div>
    </DashboardTemplate>
  );
}
