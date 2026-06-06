import type { ReactNode } from "react";

export function Card({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-card border border-hairline bg-white/[0.02] p-4 ${className}`}
    >
      {children}
    </div>
  );
}
