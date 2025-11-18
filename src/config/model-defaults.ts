/**
 * Model Selection Configuration
 *
 * Provides configurable model selection for Scout, Challenger, and Verifier tools
 * with smart defaults that balance cost and quality.
 *
 * Environment variables allow users to override defaults via Claude Desktop config.
 */

export interface ModelConfig {
  quick?: string[];
  research?: string[];
  standard?: string[];
  deep?: string[];
}

/**
 * Get Scout model configuration
 *
 * Defaults:
 * - quick_scout: Flash + gpt-5.1-codex-mini (speed + cost efficient)
 * - research_scout: Pro + gpt-5.1-codex-mini (quality + cost balance)
 */
export function getScoutModels(): { quick: string[]; research: string[] } {
  const quick = process.env.SCOUT_QUICK_MODELS?.split(',').map(m => m.trim()) ||
    ['qwen/qwen3-coder-plus', 'gemini-2.5-flash', 'gpt-5.1-codex-mini'];

  const research = process.env.SCOUT_RESEARCH_MODELS?.split(',').map(m => m.trim()) ||
    ['qwen/qwen3-coder-plus', 'gemini-2.5-pro', 'gpt-5.1-codex-mini'];

  return { quick, research };
}

/**
 * Get Challenger model configuration
 *
 * Defaults: Pro + gpt-5.1-codex-mini (quality for critical analysis, cost efficient)
 */
export function getChallengerModels(): string[] {
  return process.env.CHALLENGER_MODELS?.split(',').map(m => m.trim()) ||
    ['qwen/qwen3-coder-plus', 'gemini-2.5-pro', 'gpt-5.1-codex-mini'];
}

/**
 * Get Verifier model configuration
 *
 * Defaults:
 * - quick_verify: Flash + gpt-5.1-codex-mini (fast checks, cost efficient)
 * - standard modes: Pro + gpt-5.1-codex-mini (quality + cost balance)
 * - deep_verify: Pro + gpt-5.1 (maximum quality for critical verification)
 */
export function getVerifierModels(): {
  quick: string[];
  deep: string[];
  standard: string[];
} {
  const quick = process.env.VERIFIER_QUICK_MODELS?.split(',').map(m => m.trim()) ||
    ['qwen/qwen3-coder-plus', 'gemini-2.5-flash', 'gpt-5.1-codex-mini'];

  const deep = process.env.VERIFIER_DEEP_MODELS?.split(',').map(m => m.trim()) ||
    ['qwen/qwen3-coder-plus', 'gemini-2.5-pro', 'gpt-5.1'];

  const standard = process.env.VERIFIER_STANDARD_MODELS?.split(',').map(m => m.trim()) ||
    ['qwen/qwen3-coder-plus', 'gemini-2.5-pro', 'gpt-5.1-codex-mini'];

  return { quick, deep, standard };
}

/**
 * Get default fallback models (used when variant has no specific config)
 *
 * Default: Pro + gpt-5.1-codex-mini (balanced quality and cost)
 */
export function getDefaultModels(): string[] {
  return process.env.DEFAULT_MODELS?.split(',').map(m => m.trim()) ||
    ['qwen/qwen3-coder-plus', 'gemini-2.5-pro', 'gpt-5.1-codex-mini'];
}
