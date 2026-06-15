import { google } from "googleapis";
import type { OAuth2Client } from "google-auth-library";
import type { SupabaseClient } from "@supabase/supabase-js";
import { authedClientForUser } from "./oauth";

export type PushResult =
  | { ok: true; externalId: string }
  | { ok: false; error: string };

// SPEC.md Section 6 step 7. Pushes a single approved action to Google:
// email -> Gmail drafts.create (a DRAFT, never a send); calendar_event ->
// Calendar events.insert. Idempotent: if external_id is already set we no-op,
// and Calendar events use a deterministic id so a retry can't duplicate.
export async function pushAction(
  supabase: SupabaseClient,
  action: {
    id: string;
    kind: string;
    payload: Record<string, unknown>;
    external_id: string | null;
    idempotency_key: string;
  },
): Promise<PushResult> {
  if (action.external_id) {
    return { ok: true, externalId: action.external_id };
  }

  const auth = await authedClientForUser(supabase);
  if (!auth) {
    return { ok: false, error: "Google is not connected. Connect it in Settings." };
  }

  try {
    if (action.kind === "email") {
      const id = await createGmailDraft(auth, action.payload);
      return { ok: true, externalId: id };
    }
    if (action.kind === "calendar_event") {
      const id = await insertCalendarEvent(auth, action.payload, action.idempotency_key);
      return { ok: true, externalId: id };
    }
    // SMS never goes to Google — approve = ready to send from the phone.
    return { ok: false, error: "SMS is sent from your phone (use Copy / Open in Messages)." };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

async function createGmailDraft(
  auth: OAuth2Client,
  payload: Record<string, unknown>,
): Promise<string> {
  const gmail = google.gmail({ version: "v1", auth });
  const to = str(payload.to);
  const subject = str(payload.subject);
  const body = str(payload.body);

  const raw = toBase64Url(
    [
      to ? `To: ${to}` : "",
      `Subject: ${encodeHeader(subject)}`,
      "Content-Type: text/plain; charset=UTF-8",
      "MIME-Version: 1.0",
      "",
      body,
    ]
      .filter((l, i) => l !== "" || i > 0)
      .join("\r\n"),
  );

  const res = await gmail.users.drafts.create({
    userId: "me",
    requestBody: { message: { raw } },
  });
  return res.data.id ?? "";
}

async function insertCalendarEvent(
  auth: OAuth2Client,
  payload: Record<string, unknown>,
  idempotencyKey: string,
): Promise<string> {
  const calendar = google.calendar({ version: "v3", auth });
  const start = str(payload.start);
  const startDate = start ? new Date(start) : new Date();
  const end = new Date(startDate.getTime() + 60 * 60 * 1000); // default 1h

  try {
    const res = await calendar.events.insert({
      calendarId: "primary",
      requestBody: {
        id: sanitizeEventId(idempotencyKey),
        summary: str(payload.title),
        location: str(payload.location),
        description: str(payload.notes),
        start: { dateTime: startDate.toISOString() },
        end: { dateTime: end.toISOString() },
        reminders: { useDefault: true },
      },
    });
    return res.data.id ?? sanitizeEventId(idempotencyKey);
  } catch (e) {
    // 409 = the deterministic id already exists → treat as success (idempotent).
    if (typeof e === "object" && e && "code" in e && (e as { code?: number }).code === 409) {
      return sanitizeEventId(idempotencyKey);
    }
    throw e;
  }
}

// Google Calendar event ids must be base32hex (a-v, 0-9), length 5–1024.
function sanitizeEventId(key: string): string {
  const cleaned = key.toLowerCase().replace(/[^a-v0-9]/g, "0");
  return `closer${cleaned}`.slice(0, 1024);
}

function toBase64Url(s: string): string {
  return Buffer.from(s, "utf-8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function encodeHeader(s: string): string {
  // RFC 2047 encode non-ASCII subject lines.
  // eslint-disable-next-line no-control-regex
  return /[^\x00-\x7F]/.test(s)
    ? `=?UTF-8?B?${Buffer.from(s, "utf-8").toString("base64")}?=`
    : s;
}

function str(v: unknown): string {
  return typeof v === "string" ? v : "";
}
