/**
 * Model fallback policy — one place that decides WHETHER a provider helper may answer
 * with a different model than the one requested, and HOW that is disclosed.
 *
 * Two rules:
 *   1. Never silent. A fallback answer starts with
 *        [degraded: <requested> unavailable — <reason>; answered by <actual>]
 *      so the caller can see a model was swapped and why. (isProviderFailure treats this
 *      banner as success; gemini-tools' parseDegradedBanner reads the actual model.)
 *   2. Opt-out. TACHI_MODEL_FALLBACK=off returns the original model's error instead —
 *      for users who would rather fail than silently get a cheaper/other model billed.
 *
 * Billing failures (no credits / insufficient_quota / 402) never fall back: another model
 * bills the same account, so a swap only hides the real problem.
 */

/** TACHI_MODEL_FALLBACK=off|false|0|no disables every model swap. Read per call. */
export function modelFallbackEnabled(): boolean {
  return !/^(off|false|0|no|disabled?)$/i.test(process.env.TACHI_MODEL_FALLBACK?.trim() ?? "");
}

/** Out of credits / billing — switching model can't fix it. */
export function isBillingFailure(text: string, status?: number): boolean {
  return status === 402 || /insufficient_quota|insufficient credits|out of credits|credit balance|billing|payment required/i.test(text);
}

/** Short human reason for a failed attempt — what goes into the banner and error. */
export function describeFailure(text: string, status?: number): string {
  if (isBillingFailure(text, status)) return "out of credits / billing (top up the provider account)";
  if (status === 401 || /invalid api key|unauthori[sz]ed|api key not valid/i.test(text)) return "invalid API key";
  if (status === 404 || /not found|no endpoints found|does not exist|not supported/i.test(text)) return "model not available (retired, renamed or not routed)";
  if (status === 403 || /permission|insufficient permissions|not available in your region|access/i.test(text)) return "no access to this model for this key/region";
  if (status === 429 || /rate.?limit|quota|resource.?exhausted|too many requests|FreeTierOnly/i.test(text)) return "rate-limited / quota exhausted";
  if (/timeout|timed out|exceeded \d+/i.test(text)) return "timed out";
  if ((status !== undefined && status >= 500) || /overloaded|unavailable|internal error/i.test(text)) return "provider overloaded / server error";
  if (/incomplete|max_output_tokens|budget/i.test(text)) return "reasoning used the whole output budget";
  return "request failed";
}

/** The disclosure banner. Reason must not contain "]" (the parser stops there). */
export function degradedBanner(requested: string, answeredBy: string, reason: string): string {
  return `[degraded: ${requested} unavailable — ${reason.replace(/[\]\n]/g, " ")}; answered by ${answeredBy}]\n\n`;
}
