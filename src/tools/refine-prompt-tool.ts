/**
 * refine_prompt — OPT-IN, transparent prompt improver. Raw query → goal-first
 * brief. NEVER executes anything downstream and NEVER auto-fires: the caller
 * looks at the diff (WHAT CHANGED) and decides. Runs on the cheap tier —
 * sharpening the ask is not a flagship job. Guardrails encode why a mandatory
 * improver was rejected: no silent reinterpretation (ambiguity → OPEN
 * QUESTIONS), no invented requirements, and no reasoning-instruction injection
 * ("think step by step" etc.) — modern models reason natively.
 */
import { z } from "zod";
import { defineModelTool } from "./factory/define-model-tool.js";
import { callOpenAI } from "./openai-tools.js";
import { OPENAI_MODELS } from "../config/model-constants.js";
import { FORMAT_INSTRUCTION } from "../utils/format-constants.js";
import { withHeartbeat } from "../utils/streaming-helper.js";

export function buildRefinePrompt(args: {
  query: string;
  goal?: string;
  context?: string;
}): { system: string; user: string } {
  const system = `You are a prompt refiner. Restructure the user's raw query into a goal-first brief that any strong model can act on. You sharpen the ASK — you do not solve it and you do not change what is being asked.

HARD RULES:
1. NEVER add requirements the query doesn't imply, and NEVER silently resolve ambiguity — every ambiguity becomes an OPEN QUESTION with the options spelled out.
2. NEVER inject reasoning instructions — no "think step by step", no "use chain of thought", no "reason carefully". Modern models reason natively; the brief's job is clarity of goal, constraints, and success criteria, not choreographing thought.
3. Front-load constraints and success criteria. Keep the user's vocabulary. Where the provided context contradicts the query, surface the conflict as an open question.

OUTPUT exactly three sections:
REFINED PROMPT — the brief: goal, context, constraints, deliverable, success criteria (omit parts that would be empty rather than padding them).
WHAT CHANGED — honest bullets: what you restructured, tightened, or reordered, AND what you deliberately did not touch.
OPEN QUESTIONS — decidable questions with options; write "none" only if the query is genuinely unambiguous. ${FORMAT_INSTRUCTION}`;

  const parts: string[] = [`RAW QUERY:\n${args.query}`];
  if (args.goal) parts.push(`STATED GOAL: ${args.goal}`);
  if (args.context) parts.push(`CONTEXT: ${args.context}`);
  return { system, user: parts.join("\n\n") };
}

export const refinePromptTool = defineModelTool({
  name: "refine_prompt",
  description:
    "Opt-in prompt improver (cheap/fast model): restructures a raw query into a goal-first brief and SHOWS ITS WORK — refined prompt + what changed + open questions. Never executes anything; you review, then feed the brief to any tool. Not for injecting reasoning instructions.",
  parameters: z.object({
    query: z.string().describe("The raw query/prompt to refine — REQUIRED"),
    goal: z.string().optional().describe("What the answer is ultimately for (sharpens the brief)"),
    context: z.string().optional().describe("Relevant background/constraints the refiner should honor"),
  }),
  execute: async (args, { reportProgress }: any) => {
    if (!args.query?.trim()) {
      return "Error: 'query' is required — paste the prompt you want refined.";
    }
    const { system, user } = buildRefinePrompt(args);
    return withHeartbeat(
      () =>
        callOpenAI(
          [
            { role: "system", content: system },
            { role: "user", content: user },
          ],
          OPENAI_MODELS.INSTANT, // cheap tier ON PURPOSE — refining the ask, not solving it
          0.3,
          4000,
          "low",
        ),
      reportProgress,
      10000,
    );
  },
});

export function getAllRefinePromptTools() {
  return [refinePromptTool] as const;
}
