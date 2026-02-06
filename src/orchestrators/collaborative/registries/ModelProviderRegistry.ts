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
   * Normalize model name: lowercase + spaces/underscores to hyphens
   * Allows "gemini judge", "gemini_judge", "GEMINI-JUDGE" all to match "gemini-judge"
   */
  private normalizeModelName(name: string): string {
    return name.toLowerCase().replace(/[\s_]+/g, "-");
  }

  /**
   * Get tool name for a model
   * Returns null if no mapping found
   */
  getToolName(modelName: string): string | null {
    const mapping = this.mappings.get(this.normalizeModelName(modelName));
    return mapping?.toolName || null;
  }

  /**
   * Get provider for a model
   * Returns "unknown" if no mapping found
   */
  getProvider(modelName: string): string {
    const mapping = this.mappings.get(this.normalizeModelName(modelName));
    return mapping?.provider || "unknown";
  }

  /**
   * Get full mapping for a model
   */
  getMapping(modelName: string): ModelMapping | null {
    return this.mappings.get(this.normalizeModelName(modelName)) || null;
  }

  /**
   * Check if a model is registered
   */
  hasModel(modelName: string): boolean {
    return this.mappings.has(this.normalizeModelName(modelName));
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

  // Gemini models (all use gemini-3-pro-preview for RAW POWER)
  // NOTE: gemini_query was never registered - using gemini_brainstorm as default (most versatile)
  { modelName: "gemini", toolName: "gemini_brainstorm", provider: "google", aliases: ["gemini-pro", "gemini-3-pro-preview", "gemini-3-pro"] },
  { modelName: "gemini-3-pro-preview", toolName: "gemini_analyze_text", provider: "google", aliases: ["gemini-3", "gemini-analyze"] },

  // Perplexity models
  { modelName: "perplexity", toolName: "perplexity_ask", provider: "perplexity" },
  { modelName: "perplexity-reason", toolName: "perplexity_reason", provider: "perplexity" },

  // OpenAI models
  { modelName: "openai", toolName: "openai_brainstorm", provider: "openai", aliases: ["openai-gpt5", "openai-gpt5-nano"] },
  { modelName: "gpt5", toolName: "gpt5_reason", provider: "openai", aliases: ["gpt-5"] },
  { modelName: "gpt5-mini", toolName: "gpt5_mini_reason", provider: "openai", aliases: ["gpt-5-mini"] },

  // Kimi models (Moonshot AI)
  { modelName: "kimi", toolName: "kimi_thinking", provider: "openrouter", aliases: ["kimi-k2", "kimi-k2-thinking", "kimi-thinking", "kimi-k2.5"] },

  // Qwen reason (heavy math/reasoning)
  { modelName: "qwen-reason", toolName: "qwen_reason", provider: "openrouter", aliases: ["qwen_reason", "qwen-max", "qwen-thinking"] },

  // MiniMax models (cheap agentic)
  { modelName: "minimax", toolName: "minimax_agent", provider: "openrouter", aliases: ["minimax-agent", "minimax-m2.1"] },
  { modelName: "minimax-code", toolName: "minimax_code", provider: "openrouter", aliases: ["minimax_code"] },

  // Think tool
  { modelName: "think", toolName: "think", provider: "anthropic" },

  // Convenience aliases for nextThought multi-model chains
  { modelName: "grok-search", toolName: "grok_search", provider: "x.ai" },
  { modelName: "grok-reason", toolName: "grok_reason", provider: "x.ai" },
  { modelName: "grok-debug", toolName: "grok_debug", provider: "x.ai" },
  { modelName: "gemini-brainstorm", toolName: "gemini_brainstorm", provider: "google" },
  { modelName: "gemini-judge", toolName: "gemini_judge", provider: "google", aliases: ["gemini-synthesize", "gemini-verdict"] },
  { modelName: "gemini-analyze", toolName: "gemini_analyze_text", provider: "google" },
  { modelName: "perplexity-research", toolName: "perplexity_research", provider: "perplexity" },
  { modelName: "openai-reason", toolName: "openai_reason", provider: "openai", aliases: ["gpt-reason"] },
]);
