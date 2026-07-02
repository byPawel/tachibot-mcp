/**
 * diff_review — multi-model, diff-AWARE code review.
 * Differs from openai_code_review (whole-file, single model) and jury (free-
 * text, no code structure): reviewers are scoped to the changed lines, then a
 * Gemini judge dedupes and severity-ranks into ONE actionable list.
 * Gated on Gemini (judge); panelists self-drop when their key is missing.
 */
import { z } from "zod";
import { defineModelTool } from "./factory/define-model-tool.js";
import { callOpenRouter, OpenRouterModel } from "./openrouter-tools.js";
import { callOpenAI } from "./openai-tools.js";
import { callGemini } from "./gemini-tools.js";
import { hasOpenAIApiKey, hasOpenRouterApiKey } from "../utils/api-keys.js";
import { readFilesIntoContext } from "../utils/file-reader.js";
import { FORMAT_INSTRUCTION } from "../utils/format-constants.js";
import { withHeartbeat } from "../utils/streaming-helper.js";
import { runPanel, type Panelist } from "./panel.js";

const PANELIST_MAX_TOKENS = 8000; // same rationale as JUROR_MAX_TOKENS (jury-tool.ts)

export function buildDiffReviewerPrompt(args: {
  diff: string;
  intent?: string;
  files?: string[];
  focus?: string;
}): string {
  const focus = args.focus || "all";
  const fileContext = args.files?.length
    ? `\n\nSURROUNDING CODE (context only — do NOT review unchanged code):\n${readFilesIntoContext(args.files)}`
    : "";
  return `Review this diff. Flag issues ONLY on changed lines and lines directly adjacent to/affected by the change — do not review the rest of the file.

${args.intent ? `STATED INTENT OF THE CHANGE: ${args.intent}\nAlso flag any way the diff does NOT accomplish this intent.\n` : ""}FOCUS: ${focus} (security | perf | correctness | style | all).

FOR EACH ISSUE: severity (blocker | major | minor | nit), file:line from the diff hunks, what breaks and the concrete input/state that triggers it, suggested fix (one line).
Look specifically for: regressions the change introduces, missed edge cases in the new logic, security implications of new data flows, and behavior the intent implies but the diff doesn't implement.
If you find nothing at a severity, say so explicitly.

DIFF:
${args.diff}${fileContext}`;
}

export function buildDiffJudgePrompt(
  perspectives: { label: string; text: string }[],
  args: { diff: string; severityFloor?: string },
): string {
  const floor = args.severityFloor || "nit";
  const body = perspectives
    .map((p, i) => `=== REVIEWER ${i + 1}: ${p.label} ===\n${p.text}`)
    .join("\n\n");
  return `You are the presiding reviewer. Below are independent reviews of the SAME diff.

MERGE THEM INTO ONE LIST:
1. Deduplicate findings that describe the same underlying issue (keep the clearest wording; note "flagged by N/${perspectives.length} reviewers").
2. Discard findings that misread the diff (verify each against the DIFF below).
3. Rank by severity: blocker > major > minor > nit. OMIT everything below severity floor: ${floor}.
4. Every finding keeps its file:line anchor and one-line fix.

END WITH: verdict line — "MERGEABLE", "MERGEABLE WITH FIXES", or "DO NOT MERGE", plus the single most important fix.

DIFF:
${args.diff}

${body}`;
}

function buildPanel(): Panelist[] {
  const panel: Panelist[] = [];
  if (hasOpenRouterApiKey()) {
    panel.push({
      key: "kimi",
      label: "Kimi K2.7-Code (SWE regressions)",
      call: (q) =>
        callOpenRouter(
          [
            { role: "system", content: `You are Kimi K2.7-Code, an SWE-specialized reviewer. Hunt regressions and missed edge cases in diffs. ${FORMAT_INSTRUCTION}` },
            { role: "user", content: q },
          ],
          OpenRouterModel.KIMI_K2_7_CODE,
          0.3,
          PANELIST_MAX_TOKENS,
        ),
    });
    panel.push({
      key: "deepseek",
      label: "DeepSeek V4 Pro (correctness & security)",
      call: (q) =>
        callOpenRouter(
          [
            { role: "system", content: `You are DeepSeek V4 Pro reviewing a diff. Rigorously verify correctness of the new logic and security of new data flows. ${FORMAT_INSTRUCTION}` },
            { role: "user", content: q },
          ],
          OpenRouterModel.DEEPSEEK_V4_PRO,
          0.2,
          PANELIST_MAX_TOKENS,
        ),
    });
  }
  if (hasOpenAIApiKey()) {
    panel.push({
      key: "gpt",
      label: "GPT-5.5 (intent & API-contract)",
      call: (q) =>
        callOpenAI(
          [
            { role: "system", content: `You review diffs for intent mismatches and API-contract breaks (types, error paths, backward compatibility). ${FORMAT_INSTRUCTION}` },
            { role: "user", content: q },
          ],
          undefined,
          0.3,
          PANELIST_MAX_TOKENS,
          "high",
        ),
    });
  }
  return panel;
}

export const diffReviewTool = defineModelTool({
  name: "diff_review",
  description:
    "Multi-model diff-aware code review: 2-3 lab-diverse reviewers (Kimi K2.7-Code, DeepSeek V4 Pro, GPT-5.5) scoped to the changed lines, deduplicated and severity-ranked by a Gemini judge. Provide the unified diff in 'diff'.",
  parameters: z.object({
    diff: z.string().describe("Unified diff to review (git diff output) — REQUIRED"),
    intent: z.string().optional().describe("What the change is SUPPOSED to do (enables intent-mismatch detection)"),
    files: z.array(z.string()).optional().describe("File paths for surrounding context. Supports line ranges: 'src/foo.ts:100-200'."),
    focus: z.enum(["security", "perf", "correctness", "style", "all"]).optional().default("all").describe("Review focus"),
    severityFloor: z.enum(["blocker", "major", "minor", "nit"]).optional().default("nit").describe("Omit findings below this severity"),
  }),
  execute: async (args, { reportProgress }: any) => {
    if (!args.diff?.trim()) {
      return "Error: 'diff' is required — paste the unified diff (e.g. `git diff` output).";
    }
    const panel = buildPanel();
    if (panel.length === 0) {
      return "Error: no reviewers available — diff_review needs OPENROUTER_API_KEY and/or OPENAI_API_KEY in addition to the Gemini key. Run `doctor` for setup status.";
    }
    const reviewerPrompt = buildDiffReviewerPrompt(args);
    const perspectives = await withHeartbeat(
      () => runPanel(panel, reviewerPrompt),
      reportProgress,
      10000,
    );
    if (perspectives.length === 0) {
      return "Error: all reviewers failed (provider outage or quota). Try again or run `doctor`.";
    }
    const judgePrompt = buildDiffJudgePrompt(perspectives, args);
    const verdict = await withHeartbeat(
      () =>
        callGemini(
          judgePrompt,
          undefined,
          `You are Gemini 3 Pro, the presiding code reviewer synthesizing a panel review of one diff. Be decisive; keep only verified findings. ${FORMAT_INSTRUCTION}`,
          0.3,
        ),
      reportProgress,
      10000,
    );
    const roster = perspectives.map((p) => p.label).join(", ");
    return `DIFF REVIEW (${perspectives.length} reviewers: ${roster})\n\n${verdict}`;
  },
});

export function getAllDiffReviewTools() {
  return [diffReviewTool] as const;
}
