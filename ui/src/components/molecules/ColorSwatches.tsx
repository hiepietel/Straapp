import { ROUTE_COLORS } from "../../utils/mapStyles";

export interface ColorSwatchesProps {
  value: string;
  onChange: (color: string) => void;
  /** Names the group for screen readers. */
  label?: string;
}

const SWATCH = "size-6 shrink-0 rounded-full border border-black/20 transition-shadow";
const SELECTED = "ring-2 ring-ink ring-offset-2 ring-offset-chalk";

// The preset line colours, plus the browser's own picker for any other.
export default function ColorSwatches({ value, onChange, label = "Route colour" }: ColorSwatchesProps) {
  const isPreset = ROUTE_COLORS.some((c) => c.value === value.toLowerCase());

  return (
    <div role="group" aria-label={label} className="flex flex-wrap items-center gap-2">
      {ROUTE_COLORS.map((c) => (
        <button
          key={c.value}
          type="button"
          title={c.label}
          aria-label={c.label}
          aria-pressed={value.toLowerCase() === c.value}
          onClick={() => onChange(c.value)}
          className={`${SWATCH} ${value.toLowerCase() === c.value ? SELECTED : ""}`}
          style={{ backgroundColor: c.value }}
        />
      ))}
      {/* Any other colour: the native picker, drawn as one more swatch. */}
      <label
        title="Custom colour"
        className={`${SWATCH} relative cursor-pointer overflow-hidden ${isPreset ? "" : SELECTED}`}
        style={{
          background: isPreset ? "conic-gradient(#f44, #fd4, #4d4, #4dd, #44f, #d4d, #f44)" : value,
        }}
      >
        <span className="sr-only">Custom colour</span>
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="absolute inset-0 size-full cursor-pointer opacity-0"
        />
      </label>
    </div>
  );
}
