/**
 * Centralized Model Names and Constants
 * Named by PROVIDER (not model version) for consistency and future-proofing
 * Use these constants instead of hardcoded strings in workflows and tools
 */

// =============================================================================
// OPENAI MODELS (provider-based naming)
// =============================================================================
// GPT-5.2 released Dec 11, 2025 - CURRENT
// OpenRouter uses prefix: openai/gpt-5.2-pro, openai/gpt-5.2, openai/gpt-5.2-chat
export const OPENAI_MODELS = {
  // GPT-5.2 Models (Dec 2025 - CURRENT)
  THINKING: "gpt-5.2-thinking",     // SOTA reasoning: 293% accuracy boost ($1.75/$14, 400K)
  PRO: "gpt-5.2-pro",               // Expert: programming, science, 88.4% GPQA ($21/$168, 400K)
  INSTANT: "gpt-5.2-instant",       // Fast: conversations, explanations ($1.75/$14, 400K)

  // Aliases for backward compatibility
  FULL: "gpt-5.2-thinking",         // Map old FULL to THINKING
  CODEX_MINI: "gpt-5.2-instant",    // Map old codex-mini to INSTANT
  CODEX: "gpt-5.2-pro",             // Map old codex to PRO
  CODEX_MAX: "gpt-5.2-pro",         // Map old codex-max to PRO
} as const;

// OpenRouter model ID mapping (add prefix when using OpenRouter gateway)
export const OPENROUTER_PREFIX_MAP: Record<string, string> = {
  "gpt-5.2-thinking": "openai/",
  "gpt-5.2-pro": "openai/",
  "gpt-5.2-instant": "openai/",
} as const;

// OpenAI Reasoning Effort Levels (for models that support it)
export const OPENAI_REASONING = {
  NONE: "none",   // No extra reasoning (fastest, cheapest)
  LOW: "low",     // Light reasoning
  MEDIUM: "medium", // Balanced reasoning (default)
  HIGH: "high",   // Maximum reasoning (slowest, most thorough)
} as const;


// =============================================================================
// GEMINI MODELS (Google)
// =============================================================================
export const GEMINI_MODELS = {
  // Gemini 3 (November 2025 - Latest)
  GEMINI_3_PRO: "gemini-3-pro-preview", // Latest: structured outputs & multimodal, 1M context

  // Gemini 2.5 (Previous generation - still available)
  FLASH: "gemini-2.5-flash",       // Fast model
  PRO: "gemini-2.5-pro",           // Advanced reasoning
  FLASH_LITE: "gemini-2.5-flash-lite", // Cost-effective
} as const;

// Perplexity Models
export const PERPLEXITY_MODELS = {
  SONAR_PRO: "sonar-pro", // Main search model
  SONAR_REASONING: "sonar-reasoning-pro", // Reasoning model
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
export const KIMI_MODELS = {
  K2_THINKING: "moonshotai/kimi-k2-thinking", // 1T MoE, 32B active - Leading open-source agentic reasoning (256k context)
} as const;

// Qwen Models (Alibaba via OpenRouter)
export const QWEN_MODELS = {
  CODER_PLUS: "qwen/qwen3-coder-plus", // Code specialist (32K context)
  CODER: "qwen/qwen3-coder",           // Standard coder
  QWQ_32B: "qwen/qwq-32b",             // Deep reasoning
} as const;

// =============================================================================
// OPENROUTER MODELS (Unified - all models accessible via OpenRouter)
// =============================================================================
export const OPENROUTER_MODELS = {
  // Qwen models
  ...QWEN_MODELS,
  // Kimi models
  ...KIMI_MODELS,
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
} as const;

// Type for any valid model name
export type ModelName = (typeof ALL_MODELS)[keyof typeof ALL_MODELS];

// Common workflow settings
export const DEFAULT_WORKFLOW_SETTINGS = {
  maxTokens: 2000,
  temperature: 0.7,
  retries: 3,
  timeout: 30000, // 30 seconds
} as const;

// ============================================================================
// CURRENT_MODELS - SINGLE BUMP POINT FOR MODEL VERSIONS
// ============================================================================
// When new models release, update ONLY this section!
// All tools automatically use the new models.
// ============================================================================
// UPDATED Dec 11, 2025: Migrated to GPT-5.2 (PRO for quality, THINKING for reasoning)
export const CURRENT_MODELS = {
  openai: {
    reason: OPENAI_MODELS.THINKING,       // Deep reasoning (gpt-5.2-thinking - 293% accuracy)
    brainstorm: OPENAI_MODELS.PRO,        // Creative ideation (gpt-5.2-pro - HIGH IQ)
    code: OPENAI_MODELS.PRO,              // Code tasks (gpt-5.2-pro - 88.4% GPQA)
    explain: OPENAI_MODELS.PRO,           // Explanations (gpt-5.2-pro - quality)
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
    search: PERPLEXITY_MODELS.SONAR_PRO,
    reason: PERPLEXITY_MODELS.SONAR_REASONING,
  },
  openrouter: {
    kimi: KIMI_MODELS.K2_THINKING,
    qwen: QWEN_MODELS.CODER_PLUS,
  }
} as const;

// Tool-specific defaults - References CURRENT_MODELS for easy bumping
export const TOOL_DEFAULTS = {
  // OpenAI tools
  openai_reason: {
    model: CURRENT_MODELS.openai.reason,
    reasoning_effort: OPENAI_REASONING.HIGH,
    maxTokens: 4000,
    temperature: 0.7,
  },
  openai_brainstorm: {
    model: CURRENT_MODELS.openai.brainstorm,
    reasoning_effort: OPENAI_REASONING.MEDIUM,
    maxTokens: 2000,
    temperature: 0.9,
  },
  openai_code_review: {
    model: CURRENT_MODELS.openai.code,
    reasoning_effort: OPENAI_REASONING.MEDIUM,
    maxTokens: 2000,
    temperature: 0.3,
  },
  openai_explain: {
    model: CURRENT_MODELS.openai.explain,
    reasoning_effort: OPENAI_REASONING.LOW,
    maxTokens: 1500,
    temperature: 0.7,
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
  kimi_thinking: {
    model: CURRENT_MODELS.openrouter.kimi,
    maxTokens: 16000,
    temperature: 0.7,
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
