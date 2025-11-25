/**
 * Centralized Model Names and Constants
 * Use these constants instead of hardcoded strings in workflows and tools
 */

// OpenAI GPT-5 Models (November 2025) - Optimized for Claude Code MCP
// Verified via Perplexity + OpenAI API docs
// Strategy: Use codex for code (80%), flagship for reasoning, pro for orchestration
// NOTE: Codex models use /v1/responses endpoint, non-codex use /v1/chat/completions
export const GPT5_MODELS = {
  // General purpose (use /v1/chat/completions)
  FULL: "gpt-5.1",              // Flagship: reasoning/fallback ($10/$30, 2M context)
  PRO: "gpt-5-pro",              // Premium: complex orchestration ($20/$60, 4M context, 2x cost)

  // Code specialized (use /v1/responses endpoint!)
  CODEX_MINI: "gpt-5.1-codex-mini", // Workhorse: 70-80% of code tasks ($2/$6, 256K) ⚡ CHEAP!
  CODEX: "gpt-5.1-codex",        // Power: complex code tasks ($15/$45, 1M context)
  CODEX_MAX: "gpt-5.1-codex-max", // Frontier: BEST for deep analysis & multi-file refactoring (pricing TBD)

  // REMOVED: MINI (redundant - codex-mini better for code), NANO (too weak)
} as const;

// Backward compatibility alias
export const GPT51_MODELS = GPT5_MODELS;

// GPT-5.1 Reasoning Effort Levels
export const GPT51_REASONING = {
  NONE: "none", // No extra reasoning (fastest, cheapest)
  LOW: "low", // Light reasoning
  MEDIUM: "medium", // Balanced reasoning (default)
  HIGH: "high", // Maximum reasoning (slowest, most thorough)
} as const;

// OpenAI GPT-4 Models (Legacy - mapped to GPT-5.1)
export const GPT4_MODELS = {
  O_MINI: "gpt-5-mini", // Cost-efficient (mapped to GPT-5 mini)
  O: "gpt-5.1", // Current best (mapped to GPT-5.1 flagship)
  _1_MINI: "gpt-4.1-mini", // Best value with 1M context
} as const;

// Google Gemini Models (2025)
export const GEMINI_MODELS = {
  // Gemini 3 (November 2025 - Latest)
  GEMINI_3_PRO: "gemini-3-pro-preview", // Latest with enhanced structured outputs & multimodal, 1M context

  // Gemini 2.5 (Previous generation)
  FLASH: "gemini-2.5-flash", // Latest fast model
  PRO: "gemini-2.5-pro", // Most advanced reasoning
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

// Kimi Models (Moonshot AI via OpenRouter) - Added 2025-11-07
export const KIMI_MODELS = {
  K2_THINKING: "moonshotai/kimi-k2-thinking", // 1T MoE, 32B active - Leading open-source agentic reasoning (256k context)
} as const;

// All models combined for validation
export const ALL_MODELS = {
  ...GPT51_MODELS,
  ...GPT4_MODELS,
  ...GEMINI_MODELS,
  ...PERPLEXITY_MODELS,
  ...GROK_MODELS,
  ...KIMI_MODELS,
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
export const CURRENT_MODELS = {
  openai: {
    reason: GPT5_MODELS.PRO,           // Deep reasoning
    brainstorm: GPT5_MODELS.FULL,       // Creative ideation
    code: GPT5_MODELS.CODEX_MINI,       // Code tasks (cheap & fast)
    explain: GPT5_MODELS.CODEX_MINI,    // Explanations
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
  }
} as const;

// Tool-specific defaults - References CURRENT_MODELS for easy bumping
export const TOOL_DEFAULTS = {
  // OpenAI tools
  openai_reason: {
    model: CURRENT_MODELS.openai.reason,
    reasoning_effort: GPT51_REASONING.HIGH,
    maxTokens: 4000,
    temperature: 0.7,
  },
  openai_brainstorm: {
    model: CURRENT_MODELS.openai.brainstorm,
    reasoning_effort: GPT51_REASONING.MEDIUM,
    maxTokens: 2000,
    temperature: 0.9,
  },
  openai_code_review: {
    model: CURRENT_MODELS.openai.code,
    reasoning_effort: GPT51_REASONING.MEDIUM,
    maxTokens: 2000,
    temperature: 0.3,
  },
  openai_explain: {
    model: CURRENT_MODELS.openai.explain,
    reasoning_effort: GPT51_REASONING.LOW,
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
    reasoning_effort: GPT51_REASONING.HIGH,
    maxTokens: 500,
    temperature: 0.7,
  },
  focus: {
    model: CURRENT_MODELS.openai.code,
    reasoning_effort: GPT51_REASONING.LOW,
    maxTokens: 2000,
    temperature: 0.8,
  },
} as const;

// Default tool to use in workflows if not specified
export const DEFAULT_WORKFLOW_TOOL = "openai_brainstorm";
