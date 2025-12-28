/**
 * Model Availability Service
 * Centralized check for model availability based on API keys and profile settings
 */

import {
  hasGrokApiKey,
  hasOpenAIApiKey,
  hasPerplexityApiKey,
  hasGeminiApiKey,
  hasOpenRouterApiKey,
} from "./api-keys.js";
import { isToolEnabled } from "./tool-config.js";
import { modelProviderRegistry } from "../orchestrators/collaborative/registries/ModelProviderRegistry.js";

export interface ModelAvailability {
  modelName: string;
  toolName: string | null;
  provider: string;
  isAvailable: boolean;
  reason?: string;
}

/**
 * Provider to API key check mapping
 */
const providerApiKeyChecks: Record<string, () => boolean> = {
  "x.ai": hasGrokApiKey,
  "google": hasGeminiApiKey,
  "perplexity": hasPerplexityApiKey,
  "openai": hasOpenAIApiKey,
  "openrouter": hasOpenRouterApiKey,
  "anthropic": () => true, // Always available in Claude Code context
};

/**
 * Check if a specific model is available
 * Combines API key presence + tool enablement in profile
 */
export function isModelAvailable(modelName: string): ModelAvailability {
  const mapping = modelProviderRegistry.getMapping(modelName);

  if (!mapping) {
    return {
      modelName,
      toolName: null,
      provider: "unknown",
      isAvailable: false,
      reason: `Model "${modelName}" not registered`,
    };
  }

  const { toolName, provider } = mapping;

  // Check API key
  const hasApiKey = providerApiKeyChecks[provider];
  if (hasApiKey && !hasApiKey()) {
    return {
      modelName,
      toolName,
      provider,
      isAvailable: false,
      reason: `API key missing for provider "${provider}"`,
    };
  }

  // Check if tool is enabled in profile
  if (!isToolEnabled(toolName)) {
    return {
      modelName,
      toolName,
      provider,
      isAvailable: false,
      reason: `Tool "${toolName}" disabled in profile`,
    };
  }

  return {
    modelName,
    toolName,
    provider,
    isAvailable: true,
    reason: "Available",
  };
}

/**
 * Get all available models with their status
 */
export function getAvailableModels(): ModelAvailability[] {
  const registeredModels = modelProviderRegistry.getRegisteredModels();
  return registeredModels.map((model) => isModelAvailable(model));
}

/**
 * Get list of available model names (for schema enum or display)
 */
export function getAvailableModelNames(): string[] {
  return getAvailableModels()
    .filter((m) => m.isAvailable)
    .map((m) => m.modelName);
}

/**
 * Get formatted string of available models for display
 */
export function getAvailableModelsDisplay(): string {
  const available = getAvailableModels();
  const enabled = available.filter((m) => m.isAvailable);
  const disabled = available.filter((m) => !m.isAvailable);

  let display = `**Available Models** (${enabled.length}): ${enabled.map((m) => m.modelName).join(", ") || "none"}`;

  if (disabled.length > 0) {
    display += `\n**Unavailable** (${disabled.length}): ${disabled.map((m) => `${m.modelName} (${m.reason})`).join(", ")}`;
  }

  return display;
}
