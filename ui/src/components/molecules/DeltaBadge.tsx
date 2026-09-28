import { ArrowDownRight, ArrowRight, ArrowUpRight } from "lucide-react";
import { change } from "../../utils/periodStats";

export interface DeltaBadgeProps {
  current: number;
  previous: number;
}

// Up and down aren't "good" or "bad" here (a rest week is fine), so the change is shown
// in ink with an arrow and a sign rather than in green/red.
export default function DeltaBadge({ current, previous }: DeltaBadgeProps) {
  const value = change(current, previous);
  if (value === null) return <span className="text-sm text-mute">{current > 0 ? "new" : "—"}</span>;

  const pct = Math.round(value * 100);
  const Icon = pct > 0 ? ArrowUpRight : pct < 0 ? ArrowDownRight : ArrowRight;
  const sign = pct > 0 ? "+" : pct < 0 ? "−" : "±";

  return (
    <span className="num inline-flex items-center gap-0.5 text-sm font-semibold">
      <Icon className="size-4" aria-hidden="true" />
      {sign}
      {Math.abs(pct)}%
    </span>
  );
}
