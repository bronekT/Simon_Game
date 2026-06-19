import { z } from "zod";
import { getAnthropic, MODELS, responseText, extractJson } from "./anthropic";
import { companyKnowledge, COMPANY } from "../knowledge/company";

// On-demand deep coaching: a long, detailed breakdown of one appointment.
// Uses the FULL transcript (only run when the user taps "generate", for cost).
export async function generateDeepCoaching(transcript: string): Promise<string> {
  const anthropic = getAnthropic();
  const message = await anthropic.messages.create({
    model: MODELS.write,
    max_tokens: 2600,
    system:
      `${companyKnowledge()}\n\n` +
      `You are an elite door-sales coach reviewing ONE appointment transcript for ${COMPANY.rep} (the salesperson, "Me" in the transcript). Produce a DETAILED, specific, practical breakdown. Use clear section headers (plain text, no markdown symbols like # or *) and short lines. Cover, in this order:

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

// ============================================================================
// AGGREGATE coach: analyzes the WHOLE history (all analyzed calls) and returns a
// warm, concrete, Russian-language report — progress over time, what helps you
// close, recurring mistakes, ready phrases, techniques and product angles.
// Re-runs only when there's new history (cached by the caller).
// ============================================================================

const looseStr = z.preprocess((v) => (v == null ? "" : String(v)), z.string());
const looseArr = z.preprocess(
  (v) => (Array.isArray(v) ? v.filter((x) => x != null).map(String) : v == null || v === "" ? [] : [String(v)]),
  z.array(z.string()),
);
const pairArr = z.preprocess(
  (v) => (Array.isArray(v) ? v : []),
  z.array(
    z.object({
      when: looseStr.optional(),
      say: looseStr.optional(),
      name: looseStr.optional(),
      how: looseStr.optional(),
    }),
  ),
);

export const CoachReportSchema = z.object({
  progress: looseStr.default(""),
  strengths: looseArr.default([]),
  improve: looseArr.default([]),
  phrases: pairArr.default([]),
  tricks: pairArr.default([]),
  product_tips: looseArr.default([]),
});
export type CoachReport = z.infer<typeof CoachReportSchema>;

const AGGREGATE_SYSTEM = `Ты — личный тренер по продажам для продавца, который
продаёт и устанавливает ДВЕРИ (входные, патио, французские, раздвижные, гаражные и
т.д.) в Онтарио, Канада. Тебе дают СВОДКУ по истории его встреч и звонков: оценки
навыков по 10-балльной шкале, что прошло хорошо/плохо, возражения, итоги
(выиграл/проиграл) и динамику во времени.

Проанализируй ВСЮ историю целиком (закономерности по многим встречам, а не одну) и
дай тёплый, конкретный, практичный разбор СТРОГО НА РУССКОМ ЯЗЫКЕ — так, чтобы
человеку было легко и приятно учиться. Замечай ПРОГРЕСС (что улучшилось или
просело со временем), что именно помогает ему ЗАКРЫВАТЬ, и повторяющиеся ошибки.
Используй знание продукта (двери, материалы, опции) — давай продуктовые фишки и
точные фразы, которые усиливают аргументацию и помогают дожимать сделку.

Верни ТОЛЬКО JSON (без markdown, без кода, без пояснений вокруг):
{
  "progress": "2–3 предложения о динамике: что стало лучше/хуже со временем",
  "strengths": ["до 4 сильных сторон, которые помогают закрывать"],
  "improve": ["до 4 повторяющихся ошибок / над чем работать"],
  "phrases": [{"when":"ситуация (коротко)","say":"точная фраза слово в слово"}],
  "tricks": [{"name":"название техники","how":"как применять в его случае (1 предложение)"}],
  "product_tips": ["до 3 фишек по дверям/продукту, которые помогут закрывать"]
}
БУДЬ КРАТОК: каждый пункт — ОДНО короткое предложение. Не больше: strengths 4,
improve 4, phrases 4, tricks 3, product_tips 3. Без воды и общих фраз — всё
конкретно и применимо. Только русский. Обязательно заверши JSON корректно.`;

export async function generateCoachReport(brief: string): Promise<CoachReport | null> {
  if (!process.env.ANTHROPIC_API_KEY) return null;
  try {
    const anthropic = getAnthropic();
    const msg = await anthropic.messages.create({
      model: MODELS.write,
      max_tokens: 2600,
      system: `${companyKnowledge()}\n\n${AGGREGATE_SYSTEM}`,
      messages: [{ role: "user", content: brief }],
    });
    const json = extractJson(responseText(msg));
    if (!json) return null;
    const parsed = CoachReportSchema.safeParse(JSON.parse(json));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

export interface CoachAppt {
  occurred_at: string | null;
  record_type: string | null;
  summary: string | null;
  scores: Record<string, number | null>;
  outcome: string | null;
  what_went_well: string | null;
  what_went_wrong: string | null;
  top_objection: string | null;
}

// Compact history brief for the model (newest → oldest, capped).
export function buildCoachBrief(appts: CoachAppt[], wins: number, losses: number): string {
  const recent = [...appts].slice(-30).reverse();
  const rows = recent.map((a) => ({
    date: a.occurred_at ? a.occurred_at.slice(0, 10) : null,
    type: a.record_type,
    scores: a.scores,
    outcome: a.outcome,
    summary: (a.summary ?? "").slice(0, 220),
    well: (a.what_went_well ?? "").slice(0, 200),
    wrong: (a.what_went_wrong ?? "").slice(0, 200),
    objection: (a.top_objection ?? "").slice(0, 120),
  }));
  return JSON.stringify(
    {
      total_calls: appts.length,
      wins,
      losses,
      note: "rows ниже от НОВЫХ к СТАРЫМ — сравни недавние с ранними, чтобы увидеть прогресс",
      rows,
    },
    null,
    1,
  );
}

