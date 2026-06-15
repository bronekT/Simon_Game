import Link from "next/link";
import { createDeal } from "./actions";
import {
  DOOR_TYPES,
  DOOR_LABELS,
  LEAD_SOURCES,
  DEAL_STATUSES,
  LOCATION_TYPES,
} from "@/lib/types";
import { titleCase } from "@/lib/format";

export default function NewDeal() {
  return (
    <main className="flex flex-col gap-5">
      <header className="pt-2">
        <Link href="/deals" className="text-sm text-accent">
          ← Deals
        </Link>
        <h1 className="mt-2 text-2xl font-semibold">New deal</h1>
      </header>

      <form action={createDeal} className="flex flex-col gap-4">
        <Field label="Client name *">
          <input
            name="client_name"
            required
            placeholder="e.g. John Smith"
            className="w-full px-3 py-2.5"
          />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Door type">
            <select name="door_type" defaultValue="" className="w-full px-3 py-2.5">
              <option value="">—</option>
              {DOOR_TYPES.map((d) => (
                <option key={d} value={d}>{DOOR_LABELS[d]}</option>
              ))}
            </select>
          </Field>
          <Field label="How many doors">
            <input
              name="door_count"
              type="number"
              inputMode="numeric"
              min="1"
              step="1"
              placeholder="e.g. 2"
              className="w-full px-3 py-2.5"
            />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Status">
            <Select name="status" options={DEAL_STATUSES} defaultValue="new" />
          </Field>
          <Field label="Location">
            <Select name="location_type" options={LOCATION_TYPES} placeholder="—" />
          </Field>
        </div>

        <Field label="Lead source">
          <Select name="lead_source" options={LEAD_SOURCES} placeholder="—" />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Quote price (CAD)">
            <input
              name="quote_price"
              type="number"
              inputMode="decimal"
              min="0"
              step="1"
              placeholder="0"
              className="w-full px-3 py-2.5"
            />
          </Field>
          <Field label="Probability (%)">
            <input
              name="probability"
              type="number"
              inputMode="numeric"
              min="0"
              max="100"
              placeholder="0"
              className="w-full px-3 py-2.5"
            />
          </Field>
        </div>

        <Field label="Next action">
          <input
            name="next_action"
            placeholder="e.g. Send revised quote"
            className="w-full px-3 py-2.5"
          />
        </Field>

        <Field label="Follow up at">
          <input
            name="followup_at"
            type="datetime-local"
            className="w-full px-3 py-2.5"
          />
        </Field>

        <Field label="Phone">
          <input name="phone" type="tel" placeholder="(optional)" className="w-full px-3 py-2.5" />
        </Field>
        <Field label="Email">
          <input name="email" type="email" placeholder="(optional)" className="w-full px-3 py-2.5" />
        </Field>
        <Field label="Address">
          <input name="address" placeholder="(optional)" className="w-full px-3 py-2.5" />
        </Field>

        <div className="mt-2 flex gap-3">
          <button
            type="submit"
            className="flex-1 rounded-full bg-accent py-3 font-medium text-bg"
          >
            Save deal
          </button>
          <Link
            href="/deals"
            className="rounded-full border border-hairline px-5 py-3 text-center font-medium text-muted"
          >
            Cancel
          </Link>
        </div>
      </form>
    </main>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-sm text-muted">{label}</span>
      {children}
    </label>
  );
}

function Select({
  name,
  options,
  defaultValue,
  placeholder,
}: {
  name: string;
  options: readonly string[];
  defaultValue?: string;
  placeholder?: string;
}) {
  return (
    <select name={name} defaultValue={defaultValue ?? ""} className="w-full px-3 py-2.5">
      {placeholder !== undefined && <option value="">{placeholder}</option>}
      {options.map((o) => (
        <option key={o} value={o}>
          {titleCase(o)}
        </option>
      ))}
    </select>
  );
}
