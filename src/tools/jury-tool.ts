/**
 * Jury Tool - Multi-model panel evaluation with configurable jurors
 * Based on: "Replacing Judges with Juries" (Cohere, arXiv:2404.18796)
 * - Diverse models reduce bias better than a single strong judge
 * - 3-5 jurors is the sweet spot
 * - Different reasoning styles create useful tension for synthesis
 */

import { z } from "zod";
import { callGrok } from "./grok-tools.js";
import { callOpenAI } from "./openai-tools.js";
import { callOpenRouter, OpenRouterModel } from "./openrouter-tools.js";
import { callGemini } from "./gemini-tools.js";
import { GEMINI_MODELS } from "../config/model-constants.js";
import { FORMAT_INSTRUCTION } from "../utils/format-constants.js";
import { stripFormatting } from "../utils/format-stripper.js";
import { withHeartbeat } from "../utils/streaming-helper.js";

// Available juror models and how to call them
const JUROR_REGISTRY: Record<string, {
  label: string;
  role: string;
  call: (question: string) => Promise<string>;
}> = {
  grok: {
    label: "Grok (First Principles)",
    role: "Analyze from first principles. Be direct and opinionated. Cut through assumptions.",
    call: async (q) => callGrok([
      { role: "system", content: `You are a first-principles analyst. Be direct, pragmatic, and opinionated. ${FORMAT_INSTRUCTION}` },
      { role: "user", content: q }
    ], undefined, 0.7, 4000),
  },
  openai: {
    label: "GPT (Analytical)",
    role: "Provide nuanced analytical reasoning. Consider multiple angles and tradeoffs.",
    call: async (q) => callOpenAI([
      { role: "system", content: `You are an analytical reasoner. Consider tradeoffs, edge cases, and nuance. ${FORMAT_INSTRUCTION}` },
      { role: "user", content: q }
    ], undefined, 0.7, 4000, "high"),
  },
  qwen: {
    label: "Qwen (Code & Logic)",
    role: "Focus on code quality, implementation details, and logical rigor.",
    call: async (q) => callOpenRouter([
      { role: "system", content: `You are Qwen3-Coder-Next, an expert coder. Focus on implementation, code quality, and practical details. ${FORMAT_INSTRUCTION}` },
      { role: "user", content: q }
    ], OpenRouterModel.QWEN3_CODER_NEXT, 0.3, 4000),
  },
  qwen_reason: {
    label: "Qwen Reason (Mathematical)",
    role: "Apply rigorous mathematical and formal reasoning.",
    call: async (q) => callOpenRouter([
      { role: "system", content: `You are Qwen3-Max-Thinking, a flagship reasoning model. Apply rigorous formal reasoning. ${FORMAT_INSTRUCTION}` },
      { role: "user", content: q }
    ], OpenRouterModel.QWEN3_MAX_THINKING, 0.3, 4000),
  },
  kimi: {
    label: "Kimi (Step-by-Step)",
    role: "Think step-by-step. Decompose the problem. Find edge cases others miss.",
    call: async (q) => callOpenRouter([
      { role: "system", content: `You are Kimi K2.5. Think step-by-step. Decompose problems. Find edge cases. ${FORMAT_INSTRUCTION}` },
      { role: "user", content: q }
    ], OpenRouterModel.KIMI_K2_5, 0.4, 3000, { top_p: 0.9 }, 240000),
  },
  perplexity: {
    label: "Perplexity (Research)",
    role: "Search for real-world evidence, best practices, and recent developments.",
    call: async (q) => {
      const { callPerplexity, PerplexityModel } = await import("./perplexity-tools.js");
      return callPerplexity([
        { role: "system", content: `You are a research assistant. Find real-world evidence, best practices, and cite sources. ${FORMAT_INSTRUCTION}` },
        { role: "user", content: q }
      ], PerplexityModel.SONAR_PRO);
    },
  },
  minimax: {
    label: "MiniMax (Agentic)",
    role: "Focus on practical execution steps and agentic task planning.",
    call: async (q) => callOpenRouter([
      { role: "system", content: `You are MiniMax M2.1, an agentic model. Focus on practical execution and step-by-step plans. ${FORMAT_INSTRUCTION}` },
      { role: "user", content: q }
    ], OpenRouterModel.MINIMAX_M2_1, 0.5, 3000),
  },
};

const DEFAULT_JURORS = ["grok", "kimi", "qwen", "openai"];

export const juryTool = {
  name: "jury",
  description: "Multi-model jury: runs question through configurable panel of AI jurors in parallel, then Gemini synthesizes a unified verdict. Put QUESTION in 'question' parameter.",
  parameters: z.object({
    question: z.string().describe("The question or problem for the jury to evaluate (REQUIRED)"),
    jurors: z.string().optional()
      .describe("Comma-separated juror models (default: grok,kimi,qwen,openai). Available: grok, openai, qwen, qwen_reason, kimi, perplexity, minimax"),
    mode: z.enum(["synthesize", "evaluate", "rank", "resolve"])
      .optional()
      .default("synthesize")
      .describe("Judge mode: synthesize (merge best), evaluate (score each), rank (order by quality), resolve (settle conflicts)"),
    context: z.string().optional().describe("Additional context for all jurors")
  }),
  execute: async (args: {
    question: string;
    jurors?: string;
    mode?: string;
    context?: string;
  }, { log, reportProgress }: any) => {
    // Parse juror list
    const jurorNames = args.jurors
      ? args.jurors.split(",").map(j => j.trim().toLowerCase())
      : DEFAULT_JURORS;

    // Validate jurors
    const validJurors = jurorNames.filter(j => JUROR_REGISTRY[j]);
    if (validJurors.length === 0) {
      return `[No valid jurors. Available: ${Object.keys(JUROR_REGISTRY).join(", ")}]`;
    }

    const question = args.context
      ? `${args.question}\n\nContext: ${args.context}`
      : args.question;

    // Phase 1: Call all jurors in parallel
    const reportFn = reportProgress ?? (async () => {});
    const jurorResults = await withHeartbeat(async () => {
      const promises = validJurors.map(async (name) => {
        const juror = JUROR_REGISTRY[name];
        try {
          const result = await juror.call(question);
          return { name, label: juror.label, result };
        } catch (error) {
          const msg = error instanceof Error ? error.message : String(error);
          return { name, label: juror.label, result: `[Error: ${msg}]` };
        }
      });
      return Promise.all(promises);
    }, reportFn, 300000);

    // Phase 2: Format perspectives for the judge
    const perspectives = jurorResults
      .map(j => `--- ${j.label} ---\n${j.result}`)
      .join("\n\n");

    // Phase 3: Gemini judge synthesizes
    const modeInstructions: Record<string, string> = {
      synthesize: "SYNTHESIZE the best elements from each juror into one unified answer. Do NOT pick a winner.",
      evaluate: "SCORE each juror on accuracy, completeness, reasoning, actionability, novelty (1-10).",
      rank: "RANK jurors from strongest to weakest. Use pairwise comparison to avoid position bias.",
      resolve: "IDENTIFY conflicts between jurors. For each, state the disagreement, evaluate evidence, render verdict."
    };

    const judgePrompt = `JURY VERDICT REQUEST

QUESTION: ${args.question}

${modeInstructions[args.mode || 'synthesize']}

JUROR PERSPECTIVES (${validJurors.length} jurors):

${perspectives}

Apply chain-of-thought reasoning. Show your analysis before concluding. The final synthesis must be BETTER than any single juror.`;

    const judgeResult = await withHeartbeat(
      () => callGemini(
        judgePrompt,
        GEMINI_MODELS.GEMINI_3_PRO,
        `You are Gemini 3 Pro, acting as the presiding judge of an AI jury.
Evaluate ${validJurors.length} juror perspectives with intellectual rigor.
Decompose evaluation across traits: accuracy, reasoning, completeness, novelty.
Mitigate bias: don't favor the first, longest, or most verbose response.
Extract what each juror contributes uniquely before synthesizing.
${FORMAT_INSTRUCTION}`,
        0.3,
        'llm-orchestration'
      ),
      reportFn
    );

    // Format output
    const jurorSummary = validJurors.map(j => `- ${JUROR_REGISTRY[j].label}`).join("\n");

    return stripFormatting(`JURY PANEL
${jurorSummary}

VERDICT
${judgeResult}`);
  }
};
