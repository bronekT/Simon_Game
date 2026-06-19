"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { saveNote, deleteNote } from "@/app/(app)/notes/actions";

// Apple-Notes style editor: one big text field, the first line is the title.
// Autosaves as you type (debounced) and flushes on Back — no Save button needed.
export function NoteEditor({ id, initial }: { id: string; initial: string }) {
  const [body, setBody] = useState(initial);
  const [status, setStatus] = useState<"idle" | "saving" | "saved">(initial ? "saved" : "idle");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function onChange(v: string) {
    setBody(v);
    setStatus("saving");
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => void flush(v), 700);
  }
  async function flush(v: string) {
    if (timer.current) clearTimeout(timer.current);
    const fd = new FormData();
    fd.set("id", id);
    fd.set("body", v);
    try {
      await saveNote(fd);
      setStatus("saved");
    } catch {
      setStatus("idle");
    }
  }

  return (
    <main className="flex flex-col gap-3">
      <header className="flex items-center justify-between pt-2">
        <Link href="/notes" onClick={() => void flush(body)} className="text-sm font-medium text-accent">
          ← Notes
        </Link>
        <span className="text-[11px] text-muted">
          {status === "saving" ? "Saving…" : status === "saved" ? "Saved ✓" : ""}
        </span>
        <form action={deleteNote}>
          <input type="hidden" name="id" value={id} />
          <button className="text-sm text-risk active:scale-95">Delete</button>
        </form>
      </header>
      <textarea
        autoFocus
        value={body}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Start typing…  (the first line becomes the title)"
        className="min-h-[68vh] w-full resize-none border-0 bg-transparent px-1 text-[15px] leading-relaxed focus:outline-none focus:ring-0"
      />
    </main>
  );
}
