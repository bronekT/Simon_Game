import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/Card";
import { Mascot } from "@/components/Brand";
import { isNoteRow, decodeNote, type Note } from "@/lib/notes";
import { createNote } from "./actions";

export const dynamic = "force-dynamic";

function when(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime()) || d.getTime() === 0) return "";
  return d.toLocaleDateString("en-CA", { timeZone: "America/Toronto", month: "short", day: "numeric" });
}

export default async function Notes() {
  const supabase = await createClient();
  const { data } = await supabase.from("tasks").select("id, description").limit(500);
  const notes: Note[] = (data ?? [])
    .filter((t) => isNoteRow(t.description as string | null))
    .map((t) => decodeNote(t.id as string, t.description as string))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));

  return (
    <main className="flex flex-col gap-4">
      <header className="flex items-center justify-between pt-2">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Notes</h1>
          <p className="mt-1 text-sm text-muted">Your private scratchpad — ideas, scripts, reminders.</p>
        </div>
        <form action={createNote}>
          <button className="rounded-full bg-accent-grad px-4 py-2 text-sm font-semibold text-bg shadow-[0_6px_18px_-8px_rgba(233,162,59,0.7)] transition active:scale-95">
            + New
          </button>
        </form>
      </header>

      {notes.length === 0 ? (
        <Card className="flex flex-col items-center gap-3 py-10 text-center">
          <Mascot size={92} />
          <p className="max-w-xs text-sm text-muted">No notes yet. Tap <b className="text-accent">+ New</b> to jot down a script, an idea, or a reminder.</p>
        </Card>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {notes.map((n) => (
            <Link
              key={n.id}
              href={`/notes/${n.id}`}
              className="flex min-h-[120px] flex-col rounded-card border border-hairline bg-gradient-to-b from-white/[0.07] to-white/[0.02] p-3.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] transition active:scale-[0.98]"
            >
              <p className="line-clamp-2 text-sm font-semibold">{n.title || "New note"}</p>
              {n.preview && <p className="mt-1 line-clamp-4 flex-1 text-xs leading-relaxed text-muted">{n.preview}</p>}
              <p className="mt-auto pt-2 text-[10px] text-muted">{when(n.updatedAt)}</p>
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}
