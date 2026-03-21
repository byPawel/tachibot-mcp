/**
 * Centralized Model Names and Constants
 * Named by PROVIDER (not model version) for consistency and future-proofing
 * Use these constants instead of hardcoded strings in workflows and tools
 */

// =============================================================================
// OPENAI MODELS (provider-based naming)
// =============================================================================
// GPT-5.4 released Mar 5, 2026 - CURRENT (most capable, incorporates Codex)
// GPT-5.3-Codex released Feb 5, 2026 - Agentic coding specialist
// Model is "gpt-5.4", "thinking" is controlled by reasoning.effort parameter
// OpenRouter uses prefix: openai/gpt-5.4, openai/gpt-5.4-pro
export const OPENAI_MODELS = {
  // GPT-5.4 (Mar 2026 - CURRENT)
  // Note: "gpt-5.4" + reasoning.effort="high"/"xhigh" = "thinking" mode
  DEFAULT: "gpt-5.4",               // Most capable - reasoning, agentic, professional work
  MINI: "gpt-5.4-mini",             // Fast/efficient coding & subagents (400k ctx, Mar 17)
  PRO: "gpt-5.4-pro",               // Expert: higher compute for harder problems

  // Aliases for backward compatibility
  THINKING: "gpt-5.4",              // "Thinking" = gpt-5.4 with high reasoning effort
  FULL: "gpt-5.4",                  // Map old FULL to DEFAULT
  CODEX: "gpt-5.4-mini",            // Map old codex to MINI (gpt-5.3-codex absorbed into 5.4)
  CODEX_MINI: "gpt-5.4-mini",       // Map old codex-mini to MINI
  CODEX_MAX: "gpt-5.4-pro",         // Map old codex-max to PRO
  INSTANT: "gpt-5.4-mini",          // Map old instant to MINI
} as const;

// OpenRouter model ID mapping (add prefix when using OpenRouter gateway)
export const OPENROUTER_PREFIX_MAP: Record<string, string> = {
  "gpt-5.4": "openai/",
  "gpt-5.4-mini": "openai/",
  "gpt-5.4-pro": "openai/",
} as const;

// OpenAI Reasoning Effort Levels (for models that support it)
// Use with gpt-5.4: none=fast, low/medium=balanced, high/xhigh="thinking" mode
export const OPENAI_REASONING = {
  NONE: "none",     // No extra reasoning (fastest, allows temperature)
  LOW: "low",       // Light reasoning
  MEDIUM: "medium", // Balanced reasoning (default)
  HIGH: "high",     // Strong reasoning ("thinking" mode)
  XHIGH: "xhigh",   // Maximum reasoning (most thorough, slowest)
} as const;


// =============================================================================
// GEMINI MODELS (Google)
// =============================================================================
export const GEMINI_MODELS = {
  // Gemini 3.1 Pro - default (3.0 Pro retires Mar 9, 2026)
  GEMINI_3_PRO: "gemini-3.1-pro-preview",     // Migrated: 3.0 retires Mar 9
  GEMINI_3_1_PRO: "gemini-3.1-pro-preview",   // Enhanced reasoning, 1M context
  GEMINI_3_FLASH: "gemini-3-flash-preview",    // Fast frontier model
  GEMINI_3_1_FLASH_LITE: "gemini-3.1-flash-lite", // Mar 3, 2026 - fastest/cheapest in 3.1 series

  // Aliases
  PRO: "gemini-3.1-pro-preview",
  FLASH: "gemini-3-flash-preview",
  FLASH_LITE: "gemini-3.1-flash-lite",
} as const;

// Perplexity Models
export const PERPLEXITY_MODELS = {
  SONAR: "sonar", // Lightweight search (cheapest)
  SONAR_PRO: "sonar-pro", // Advanced search
  SONAR_REASONING: "sonar-reasoning-pro", // Reasoning model (expensive - avoid)
} as const;

// Grok Models (xAI) - Updated 2025-11-22 with correct API model names
export const GROK_MODELS = {
  // Grok 4.1 models (Nov 2025) - LATEST & BEST
  _4_1_FAST_REASONING: "grok-4-1-fast-reasoning",     // Latest: 2M context, $0.20/$0.50, enhanced reasoning
  _4_1_FAST_NON_REASONING: "grok-4-1-fast-non-reasoning", // Tool-calling optimized: 2M context, $0.20/$0.50

  // Grok 4 fast models (2025) - Still good
  CODE_FAST: "grok-code-fast-1",              // Coding specialist: 256K→2M, $0.20/$1.50, 92 tok/sec
  _4_FAST_REASONING: "grok-4-fast-reasoning", // Cheap reasoning: 2M→4M, $0.20/$0.50
  _4_FAST: "grok-4-fast-non-reasoning",       // Fast general: 2M→4M, $0.20/$0.50

  // Expensive/specialized (use sparingly)
  _4_HEAVY: "grok-4-0709",                    // Multi-agent: 256K→2M, $3/$15 (expensive!)
  _3: "grok-3",                               // Legacy with search: 256K→2M
} as const;

// Kimi Models (Moonshot AI via OpenRouter)
// K2.5 released Jan 27, 2026 - Multimodal + Agent Swarm (100 sub-agents)
export const KIMI_MODELS = {
  K2_THINKING: "moonshotai/kimi-k2-thinking",   // 1T MoE, 32B active - agentic reasoning (256k context)
  K2_5: "moonshotai/kimi-k2.5",                 // Multimodal (vision/video), Agent Swarm, tops SWE-Bench
} as const;

// MiniMax Models (MiniMax via OpenRouter)
// M2.7 released Mar 18, 2026 - Self-evolving, #1 AI Intelligence Index, SWE-Pro 56.22%
export const MINIMAX_MODELS = {
  M2_7: "minimax/minimax-m2.7",                 // 2300B/100B MoE, 200K ctx, SWE-Pro 56.22%, Multi-SWE #1, $0.30/$1.20
  M2_5: "minimax/minimax-m2.5",                 // SWE-Bench 80.2%, 37% faster than M2.1 (legacy)
  M2_1: "minimax/minimax-m2.1",                 // 230B/10B MoE - SWE-Bench 72.5% (legacy)
} as const;

// Qwen Models (Alibaba via OpenRouter)
// Qwen3 235B Thinking (July 2025) - Largest reasoning model available
// Qwen3-Coder-Next (Feb 2026) - Agentic coding specialist, 80B/3B MoE, 262K context
export const QWEN_MODELS = {
  CODER_NEXT: "qwen/qwen3-coder-next",         // NEW: 80B/3B MoE, 262K ctx, SWE-Bench >70%, $0.07/$0.30
  CODER_PLUS: "qwen/qwen3-coder-plus",         // Code specialist (32K context)
  CODER: "qwen/qwen3-coder",                   // Legacy coder - 480B MoE, SWE-Bench 69.6%
  QWQ_32B: "qwen/qwq-32b",                     // Deep reasoning - CodeElo 1261
  MAX_THINKING: "qwen/qwen3-235b-a22b-thinking-2507", // 235B MoE (22B active) thinking mode - heavy reasoning
} as const;

// =============================================================================
// OPENROUTER MODELS (Unified - all models accessible via OpenRouter)
// =============================================================================
export const OPENROUTER_MODELS = {
  // Qwen models
  ...QWEN_MODELS,
  // Kimi models
  ...KIMI_MODELS,
  // MiniMax models
  ...MINIMAX_MODELS,
} as const;

// =============================================================================
// PROVIDERS - All provider constants in one place
// =============================================================================
export const PROVIDERS = {
  openai: OPENAI_MODELS,
  google: GEMINI_MODELS,
  xai: GROK_MODELS,
  perplexity: PERPLEXITY_MODELS,
  openrouter: OPENROUTER_MODELS,
} as const;

// All models combined for validation
export const ALL_MODELS = {
  ...OPENAI_MODELS,
  ...GEMINI_MODELS,
  ...PERPLEXITY_MODELS,
  ...GROK_MODELS,
  ...KIMI_MODELS,
  ...QWEN_MODELS,
  ...MINIMAX_MODELS,
} as const;

// Type for any valid model name
export type ModelName = (typeof ALL_MODELS)[keyof typeof ALL_MODELS];

// Common workflow settings
export const DEFAULT_WORKFLOW_SETTINGS = {
  maxTokens: 2000,
  temperature: 0.7,
  retries: 3,
  timeout: 70000, // 70 seconds (Gemini 3.1 Pro Preview needs longer)
} as const;

// ============================================================================
// CURRENT_MODELS - SINGLE BUMP POINT FOR MODEL VERSIONS
// ============================================================================
// When new models release, update ONLY this section!
// All tools automatically use the new models.
// ============================================================================
// UPDATED Mar 21, 2026: GPT-5.4 (flagship) + GPT-5.4-mini (coding/fast)
// gpt-5.3-codex retired — capabilities absorbed into gpt-5.4
export const CURRENT_MODELS = {
  openai: {
    default: OPENAI_MODELS.DEFAULT,       // gpt-5.4 - most capable (Mar 2026)
    reason: OPENAI_MODELS.DEFAULT,        // Deep reasoning (gpt-5.4 + effort=high)
    brainstorm: OPENAI_MODELS.DEFAULT,    // Creative ideation (gpt-5.4 + effort=medium)
    code: OPENAI_MODELS.MINI,             // Code tasks (gpt-5.4-mini - 94% of flagship, 70% cheaper)
    explain: OPENAI_MODELS.MINI,          // Explanations (gpt-5.4-mini - fast & capable)
    search: OPENAI_MODELS.DEFAULT,        // Web search (gpt-5.4 + web_search tool)
    // Premium option for opt-in (use sparingly - $30/$180 per 1M tokens)
    premium: OPENAI_MODELS.PRO,           // Expert mode (gpt-5.4-pro - higher compute)
  },
  grok: {
    reason: GROK_MODELS._4_1_FAST_REASONING,
    code: GROK_MODELS._4_1_FAST_NON_REASONING,
    debug: GROK_MODELS._4_1_FAST_NON_REASONING,
    brainstorm: GROK_MODELS._4_1_FAST_REASONING,
    search: GROK_MODELS._4_1_FAST_REASONING,
    architect: GROK_MODELS._4_1_FAST_REASONING,
  },
  gemini: {
    default: GEMINI_MODELS.GEMINI_3_PRO,
  },
  perplexity: {
    search: PERPLEXITY_MODELS.SONAR,           // $1/$1 per M (cheapest)
    reason: PERPLEXITY_MODELS.SONAR_REASONING, // sonar-reasoning-pro $2/$8 per M
  },
  openrouter: {
    kimi: KIMI_MODELS.K2_5,                // K2.5 multimodal + agent swarm (thinking via reasoning param)
    qwen: QWEN_MODELS.CODER_NEXT,             // Qwen3-Coder-Next: 80B/3B MoE, 262K ctx, SWE >70%
    qwen_reason: QWEN_MODELS.MAX_THINKING, // 235B MoE thinking mode (HMMT 98%)
    minimax: MINIMAX_MODELS.M2_7,          // M2.7: SWE-Pro 56.22%, Multi-SWE #1, self-evolving
  }
} as const;

// Tool-specific defaults - References CURRENT_MODELS for easy bumping
export const TOOL_DEFAULTS = {
  // OpenAI tools (GPT-5.4 reasoning tokens eat into max_output_tokens, so set higher)
  openai_reason: {
    model: CURRENT_MODELS.openai.reason,
    reasoning_effort: OPENAI_REASONING.HIGH,
    maxTokens: 8000,
    temperature: 0.7,
  },
  openai_brainstorm: {
    model: CURRENT_MODELS.openai.brainstorm,
    reasoning_effort: OPENAI_REASONING.MEDIUM,
    maxTokens: 6000,
    temperature: 0.9,
  },
  openai_code_review: {
    model: CURRENT_MODELS.openai.code,
    reasoning_effort: OPENAI_REASONING.MEDIUM,
    maxTokens: 6000,
    temperature: 0.3,
  },
  openai_explain: {
    model: CURRENT_MODELS.openai.explain,
    reasoning_effort: OPENAI_REASONING.LOW,
    maxTokens: 4000,
    temperature: 0.7,
  },
  openai_search: {
    model: CURRENT_MODELS.openai.search,
    reasoning_effort: OPENAI_REASONING.LOW,
    maxTokens: 8000,
    temperature: 0.3,
  },

  // Gemini tools
  gemini_brainstorm: {
    model: CURRENT_MODELS.gemini.default,
    maxTokens: 2048,
    temperature: 0.9,
  },
  gemini_analyze_code: {
    model: CURRENT_MODELS.gemini.default,
    maxTokens: 2048,
    temperature: 0.3,
  },
  gemini_analyze_text: {
    model: CURRENT_MODELS.gemini.default,
    maxTokens: 2048,
    temperature: 0.5,
  },

  // Perplexity tools
  perplexity_ask: {
    model: CURRENT_MODELS.perplexity.search,
    maxTokens: 2000,
    temperature: 0.7,
  },
  perplexity_reason: {
    model: CURRENT_MODELS.perplexity.reason,
    maxTokens: 4000,
    temperature: 0.7,
  },
  perplexity_research: {
    model: CURRENT_MODELS.perplexity.search,
    maxTokens: 3000,
    temperature: 0.7,
  },

  // Grok tools
  grok_reason: {
    model: CURRENT_MODELS.grok.reason,
    maxTokens: 8000,
    temperature: 0.7,
  },
  grok_code: {
    model: CURRENT_MODELS.grok.code,
    maxTokens: 4000,
    temperature: 0.3,
  },
  grok_search: {
    model: CURRENT_MODELS.grok.search,
    maxTokens: 3000,
    temperature: 0.7,
  },
  grok_brainstorm: {
    model: CURRENT_MODELS.grok.brainstorm,
    maxTokens: 4000,
    temperature: 0.9,
  },
  grok_architect: {
    model: CURRENT_MODELS.grok.architect,
    maxTokens: 4000,
    temperature: 0.6,
  },
  grok_debug: {
    model: CURRENT_MODELS.grok.debug,
    maxTokens: 3000,
    temperature: 0.3,
  },

  // OpenRouter tools
  qwen_coder: {
    maxTokens: 4000,
    temperature: 0.5,
  },
  qwen_algo: {
    model: QWEN_MODELS.MAX_THINKING,      // 235B-Thinking (LiveCodeBench 91.4, HMMT 98%)
    maxTokens: 8000,
    temperature: 0.2,
  },
  qwen_reason: {
    model: QWEN_MODELS.MAX_THINKING,      // 235B-Thinking, HMMT 98%
    maxTokens: 8000,
    temperature: 0.3,                      // Lower for precise reasoning
  },
  kimi_thinking: {
    model: KIMI_MODELS.K2_5,              // K2.5 multimodal (thinking via reasoning param)
    maxTokens: 16000,
    temperature: 0.7,
  },
  // MiniMax tools - VERY CHEAP, open source
  minimax_code: {
    model: MINIMAX_MODELS.M2_7,           // SWE-Pro 56.22%, Multi-SWE #1
    maxTokens: 4000,
    temperature: 0.3,                      // Lower for precise code
  },
  minimax_agent: {
    model: MINIMAX_MODELS.M2_7,           // SWE-Pro 56.22%, self-evolving, #1 AI Intelligence Index
    maxTokens: 4000,
    temperature: 0.5,                      // Balanced for agentic tasks
  },

  // Meta tools
  think: {
    model: CURRENT_MODELS.openai.reason,
    reasoning_effort: OPENAI_REASONING.HIGH,
    maxTokens: 4000,
    temperature: 0.7,
  },
  focus: {
    model: CURRENT_MODELS.openai.code,
    reasoning_effort: OPENAI_REASONING.LOW,
    maxTokens: 2000,
    temperature: 0.8,
  },
} as const;

// Default tool to use in workflows if not specified
export const DEFAULT_WORKFLOW_TOOL = "openai_brainstorm";

// =============================================================================
// MODEL DISPLAY NAMES - Single source of truth for UI display
// =============================================================================
// Used in tool outputs, usage stats, logs - keeps display consistent
export const MODEL_DISPLAY_NAMES: Record<string, string> = {
  // OpenAI
  "gpt-5.4": "gpt-5.4",
  "gpt-5.4-mini": "gpt-5.4-mini",
  "gpt-5.4-pro": "gpt-5.4-pro",

  // Gemini
  "gemini-3.1-pro-preview": "gemini-3.1-pro",
  "gemini-3-flash-preview": "gemini-3-flash",
  "gemini-3.1-flash-lite": "gemini-3.1-flash-lite",

  // Grok (xAI)
  "grok-4-1-fast-reasoning": "grok-4.1",
  "grok-4-1-fast-non-reasoning": "grok-4.1-fast",
  "grok-4-fast-reasoning": "grok-4",
  "grok-4-fast-non-reasoning": "grok-4-fast",
  "grok-code-fast-1": "grok-code",
  "grok-4-0709": "grok-4-heavy",
  "grok-3": "grok-3",

  // Perplexity
  "sonar-pro": "perplexity",
  "sonar-reasoning-pro": "perplexity-reason",

  // Kimi (Moonshot)
  "moonshotai/kimi-k2-thinking": "kimi-k2",
  "moonshotai/kimi-k2.5": "kimi-k2.5",
  "moonshotai/kimi-k2.5-thinking": "kimi-k2.5",

  // Qwen (Alibaba)
  "qwen/qwen3-coder-next": "qwen-coder-next",
  "qwen/qwen3-coder-plus": "qwen-coder",
  "qwen/qwen3-coder": "qwen-coder",
  "qwen/qwq-32b": "qwq-32b",
  "qwen/qwen3-max-thinking": "qwen-max",

  // MiniMax
  "minimax/minimax-m2.7": "minimax-m2.7",
  "minimax/minimax-m2.5": "minimax-m2.5",
  "minimax/minimax-m2.1": "minimax-m2.1",
} as const;

// Helper to get display name (falls back to model ID if not mapped)
export function getModelDisplayName(modelId: string): string {
  return MODEL_DISPLAY_NAMES[modelId] || modelId;
}

// Model pricing per 1K tokens (input/output average) for cost tracking
export const MODEL_PRICING: Record<string, number> = {
  // OpenAI
  "gpt-5.4": 0.00875,           // ($2.50 + $15) / 2 / 1000 (Mar 2026)
  "gpt-5.4-mini": 0.002625,     // ($0.75 + $4.50) / 2 / 1000 (Mar 17, 2026)
  "gpt-5.4-pro": 0.105,         // ($30 + $180) / 2 / 1000 (Mar 2026)

  // Gemini
  "gemini-3.1-pro-preview": 0.007, // ($2 + $12) / 2 / 1000
  "gemini-3-flash-preview": 0.00175,     // ($0.50 + $3) / 2 / 1000
  "gemini-3.1-flash-lite": 0.001,       // Cheapest/fastest in 3.1 series (Mar 2026)

  // Grok - all cheap!
  "grok-4-1-fast-reasoning": 0.00035,
  "grok-4-1-fast-non-reasoning": 0.00035,
  "grok-4-fast-reasoning": 0.00035,
  "grok-4-fast-non-reasoning": 0.00035,
  "grok-code-fast-1": 0.00085,
  "grok-4-0709": 0.009,          // expensive
  "grok-3": 0.00035,

  // Perplexity
  "sonar": 0.001,                  // cheapest search
  "sonar-pro": 0.006,
  "sonar-reasoning-pro": 0.006,   // avoid - expensive reasoning tokens

  // OpenRouter models - Kimi
  "moonshotai/kimi-k2-thinking": 0.002,
  "moonshotai/kimi-k2.5": 0.003,
  "moonshotai/kimi-k2.5-thinking": 0.003,

  // OpenRouter models - Qwen
  "qwen/qwen3-coder-next": 0.000185,   // ($0.07 + $0.30) / 2 / 1000 - cheapest coder!
  "qwen/qwen3-coder-plus": 0.0005,
  "qwen/qwen3-coder": 0.0003,
  "qwen/qwq-32b": 0.001,
  "qwen/qwen3-max-thinking": 0.005,

  // OpenRouter models - MiniMax (VERY CHEAP!)
  "minimax/minimax-m2.7": 0.00075,        // ($0.30 + $1.20) / 2 / 1000 - flagship
  "minimax/minimax-m2.5": 0.000685,       // legacy
  "minimax/minimax-m2.1": 0.000685,       // legacy
} as const;
