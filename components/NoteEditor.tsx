"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { saveNote, deleteNote } from "@/app/(app)/notes/actions";

// Apple-Notes style: a big bold Title, then the note body. Autosaves as you type
// (debounced) and flushes on Back — no Save button needed.
export function NoteEditor({ id, initial }: { id: string; initial: string }) {
  const nl = initial.indexOf("\n");
  const [title, setTitle] = useState(nl === -1 ? initial : initial.slice(0, nl));
  const [body, setBody] = useState(nl === -1 ? "" : initial.slice(nl + 1));
  const [status, setStatus] = useState<"idle" | "saving" | "saved">(initial ? "saved" : "idle");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function schedule(nextTitle: string, nextBody: string) {
    setStatus("saving");
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => void flush(nextTitle, nextBody), 700);
  }
  async function flush(t = title, b = body) {
    if (timer.current) clearTimeout(timer.current);
    const fd = new FormData();
    fd.set("id", id);
    fd.set("body", b.trim() ? `${t}\n${b}` : t);
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
        <Link href="/notes" onClick={() => void flush()} className="text-sm font-medium text-accent">
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

      <input
        autoFocus={!title}
        value={title}
        onChange={(e) => {
          setTitle(e.target.value);
          schedule(e.target.value, body);
        }}
        placeholder="Title"
        className="w-full border-0 bg-transparent px-1 text-2xl font-bold tracking-tight placeholder:text-muted/60 focus:outline-none focus:ring-0"
      />
      <textarea
        value={body}
        onChange={(e) => {
          setBody(e.target.value);
          schedule(title, e.target.value);
        }}
        placeholder="Start writing…"
        className="min-h-[62vh] w-full resize-none border-0 bg-transparent px-1 text-[16px] leading-relaxed placeholder:text-muted/60 focus:outline-none focus:ring-0"
      />
    </main>
  );
}
