import type { ReactNode } from "react";

export type StatItemSize = "md" | "lg";

export interface StatItemProps {
  label: string;
  value: ReactNode;
  size?: StatItemSize;
}

// Must be placed inside a <dl>.
export default function StatItem({ label, value, size = "md" }: StatItemProps) {
  return (
    <div>
      <dt className="text-sm text-mute">{label}</dt>
      <dd className={`num font-bold leading-tight ${size === "lg" ? "text-3xl" : "text-xl"}`}>
        {value}
      </dd>
    </div>
  );
}
