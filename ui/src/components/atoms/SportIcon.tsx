import { GROUPS } from "../../utils/sports";
import type { SportGroupId } from "../../utils/sports";

export interface SportIconProps {
  group: SportGroupId;
  className?: string;
}

export default function SportIcon({ group, className = "size-4" }: SportIconProps) {
  const Icon = (GROUPS[group] ?? GROUPS.other).icon;
  return <Icon className={className} aria-hidden="true" />;
}
