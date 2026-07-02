/**
 * plan_critique — adversarial red-team of an EXISTING plan (any source:
 * hand-written, planner_maker output, a design doc). planner_maker BUILDS
 * plans and planner_runner EXECUTES them; nothing critiques a plan you
 * already hold. Panel of diverse critics + Gemini synthesis, pre-mortem first.
 * Gated on Gemini (judge); critics self-drop when their key is missing.
 */
import { z } from "zod";
import { defineModelTool } from "./factory/define-model-tool.js";
import { callOpenRouter, OpenRouterModel } from "./openrouter-tools.js";
import { callGrok } from "./grok-tools.js";
import { callOpenAI } from "./openai-tools.js";
import { callGemini } from "./gemini-tools.js";
import { OPENAI_MODELS } from "../config/model-constants.js";
import { hasGrokApiKey, hasOpenAIApiKey, hasOpenRouterApiKey } from "../utils/api-keys.js";
import { readFilesIntoContext } from "../utils/file-reader.js";
import { FORMAT_INSTRUCTION } from "../utils/format-constants.js";
import { withHeartbeat } from "../utils/streaming-helper.js";
import { runPanel, type Panelist } from "./panel.js";

const PANELIST_MAX_TOKENS = 8000;

export function buildPlanCritiquePrompt(args: {
  plan: string;
  goal?: string;
  constraints?: string;
  files?: string[];
}): string {
  const fileContext = args.files?.length
    ? `\n\nRELEVANT CODE/DOCS:\n${readFilesIntoContext(args.files)}`
    : "";
  return `Red-team this plan. Assume it was executed and FAILED — work backwards.

1. PRE-MORTEM — the 5 most plausible ways this plan failed, most likely first, each with the step that caused it.
2. HIDDEN ASSUMPTIONS — every unstated assumption the plan depends on (environment, data, ordering, people); mark which are UNVERIFIED.
3. STRUCTURE — missing steps, mis-ordered steps, steps with no acceptance criterion or no rollback.
4. RISKS RANKED — likelihood x impact, each with a concrete mitigation that could be added to the plan.
Do NOT rewrite the plan; critique it. Be specific to THIS plan — no generic project-management advice.

${args.goal ? `STATED GOAL: ${args.goal}\nAlso flag anything in the plan that does not serve this goal (scope creep) and any goal aspect no step covers (gap).\n` : ""}${args.constraints ? `CONSTRAINTS: ${args.constraints}\n` : ""}
PLAN UNDER REVIEW:
${args.plan}${fileContext}`;
}

export function buildPlanCritiqueJudgePrompt(
  perspectives: { label: string; text: string }[],
  args: { plan: string },
): string {
  const body = perspectives
    .map((p, i) => `=== CRITIC ${i + 1}: ${p.label} ===\n${p.text}`)
    .join("\n\n");
  return `You are synthesizing independent red-team critiques of the SAME plan into one actionable review.

1. Merge duplicate concerns (note "raised by N/${perspectives.length} critics" — convergence signals real risk).
2. Discard critiques that misread the plan (verify against the PLAN below).
3. Output: (a) TOP RISKS ranked by likelihood x impact with mitigations; (b) UNVERIFIED ASSUMPTIONS to check before starting; (c) CONCRETE PLAN EDITS — numbered, minimal, each tied to a risk; (d) VERDICT — "SOUND", "SOUND WITH EDITS", or "RETHINK", one sentence why.

PLAN:
${args.plan}

${body}`;
}

function buildCriticPanel(): Panelist[] {
  const panel: Panelist[] = [];
  if (hasOpenRouterApiKey()) {
    panel.push({
      key: "deepseek",
      label: "DeepSeek V4 Pro (logical soundness)",
      call: (q) =>
        callOpenRouter(
          [
            { role: "system", content: `You are DeepSeek V4 Pro red-teaming a plan. Attack its logical soundness: ordering, dependencies, unstated preconditions. ${FORMAT_INSTRUCTION}` },
            { role: "user", content: q },
          ],
          OpenRouterModel.DEEPSEEK_V4_PRO,
          0.3,
          PANELIST_MAX_TOKENS,
        ),
    });
  }
  if (hasGrokApiKey()) {
    panel.push({
      key: "grok",
      label: "Grok (operational reality)",
      call: (q) =>
        callGrok(
          [
            { role: "system", content: `You are a pragmatic staff engineer red-teaming a plan. Attack its operational reality: deploy risk, rollback, timing, human factors. Be blunt. ${FORMAT_INSTRUCTION}` },
            { role: "user", content: q },
          ],
          undefined,
          0.5,
          PANELIST_MAX_TOKENS,
        ),
    });
  }
  if (hasOpenAIApiKey()) {
    panel.push({
      key: "gpt",
      label: "GPT-5.5 (edge cases & scope)",
      call: (q) =>
        callOpenAI(
          [
            { role: "system", content: `You red-team plans for edge cases, scope gaps, and missing acceptance criteria. ${FORMAT_INSTRUCTION}` },
            { role: "user", content: q },
          ],
          OPENAI_MODELS.DEFAULT, // explicit: `undefined` falls back to INSTANT (gpt-5.4-mini), contradicting the GPT-5.5 label
          0.4,
          PANELIST_MAX_TOKENS,
          "high",
        ),
    });
  }
  return panel;
}

export const planCritiqueTool = defineModelTool({
  name: "plan_critique",
  description:
    "Adversarial red-team of an existing plan (from any source): multi-model pre-mortem, hidden-assumption audit, ranked risks with mitigations, concrete plan edits, verdict. Complements planner_maker (builds) and planner_runner (executes).",
  parameters: z.object({
    plan: z.string().describe("The plan to critique (paste it) — REQUIRED"),
    goal: z.string().optional().describe("The goal the plan is supposed to achieve (enables scope-creep and gap detection)"),
    constraints: z.string().optional().describe("Hard constraints (deadline, budget, compliance, team size)"),
    files: z.array(z.string()).optional().describe("Relevant code/doc paths for grounding. Supports line ranges: 'src/foo.ts:100-200'."),
  }),
  execute: async (args, { reportProgress }: any) => {
    if (!args.plan?.trim()) {
      return "Error: 'plan' is required — paste the plan you want red-teamed.";
    }
    const panel = buildCriticPanel();
    if (panel.length === 0) {
      return "Error: no critics available — plan_critique needs OPENROUTER_API_KEY, GROK_API_KEY, or OPENAI_API_KEY in addition to the Gemini key. Run `doctor` for setup status.";
    }
    const criticPrompt = buildPlanCritiquePrompt(args);
    const perspectives = await withHeartbeat(
      () => runPanel(panel, criticPrompt),
      reportProgress,
      10000,
    );
    if (perspectives.length === 0) {
      return "Error: all critics failed (provider outage or quota). Try again or run `doctor`.";
    }
    const judgePrompt = buildPlanCritiqueJudgePrompt(perspectives, args);
    const verdict = await withHeartbeat(
      () =>
        callGemini(
          judgePrompt,
          undefined,
          `You are Gemini 3 Pro, synthesizing a red-team panel's critiques of one plan. Convergent concerns are signal; be decisive. ${FORMAT_INSTRUCTION}`,
          0.3,
        ),
      reportProgress,
      10000,
    );
    const roster = perspectives.map((p) => p.label).join(", ");
    return `PLAN CRITIQUE (${perspectives.length} critics: ${roster})\n\n${verdict}`;
  },
});

export function getAllPlanCritiqueTools() {
  return [planCritiqueTool] as const;
}
