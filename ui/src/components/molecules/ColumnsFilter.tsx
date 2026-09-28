import { MAX_COLUMNS, MIN_COLUMNS } from "../../hooks/useColumnCount";

const OPTIONS = Array.from(
  { length: MAX_COLUMNS - MIN_COLUMNS + 1 },
  (_, i) => MIN_COLUMNS + i
);

export interface ColumnsFilterProps {
  value: number;
  onChange: (value: number) => void;
}

export default function ColumnsFilter({ value, onChange }: ColumnsFilterProps) {
  return (
    <div className="flex items-center gap-2" role="group" aria-label="Activities per row">
      <span className="text-sm text-mute">Per row</span>
      <div className="flex gap-1">
        {OPTIONS.map((n) => {
          const active = n === value;
          return (
            <button
              key={n}
              type="button"
              aria-pressed={active}
              onClick={() => onChange(n)}
              className={`num size-8 rounded-full text-sm font-semibold transition-colors ${
                active ? "bg-ink text-chalk" : "bg-chalk text-ink hover:bg-white border border-line"
              }`}
            >
              {n}
            </button>
          );
        })}
      </div>
    </div>
  );
}
