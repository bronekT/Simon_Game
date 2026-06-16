"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { pushCalendar } from "@/lib/google/push";
import { fromLocalInput } from "@/lib/format";

function str(form: FormData, key: string): string | null {
  const v = form.get(key);
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t === "" ? null : t;
}

export async function addTask(form: FormData) {
  const description = str(form, "description");
  if (!description) return;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  await supabase.from("tasks").insert({
    user_id: user.id,
    type: str(form, "type") ?? "other",
    description,
    due_at: fromLocalInput(str(form, "due_at")),
    deal_id: str(form, "deal_id"),
  });
  revalidatePath("/tasks");
}

export async function toggleTask(form: FormData) {
  const id = String(form.get("id") ?? "");
  const done = String(form.get("done") ?? "") === "true";
  if (!id) return;
  const supabase = await createClient();
  await supabase.from("tasks").update({ done: !done }).eq("id", id);
  revalidatePath("/tasks");
}

export async function deleteTask(form: FormData) {
  const id = String(form.get("id") ?? "");
  if (!id) return;
  const supabase = await createClient();
  await supabase.from("tasks").delete().eq("id", id);
  revalidatePath("/tasks");
}

// One-way push of a task to Google Calendar (Phase 4).
export async function pushTaskToCalendar(form: FormData) {
  const id = String(form.get("id") ?? "");
  if (!id) return;
  const supabase = await createClient();
  const { data: task } = await supabase
    .from("tasks")
    .select("id, description, due_at, calendar_event_id")
    .eq("id", id)
    .maybeSingle();
  if (!task?.due_at || task.calendar_event_id) {
    revalidatePath("/tasks");
    return;
  }

  const result = await pushCalendar(supabase, {
    title: (task.description as string) ?? "Task",
    start: task.due_at as string,
    idempotencyKey: `task-${id}`,
  });
  if (result.ok) {
    await supabase.from("tasks").update({ calendar_event_id: result.externalId }).eq("id", id);
  }
  revalidatePath("/tasks");
}
