import { getAnthropic, MODELS, responseText } from "./anthropic";
import { companyKnowledge } from "../knowledge/company";

// On-demand deep coaching: a long, detailed breakdown of one appointment.
// Uses the FULL transcript (only run when the user taps "generate", for cost).
export async function generateDeepCoaching(transcript: string): Promise<string> {
  const anthropic = getAnthropic();
  const message = await anthropic.messages.create({
    model: MODELS.write,
    max_tokens: 2600,
    system:
      `${companyKnowledge()}\n\n` +
      `You are an elite door-sales coach reviewing ONE appointment transcript for ${"Tony"} (the salesperson, "Me" in the transcript). Produce a DETAILED, specific, practical breakdown. Use clear section headers (plain text, no markdown symbols like # or *) and short lines. Cover, in this order:

1) WHAT WENT WELL — concrete moments, quote what was actually said.
2) WHAT WENT WRONG / MISSED — specific mistakes or missed opportunities.
3) KEY MOMENTS — for the most important 3–5 moments: what was said vs. exactly what to say instead (give the real words), and the technique it uses.
4) WHAT NOT TO DO — habits to drop.
5) NEXT MOVE TO CLOSE — the single best next step for THIS customer to win the deal (a concrete script).

Be direct, encouraging, and specific to the doors business. No fluff.`,
    messages: [{ role: "user", content: `TRANSCRIPT:\n"""\n${transcript}\n"""` }],
  });
  return responseText(message).trim();
}
