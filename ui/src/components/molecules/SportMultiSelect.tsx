import PillMultiSelect from "./PillMultiSelect";
import type { SportGroupId } from "../../utils/sports";

export interface SportOption {
  id: SportGroupId;
  label: string;
}

export interface SportMultiSelectProps {
  options: readonly SportOption[];
  /** An empty set means "every type" — that's what the "All" pill selects. */
  value: ReadonlySet<SportGroupId>;
  onChange: (value: ReadonlySet<SportGroupId>) => void;
}

export default function SportMultiSelect({ options, value, onChange }: SportMultiSelectProps) {
  return (
    <PillMultiSelect options={options} value={value} onChange={onChange} label="Filter statistics by activity type" />
  );
}
