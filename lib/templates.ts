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

// ── Ready-to-send follow-up templates, by PURPOSE ─────────────────────────────
// Deterministic (no AI), name pre-filled. These give a quick menu of standard
// follow-ups — pick the purpose, the text is ready. Always available.
export interface FollowupTemplate {
  key: string;
  label: string; // the purpose shown on the card
  subject?: string; // email only
  body: string;
}

function firstName(name: string | null | undefined): string {
  const n = (name ?? "").trim().split(/\s+/)[0];
  return n || "there";
}

export function smsTemplates(opts: {
  name: string | null;
  showroomAddress: string | null;
  address: string | null;
}): FollowupTemplate[] {
  const n = firstName(opts.name);
  const rep = COMPANY.rep.split(/\s+/)[0]; // "Tony"
  const showroom = opts.showroomAddress ?? "our showroom";
  return [
    {
      key: "checkin",
      label: "Gentle check-in",
      body: `Hi ${n}, it's ${rep} from ${COMPANY.name}. Just checking in on your door project — happy to answer any questions whenever you're ready. 🙂`,
    },
    {
      key: "showroom_invite",
      label: "Showroom invite",
      body: `Hi ${n}, ${rep} here from ${COMPANY.name}. If you'd like to see and feel the door options in person, come by ${showroom} any time — I can walk you through styles, glass and finishes. When works for you?`,
    },
    {
      key: "discount",
      label: "Discount / promo",
      body: `Hi ${n}, quick one — we've got a promo running right now. If we lock in your door this week I can hold a 5% discount for you. Want me to set it aside?`,
    },
    {
      key: "financing",
      label: "Financing",
      body: `Hi ${n}, just so you know we offer flexible financing on our doors — you can spread it into easy monthly payments. Want me to send the options over?`,
    },
    {
      key: "last_chance",
      label: "Last chance",
      body: `Hi ${n}, I'm about to release the quote I put together for you. Want me to hold it a few more days, or should we go ahead and book the install?`,
    },
  ];
}

export function emailTemplates(opts: {
  name: string | null;
  showroomAddress: string | null;
  signature: string | null;
}): FollowupTemplate[] {
  const n = firstName(opts.name);
  const sig = opts.signature ?? `${COMPANY.rep}\n${COMPANY.name}\n${COMPANY.phone}`;
  const showroom = opts.showroomAddress ?? "our showroom";
  return [
    {
      key: "checkin",
      label: "Gentle check-in",
      subject: "Following up on your new door",
      body: `Hi ${n},\n\nJust following up on your door project — I wanted to make sure you have everything you need to move forward. Happy to answer any questions, tweak the options, or take a fresh look at pricing.\n\nWhat would you like to do next?\n\n${sig}`,
    },
    {
      key: "showroom_invite",
      label: "Showroom invite",
      subject: "Come see your door options in person",
      body: `Hi ${n},\n\nIf you'd like to see and feel the options in person before deciding, you're welcome to visit ${showroom}. I can walk you through styles, glass, hardware and finishes so you can choose with confidence.\n\nWhen would be a good time for you?\n\n${sig}`,
    },
    {
      key: "discount",
      label: "Discount / promo",
      subject: "A little something to help you decide",
      body: `Hi ${n},\n\nWe've got a promotion running at the moment — if we lock in your door this week I can hold a 5% discount for you. It's a great time to get the project moving before lead times stretch out.\n\nWant me to set it aside?\n\n${sig}`,
    },
    {
      key: "last_chance",
      label: "Last chance",
      subject: "Should I hold your quote?",
      body: `Hi ${n},\n\nI'm about to release the quote I put together for you. I'd love to get your new door underway — would you like me to hold the pricing a few more days, or should we go ahead and book the install?\n\nEither way, just let me know.\n\n${sig}`,
    },
  ];
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
