import type { ReactNode } from "react";

export interface DashboardTemplateProps {
  header: ReactNode;
  notice?: ReactNode;
  summary?: ReactNode;
  filters?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
}

// Page layout only: decides where things go, knows nothing about data.
export default function DashboardTemplate({
  header,
  notice,
  summary,
  filters,
  children,
  footer,
}: DashboardTemplateProps) {
  return (
    <div className="mx-auto max-w-6xl px-4 pb-16 sm:px-6">
      {header}
      {notice && <div className="mt-4">{notice}</div>}
      <div className="mt-6">{summary}</div>
      <div className="mt-6">{filters}</div>
      <main className="mt-6">{children}</main>
      {footer && <div className="mt-10 flex justify-center">{footer}</div>}
    </div>
  );
}
