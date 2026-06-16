import type { DealStatus } from "./types";

// The business operates in Ontario. ALL date/time display + the datetime-local
// inputs are anchored to this zone so a "5 PM" stays 5 PM (not shifted to the
// server's UTC). This is the single source of truth for time handling.
export const TZ = "America/Toronto";

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
    timeZone: TZ,
    month: "short",
    day: "numeric",
  });
}

export function dateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-CA", {
    timeZone: TZ,
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

// Toronto UTC offset for a given instant, e.g. "-04:00" (EDT) / "-05:00" (EST).
export function torontoOffset(d: Date = new Date()): string {
  const name =
    new Intl.DateTimeFormat("en-US", { timeZone: TZ, timeZoneName: "shortOffset" })
      .formatToParts(d)
      .find((p) => p.type === "timeZoneName")?.value ?? "GMT-4";
  const m = name.match(/GMT([+-])(\d{1,2})(?::?(\d{2}))?/);
  if (!m) return "-04:00";
  return `${m[1]}${m[2].padStart(2, "0")}:${m[3] ?? "00"}`;
}

// ISO instant → value for a <input type="datetime-local"> shown in Toronto.
export function toLocalInput(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const p: Record<string, string> = {};
  for (const part of new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hour12: false,
  }).formatToParts(d)) {
    p[part.type] = part.value;
  }
  const hh = p.hour === "24" ? "00" : p.hour; // guard against 24:00
  return `${p.year}-${p.month}-${p.day}T${hh}:${p.minute}`;
}

// A datetime-local value (Toronto wall-clock) → a correct UTC ISO string.
export function fromLocalInput(value: string | null | undefined): string | null {
  if (!value) return null;
  const offset = torontoOffset(new Date(`${value}:00Z`));
  const d = new Date(`${value}:00${offset}`);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
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
