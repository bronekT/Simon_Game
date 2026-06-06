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
}

// Fields the user can set when creating/editing a deal by hand (Phase 0).
export type DealInput = Pick<
  Deal,
  | "client_name" | "address" | "phone" | "email"
  | "service_type" | "lead_source" | "status" | "location_type"
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

// Statuses considered "open pipeline" (not yet closed/dead).
export const OPEN_STATUSES: DealStatus[] = [
  "new", "booked", "met", "quoted", "negotiation",
];
