import { getAnthropic, MODELS, responseText } from "./anthropic";

const SUPPORTED = ["image/png", "image/jpeg", "image/webp", "image/gif"];

export function isSupportedImage(mediaType: string): boolean {
  return SUPPORTED.includes(mediaType);
}

// Turn a screenshot (a text/WhatsApp/email conversation, a quote, etc.) into a
// plain-text "transcript" the normal pipeline can analyze. This lets the user
// drop a screenshot into a deal and have the AI act on it (book a meeting,
// update the follow-up, etc.).
export async function imageToTranscript(
  base64: string,
  mediaType: string,
): Promise<string> {
  const anthropic = getAnthropic();
  const message = await anthropic.messages.create({
    model: MODELS.extract,
    max_tokens: 1500,
    system:
      "You convert a screenshot from a door salesperson into plain text the rest of the system can analyze. The image is usually a text/WhatsApp/email conversation with a customer, a quote, or a note. Transcribe it faithfully: label turns as 'Customer:' and 'Me:' when it's a conversation; preserve dates, times, meeting requests, door types/quantities, prices, names, and addresses. If it isn't a conversation, briefly describe the sales-relevant content. Output ONLY the transcription/description — no commentary.",
    messages: [
      {
        role: "user",
        content: [
          { type: "image", source: { type: "base64", media_type: mediaType as "image/png", data: base64 } },
          { type: "text", text: "Transcribe this screenshot for our sales system." },
        ],
      },
    ],
  });
  return responseText(message).trim();
}
