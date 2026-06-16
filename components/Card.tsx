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
      className={`rounded-card border border-hairline bg-white/[0.05] p-4 transition-transform duration-150 active:scale-[0.99] ${className}`}
    >
      {children}
    </div>
  );
}
