/**
 * Provider catalog — single source of truth for "which tools belong to which
 * provider, and what key unlocks them". Shared by the `doctor` diagnostic tool
 * and the `tachi` no-query catalog so the two stay in sync (DRY).
 *
 * Tools self-gate registration on API keys (see src/tools/registry.ts), so a
 * user with one key sees only a slice of the full tool set with no explanation.
 * This catalog makes the gating legible: each group knows its key check and the
 * exact env var(s) that unlock it.
 */

import {
  hasGrokApiKey,
  hasOpenAIApiKey,
  hasPerplexityApiKey,
  hasGeminiApiKey,
  hasOpenRouterApiKey,
  hasLocalLLM,
} from "../utils/api-keys.js";

export interface ProviderGroup {
  /** Human label, e.g. "Grok / xAI" */
  label: string;
  /** Env var(s) that unlock this group, e.g. "XAI_API_KEY or GROK_API_KEY" */
  envHint: string;
  /** True when the required key/opt-in is present */
  available: () => boolean;
  /** Tool names gated behind this provider */
  tools: string[];
  /** One-line note about what the key unlocks (optional) */
  note?: string;
}

/**
 * Key-gated provider groups, in the same order the registry registers them.
 * Kept in sync with src/tools/registry.ts and the ToolsConfig in
 * src/profiles/types.ts.
 */
export const PROVIDER_GROUPS: ProviderGroup[] = [
  {
    label: "Perplexity",
    envHint: "PERPLEXITY_API_KEY",
    available: hasPerplexityApiKey,
    tools: ["perplexity_ask", "perplexity_reason"],
  },
  {
    label: "Grok / xAI",
    envHint: "XAI_API_KEY or GROK_API_KEY",
    available: hasGrokApiKey,
    tools: [
      "grok_reason",
      "grok_code",
      "grok_debug",
      "grok_architect",
      "grok_brainstorm",
      "grok_search",
    ],
  },
  {
    label: "OpenAI",
    envHint: "OPENAI_API_KEY",
    available: hasOpenAIApiKey,
    tools: [
      "openai_reason",
      "openai_brainstorm",
      "openai_code_review",
      "openai_explain",
      "openai_search",
    ],
  },
  {
    label: "Gemini / Google",
    envHint: "GOOGLE_API_KEY or GEMINI_API_KEY",
    available: hasGeminiApiKey,
    note: "also powers the jury judge",
    tools: [
      "gemini_brainstorm",
      "gemini_analyze_code",
      "gemini_analyze_text",
      "gemini_judge",
      "gemini_search",
      "jury",
      "diff_review",
    ],
  },
  {
    label: "OpenRouter",
    envHint: "OPENROUTER_API_KEY",
    available: hasOpenRouterApiKey,
    note: "unlocks Qwen / Kimi / MiniMax / DeepSeek / GLM / StepFun / ERNIE + planner",
    tools: [
      "qwen_coder",
      "qwen_algo",
      "qwq_reason",
      "qwen_reason",
      "qwen_competitive",
      "kimi_thinking",
      "kimi_code",
      "kimi_decompose",
      "kimi_long_context",
      "minimax_code",
      "minimax_agent",
      "deepseek_reason",
      "deepseek_algo",
      "glm_reason",
      "stepfun_reason",
      "ernie_reason",
      "planner_maker",
      "planner_runner",
      "list_plans",
      "testgen",
      "security_review",
    ],
  },
  {
    label: "Local LLM",
    envHint: "LOCAL_LLM_BASE_URL or LOCAL_LLM_MODEL",
    available: hasLocalLLM,
    note: "Ollama / LM Studio / llama.cpp / vLLM — zero-cost, offline",
    tools: ["local_query"],
  },
];

/**
 * Always-on tools — registered unconditionally (no API key required). Profile
 * membership still applies, but no key can hide these.
 */
export const ALWAYS_ON_TOOLS: string[] = [
  "think",
  "focus",
  "nextThought",
  "tachi",
  "doctor",
  "usage_stats",
  "workflow",
  "list_workflows",
  "create_workflow",
  "visualize_workflow",
  "workflow_start",
  "continue_workflow",
  "workflow_status",
  "validate_workflow",
  "validate_workflow_file",
  "list_prompt_techniques",
  "preview_prompt_technique",
  "execute_prompt_technique",
];

/** Bundled Claude Code skills (deployed to ~/.claude/skills/ on install). */
export const SKILLS: { name: string; desc: string }[] = [
  { name: "judge", desc: "Multi-model council with fallback awareness" },
  { name: "think", desc: "Sequential reasoning chains" },
  { name: "focus", desc: "Mode-based multi-model reasoning" },
  { name: "blueprint", desc: "Multi-model planning to bite-sized TDD steps" },
  { name: "breakdown", desc: "Strategic decomposition (breadth-first)" },
  { name: "decompose", desc: "Split into sub-problems, deep-dive each (depth-first)" },
  { name: "prompt", desc: "Recommends the right thinking technique" },
  { name: "algo", desc: "Algorithm analysis with 4 models (deepseek_algo lead)" },
  { name: "lens", desc: "Long-context analysis via active retrieval (256K)" },
  { name: "reflect", desc: "Grounded reflexion loop vs external evidence" },
  { name: "tot", desc: "Tree-of-Thought: branch, prune via jury, synthesize" },
  { name: "tachi", desc: "Help & discovery" },
];
