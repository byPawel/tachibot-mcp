/**
 * Judge runner — keeps a panel's synthesis alive when Gemini is unavailable.
 *
 * WHY THIS EXISTS. Every panel tool (jury, diff_review, plan_critique, and /council's
 * resolution step) fans out to N models, pays for all N, and then asks Gemini to
 * synthesize. A single Gemini failure at that last step threw away the entire panel —
 * the expensive part had already completed and been billed.
 *
 * WHY NOT JUST FALL BACK TO FLASH. callGemini already retries and degrades Pro -> Flash.
 * That covers a cap specific to the Pro *preview* model. It does NOT cover the common
 * case: quota is billed per KEY, so when the key is exhausted every Gemini tier fails
 * together. Verified Aug 12 2026 — with the key capped, gemini-3.6-flash returned the
 * same RESOURCE_EXHAUSTED as gemini-3.1-pro-preview. Surviving that needs a different
 * provider, which is what this adds.
 *
 * WHY IT ISN'T INSIDE callGemini. A function named callGemini that silently answers as
 * GPT would astonish its other ~10 callers. The cross-provider hop is a judging policy,
 * so it lives with the judges.
 *
 * Escalation order, cheapest-correct first:
 *   1. Gemini (which internally retries, then degrades Pro -> Flash)
 *   2. gpt-5.6-sol at high reasoning effort — different vendor, different quota
 *   3. give up, and let the CALLER decide how to degrade. For a jury that means
 *      returning the raw juror perspectives unsynthesized, which is far more useful
 *      than an error string: the panel already ran and the user already paid for it.
 */

import { callGemini, parseDegradedBanner } from "../tools/gemini-tools.js";
import { callOpenAI } from "../tools/openai-tools.js";
import { OPENAI_MODELS, OPENAI_REASONING, GEMINI_MODELS } from "../config/model-constants.js";
import { isProviderFailure } from "./provider-failure.js";
import { modelFallbackEnabled } from "./fallback-policy.js";

export interface JudgeResult {
  /** Synthesized verdict, or null when every judge was unavailable. */
  text: string | null;
  /** Which model actually produced it — for honest attribution in the output. */
  judge: string | null;
  /** True when a non-preferred judge answered, so callers can say so. */
  degraded: boolean;
}

export async function runJudge(
  prompt: string,
  systemPrompt: string,
  temperature = 0.3,
  maxTokens = 18000,
): Promise<JudgeResult> {
  const gemini = await callGemini(
    prompt,
    GEMINI_MODELS.GEMINI_3_PRO,
    systemPrompt,
    temperature,
    "llm-orchestration",
    maxTokens,
  );
  if (!isProviderFailure(gemini)) {
    // callGemini prefixes a banner naming the model that actually answered when it
    // degraded (Argon -> 3.1 Pro, and/or Pro -> Flash).
    const banner = parseDegradedBanner(gemini);
    return {
      text: gemini,
      judge: banner ? banner.answeredBy : GEMINI_MODELS.GEMINI_3_PRO,
      degraded: banner !== null,
    };
  }

  // TACHI_MODEL_FALLBACK=off: no cross-provider escalation — callers degrade visibly
  if (!modelFallbackEnabled()) {
    console.error(`💀 [Judge] Gemini unavailable and model fallback is off (TACHI_MODEL_FALLBACK)`);
    return { text: null, judge: null, degraded: true };
  }
  console.error(`🔻 [Judge] Gemini unavailable, escalating to ${OPENAI_MODELS.SOL}`);
  const openai = await callOpenAI(
    [
      { role: "system", content: systemPrompt },
      { role: "user", content: prompt },
    ],
    OPENAI_MODELS.SOL,
    temperature,
    maxTokens,
    OPENAI_REASONING.HIGH,
  );
  if (!isProviderFailure(openai)) {
    return { text: openai, judge: OPENAI_MODELS.SOL, degraded: true };
  }

  console.error(`💀 [Judge] All judges unavailable — caller must degrade`);
  return { text: null, judge: null, degraded: true };
}

/** Banner for a verdict produced by anything other than the preferred judge. */
export function judgeAttribution(result: JudgeResult): string {
  if (!result.degraded || !result.judge) return "";
  return `[judge degraded: synthesized by ${result.judge}]\n`;
}
