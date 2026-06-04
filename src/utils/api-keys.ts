/**
 * Centralized API Key Resolution
 * Single source of truth for all API key lookups (SRP)
 */

// Grok/xAI - supports both XAI_API_KEY (new) and GROK_API_KEY (legacy)
export const getGrokApiKey = (): string | undefined =>
  process.env.XAI_API_KEY || process.env.GROK_API_KEY;

export const hasGrokApiKey = (): boolean =>
  !!(process.env.XAI_API_KEY || process.env.GROK_API_KEY);

// Other providers (single key each)
export const getOpenAIApiKey = (): string | undefined => process.env.OPENAI_API_KEY;
export const hasOpenAIApiKey = (): boolean => !!process.env.OPENAI_API_KEY;

export const getPerplexityApiKey = (): string | undefined => process.env.PERPLEXITY_API_KEY;
export const hasPerplexityApiKey = (): boolean => !!process.env.PERPLEXITY_API_KEY;

export const getGeminiApiKey = (): string | undefined => process.env.GOOGLE_API_KEY;
export const hasGeminiApiKey = (): boolean => !!process.env.GOOGLE_API_KEY;

export const getOpenRouterApiKey = (): string | undefined => process.env.OPENROUTER_API_KEY;
export const hasOpenRouterApiKey = (): boolean => !!process.env.OPENROUTER_API_KEY;

export const getQwenApiKey = (): string | undefined => process.env.QWEN_API_KEY;
export const hasQwenApiKey = (): boolean => !!process.env.QWEN_API_KEY;

export const getDeepSeekApiKey = (): string | undefined => process.env.DEEPSEEK_API_KEY;
export const hasDeepSeekApiKey = (): boolean => !!process.env.DEEPSEEK_API_KEY;

// Local LLM (Ollama / LM Studio / llama.cpp / vLLM — any OpenAI-compatible endpoint)
// No API key required; presence is implied by a running local server.
// Defaults target Ollama. Override via LOCAL_LLM_BASE_URL / LOCAL_LLM_MODEL.
export const getLocalLLMBaseUrl = (): string =>
  process.env.LOCAL_LLM_BASE_URL || "http://localhost:11434/v1"; // Ollama default (LM Studio: http://localhost:1234/v1)
export const getLocalLLMModel = (): string =>
  process.env.LOCAL_LLM_MODEL || "hermes3"; // Nous Hermes
export const getLocalLLMApiKey = (): string => process.env.LOCAL_LLM_API_KEY || "local"; // most local servers ignore this
// Treat local as "available" once the user has opted in by setting a base URL or model.
export const hasLocalLLM = (): boolean =>
  !!(process.env.LOCAL_LLM_BASE_URL || process.env.LOCAL_LLM_MODEL);
