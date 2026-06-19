// Personal notes, Apple-Notes style. Stored as tagged rows in the existing
// `tasks` table (no schema change): the description holds a tagged JSON blob with
// the note text + last-edited time. The first line is the title.

export const NOTE_TAG = "§note§";

export interface Note {
  id: string;
  title: string;
  preview: string;
  body: string;
  updatedAt: string;
}

export function encodeNote(body: string): string {
  return NOTE_TAG + JSON.stringify({ x: body, u: new Date().toISOString() });
}

export function isNoteRow(description: string | null | undefined): boolean {
  return typeof description === "string" && description.startsWith(NOTE_TAG);
}

export function decodeNote(id: string, description: string): Note {
  let body = "";
  let u = new Date(0).toISOString();
  try {
    const o = JSON.parse(description.slice(NOTE_TAG.length));
    body = String(o.x ?? "");
    u = String(o.u ?? u);
  } catch {
    /* corrupt — treat as empty */
  }
  const lines = body.split("\n").map((l) => l.trim());
  const nonEmpty = lines.filter(Boolean);
  const title = (nonEmpty[0] ?? "New note").slice(0, 80);
  const preview = (nonEmpty.slice(1).join(" ") || (nonEmpty[0] ? "" : "Empty note")).slice(0, 140);
  return { id, title, preview, body, updatedAt: u };
}
