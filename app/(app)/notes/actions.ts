"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { encodeNote } from "@/lib/notes";

export async function createNote() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data } = await supabase
    .from("tasks")
    .insert({ user_id: user.id, type: "other", description: encodeNote(""), done: false })
    .select("id")
    .single();
  redirect(`/notes/${data!.id}`);
}

export async function saveNote(form: FormData) {
  const id = String(form.get("id") ?? "");
  const body = String(form.get("body") ?? "");
  if (!id) return;
  const supabase = await createClient();
  await supabase.from("tasks").update({ description: encodeNote(body) }).eq("id", id);
  revalidatePath("/notes");
  revalidatePath(`/notes/${id}`);
}

export async function deleteNote(form: FormData) {
  const id = String(form.get("id") ?? "");
  if (!id) return;
  const supabase = await createClient();
  await supabase.from("tasks").delete().eq("id", id);
  revalidatePath("/notes");
  redirect("/notes");
}
