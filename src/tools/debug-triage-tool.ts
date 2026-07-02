/**
 * debug_triage — systematic stack-trace triage.
 * Unlike grok_debug (single-shot "describe issue → answer"), this returns a
 * RANKED hypothesis list: real debugging narrows a hypothesis space, so the
 * output is ordered root-cause candidates each with the discriminating
 * evidence that would confirm or kill it, plus the minimal fix for the leader.
 */
import { z } from "zod";
import { defineModelTool } from "./factory/define-model-tool.js";
import { callGrok } from "./grok-tools.js";
import { readFilesIntoContext } from "../utils/file-reader.js";
import { FORMAT_INSTRUCTION } from "../utils/format-constants.js";
import { withHeartbeat } from "../utils/streaming-helper.js";

export function buildDebugTriagePrompt(args: {
  error: string;
  code?: string;
  files?: string[];
  context?: string;
  runtime?: string;
}): { system: string; user: string } {
  const system = `You are a principal engineer triaging a bug. Real debugging narrows a hypothesis space — do NOT jump to one answer.

METHOD:
1. HYPOTHESES RANKED — enumerate the plausible root causes, ordered most→least likely, each with a rough likelihood (e.g. 60%/25%/10%/5%). Likelihoods must reflect the specific evidence given, not generic priors.
2. DISCRIMINATING EVIDENCE — for EACH hypothesis: the one cheapest check (log line, breakpoint, command, input) whose outcome confirms it or kills it. Prefer checks that split the space fastest.
3. MINIMAL FIX — for the TOP hypothesis only: the smallest code change that fixes it, and what test would lock the fix in.
4. IF WRONG — one line: which hypothesis to promote if the top check comes back negative.

Never invent stack frames, file names, or APIs not present in the input. If the evidence is too thin to rank, say exactly what's missing and stop. ${FORMAT_INSTRUCTION}`;

  const parts: string[] = [`ERROR / STACK TRACE:\n${args.error}`];
  if (args.context) parts.push(`CONTEXT (repro, recent changes): ${args.context}`);
  if (args.runtime) parts.push(`RUNTIME: ${args.runtime}`);
  if (args.code) parts.push(`RELEVANT CODE:\n${args.code}`);
  if (args.files?.length) parts.push(`SOURCE FILES:\n${readFilesIntoContext(args.files)}`);
  return { system, user: parts.join("\n\n") };
}

export const debugTriageTool = defineModelTool({
  name: "debug_triage",
  description:
    "Systematic bug triage (Grok 4.3): RANKED root-cause hypotheses with likelihoods, the cheapest discriminating check for each, and the minimal fix for the top candidate. Provide the error/stack trace in 'error'.",
  parameters: z.object({
    error: z.string().describe("The error message or stack trace — REQUIRED"),
    code: z.string().optional().describe("Relevant code (or use 'files')"),
    files: z.array(z.string()).optional().describe("File paths to read server-side. Supports line ranges: 'src/foo.ts:100-200'."),
    context: z.string().optional().describe("Repro steps, recent changes, frequency (always/intermittent)"),
    runtime: z.string().optional().describe("Runtime/environment (e.g. 'node 22', 'python 3.12/django', browser)"),
  }),
  execute: async (args, { reportProgress }: any) => {
    if (!args.error?.trim()) {
      return "Error: 'error' is required — paste the error message or stack trace to triage.";
    }
    const { system, user } = buildDebugTriagePrompt(args);
    return withHeartbeat(
      () =>
        callGrok(
          [
            { role: "system", content: system },
            { role: "user", content: user },
          ],
          undefined, // grok default IS the flagship (grok-4.3) — unlike callOpenAI
          0.3,
          12000,
        ),
      reportProgress,
      10000,
    );
  },
});

export function getAllDebugTriageTools() {
  return [debugTriageTool] as const;
}
