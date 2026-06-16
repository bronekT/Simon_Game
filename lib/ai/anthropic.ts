import Anthropic from "@anthropic-ai/sdk";

// Server-only. The key never reaches the browser (SPEC.md Section 2).
export function getAnthropic(): Anthropic {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error(
      "ANTHROPIC_API_KEY is not set. Add it to .env.local (and to Vercel) — see README.",
    );
  }
  return new Anthropic({ apiKey });
}

// Model IDs (verified current against the Anthropic docs — SPEC.md Section 2).
// Sonnet for extraction too — accuracy on names/dates matters more than the
// small extra cost (a few cents per transcript).
export const MODELS = {
  extract: "claude-sonnet-4-6",
  write: "claude-sonnet-4-6",
} as const;

// Pull the concatenated text out of a Messages API response.
export function responseText(message: Anthropic.Message): string {
  return message.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("");
}

// Models sometimes wrap JSON in prose or ```code fences```. Pull out the first
// balanced JSON object so JSON.parse has a clean string to work with.
export function extractJson(raw: string): string | null {
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1] : raw;
  const start = candidate.indexOf("{");
  if (start === -1) return null;

  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < candidate.length; i++) {
    const ch = candidate[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === "\\") escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') inString = true;
    else if (ch === "{") depth++;
    else if (ch === "}") {
      depth--;
      if (depth === 0) return candidate.slice(start, i + 1);
    }
  }
  return null;
}
