import ActivityCard from "./ActivityCard";
import type { Activity } from "../../types/strava";

// Written out in full (rather than built with a template string) so Tailwind's build-time
// scan can find and generate each class — it can't see classes assembled at runtime.
const COLUMN_CLASSES: Record<number, string> = {
  1: "sm:grid-cols-1",
  2: "sm:grid-cols-2",
  3: "sm:grid-cols-3",
  4: "sm:grid-cols-4",
  5: "sm:grid-cols-5",
  6: "sm:grid-cols-6",
};

export interface ActivityGridProps {
  activities: readonly Activity[];
  /** 1–6 cards per row from the `sm` breakpoint up; always 1 below it. */
  columns?: number;
}

export default function ActivityGrid({ activities, columns = 3 }: ActivityGridProps) {
  if (activities.length === 0) {
    return <p className="py-16 text-center text-mute">No activities match this filter.</p>;
  }

  return (
    <ul className={`grid grid-cols-1 gap-5 ${COLUMN_CLASSES[columns] ?? COLUMN_CLASSES[3]}`}>
      {activities.map((activity) => (
        <li key={activity.id}>
          <ActivityCard activity={activity} />
        </li>
      ))}
    </ul>
  );
}
