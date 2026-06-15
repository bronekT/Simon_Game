// Shared domain types. These mirror the SQL enums/tables in
// supabase/migrations/0001_init.sql. Kept hand-written and small for Phase 0;
// later we can generate full types from the database if useful.

export type ServiceType =
  | "roofing" | "doors" | "windows" | "siding" | "insulation" | "other";

export type LeadSource =
  | "company_lead" | "referral" | "self_generated" | "repeat" | "cold_call";

export type DealStatus =
  | "new" | "booked" | "met" | "quoted" | "negotiation" | "won" | "lost" | "dead";

export type LocationType = "home" | "showroom" | "phone" | "virtual";

// The business sells doors — these are the door types it quotes.
export type DoorType =
  | "entry" | "patio" | "storm" | "french" | "sliding"
  | "garage" | "interior" | "bifold" | "screen" | "other";

export interface Deal {
  id: string;
  user_id: string;
  created_at: string;
  updated_at: string;
  client_name: string;
  address: string | null;
  phone: string | null;
  email: string | null;
  service_type: ServiceType | null;
  door_type: DoorType | null;
  door_count: number | null;
  lead_source: LeadSource | null;
  status: DealStatus;
  location_type: LocationType | null;
  quote_price: number | null;
  cost: number | null;
  min_price: number | null;
  gross_profit: number | null;
  discount_room: number | null;
  probability: number | null;
  decision_maker: string | null;
  competitor: string | null;
  main_objection: string | null;
  next_action: string | null;
  followup_at: string | null;
  followup_sent_at: string | null;
}

// Fields the user can set when creating/editing a deal by hand.
export type DealInput = Pick<
  Deal,
  | "client_name" | "address" | "phone" | "email"
  | "door_type" | "door_count" | "lead_source" | "status" | "location_type"
  | "quote_price" | "probability" | "next_action" | "followup_at"
>;

export const SERVICE_TYPES: ServiceType[] = [
  "roofing", "doors", "windows", "siding", "insulation", "other",
];
export const LEAD_SOURCES: LeadSource[] = [
  "company_lead", "referral", "self_generated", "repeat", "cold_call",
];
export const DEAL_STATUSES: DealStatus[] = [
  "new", "booked", "met", "quoted", "negotiation", "won", "lost", "dead",
];
export const LOCATION_TYPES: LocationType[] = [
  "home", "showroom", "phone", "virtual",
];

export const DOOR_TYPES: DoorType[] = [
  "entry", "patio", "storm", "french", "sliding",
  "garage", "interior", "bifold", "screen", "other",
];

export const DOOR_LABELS: Record<DoorType, string> = {
  entry: "Entry / front",
  patio: "Patio",
  storm: "Storm",
  french: "French",
  sliding: "Sliding",
  garage: "Garage",
  interior: "Interior",
  bifold: "Bifold",
  screen: "Screen",
  other: "Other",
};

// Statuses considered "open pipeline" (not yet closed/dead).
export const OPEN_STATUSES: DealStatus[] = [
  "new", "booked", "met", "quoted", "negotiation",
];

// What the client is after, in one line: "3× Patio doors".
export function doorWant(
  type: DoorType | null,
  count: number | null,
): string | null {
  if (!type && !count) return null;
  const noun = type ? `${DOOR_LABELS[type]} doors` : "doors";
  return count ? `${count}× ${noun}` : noun;
}

// Per-client engagement signals derived from the deal record.
export interface Engagement {
  booked: boolean;
  met: boolean;
  quoted: boolean;
  followupSent: boolean;
}
export function engagement(d: {
  status: DealStatus;
  quote_price: number | null;
  followup_sent_at: string | null;
}): Engagement {
  const met = ["met", "quoted", "negotiation", "won", "lost"].includes(d.status);
  return {
    booked: d.status === "booked",
    met,
    quoted: d.quote_price != null || ["quoted", "negotiation", "won"].includes(d.status),
    followupSent: Boolean(d.followup_sent_at),
  };
}
