import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/Card";
import { addTask, toggleTask, deleteTask, pushTaskToCalendar } from "./actions";
import { shortDate, titleCase } from "@/lib/format";
import { isNoteRow } from "@/lib/notes";
import { googleConfigured } from "@/lib/google/oauth";

export const dynamic = "force-dynamic";

interface Task {
  id: string;
  type: string | null;
  description: string | null;
  due_at: string | null;
  done: boolean;
  calendar_event_id: string | null;
}

export default async function Tasks() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("tasks")
    .select("id, type, description, due_at, done, calendar_event_id")
    .order("due_at", { ascending: true, nullsFirst: false });
  const tasks = (data ?? []).filter((t) => !isNoteRow(t.description as string | null)) as Task[];

  // Upcoming follow-ups from deals (agenda), next 5.
  const { data: followups } = await supabase
    .from("deals")
    .select("id, client_name, followup_at")
    .not("followup_at", "is", null)
    .order("followup_at", { ascending: true })
    .limit(5);

  const open = tasks.filter((t) => !t.done);
  const done = tasks.filter((t) => t.done);

  const now = new Date();
  const isToday = (iso: string | null) =>
    iso && new Date(iso).toDateString() === now.toDateString();
  const isOverdue = (iso: string | null) => iso && new Date(iso) < now && !isToday(iso);

  const today = open.filter((t) => isToday(t.due_at) || isOverdue(t.due_at));
  const upcoming = open.filter((t) => t.due_at && !isToday(t.due_at) && !isOverdue(t.due_at));
  const someday = open.filter((t) => !t.due_at);

  return (
    <main className="flex flex-col gap-5">
      <header className="pt-2">
        <h1 className="text-2xl font-semibold">Today&apos;s plan</h1>
        <p className="mt-1 text-sm text-muted">Checklist + agenda. Tasks sync one-way to Google Calendar.</p>
      </header>

      {/* Add task */}
      <Card>
        <form action={addTask} className="flex flex-col gap-3">
          <input name="description" placeholder="Add a task…" className="w-full px-3 py-2.5" />
          <div className="grid grid-cols-2 gap-3">
            <select name="type" defaultValue="other" className="w-full px-3 py-2.5 text-sm">
              {["call", "send", "visit", "followup", "other"].map((t) => (
                <option key={t} value={t}>{titleCase(t)}</option>
              ))}
            </select>
            <input name="due_at" type="datetime-local" className="w-full px-3 py-2.5 text-sm" />
          </div>
          <button className="rounded-full bg-accent py-2.5 text-sm font-medium text-bg">Add</button>
        </form>
      </Card>

      {/* Agenda — upcoming follow-ups */}
      {(followups ?? []).length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="text-sm font-semibold text-muted">Upcoming follow-ups</h2>
          {(followups ?? []).map((f) => (
            <Link key={f.id} href={`/deals/${f.id}`}>
              <Card className="active:bg-white/[0.05]">
                <div className="flex items-center justify-between">
                  <span className="text-sm">{f.client_name}</span>
                  <span className="text-xs text-followup">{shortDate(f.followup_at)}</span>
                </div>
              </Card>
            </Link>
          ))}
        </section>
      )}

      <TaskGroup title="Today / overdue" tasks={today} />
      <TaskGroup title="Upcoming" tasks={upcoming} />
      <TaskGroup title="Someday" tasks={someday} />

      {done.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="text-sm font-semibold text-muted">Done</h2>
          {done.map((t) => (
            <TaskRow key={t.id} task={t} />
          ))}
        </section>
      )}

      {open.length === 0 && done.length === 0 && (
        <Card><p className="text-sm text-muted">No tasks yet. Add one above.</p></Card>
      )}
    </main>
  );
}

function TaskGroup({ title, tasks }: { title: string; tasks: Task[] }) {
  if (tasks.length === 0) return null;
  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-sm font-semibold text-muted">{title}</h2>
      {tasks.map((t) => (
        <TaskRow key={t.id} task={t} />
      ))}
    </section>
  );
}

function TaskRow({ task }: { task: Task }) {
  return (
    <Card>
      <div className="flex items-start gap-3">
        <form action={toggleTask}>
          <input type="hidden" name="id" value={task.id} />
          <input type="hidden" name="done" value={String(task.done)} />
          <button
            aria-label="Toggle done"
            className={`mt-0.5 flex h-5 w-5 items-center justify-center rounded-full border ${
              task.done ? "border-won bg-won/20 text-won" : "border-hairline text-transparent"
            }`}
          >
            ✓
          </button>
        </form>

        <div className="min-w-0 flex-1">
          <p className={`text-sm ${task.done ? "text-muted line-through" : ""}`}>
            {task.description}
          </p>
          <div className="mt-1 flex items-center gap-2 text-xs text-muted">
            <span>{titleCase(task.type)}</span>
            {task.due_at && <span className="text-followup">· {shortDate(task.due_at)}</span>}
            {task.calendar_event_id && <span className="text-won">· on calendar</span>}
          </div>
        </div>

        <div className="flex shrink-0 flex-col items-end gap-1">
          {task.due_at && !task.calendar_event_id && googleConfigured() && (
            <form action={pushTaskToCalendar}>
              <input type="hidden" name="id" value={task.id} />
              <button className="rounded-full border border-hairline px-2 py-0.5 text-xs text-task">
                → Calendar
              </button>
            </form>
          )}
          <form action={deleteTask}>
            <input type="hidden" name="id" value={task.id} />
            <button className="text-xs text-muted">Delete</button>
          </form>
        </div>
      </div>
    </Card>
  );
}
