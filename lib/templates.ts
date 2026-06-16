import { COMPANY } from "./knowledge/company";
import { dateTime } from "./format";
import { doorWant, type DoorType } from "./types";

// Beautiful, structured booking confirmations (with emoji) — deterministic so
// they always look right. Used for booking_call captures.
export function bookingConfirmation(opts: {
  name: string | null;
  startIso: string | null;
  locationType: string | null;
  address: string | null;
  showroomAddress: string | null;
}): string {
  const name = opts.name ?? "there";
  const when = opts.startIso ? dateTime(opts.startIso) : "your appointment time";
  const sig = `— ${COMPANY.rep}\n${COMPANY.name}\n📞 ${COMPANY.phone}`;

  if (opts.locationType === "showroom") {
    const addr = opts.showroomAddress ?? "our showroom";
    return [
      `Hi ${name} 👋`,
      ``,
      `Thank you for booking your appointment with ${COMPANY.name}! 🚪`,
      ``,
      `To make the most of our visit:`,
      `📸 Take a few photos of your current door`,
      `📏 Measure brick-to-brick roughly (inside & outside)`,
      ``,
      `📅 ${when}`,
      `📍 ${addr}`,
      `🅿️ Parking on site`,
      ``,
      `See you there!`,
      ``,
      sig,
    ].join("\n");
  }

  // Home visit (default)
  const addr = opts.address ?? "your place";
  return [
    `Hi ${name} 👋`,
    ``,
    `Thank you for booking! I'll come by to measure and walk you through door options. 🚪`,
    ``,
    `To get started:`,
    `📸 A few photos of your current door help`,
    `🚪 Please make sure I can reach the doorway`,
    ``,
    `📅 ${when}`,
    `📍 ${addr}`,
    ``,
    `See you then!`,
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
