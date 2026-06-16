"use server";

import { after } from "next/server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { ingestTranscript, analyzeAppointment } from "@/lib/pipeline";
import { imageToTranscript, isSupportedImage } from "@/lib/ai/vision";

interface FilePayload {
  isImage: boolean;
  base64: string;
  mediaType: string;
  text: string;
}

// Capture runs in the BACKGROUND: we save the transcript instantly, send the
// user straight back, and do the slow AI work after the response. Results show
// up in Deals / To-approve a few seconds later.
export async function processTranscript(form: FormData) {
  const typed = String(form.get("transcript") ?? "").trim();
  const attachRaw = String(form.get("deal_id") ?? "").trim();
  const attachDealId = attachRaw === "" ? null : attachRaw;
  const backTo = String(form.get("back_to") ?? "/capture");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const userId = user.id;

  // Read any uploaded file's bytes now (the request stream is gone after we return).
  let filePayload: FilePayload | null = null;
  const file = form.get("file");
  if (file && file instanceof File && file.size > 0) {
    const mediaType = file.type || "application/octet-stream";
    if (isSupportedImage(mediaType)) {
      filePayload = {
        isImage: true,
        base64: Buffer.from(await file.arrayBuffer()).toString("base64"),
        mediaType,
        text: "",
      };
    } else {
      filePayload = { isImage: false, base64: "", mediaType, text: (await file.text()).trim() };
    }
  }

  if (typed.length < 20 && !filePayload) {
    redirect(`${backTo}?error=${encodeURIComponent("Add a transcript, paste text, or attach a screenshot/file.")}`);
  }

  // Save immediately (placeholder text if it's an attachment we still need to read).
  const placeholder = typed || "(reading attachment…)";
  const appointmentId = await ingestTranscript(supabase, userId, placeholder, attachDealId, "manual");
  if (!appointmentId) {
    redirect(`${backTo}?error=${encodeURIComponent("Could not save — please try again.")}`);
  }

  // Heavy work runs after the response is sent.
  after(async () => {
    const admin = createAdminClient();
    try {
      let transcript = typed;
      if (filePayload) {
        if (filePayload.isImage) {
          transcript = await imageToTranscript(filePayload.base64, filePayload.mediaType);
        } else {
          transcript = typed ? `${typed}\n\n${filePayload.text}` : filePayload.text;
        }
        await admin.from("appointments").update({ transcript }).eq("id", appointmentId);
      }
      await analyzeAppointment(admin, userId, appointmentId!);
    } catch {
      await admin.from("appointments").update({ needs_review: true }).eq("id", appointmentId!);
    }
  });

  revalidatePath("/");
  revalidatePath("/deals");
  revalidatePath("/approve");
  redirect(`${backTo}?processing=1`);
}
