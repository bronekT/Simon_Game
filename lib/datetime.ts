import { torontoOffset, TZ } from "./format";

// ============================================================================
// Bulletproof date/time resolution.
// The AI only TRANSCRIBES the spoken time into atomic parts (weekday, this/next,
// month/day, hour, minute, am/pm). This file turns those parts into an exact
// instant — deterministically, anchored to "now" in America/Toronto. No AI date
// arithmetic, so the weekday can never silently drift.
// ============================================================================

export interface WhenParts {
  weekday: string | null; // "monday".."sunday"
  relative: string | null; // "today" | "tomorrow"
  qualifier: string | null; // "this" | "next"
  month: number | null; // 1-12
  day: number | null; // 1-31
  hour: number | null; // 1-12 or 0-23
  minute: number | null;
  meridiem: string | null; // "am" | "pm"
}

const WD: Record<string, number> = {
  sunday: 0, monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5, saturday: 6,
};

interface YMD { y: number; m: number; d: number; wd: number }

function torontoYMD(date: Date): YMD {
  const p: Record<string, string> = {};
  for (const part of new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit", weekday: "short",
  }).formatToParts(date)) p[part.type] = part.value;
  const wdMap: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  return { y: +p.year, m: +p.month, d: +p.day, wd: wdMap[p.weekday] ?? 0 };
}

// Add whole days to a Toronto Y/M/D and return the new Y/M/D (DST-safe: we step
// at noon UTC, far from any DST boundary, then re-read the Toronto date).
function addDays(base: YMD, n: number): YMD {
  const t = Date.UTC(base.y, base.m - 1, base.d, 12, 0, 0) + n * 86_400_000;
  return torontoYMD(new Date(t));
}

function torontoHourMinute(date: Date): { h: number; min: number } {
  const p: Record<string, string> = {};
  for (const part of new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ, hour: "2-digit", minute: "2-digit", hour12: false,
  }).formatToParts(date)) p[part.type] = part.value;
  const h = p.hour === "24" ? 0 : +p.hour;
  return { h, min: +p.minute };
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

// Build a correct ISO (with the Toronto offset for that calendar day).
function buildIso(t: YMD, hh: number, mm: number): string {
  const offset = torontoOffset(new Date(`${t.y}-${pad(t.m)}-${pad(t.d)}T12:00:00Z`));
  return `${t.y}-${pad(t.m)}-${pad(t.d)}T${pad(hh)}:${pad(mm)}:00${offset}`;
}

// Normalize an hour + am/pm into 24h.
function to24h(hour: number, meridiem: string | null): number {
  const mer = (meridiem ?? "").toLowerCase();
  let h = hour;
  if (mer.startsWith("p")) {
    if (h < 12) h += 12;
  } else if (mer.startsWith("a")) {
    if (h === 12) h = 0;
  } else if (h >= 1 && h <= 7) {
    // No am/pm and a small hour: door visits are afternoon/evening → assume PM.
    h += 12;
  }
  return Math.max(0, Math.min(23, h));
}

/**
 * Resolve atomic time parts into an exact ISO instant in Toronto, or null.
 * Deterministic: a named weekday always lands on that weekday.
 */
export function resolveWhen(when: WhenParts | null | undefined, base: Date = new Date()): string | null {
  if (!when) return null;

  const today = torontoYMD(base);
  const hasTime = when.hour != null && Number.isFinite(when.hour);
  const hh = hasTime ? to24h(when.hour as number, when.meridiem) : 10; // default 10:00 if only a day
  const mm = when.minute != null && Number.isFinite(when.minute) ? (when.minute as number) : 0;

  const rel = (when.relative ?? "").toLowerCase();
  const qualifier = (when.qualifier ?? "").toLowerCase();
  const weekdayKey = (when.weekday ?? "").toLowerCase().trim();

  let target: YMD | null = null;

  if (when.month && when.day) {
    // Explicit calendar date (assume current year; roll to next year if already past).
    target = { y: today.y, m: when.month, d: when.day, wd: 0 };
    target = torontoYMD(new Date(`${target.y}-${pad(target.m)}-${pad(target.d)}T12:00:00Z`));
    const todayMs = Date.UTC(today.y, today.m - 1, today.d);
    const tgtMs = Date.UTC(target.y, target.m - 1, target.d);
    if (tgtMs < todayMs) target = addDays(target, 0), (target.y += 1);
  } else if (rel.includes("today")) {
    target = today;
  } else if (rel.includes("tomorrow")) {
    target = addDays(today, 1);
  } else if (weekdayKey in WD) {
    const tw = WD[weekdayKey];
    let daysUntil = (tw - today.wd + 7) % 7;
    if (daysUntil === 0) {
      // Same weekday as today: keep today only if the time is still ahead.
      const nowHM = torontoHourMinute(base);
      const ahead = hasTime && (hh > nowHM.h || (hh === nowHM.h && mm > nowHM.min));
      daysUntil = ahead ? 0 : 7;
    }
    if (qualifier === "next") daysUntil += 7;
    target = addDays(today, daysUntil);
  } else {
    return null; // no usable day info
  }

  if (!target) return null;

  const iso = buildIso(target, hh, mm);

  // Validation: the resolved weekday MUST match the requested weekday.
  if (weekdayKey in WD) {
    const got = torontoYMD(new Date(iso)).wd;
    if (got !== WD[weekdayKey]) return null; // never return a wrong weekday
  }
  return iso;
}
