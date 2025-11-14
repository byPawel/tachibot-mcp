/**
 * Centralized Model Names and Constants
 * Use these constants instead of hardcoded strings in workflows and tools
 */

// OpenAI GPT-5 Models (August 2025)
export const GPT5_MODELS = {
  NANO: "gpt-5-nano", // Fastest, most cost-efficient ($0.05/$0.40 per 1M tokens)
  MINI: "gpt-5-mini", // Balanced performance ($0.25/$2 per 1M tokens)
  FULL: "gpt-5", // Most advanced ($1.25/$10 per 1M tokens)
} as const;

// OpenAI GPT-4 Models
export const GPT4_MODELS = {
  O_MINI: "gpt-5-mini", // Cost-efficient
  O: "gpt-5", // Current best
  _1_MINI: "gpt-4.1-mini", // Best value with 1M context
} as const;

// Google Gemini Models (2025)
export const GEMINI_MODELS = {
  FLASH: "gemini-2.5-flash", // Latest fast model
  PRO: "gemini-2.5-pro", // Most advanced reasoning
  FLASH_LITE: "gemini-2.5-flash-lite", // Cost-effective
} as const;

// Perplexity Models
export const PERPLEXITY_MODELS = {
  SONAR_PRO: "sonar-pro", // Main search model
  SONAR_REASONING: "sonar-reasoning-pro", // Reasoning model
} as const;

// Grok Models (xAI) - Updated 2025-11-07
export const GROK_MODELS = {
  // New fast models (2025) - PRIMARY USE
  CODE_FAST: "grok-code-fast-1",              // Coding specialist: 256K→2M, $0.20/$1.50, 92 tok/sec
  _4_FAST_REASONING: "grok-4-fast-reasoning", // Cheap reasoning: 2M→4M, $0.20/$0.50 (3x cheaper!)
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
  ...GPT5_MODELS,
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

// Tool-specific defaults for ALL tools
export const TOOL_DEFAULTS = {
  // OpenAI GPT-5 tools
  gpt5_nano: {
    model: GPT5_MODELS.NANO,
    maxTokens: 1000,
    temperature: 1.0, // GPT-5 requires temperature=1
  },
  gpt5_mini: {
    model: GPT5_MODELS.MINI,
    maxTokens: 2000,
    temperature: 1.0,
  },
  gpt5: {
    model: GPT5_MODELS.FULL,
    maxTokens: 4000,
    temperature: 1.0,
  },

  // Gemini tools
  gemini_query: {
    model: GEMINI_MODELS.PRO,
    maxTokens: 2048,
    temperature: 0.7,
  },
  gemini_brainstorm: {
    model: GEMINI_MODELS.PRO,
    maxTokens: 2048,
    temperature: 0.9,
  },
  gemini_analyze_code: {
    model: GEMINI_MODELS.PRO,
    maxTokens: 2048,
    temperature: 0.3,
  },
  gemini_analyze_text: {
    model: GEMINI_MODELS.PRO,
    maxTokens: 2048,
    temperature: 0.5,
  },

  // Perplexity tools
  perplexity_ask: {
    model: PERPLEXITY_MODELS.SONAR_PRO,
    maxTokens: 2000,
    temperature: 0.7,
  },
  perplexity_reason: {
    model: PERPLEXITY_MODELS.SONAR_REASONING,
    maxTokens: 4000,
    temperature: 0.7,
  },
  perplexity_research: {
    model: PERPLEXITY_MODELS.SONAR_PRO,
    maxTokens: 3000,
    temperature: 0.7,
  },

  // Grok tools - UPDATED with new fast models
  grok: {
    model: GROK_MODELS._4_FAST_REASONING, // Changed: 3x cheaper output
    maxTokens: 4000,
    temperature: 0.7,
  },
  grok_reason: {
    model: GROK_MODELS._4_FAST_REASONING, // Changed: 3x cheaper, 8x context
    maxTokens: 8000,
    temperature: 0.7,
  },
  grok_code: {
    model: GROK_MODELS.CODE_FAST, // Changed: Coding specialist, 3x faster
    maxTokens: 4000,
    temperature: 0.3,
  },
  grok_search: {
    model: GROK_MODELS._4_FAST_REASONING, // Changed: Use fast reasoning with search
    maxTokens: 3000,
    temperature: 0.7,
  },
  grok_brainstorm: {
    model: GROK_MODELS._4_FAST, // Changed: Fast non-reasoning for creativity
    maxTokens: 4000,
    temperature: 0.9,
  },
  grok_architect: {
    model: GROK_MODELS._4_FAST_REASONING, // New: Architecture needs reasoning
    maxTokens: 4000,
    temperature: 0.6,
  },
  grok_debug: {
    model: GROK_MODELS.CODE_FAST, // New: Use code specialist for debugging
    maxTokens: 3000,
    temperature: 0.3,
  },

  // Qwen tools (via OpenRouter)
  qwen_coder: {
    maxTokens: 4000,
    temperature: 0.5,
  },

  // Kimi tools (via OpenRouter)
  kimi_thinking: {
    model: KIMI_MODELS.K2_THINKING,
    maxTokens: 16000, // Large for detailed reasoning chains
    temperature: 0.7, // Higher for creative reasoning
  },

  // Meta tools (think, focus, code_reviewer, etc.)
  think: {
    model: GPT5_MODELS.MINI,
    maxTokens: 500,
    temperature: 0.7,
  },
  focus: {
    model: GPT5_MODELS.MINI,
    maxTokens: 2000,
    temperature: 0.8,
  },
  code_reviewer: {
    model: GPT5_MODELS.MINI,
    maxTokens: 2000,
    temperature: 0.5,
  },
  test_architect: {
    model: GPT5_MODELS.MINI,
    maxTokens: 2000,
    temperature: 0.6,
  },
  documentation_writer: {
    model: GPT5_MODELS.MINI,
    maxTokens: 2000,
    temperature: 0.7,
  },
} as const;

// Default tool to use in workflows if not specified
export const DEFAULT_WORKFLOW_TOOL = "gpt5_mini";
