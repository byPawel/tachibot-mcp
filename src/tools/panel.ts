/**
 * Tiny fan-out helper for multi-model panel tools (diff_review, plan_critique).
 * Same resilience contract as the jury: a panelist whose call throws (missing
 * key, provider outage) is DROPPED — its error text must never leak into
 * synthesis. Output is stripped so the judge sees plain prose.
 */
import { stripFormatting } from "../utils/format-stripper.js";

export interface Panelist {
  key: string;
  label: string;
  call: (q: string) => Promise<string>;
}

export async function runPanel(
  panelists: Panelist[],
  prompt: string,
): Promise<{ label: string; text: string }[]> {
  const settled = await Promise.all(
    panelists.map(async (p) => {
      try {
        const text = stripFormatting(await p.call(prompt));
        if (text.length === 0) {
          console.error(`[panel] Dropping panelist ${p.label}: empty output`);
          return null;
        }
        return { label: p.label, text };
      } catch (e) {
        console.error(`[panel] Dropping panelist ${p.label}: ${e instanceof Error ? e.message : String(e)}`);
        return null;
      }
    }),
  );
  return settled.filter((r): r is { label: string; text: string } => r !== null);
}
