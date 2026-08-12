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
import { isProviderFailure } from "../utils/provider-failure.js";
import { runJudge, judgeAttribution, type JudgeResult } from "../utils/judge-runner.js";
import {
  JUDGE_MODE_INSTRUCTIONS,
  JUDGE_METHOD,
  JUDGE_EPISTEMIC_LIMIT,
  JUDGE_BIAS_CONTROLS,
  JUDGE_FORMAT_EXCEPTION,
} from "../utils/judge-constants.js";
import { stripFormatting } from "../utils/format-stripper.js";
import { withHeartbeat } from "../utils/streaming-helper.js";

// Per-juror output budget. Reasoning-heavy jurors (GLM, Kimi, DeepSeek,
// GPT-5.5 high-effort) spend much of their token budget on internal reasoning
// BEFORE the visible answer, so a tight cap truncates the verdict mid-sentence
// (finish_reason: "length"). 8000 leaves room for reasoning + a complete take.
const JUROR_MAX_TOKENS = 8000;

// Re-exported for back-compat; the detector now lives in utils/provider-failure.ts so the
// judge runner can share it without importing this module (which would be a cycle).
export { isProviderFailure };

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
    ], undefined, 0.7, JUROR_MAX_TOKENS),
  },
  openai: {
    label: "GPT (Analytical)",
    role: "Provide nuanced analytical reasoning. Consider multiple angles and tradeoffs.",
    call: async (q) => callOpenAI([
      { role: "system", content: `You are an analytical reasoner. Consider tradeoffs, edge cases, and nuance. ${FORMAT_INSTRUCTION}` },
      { role: "user", content: q }
    ], undefined, 0.7, JUROR_MAX_TOKENS, "high"),
  },
  qwen: {
    label: "Qwen (Code & Logic)",
    role: "Focus on code quality, implementation details, and logical rigor.",
    call: async (q) => callOpenRouter([
      { role: "system", content: `You are Qwen3-Coder-Next, an expert coder. Focus on implementation, code quality, and practical details. ${FORMAT_INSTRUCTION}` },
      { role: "user", content: q }
    ], OpenRouterModel.QWEN3_CODER_NEXT, 0.3, JUROR_MAX_TOKENS),
  },
  qwen_reason: {
    label: "Qwen Reason (Mathematical)",
    role: "Apply rigorous mathematical and formal reasoning.",
    call: async (q) => callOpenRouter([
      { role: "system", content: `You are Qwen3.8-Max, Alibaba's flagship reasoning model. Apply rigorous formal reasoning. ${FORMAT_INSTRUCTION}` },
      { role: "user", content: q }
      // Effort MUST be set explicitly: Qwen3.8-Max's default behaves like "high"
      // (~5 min/call), and the panel waits on its slowest juror. "medium" answers
      // at the same depth in well under a minute.
    ], OpenRouterModel.QWEN3_8_MAX, 0.3, JUROR_MAX_TOKENS, { reasoning_effort: "medium" }),
  },
  kimi: {
    label: "Kimi (Step-by-Step)",
    role: "Think step-by-step. Decompose the problem. Find edge cases others miss.",
    call: async (q) => callOpenRouter([
      { role: "system", content: `You are Kimi K3. Think step-by-step. Decompose problems. Find edge cases. ${FORMAT_INSTRUCTION}` },
      { role: "user", content: q }
    ], OpenRouterModel.KIMI_K3, 0.4, JUROR_MAX_TOKENS, { top_p: 0.9 }, 240000),
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
    ], OpenRouterModel.MINIMAX_M3, 0.5, JUROR_MAX_TOKENS),
  },
  deepseek: {
    label: "DeepSeek V4 Pro (Frontier Reasoning)",
    role: "Apply frontier open-weight reasoning. Be rigorous on math, logic chains, and correctness.",
    call: async (q) => callOpenRouter([
      { role: "system", content: `You are DeepSeek V4 Pro, an open-weight frontier reasoning model (top AIME/GPQA). Reason rigorously, show the chain, then conclude. ${FORMAT_INSTRUCTION}` },
      { role: "user", content: q }
    ], OpenRouterModel.DEEPSEEK_V4_PRO, 0.3, JUROR_MAX_TOKENS),
  },
  glm: {
    label: "GLM-5.2 (Agentic)",
    role: "Reason as an agent: plan, anticipate failure modes, decide. Strong on tool-use and SWE.",
    call: async (q) => callOpenRouter([
      { role: "system", content: `You are Zhipu GLM-5.2, a frontier open-weights agentic model (1M ctx, top long-horizon coding). Plan, reason through tool-use/steps, then give a decisive verdict. ${FORMAT_INSTRUCTION}` },
      { role: "user", content: q }
    ], OpenRouterModel.GLM_5_2, 0.3, JUROR_MAX_TOKENS),
  },
  stepfun: {
    label: "StepFun 3.7 (Efficient Reasoning)",
    role: "Reason efficiently and tightly. Strong on math/AIME-style problems at low cost.",
    call: async (q) => callOpenRouter([
      { role: "system", content: `You are StepFun Step 3.7 Flash, an efficient reasoning model. Reason tightly, then conclude. ${FORMAT_INSTRUCTION}` },
      { role: "user", content: q }
    ], OpenRouterModel.STEPFUN_3_7, 0.3, JUROR_MAX_TOKENS),
  },
  ernie: {
    label: "ERNIE 4.5 VL (Broad Knowledge)",
    role: "Bring broad knowledge and human-preference judgment. Uncorrelated with US labs.",
    call: async (q) => callOpenRouter([
      { role: "system", content: `You are Baidu ERNIE 4.5 VL, a broad-knowledge MoE with strong human-preference alignment. Give a well-rounded, decisive judgment. ${FORMAT_INSTRUCTION}` },
      { role: "user", content: q }
    ], OpenRouterModel.ERNIE_4_5_VL, 0.4, JUROR_MAX_TOKENS),
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
      // Heartbeat every 10s (the 3rd arg is the INTERVAL, not a timeout) so the
      // MCP client keeps the connection alive through long parallel juror calls.
    }, reportFn, 10000);

    // Phase 2: Format perspectives for the judge
    const liveJurors = jurorResults.filter(
      (j) =>
        typeof j.result === "string" &&
        j.result.length > 0 &&
        !isProviderFailure(j.result),
    );
    const dropped = jurorResults.filter((j) => !liveJurors.includes(j));
    if (dropped.length > 0) {
      console.error(
        `⚠️ ${dropped.length} juror(s) dropped (offline/error) — synthesizing from ${liveJurors.length}`,
      );
    }
    if (liveJurors.length === 0) {
      return `[Jury failed: all ${jurorResults.length} juror(s) errored or timed out. Run \`doctor\` to check provider keys and quota.]`;
    }

    // Anonymize before synthesis. The judge is asked to weigh reasoning, so it must not
    // see which lab produced which perspective — identity bias is the one bias the old
    // prompt debiased against while actively inducing it. The lens (the parenthetical in
    // each label) survives because it states what angle the juror was asked to take; the
    // vendor names are restored only in the roster printed below.
    const anonymized = liveJurors.map((j, i) => ({
      tag: `JUROR ${String.fromCharCode(65 + i)}`,
      lens: j.label.match(/\(([^)]+)\)/)?.[1] ?? j.label,
      text: j.result as string,
    }));
    const perspectives = anonymized
      .map((a) => `--- ${a.tag} (${a.lens} lens) ---\n${a.text}`)
      .join("\n\n");

    // Phase 3: judge synthesizes. Counts below MUST come from `anonymized`, not
    // `validJurors` — the judge can only reason about perspectives it was actually shown,
    // and telling it "4 jurors" while showing 2 miscalibrates every consensus claim.
    const droppedNote = dropped.length > 0
      ? `\nNOTE: ${dropped.length} of ${jurorResults.length} jurors failed (provider error or quota)
and are ABSENT below. Do not infer agreement from jurors you cannot see — calibrate
confidence to the ${anonymized.length} present, and say the panel was short-handed.\n`
      : "";

    const judgePrompt = `JURY VERDICT REQUEST

QUESTION: ${args.question}

${JUDGE_MODE_INSTRUCTIONS[args.mode || 'synthesize']}

JUROR PERSPECTIVES (${anonymized.length}):

${perspectives}

${JUDGE_METHOD}

${JUDGE_EPISTEMIC_LIMIT}
${droppedNote}`;

    const judgeSystemPrompt = `You are the presiding judge of an AI jury, evaluating ${anonymized.length} anonymized
juror perspectives. Extract what each contributes uniquely before synthesizing.
${JUDGE_BIAS_CONTROLS}
${FORMAT_INSTRUCTION}
${JUDGE_FORMAT_EXCEPTION}`;

    const judged = (await withHeartbeat(
      () => runJudge(judgePrompt, judgeSystemPrompt, 0.3),
      reportFn
    )) as JudgeResult;

    // Format output. The judge saw anonymous letters; the USER gets the mapping back,
    // plus an honest account of who never made it to the panel.
    const jurorSummary = [
      ...liveJurors.map((j, i) => `- ${String.fromCharCode(65 + i)}: ${j.label}`),
      ...dropped.map(j => `- ${j.label} — DROPPED (provider error or quota)`),
    ].join("\n");

    // Every judge down. The panel already ran and was already billed, so hand back the raw
    // perspectives rather than an error string — unsynthesized jurors are still the bulk of
    // the value, and throwing them away is the one outcome with no upside.
    if (judged.text === null) {
      return stripFormatting(`JURY PANEL (${liveJurors.length}/${jurorResults.length} responded)
${jurorSummary}

⚠️ NO VERDICT — every judge was unavailable (Gemini and OpenAI both failed; usually
quota). The juror perspectives below are UNSYNTHESIZED and were not cross-checked
against each other. Run \`doctor\` to see provider status.

RAW PERSPECTIVES
${perspectives}`);
    }

    return stripFormatting(`JURY PANEL (${liveJurors.length}/${jurorResults.length} responded)
${jurorSummary}

VERDICT
${judgeAttribution(judged)}${judged.text}`);
  }
});
