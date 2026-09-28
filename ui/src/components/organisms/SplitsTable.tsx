import { formatSignedElevation } from "../../utils/format";
import { formatSportSpeed } from "../../utils/activityStats";
import type { SportGroupId } from "../../utils/sports";
import type { Split } from "../../types/strava";

export interface SplitsTableProps {
  splits: readonly Split[];
  group: SportGroupId;
  /** The split to pick out — hovered here, or where the charts/map are being scrubbed. */
  activeIndex?: number | null;
  /** Reports the split under the pointer (or keyboard focus), `null` when it leaves. */
  onActiveIndexChange?: (index: number | null) => void;
}

const CELL = "px-3 py-2 sm:px-4";

// GPS makes "full" splits land a few metres either side of 1000.
const FULL_SPLIT_TOLERANCE_M = 5;

/** The last split is whatever is left over, so it is usually shorter than a kilometre. */
const isShort = (s: Split): boolean => s.distance < 1000 - FULL_SPLIT_TOLERANCE_M;

export default function SplitsTable({
  splits,
  group,
  activeIndex = null,
  onActiveIndexChange,
}: SplitsTableProps) {
  const fastest = Math.max(...splits.map((s) => s.average_speed));
  const showHeartRate = splits.some((s) => s.average_heartrate !== undefined);
  const speedHeading = group === "ride" ? "Speed" : "Pace";

  return (
    <div className="overflow-x-auto rounded-lg border border-line bg-chalk">
      <table className="w-full text-left text-sm whitespace-nowrap">
        <caption className="sr-only">Kilometre splits</caption>
        <thead className="border-b border-line text-mute">
          <tr>
            <th scope="col" className={CELL + " font-semibold"}>
              Km
            </th>
            <th scope="col" className={CELL + " font-semibold"}>
              {speedHeading}
            </th>
            <th scope="col" className={CELL + " font-semibold"}>
              Elev
            </th>
            {showHeartRate && (
              <th scope="col" className={CELL + " font-semibold"}>
                Heart rate
              </th>
            )}
          </tr>
        </thead>
        <tbody>
          {splits.map((s, i) => (
            <tr
              key={s.split}
              // Focusable so keyboard users can step through splits and see each on the map/charts.
              tabIndex={onActiveIndexChange ? 0 : undefined}
              onPointerEnter={() => onActiveIndexChange?.(i)}
              onPointerLeave={() => onActiveIndexChange?.(null)}
              onFocus={() => onActiveIndexChange?.(i)}
              onBlur={() => onActiveIndexChange?.(null)}
              aria-current={i === activeIndex ? "true" : undefined}
              className={`border-b border-line transition-colors last:border-b-0 focus:outline-none focus-visible:bg-paint/40 ${
                i === activeIndex ? "bg-paint/40" : ""
              } ${onActiveIndexChange ? "cursor-default" : ""}`}
            >
              <th scope="row" className={CELL + " num font-semibold"}>
                {s.split}
                {isShort(s) && (
                  <span className="ml-1 text-xs font-normal text-mute">
                    {" "}
                    {(s.distance / 1000).toFixed(2)} km
                  </span>
                )}
              </th>
              <td className={CELL}>
                <div className="flex items-center gap-3">
                  <span className="num w-[5.5rem] shrink-0 font-semibold">
                    {formatSportSpeed(group, s.average_speed)}
                  </span>
                  {/* Decorative: the number beside it is the real value. */}
                  <div aria-hidden="true" className="h-2 min-w-10 flex-1 rounded-full bg-line">
                    <div
                      className="h-full rounded-full bg-asphalt"
                      style={{ width: `${(s.average_speed / fastest) * 100}%` }}
                    />
                  </div>
                </div>
              </td>
              <td className={CELL + " num"}>{formatSignedElevation(s.elevation_difference)}</td>
              {showHeartRate && (
                <td className={CELL + " num"}>
                  {s.average_heartrate !== undefined ? Math.round(s.average_heartrate) : "–"}
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
