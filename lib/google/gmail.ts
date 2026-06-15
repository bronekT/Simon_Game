import { google, gmail_v1 } from "googleapis";
import type { OAuth2Client } from "google-auth-library";

export interface InboxTranscript {
  messageId: string;
  text: string;
}

// Reads unprocessed transcript emails from a Gmail label (default "CLOSER").
// This is how Plaud → Zapier → inbox transcripts arrive (SPEC.md Section 6.1).
export async function readLabelTranscripts(
  auth: OAuth2Client,
  labelName: string,
  max = 10,
): Promise<{ items: InboxTranscript[]; labelId: string | null }> {
  const gmail = google.gmail({ version: "v1", auth });

  const labelId = await findLabelId(gmail, labelName);
  if (!labelId) return { items: [], labelId: null };

  const list = await gmail.users.messages.list({
    userId: "me",
    labelIds: [labelId],
    maxResults: max,
  });

  const items: InboxTranscript[] = [];
  for (const m of list.data.messages ?? []) {
    if (!m.id) continue;
    const msg = await gmail.users.messages.get({ userId: "me", id: m.id, format: "full" });
    const text = extractPlainText(msg.data) || msg.data.snippet || "";
    if (text.trim().length > 0) items.push({ messageId: m.id, text });
  }
  return { items, labelId };
}

// After processing, remove the label so the message isn't ingested again.
export async function markProcessed(
  auth: OAuth2Client,
  messageId: string,
  labelId: string,
): Promise<void> {
  const gmail = google.gmail({ version: "v1", auth });
  await gmail.users.messages.modify({
    userId: "me",
    id: messageId,
    requestBody: { removeLabelIds: [labelId] },
  });
}

async function findLabelId(
  gmail: gmail_v1.Gmail,
  name: string,
): Promise<string | null> {
  const res = await gmail.users.labels.list({ userId: "me" });
  const match = (res.data.labels ?? []).find(
    (l) => l.name?.toLowerCase() === name.toLowerCase(),
  );
  return match?.id ?? null;
}

function extractPlainText(msg: gmail_v1.Schema$Message): string {
  const parts: gmail_v1.Schema$MessagePart[] = [];
  const walk = (p?: gmail_v1.Schema$MessagePart) => {
    if (!p) return;
    parts.push(p);
    (p.parts ?? []).forEach(walk);
  };
  walk(msg.payload ?? undefined);

  const plain = parts.find((p) => p.mimeType === "text/plain" && p.body?.data);
  const target = plain ?? parts.find((p) => p.body?.data);
  if (!target?.body?.data) return "";
  return decodeB64Url(target.body.data);
}

function decodeB64Url(data: string): string {
  return Buffer.from(data.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf-8");
}
