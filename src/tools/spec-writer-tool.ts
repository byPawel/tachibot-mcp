/**
 * spec_writer — loose feature request → reviewable SPEC artifact.
 * The missing front-end of the planning pipeline: kimi_decompose emits
 * subtasks and planner_maker emits execution plans, but nothing produces the
 * human-reviewable WHAT-are-we-building document to align on BEFORE planning.
 * Output is for sign-off (user stories + acceptance criteria + out-of-scope +
 * open questions), not for execution. Feed the approved spec to planner_maker.
 */
import { z } from "zod";
import { defineModelTool } from "./factory/define-model-tool.js";
import { callOpenAI } from "./openai-tools.js";
import { OPENAI_MODELS } from "../config/model-constants.js";
import { readFilesIntoContext } from "../utils/file-reader.js";
import { FORMAT_INSTRUCTION } from "../utils/format-constants.js";
import { withHeartbeat } from "../utils/streaming-helper.js";

export function buildSpecWriterPrompt(args: {
  request: string;
  context?: string;
  files?: string[];
  format?: string;
}): { system: string; user: string } {
  const format = args.format || "both";
  const formatLine =
    format === "user_story"
      ? "Express acceptance criteria inside each user story."
      : format === "gherkin"
        ? "Express acceptance criteria as Given/When/Then scenarios."
        : "Express acceptance criteria as Given/When/Then scenarios grouped under user stories.";

  const system = `You are a senior product engineer turning a loose request into a spec a human can review and SIGN OFF ON. The output is an alignment document, not a plan — no implementation steps, no file names, no sequencing.

SPEC SECTIONS (all required):
1. SUMMARY — the goal in two sentences, in the requester's own vocabulary.
2. USER STORIES — "As a…, I want…, so that…"; smallest set that covers the request.
3. ACCEPTANCE CRITERIA — ${formatLine} Each criterion must be objectively checkable.
4. NON-FUNCTIONAL REQUIREMENTS — only those the request or context implies (perf, security, compat); omit the section's boilerplate if none apply, but say so.
5. OUT OF SCOPE — explicit list of adjacent things this spec deliberately does NOT cover.
6. OPEN QUESTIONS — every ambiguity in the request, phrased as a decidable question with the options.

RULES: Do NOT invent requirements the request doesn't imply. PRESERVE ambiguity as open questions rather than resolving it silently. Where the context contradicts the request, surface the conflict as an open question. ${FORMAT_INSTRUCTION}`;

  const parts: string[] = [`REQUEST:\n${args.request}`];
  if (args.context) parts.push(`CONTEXT: ${args.context}`);
  if (args.files?.length) parts.push(`RELEVANT CODE/DOCS:\n${readFilesIntoContext(args.files)}`);
  return { system, user: parts.join("\n\n") };
}

export const specWriterTool = defineModelTool({
  name: "spec_writer",
  description:
    "Turn a loose feature request into a reviewable spec (GPT-5.5): user stories, Given/When/Then acceptance criteria, non-functional requirements, explicit out-of-scope, open questions. For sign-off BEFORE planning — feed the approved spec to planner_maker.",
  parameters: z.object({
    request: z.string().describe("The feature request, as loose as it comes — REQUIRED"),
    context: z.string().optional().describe("System context (existing behavior, constraints, user base)"),
    files: z.array(z.string()).optional().describe("Relevant code/doc paths for grounding. Supports line ranges: 'src/foo.ts:100-200'."),
    format: z.enum(["user_story", "gherkin", "both"]).optional().default("both").describe("Acceptance-criteria format"),
  }),
  execute: async (args, { reportProgress }: any) => {
    if (!args.request?.trim()) {
      return "Error: 'request' is required — describe the feature, however loosely.";
    }
    const { system, user } = buildSpecWriterPrompt(args);
    return withHeartbeat(
      () =>
        callOpenAI(
          [
            { role: "system", content: system },
            { role: "user", content: user },
          ],
          OPENAI_MODELS.DEFAULT, // explicit: `undefined` falls back to INSTANT (gpt-5.4-mini)
          0.4,
          12000,
          "high",
        ),
      reportProgress,
      10000,
    );
  },
});

export function getAllSpecWriterTools() {
  return [specWriterTool] as const;
}
