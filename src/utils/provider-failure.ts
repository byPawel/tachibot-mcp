/**
 * Provider failure detection.
 *
 * Every provider helper in this codebase (callGrok / callOpenAI / callOpenRouter /
 * callGemini) catches its own errors and RETURNS a bracketed marker string instead of
 * throwing. That means try/catch around a provider call is nearly useless: the failure
 * arrives as a normal-looking string return value.
 *
 * Anything that treats a provider result as content — a juror perspective, a panel
 * review, a judge verdict — must run it through here first, or it will happily
 * synthesize "[Gemini error: Too Many Requests]" as though it were an opinion.
 */

const PROVIDER_FAILURE =
  /^\s*\[[^\]]*\b(error|timeout|failed|unavailable|not available|not configured|quota|rate.?limit)\b/i;

export function isProviderFailure(text: string | null | undefined): boolean {
  if (typeof text !== "string" || text.length === 0) return true;
  return PROVIDER_FAILURE.test(text) || /^\s*No response from /i.test(text);
}
