import type { ReactNode } from "react";

export function Card({
  children,
  className = "",
  glow = false,
}: {
  children: ReactNode;
  className?: string;
  glow?: boolean;
}) {
  return (
    <div
      className={`rounded-card border border-hairline bg-gradient-to-b from-white/[0.07] to-white/[0.02] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] transition-all duration-150 active:scale-[0.99] ${glow ? "glow-accent" : ""} ${className}`}
    >
      {children}
    </div>
  );
}
