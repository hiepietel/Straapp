import Button from "../atoms/Button";
import type { ReactNode } from "react";

const TONES = {
  info: "border-line bg-chalk text-ink",
  error: "border-alert/40 bg-white text-alert",
} as const;

export type NoticeTone = keyof typeof TONES;

export interface NoticeProps {
  tone?: NoticeTone;
  children: ReactNode;
  actionLabel?: string;
  onAction?: () => void;
}

export default function Notice({ tone = "info", children, actionLabel, onAction }: NoticeProps) {
  return (
    <div
      role={tone === "error" ? "alert" : "note"}
      className={`flex flex-wrap items-center justify-between gap-3 rounded-lg border px-4 py-3 text-sm ${TONES[tone]}`}
    >
      <p>{children}</p>
      {actionLabel && (
        <Button variant="ghost" onClick={onAction}>
          {actionLabel}
        </Button>
      )}
    </div>
  );
}
