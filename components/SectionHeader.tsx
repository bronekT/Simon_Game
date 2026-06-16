import type { ReactNode } from "react";

// One consistent section header across the app: small, uppercase, muted.
export function SectionHeader({
  title,
  count,
  action,
}: {
  title: string;
  count?: number;
  action?: ReactNode;
}) {
  return (
    <div className="flex items-center justify-between">
      <h2 className="text-xs font-semibold uppercase tracking-wide text-muted">
        {title}
        {count != null && <span className="ml-1.5 text-muted/60">{count}</span>}
      </h2>
      {action}
    </div>
  );
}
