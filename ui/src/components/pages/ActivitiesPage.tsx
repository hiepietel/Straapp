import { useMemo, useState } from "react";
import DashboardTemplate from "../templates/DashboardTemplate";
import SummaryStrip from "../organisms/SummaryStrip";
import ActivityGrid from "../organisms/ActivityGrid";
import SportTypeFilter from "../molecules/SportTypeFilter";
import ColumnsFilter from "../molecules/ColumnsFilter";
import Notice from "../molecules/Notice";
import Spinner from "../atoms/Spinner";
import Button from "../atoms/Button";
import { useActivities } from "../../hooks/useActivities";
import { useColumnCount } from "../../hooks/useColumnCount";
import { isDemo } from "../../services/auth";
import { matchesSportTypes, sportTypeOf } from "../../utils/sports";
import type { ReactNode } from "react";

export default function ActivitiesPage() {
  // Strava's own max per page (200), not just the previous 30: statistics filters like
  // "Last 6 months" need real history loaded, not just the first handful of activities.
  const { activities, status, error, hasMore, refresh, loadMore } = useActivities(200);
  const [sportTypes, setSportTypes] = useState<ReadonlySet<string>>(new Set());
  const [columns, setColumns] = useColumnCount();

  // Only offer filters for sports that exist in the data.
  const presentTypes = useMemo(() => [...new Set(activities.map(sportTypeOf))], [activities]);

  const visible = useMemo(
    () => activities.filter((a) => matchesSportTypes(sportTypeOf(a), sportTypes)),
    [activities, sportTypes]
  );

  const firstLoad = status === "loading";
  const failedFirstLoad = status === "error" && activities.length === 0;

  let notice: ReactNode = null;
  if (error) {
    notice = (
      <Notice tone="error" actionLabel="Try again" onAction={activities.length ? loadMore : refresh}>
        {error}
      </Notice>
    );
  } else if (isDemo) {
    notice = (
      <Notice>
        You are seeing demo data. Remove VITE_DEMO from the .env file and run the Straapp API to see your own activities.
      </Notice>
    );
  }

  return (
    <DashboardTemplate
      header={
        <header className="pt-8">
          <h1 className="text-3xl font-extrabold tracking-tight">Activities</h1>
        </header>
      }
      notice={notice}
      summary={
        !firstLoad &&
        !failedFirstLoad && (
          <SummaryStrip
            activities={activities}
            status={status}
            hasMore={hasMore}
            onLoadMore={loadMore}
          />
        )
      }
      filters={
        !firstLoad &&
        !failedFirstLoad && (
          <div className="flex flex-wrap items-start justify-between gap-4">
            <SportTypeFilter types={presentTypes} value={sportTypes} onChange={setSportTypes} />
            <div className="flex items-center gap-3">
              <ColumnsFilter value={columns} onChange={setColumns} />
              <Button variant="ghost" onClick={refresh} disabled={firstLoad}>
                Refresh
              </Button>
            </div>
          </div>
        )
      }
      footer={
        status === "loadingMore" ? (
          <Spinner label="Loading more activities" />
        ) : (
          status === "ready" &&
          hasMore && (
            <Button variant="ghost" onClick={loadMore}>
              Load more
            </Button>
          )
        )
      }
    >
      {firstLoad ? (
        <div className="flex justify-center py-24">
          <Spinner label="Loading your activities" />
        </div>
      ) : (
        !failedFirstLoad && <ActivityGrid activities={visible} columns={columns} />
      )}
    </DashboardTemplate>
  );
}
