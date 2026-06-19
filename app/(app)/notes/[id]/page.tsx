import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isNoteRow, decodeNote } from "@/lib/notes";
import { NoteEditor } from "@/components/NoteEditor";

export const dynamic = "force-dynamic";

export default async function NotePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data } = await supabase.from("tasks").select("id, description").eq("id", id).maybeSingle();
  if (!data || !isNoteRow(data.description as string | null)) notFound();
  const note = decodeNote(data.id as string, data.description as string);
  return <NoteEditor id={note.id} initial={note.body} />;
}
