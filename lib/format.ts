import type { DealStatus } from "./types";

export function money(n: number | null | undefined): string {
  if (n === null || n === undefined) return "—";
  return new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency: "CAD",
    maximumFractionDigits: 0,
  }).format(n);
}

export function shortDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-CA", {
    month: "short",
    day: "numeric",
  });
}

export function dateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-CA", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function titleCase(s: string | null | undefined): string {
  if (!s) return "—";
  return s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

// Map a deal status to one of the four status colors (Section 10).
export function statusTone(
  status: DealStatus,
): "won" | "followup" | "risk" | "task" | "muted" {
  switch (status) {
    case "won":
      return "won";
    case "negotiation":
    case "quoted":
      return "followup";
    case "lost":
    case "dead":
      return "risk";
    case "booked":
    case "met":
      return "task";
    default:
      return "muted";
  }
}
