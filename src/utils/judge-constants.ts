/**
 * Shared judge prompt constants.
 *
 * Used by the `jury` tool and `gemini_judge` — previously each carried its own
 * drifting copy of the same four mode instructions.
 *
 * Design notes (why these prompts look the way they do):
 *
 * - NO MODEL PERSONA. The judges used to open "You are Gemini 3 Pro". That name was
 *   stale (the model is 3.1 Pro) and, worse, handing a judge its own vendor identity
 *   invites self-preference bias the moment a same-vendor juror appears. The role is
 *   what matters, so the role is what we state.
 *
 * - ONE reasoning technique, not six. The old gemini_judge prompt stacked
 *   chain-of-thought + first principles + tree-of-thoughts + adversarial check +
 *   self-consistency + extract-before-synthesizing. Competing directives get a shallow
 *   gesture at each rather than depth in one. Decomposition is the technique that
 *   actually fits synthesis (find the sub-claims, then adjudicate each), so it is the
 *   one we keep, with an adversarial pass folded into the final step.
 *
 * - NO FAKE SELF-CONSISTENCY. The old prompt asked "if you arrived at this verdict 3
 *   different ways, would you get the same answer?" Self-consistency requires SAMPLING
 *   the judge repeatedly and comparing — a single call can only roleplay it. Dropped.
 *   The real version belongs at the orchestration layer (call the judge N times, compare).
 *
 * - Tree-of-Thoughts is deliberately NOT here. In a jury the jurors ARE the parallel
 *   branches; the judge's job is to prune and merge them, which is the second half of
 *   ToT already. Asking one judge to also generate fresh branches duplicates the panel
 *   at worse diversity. Real ToT lives in the `/tot` skill.
 */

/** Per-mode instruction shared by every judge surface. */
export const JUDGE_MODE_INSTRUCTIONS: Record<string, string> = {
  synthesize: `SYNTHESIS MODE: Merge the best elements of each perspective into one answer.
Do NOT pick a winner. Identify what is uniquely valuable in EACH perspective.
The result must be better than any single input — if it is not, say so.`,

  evaluate: `EVALUATION MODE: Score each perspective 1-10 on:
accuracy, completeness, reasoning quality, actionability, novelty.
Give per-perspective scores with a one-line justification each.
A low score needs a specific defect, not a vague reservation.`,

  rank: `RANKING MODE: Order perspectives strongest to weakest.
For each: rank, key strength, key weakness.
Compare in PAIRS rather than scoring in sequence — sequential scoring anchors on
whatever you read first.`,

  resolve: `CONFLICT RESOLUTION MODE: Find where the perspectives actually disagree.
For each conflict: state the disagreement, weigh the reasoning on both sides,
render a verdict, and give a confidence level (high/medium/low).
A conflict resolved by "both are partly right" needs to say which part of each.`,
};

/**
 * The judging method. Decomposition first, adjudication second, verdict last.
 * Shared by both judges so improvements land in one place.
 */
export const JUDGE_METHOD = `METHOD — work through these in order and show your work:
1. DECOMPOSE the question into the 2-5 sub-claims the perspectives actually turn on.
2. For each sub-claim, note which perspectives support it and on what grounds.
3. Label each sub-claim:
   • AGREED — every perspective supports it
   • CONTESTED — they conflict
   • UNVERIFIED — asserted with no supporting reasoning
4. Resolve the CONTESTED ones on the strength of the reasoning, not the confidence
   of the wording. Longer and more assertive is not more correct.
5. ADVERSARIAL PASS: argue the strongest case AGAINST your leading conclusion.
   Keep it only if it survives.
6. Write the verdict.`;

/**
 * Epistemic limit. A judge reading only peer text cannot verify anything, yet the old
 * prompts graded perspectives on "accuracy" — an instruction to launder consensus into
 * fact. State the limit and give it somewhere honest to put unverifiable claims.
 */
export const JUDGE_EPISTEMIC_LIMIT = `You are reading model-generated text only — no sources, no execution, no ground truth.
You cannot confirm any factual claim. Mark contested facts UNVERIFIED rather than
adopting them. If the perspectives are collectively wrong, or the question is
underspecified, say that instead of manufacturing a consensus.`;

/** Bias controls, stated together so they are not scattered through the prompt. */
export const JUDGE_BIAS_CONTROLS = `Do not favor a perspective for being first, longest, most confident, or most verbose.
Judge the reasoning, never the source.`;

/**
 * FORMAT_INSTRUCTION caps output at "2-4 sections max" with ≤4-line paragraphs — tuned
 * for a CLI skim, and in direct conflict with a judge asked to show a 6-step analysis.
 * Appended AFTER FORMAT_INSTRUCTION so recency favors the exception.
 */
export const JUDGE_FORMAT_EXCEPTION = `FORMAT EXCEPTION (overrides the section cap above): a judge's analysis may use up to
6 sections. Reasoning depth wins over brevity here. The verdict line stays one line.`;
