import SportIcon from "../atoms/SportIcon";
import type { SportGroupId } from "../../utils/sports";

export interface SportBadgeProps {
  group: SportGroupId;
  label: string;
}

export default function SportBadge({ group, label }: SportBadgeProps) {
  return (
    <span className="inline-flex items-center gap-1.5 text-sm font-medium text-mute">
      <SportIcon group={group} />
      {label}
    </span>
  );
}
