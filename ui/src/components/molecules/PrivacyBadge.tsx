import { Lock } from "lucide-react";

// Only rendered for private activities — the common (public) case needs no badge at all.
export default function PrivacyBadge() {
  return (
    <span className="inline-flex items-center gap-1 text-sm font-medium text-mute">
      <Lock className="size-3.5" aria-hidden="true" />
      Private
    </span>
  );
}
