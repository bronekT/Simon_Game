import { COMPANY } from "./knowledge/company";
import { dateTime, TZ } from "./format";
import { doorWant, type DoorType } from "./types";

// Time-of-day greeting in the business timezone (changes morning/afternoon/eve).
function greeting(): string {
  const hour = Number(
    new Intl.DateTimeFormat("en-US", { timeZone: TZ, hour: "2-digit", hour12: false })
      .format(new Date()),
  );
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

// Booking confirmation in the style you send — dynamic greeting, name, and
// day/date/time, signed off. Deterministic so it always reads cleanly.
export function bookingConfirmation(opts: {
  name: string | null;
  startIso: string | null;
  locationType: string | null;
  address: string | null;
  showroomAddress: string | null;
}): string {
  const name = opts.name ?? "there";
  const when = opts.startIso ? dateTime(opts.startIso) : "the time we agreed";
  const sig = `${COMPANY.rep}\n${COMPANY.name}\n${COMPANY.phone}`;

  if (opts.locationType === "showroom") {
    const addr = opts.showroomAddress ?? "our showroom";
    return [
      `${greeting()} ${name},`,
      ``,
      `Thank you for booking your showroom appointment with ${COMPANY.name}! We look forward to helping you find the perfect door.`,
      ``,
      `🗓️ ${when}`,
      `📍 ${addr}`,
      ``,
      `To make the most of your visit, it helps to bring a few photos of your current door and a rough brick-to-brick measurement (inside & outside).`,
      ``,
      `See you then! Reply here if anything changes.`,
      ``,
      sig,
    ].join("\n");
  }

  // Home visit (default)
  const addr = opts.address ?? "your address";
  return [
    `${greeting()} ${name},`,
    ``,
    `Thank you for booking! I'll come by to measure and walk you through your door options.`,
    ``,
    `🗓️ ${when}`,
    `📍 ${addr}`,
    ``,
    `If you can, please make sure I'll have access to the doorway. A couple of photos of the current door ahead of time are a bonus.`,
    ``,
    `See you then! Reply here if anything changes.`,
    ``,
    sig,
  ].join("\n");
}

// A rich Google Calendar event description (door details + a quick checklist).
export function eventDescription(opts: {
  summary: string | null;
  doorType: string | null;
  doorCount: number | null;
  address: string | null;
  locationType: string | null;
}): string {
  const lines: string[] = [];
  const want = doorWant(opts.doorType as DoorType | null, opts.doorCount);
  if (want) lines.push(`🚪 ${want}`);
  if (opts.summary) lines.push(opts.summary);
  if (opts.address) lines.push(`📍 ${opts.address}`);
  lines.push("");
  lines.push("Checklist:");
  lines.push("• Bring door samples & finishes");
  lines.push("• Measure brick-to-brick (inside & outside)");
  lines.push("• Confirm material, glass & hardware");
  lines.push("");
  lines.push(`— ${COMPANY.rep}, ${COMPANY.name}`);
  return lines.join("\n");
}
