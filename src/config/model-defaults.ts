/**
 * Model Selection Configuration
 *
 * Provides configurable model selection for Scout, Challenger, and Verifier tools
 * with smart defaults that balance cost and quality.
 *
 * Environment variables allow users to override defaults via Claude Desktop config.
 *
 * DRY: Imports model names from model-constants.ts - update there to bump versions.
 */

import {
  GEMINI_MODELS,
  OPENAI_MODELS,
  GROK_MODELS,
  PERPLEXITY_MODELS,
  KIMI_MODELS,
  QWEN_MODELS,
  MINIMAX_MODELS
} from './model-constants.js';

/**
 * Default model selections by provider
 * Strategy: Always use latest models (quality over cost)
 * Update model-constants.ts to bump versions
 */
const MODELS = {
  // Google Gemini
  GEMINI: GEMINI_MODELS.GEMINI_3_PRO,           // gemini-3.1-pro-preview

  // OpenAI (GPT-5.2)
  OPENAI: OPENAI_MODELS.THINKING,               // gpt-5.2-thinking (default - SOTA reasoning)
  OPENAI_REASON: OPENAI_MODELS.THINKING,        // gpt-5.2-thinking (deep reasoning)

  // xAI Grok
  GROK: GROK_MODELS._4_1_FAST_REASONING,        // grok-4-1-fast-reasoning

  // Perplexity
  PERPLEXITY: PERPLEXITY_MODELS.SONAR,           // sonar (cheapest)
  PERPLEXITY_REASON: PERPLEXITY_MODELS.SONAR_PRO, // sonar-pro (was sonar-reasoning-pro)

  // OpenRouter
  QWEN: QWEN_MODELS.CODER_NEXT,                 // qwen/qwen3-coder-next (80B/3B MoE, 262K ctx)
  QWEN_REASON: QWEN_MODELS.MAX_THINKING,        // qwen/qwen3-235b-a22b-thinking (235B MoE)
  KIMI: KIMI_MODELS.K2_5,                       // moonshotai/kimi-k2.5 (thinking via reasoning param)
  MINIMAX: MINIMAX_MODELS.M2_5,                 // minimax/minimax-m2.5 (SWE 80.2%, open source)
} as const;

export interface ModelConfig {
  quick?: string[];
  research?: string[];
  standard?: string[];
  deep?: string[];
}

/**
 * Get Scout model configuration
 * All variants use Gemini 3 Pro (latest & best)
 */
export function getScoutModels(): { quick: string[]; research: string[] } {
  const quick = process.env.SCOUT_QUICK_MODELS?.split(',').map(m => m.trim()) ||
    [MODELS.QWEN, MODELS.GEMINI, MODELS.OPENAI];

  const research = process.env.SCOUT_RESEARCH_MODELS?.split(',').map(m => m.trim()) ||
    [MODELS.QWEN, MODELS.GEMINI, MODELS.OPENAI];

  return { quick, research };
}

/**
 * Get Challenger model configuration
 * Uses Gemini 3 Pro for critical analysis
 */
export function getChallengerModels(): string[] {
  return process.env.CHALLENGER_MODELS?.split(',').map(m => m.trim()) ||
    [MODELS.QWEN, MODELS.GEMINI, MODELS.OPENAI];
}

/**
 * Get Verifier model configuration
 * All variants use Gemini 3 Pro; deep uses gpt-5.2-thinking for max reasoning
 */
export function getVerifierModels(): {
  quick: string[];
  deep: string[];
  standard: string[];
} {
  const quick = process.env.VERIFIER_QUICK_MODELS?.split(',').map(m => m.trim()) ||
    [MODELS.QWEN, MODELS.GEMINI, MODELS.OPENAI];

  const deep = process.env.VERIFIER_DEEP_MODELS?.split(',').map(m => m.trim()) ||
    [MODELS.QWEN, MODELS.GEMINI, MODELS.OPENAI_REASON];

  const standard = process.env.VERIFIER_STANDARD_MODELS?.split(',').map(m => m.trim()) ||
    [MODELS.QWEN, MODELS.GEMINI, MODELS.OPENAI];

  return { quick, deep, standard };
}

/**
 * Get default fallback models
 * Uses Gemini 3 Pro + codex-mini
 */
export function getDefaultModels(): string[] {
  return process.env.DEFAULT_MODELS?.split(',').map(m => m.trim()) ||
    [MODELS.QWEN, MODELS.GEMINI, MODELS.OPENAI];
}
