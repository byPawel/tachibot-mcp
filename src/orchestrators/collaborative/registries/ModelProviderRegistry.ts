/**
 * Model Provider Registry
 * Maps model names to tool names and providers
 * Replaces hard-coded switch statements
 */

export interface ModelMapping {
  modelName: string;
  toolName: string;
  provider: string;
  aliases?: string[]; // Alternative names for this model
}

export class ModelProviderRegistry {
  private mappings: Map<string, ModelMapping> = new Map();

  /**
   * Register a model mapping
   */
  register(mapping: ModelMapping): void {
    // Register primary name
    this.mappings.set(mapping.modelName.toLowerCase(), mapping);

    // Register aliases
    if (mapping.aliases) {
      mapping.aliases.forEach(alias => {
        this.mappings.set(alias.toLowerCase(), mapping);
      });
    }
  }

  /**
   * Register multiple mappings at once
   */
  registerMany(mappings: ModelMapping[]): void {
    mappings.forEach(m => this.register(m));
  }

  /**
   * Get tool name for a model
   * Returns null if no mapping found
   */
  getToolName(modelName: string): string | null {
    const mapping = this.mappings.get(modelName.toLowerCase());
    return mapping?.toolName || null;
  }

  /**
   * Get provider for a model
   * Returns "unknown" if no mapping found
   */
  getProvider(modelName: string): string {
    const mapping = this.mappings.get(modelName.toLowerCase());
    return mapping?.provider || "unknown";
  }

  /**
   * Get full mapping for a model
   */
  getMapping(modelName: string): ModelMapping | null {
    return this.mappings.get(modelName.toLowerCase()) || null;
  }

  /**
   * Check if a model is registered
   */
  hasModel(modelName: string): boolean {
    return this.mappings.has(modelName.toLowerCase());
  }

  /**
   * Get all registered model names
   */
  getRegisteredModels(): string[] {
    const models = new Set<string>();
    this.mappings.forEach(mapping => {
      models.add(mapping.modelName);
    });
    return Array.from(models);
  }
}

// Singleton instance with default mappings
export const modelProviderRegistry = new ModelProviderRegistry();

// Register default model mappings (extracted from CollaborativeOrchestrator)
modelProviderRegistry.registerMany([
  // Qwen models
  { modelName: "qwen", toolName: "qwen_coder", provider: "openrouter" },
  { modelName: "qwen-coder", toolName: "qwen_coder", provider: "openrouter" },
  { modelName: "qwq", toolName: "qwq_reason", provider: "openrouter" },

  // Grok models
  { modelName: "grok", toolName: "grok_reason", provider: "x.ai" },
  { modelName: "grok-4", toolName: "grok_reason", provider: "x.ai", aliases: ["grok-4-0709"] },

  // Claude models
  { modelName: "claude", toolName: "think", provider: "anthropic", aliases: ["claude-code", "reasoning", "analysis"] },

  // Gemini models
  { modelName: "gemini", toolName: "gemini_query", provider: "google", aliases: ["gemini-pro", "gemini-2.5-pro"] },
  { modelName: "gemini-2.5-flash", toolName: "gemini_analyze_text", provider: "google", aliases: ["gemini-2.5-flash-lite"] },

  // Perplexity models
  { modelName: "perplexity", toolName: "perplexity_ask", provider: "perplexity" },
  { modelName: "perplexity-reason", toolName: "perplexity_reason", provider: "perplexity" },

  // OpenAI models
  { modelName: "openai", toolName: "openai_brainstorm", provider: "openai", aliases: ["openai-gpt5", "openai-gpt5-nano"] },
  { modelName: "gpt5", toolName: "gpt5_reason", provider: "openai", aliases: ["gpt-5"] },
  { modelName: "gpt5-mini", toolName: "gpt5_mini_reason", provider: "openai", aliases: ["gpt-5-mini"] },

  // Kimi models (Moonshot AI)
  { modelName: "kimi", toolName: "kimi_thinking", provider: "openrouter", aliases: ["kimi-k2", "kimi-k2-thinking", "kimi-thinking"] },

  // Think tool
  { modelName: "think", toolName: "think", provider: "anthropic" }
]);
