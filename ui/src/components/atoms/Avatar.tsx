import { useState } from "react";

export interface AvatarProps {
  src?: string | null | undefined;
  /** Used for the fallback initials and the image's accessible name. */
  name: string;
  className?: string;
}

function initials(name: string): string {
  const letters = name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0]!.toUpperCase());
  return letters.length ? letters.slice(0, 2).join("") : "?";
}

// Falls back to initials when there's no photo, or the photo fails to load
// (Strava's default silhouette URL is also a real image, so this only catches actual errors).
// `className` carries both the size and (for the fallback) the initials' font size, so a
// caller asking for a bigger avatar isn't fighting a hardcoded text-sm at equal specificity.
export default function Avatar({ src, name, className = "size-9 text-sm" }: AvatarProps) {
  const [failed, setFailed] = useState(false);

  if (src && !failed) {
    return (
      <img
        src={src}
        alt={name}
        onError={() => setFailed(true)}
        className={`shrink-0 rounded-full object-cover ${className}`}
      />
    );
  }

  return (
    <span
      role="img"
      aria-label={name}
      className={`num flex shrink-0 items-center justify-center rounded-full bg-ink font-bold text-chalk ${className}`}
    >
      {initials(name)}
    </span>
  );
}
