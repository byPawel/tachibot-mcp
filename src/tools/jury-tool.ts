/**
 * Jury Tool - Multi-model panel evaluation with configurable jurors
 * Based on: "Replacing Judges with Juries" (Cohere, arXiv:2404.18796)
 * - Diverse models reduce bias better than a single strong judge
 * - 3-5 jurors is the sweet spot
 * - Different reasoning styles create useful tension for synthesis
 */

import { z } from "zod";
import { defineModelTool } from "./factory/define-model-tool.js";
import { callGrok } from "./grok-tools.js";
import { callOpenAI } from "./openai-tools.js";
import { callOpenRouter, OpenRouterModel } from "./openrouter-tools.js";
import { callLocal } from "./local-tools.js";
import { callGemini } from "./gemini-tools.js";
import { GEMINI_MODELS } from "../config/model-constants.js";
import { FORMAT_INSTRUCTION } from "../utils/format-constants.js";
import { stripFormatting } from "../utils/format-stripper.js";
import { withHeartbeat } from "../utils/streaming-helper.js";

// Available juror models and how to call them
export const JUROR_REGISTRY: Record<string, {
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
      { role: "system", content: `You are Kimi K2.6. Think step-by-step. Decompose problems. Find edge cases. ${FORMAT_INSTRUCTION}` },
      { role: "user", content: q }
    ], OpenRouterModel.KIMI_K2_6, 0.4, 3000, { top_p: 0.9 }, 240000),
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
      { role: "system", content: `You are MiniMax M3, an agentic model built for long-horizon multi-step work (1M context, MSA sparse attention). Focus on practical execution and step-by-step plans. ${FORMAT_INSTRUCTION}` },
      { role: "user", content: q }
    ], OpenRouterModel.MINIMAX_M3, 0.5, 3000),
  },
  deepseek: {
    label: "DeepSeek V4 Pro (Frontier Reasoning)",
    role: "Apply frontier open-weight reasoning. Be rigorous on math, logic chains, and correctness.",
    call: async (q) => callOpenRouter([
      { role: "system", content: `You are DeepSeek V4 Pro, an open-weight frontier reasoning model (top AIME/GPQA). Reason rigorously, show the chain, then conclude. ${FORMAT_INSTRUCTION}` },
      { role: "user", content: q }
    ], OpenRouterModel.DEEPSEEK_V4_PRO, 0.3, 4000),
  },
  glm: {
    label: "GLM-5.1 (Agentic)",
    role: "Reason as an agent: plan, anticipate failure modes, decide. Strong on tool-use and SWE.",
    call: async (q) => callOpenRouter([
      { role: "system", content: `You are Zhipu GLM-5.1, a SWE-Bench Pro leader. Plan, reason through tool-use/steps, then give a decisive verdict. ${FORMAT_INSTRUCTION}` },
      { role: "user", content: q }
    ], OpenRouterModel.GLM_5_1, 0.3, 4000),
  },
  stepfun: {
    label: "StepFun 3.7 (Efficient Reasoning)",
    role: "Reason efficiently and tightly. Strong on math/AIME-style problems at low cost.",
    call: async (q) => callOpenRouter([
      { role: "system", content: `You are StepFun Step 3.7 Flash, an efficient reasoning model. Reason tightly, then conclude. ${FORMAT_INSTRUCTION}` },
      { role: "user", content: q }
    ], OpenRouterModel.STEPFUN_3_7, 0.3, 3000),
  },
  ernie: {
    label: "ERNIE 4.5 VL (Broad Knowledge)",
    role: "Bring broad knowledge and human-preference judgment. Uncorrelated with US labs.",
    call: async (q) => callOpenRouter([
      { role: "system", content: `You are Baidu ERNIE 4.5 VL, a broad-knowledge MoE with strong human-preference alignment. Give a well-rounded, decisive judgment. ${FORMAT_INSTRUCTION}` },
      { role: "user", content: q }
    ], OpenRouterModel.ERNIE_4_5_VL, 0.4, 3000),
  },
  // Local open-weights juror — free, offline, ZERO token cost. Its judgment is
  // uncorrelated with the frontier vendors above, which is exactly what reduces
  // shared-bias blind spots (arXiv:2404.18796). Runs whatever LOCAL_LLM_MODEL
  // points at (Ollama/LM Studio/llama.cpp/vLLM); see local-tools.ts for setup.
  // NOTE: there is intentionally only ONE local juror. Persona variants on the
  // same weights (the old 'hermes' juror) add fake diversity — jury independence
  // comes from different model weights, not different system prompts — and
  // claiming "You are Hermes" to a non-Hermes backend is a false-role prompt.
  local: {
    label: "Local LLM (Free)",
    role: "Local open-weights juror running offline at zero token cost.",
    call: async (q) => callLocal([
      { role: "system", content: `You are a local open-weights model acting as an independent juror. Be rigorous and concise. ${FORMAT_INSTRUCTION}` },
      { role: "user", content: q }
    ], { temperature: 0.5, maxTokens: 4000 }),
  },
};

// Legacy juror names accepted for back-compat. 'hermes' was a persona variant
// of the local juror (same weights, different costume) — panels that request it
// get the honest local juror instead. Names are deduped after mapping so
// "hermes,local" yields one local vote, not two correlated ones.
const JUROR_ALIASES: Record<string, string> = {
  hermes: "local",
};

export const DEFAULT_JURORS = ["grok", "deepseek", "kimi", "openai"];

export const juryTool = defineModelTool({
  name: "jury",
  description: "Multi-model jury: runs question through configurable panel of AI jurors in parallel, then Gemini synthesizes a unified verdict. Put QUESTION in 'question' parameter.",
  parameters: z.object({
    question: z.string().describe("The question or problem for the jury to evaluate (REQUIRED)"),
    jurors: z.string().optional()
      .describe("Comma-separated juror models (default: grok,deepseek,kimi,openai). Available: grok, openai, qwen, qwen_reason, kimi, perplexity, minimax, deepseek, glm, stepfun, ernie, local (free offline — uses LOCAL_LLM_MODEL via Ollama/LM Studio; 'hermes' accepted as legacy alias)"),
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
    // Parse juror list; map legacy aliases, then dedupe so an alias and its
    // target (e.g. "hermes,local") count as one juror, not two correlated votes.
    const jurorNames = [...new Set(
      (args.jurors
        ? args.jurors.split(",").map(j => j.trim().toLowerCase())
        : DEFAULT_JURORS
      ).map(j => JUROR_ALIASES[j] ?? j)
    )];

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
          // Drop a failed juror (e.g. an offline local model) rather than feeding
          // its error text to the judge — keeps synthesis clean. Typed errors from
          // callLocal land here, so no string-matching needed.
          console.error(`⚠️ Dropping juror ${name}: ${msg}`);
          return { name, label: juror.label, result: null as string | null };
        }
      });
      return Promise.all(promises);
    }, reportFn, 300000);

    // Phase 2: Format perspectives for the judge
    const liveJurors = jurorResults.filter(
      (j) => typeof j.result === "string" && j.result.length > 0,
    );
    const droppedCount = jurorResults.length - liveJurors.length;
    if (droppedCount > 0) {
      console.error(
        `⚠️ ${droppedCount} juror(s) dropped (offline/error) — synthesizing from ${liveJurors.length}`,
      );
    }
    const perspectives = liveJurors
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
});
