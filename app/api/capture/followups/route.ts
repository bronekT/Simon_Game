import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { produceFollowups } from "@/lib/followups";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Step 2 of capture: generate polished follow-ups + detailed coaching for a deal.
// Run separately from extraction (one AI call here) so it always fits in 60s,
// regardless of how long the meeting was. The client fires this in the background
// after the deal is created.
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ ok: false, error: "Not signed in." }, { status: 401 });

  let dealId = "";
  try {
    const body = await request.json();
    dealId = String(body.dealId ?? "").trim();
  } catch {
    /* no body */
  }
  if (!dealId) return NextResponse.json({ ok: false, error: "Missing dealId." }, { status: 400 });

  const result = await produceFollowups(createAdminClient(), user.id, dealId);
  return NextResponse.json(result);
}
