import { useState } from "react";

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const COLOR = "#2a78d6";

export interface WeekHourGridProps {
  /** Activities started per [weekday Monday..Sunday][hour 0..23]. */
  grid: readonly (readonly number[])[];
}

// When activities start: one row per weekday, one column per hour, darker where there are more.
// A single hue from light to dark, so the busiest times read at a glance.
export default function WeekHourGrid({ grid }: WeekHourGridProps) {
  const [hovered, setHovered] = useState<{ day: number; hour: number } | null>(null);
  const max = Math.max(1, ...grid.flat());
  const value = hovered ? grid[hovered.day]![hovered.hour]! : 0;

  return (
    <div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[36rem] border-separate [border-spacing:2px] text-xs" onPointerLeave={() => setHovered(null)}>
          <caption className="sr-only">Activities started per weekday and hour</caption>
          <thead>
            <tr>
              <th scope="col" className="w-10" />
              {Array.from({ length: 24 }, (_, h) => (
                <th key={h} scope="col" className="num font-normal text-mute">
                  {h % 3 === 0 ? h : ""}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {grid.map((row, d) => (
              <tr key={d}>
                <th scope="row" className="pr-2 text-left font-semibold text-mute">
                  {DAYS[d]}
                </th>
                {row.map((count, h) => (
                  <td
                    key={h}
                    className={`h-6 rounded-sm ${count ? "" : "bg-pavement"} ${
                      hovered?.day === d && hovered.hour === h ? "outline-2 outline-ink" : ""
                    }`}
                    style={count ? { backgroundColor: COLOR, opacity: 0.15 + 0.85 * (count / max) } : undefined}
                    onPointerEnter={() => setHovered({ day: d, hour: h })}
                  >
                    <span className="sr-only">
                      {DAYS[d]} {h}:00, {count} activities
                    </span>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="num mt-2 h-5 text-sm text-mute" aria-live="polite">
        {hovered
          ? `${DAYS[hovered.day]} ${String(hovered.hour).padStart(2, "0")}:00–${String(hovered.hour + 1).padStart(2, "0")}:00 · ${value} ${
              value === 1 ? "activity" : "activities"
            }`
          : "Hover a square for its count."}
      </p>
    </div>
  );
}
