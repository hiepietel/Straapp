export interface SpinnerProps {
  label?: string;
}

export default function Spinner({ label = "Loading" }: SpinnerProps) {
  return (
    <span role="status" className="inline-flex items-center gap-2 text-mute">
      <svg
        className="size-5 animate-spin motion-reduce:animate-none"
        viewBox="0 0 24 24"
        fill="none"
        aria-hidden="true"
      >
        <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3" />
        <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
      </svg>
      <span className="text-sm">{label}</span>
    </span>
  );
}
