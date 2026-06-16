import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SubmitButton } from "@/components/SubmitButton";
import { updateDeal } from "./actions";
import {
  DOOR_TYPES, DOOR_LABELS, DEAL_STATUSES, LOCATION_TYPES, type Deal,
} from "@/lib/types";
import { titleCase } from "@/lib/format";

export const dynamic = "force-dynamic";

function toLocal(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

export default async function EditDeal({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data } = await supabase.from("deals").select("*").eq("id", id).maybeSingle();
  if (!data) notFound();
  const d = data as Deal;

  return (
    <main className="flex flex-col gap-5">
      <header className="pt-2">
        <Link href={`/deals/${id}`} className="text-sm text-accent">← Back</Link>
        <h1 className="mt-2 text-2xl font-semibold">Edit deal</h1>
      </header>

      <form action={updateDeal} className="flex flex-col gap-4">
        <input type="hidden" name="id" value={id} />

        <Field label="Client name">
          <input name="client_name" defaultValue={d.client_name ?? ""} className="w-full px-3 py-2.5" />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Door type">
            <select name="door_type" defaultValue={d.door_type ?? ""} className="w-full px-3 py-2.5">
              <option value="">—</option>
              {DOOR_TYPES.map((t) => <option key={t} value={t}>{DOOR_LABELS[t]}</option>)}
            </select>
          </Field>
          <Field label="How many doors">
            <input name="door_count" type="number" min="1" defaultValue={d.door_count ?? ""} className="w-full px-3 py-2.5" />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Status">
            <select name="status" defaultValue={d.status} className="w-full px-3 py-2.5">
              {DEAL_STATUSES.map((s) => <option key={s} value={s}>{titleCase(s)}</option>)}
            </select>
          </Field>
          <Field label="Location">
            <select name="location_type" defaultValue={d.location_type ?? ""} className="w-full px-3 py-2.5">
              <option value="">—</option>
              {LOCATION_TYPES.map((l) => <option key={l} value={l}>{titleCase(l)}</option>)}
            </select>
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Quote price (CAD)">
            <input name="quote_price" type="number" min="0" defaultValue={d.quote_price ?? ""} className="w-full px-3 py-2.5" />
          </Field>
          <Field label="Probability (%)">
            <input name="probability" type="number" min="0" max="100" defaultValue={d.probability ?? ""} className="w-full px-3 py-2.5" />
          </Field>
        </div>

        <Field label="Next action">
          <input name="next_action" defaultValue={d.next_action ?? ""} className="w-full px-3 py-2.5" />
        </Field>
        <Field label="Follow up at">
          <input name="followup_at" type="datetime-local" defaultValue={toLocal(d.followup_at)} className="w-full px-3 py-2.5" />
        </Field>

        <Field label="Phone"><input name="phone" defaultValue={d.phone ?? ""} className="w-full px-3 py-2.5" /></Field>
        <Field label="Email"><input name="email" defaultValue={d.email ?? ""} className="w-full px-3 py-2.5" /></Field>
        <Field label="Address"><input name="address" defaultValue={d.address ?? ""} className="w-full px-3 py-2.5" /></Field>
        <Field label="Decision maker"><input name="decision_maker" defaultValue={d.decision_maker ?? ""} className="w-full px-3 py-2.5" /></Field>
        <Field label="Competitor"><input name="competitor" defaultValue={d.competitor ?? ""} className="w-full px-3 py-2.5" /></Field>
        <Field label="Main objection"><input name="main_objection" defaultValue={d.main_objection ?? ""} className="w-full px-3 py-2.5" /></Field>

        <div className="mt-1 flex items-stretch gap-3">
          <div className="flex-1">
            <SubmitButton pendingLabel="Saving…">Save changes</SubmitButton>
          </div>
          <Link href={`/deals/${id}`} className="rounded-full border border-hairline px-5 py-3 text-center font-medium text-muted">
            Cancel
          </Link>
        </div>
      </form>
    </main>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-sm text-muted">{label}</span>
      {children}
    </label>
  );
}
