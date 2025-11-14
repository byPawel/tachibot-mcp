/**
 * Model Preferences Configuration
 * Allows users to set their preferred models based on available API tokens
 */

export interface ModelPreferences {
  // Primary reasoning model (highest priority)
  primaryReasoning?: string;
  // Backup reasoning models (in order of preference)
  backupReasoning?: string[];
  // Primary research model
  primaryResearch?: string;
  // Primary analysis model
  primaryAnalysis?: string;
  // Enable expensive models (o3, grok-heavy, etc.)
  enableExpensiveModels?: boolean;
  // Model-specific overrides
  modelOverrides?: Record<string, ModelConfig>;
}

export interface ModelConfig {
  enabled: boolean;
  priority: number; // Lower = higher priority
  maxTokens?: number;
  temperature?: number;
  costLimit?: number; // Max cost per request in USD
}

/**
 * Default model configurations with user preferences
 */
export class ModelPreferencesManager {
  private preferences: ModelPreferences = {};
  private availableModels: Map<string, ModelConfig> = new Map();

  constructor() {
    this.loadPreferences();
    this.initializeModels();
  }

  /**
   * Load preferences from environment variables
   */
  private loadPreferences(): void {
    // Check for user preferences in environment
    const primaryModel = process.env.PRIMARY_REASONING_MODEL;
    const backupModels = process.env.BACKUP_REASONING_MODELS?.split(",").map(
      (m) => m.trim(),
    );
    const enableExpensive = process.env.ENABLE_EXPENSIVE_MODELS === "true";
    const preferGrok = process.env.PREFER_GROK === "true";
    const preferO3 = process.env.PREFER_O3 === "true";

    const defaultBackups = ["gpt5_mini", "gpt41_mini", "gpt5"];
    this.preferences = {
      primaryReasoning: primaryModel || "gpt5",
      backupReasoning:
        backupModels && backupModels.length > 0 ? backupModels : defaultBackups,
      primaryResearch: process.env.PRIMARY_RESEARCH_MODEL,
      primaryAnalysis: process.env.PRIMARY_ANALYSIS_MODEL,
      enableExpensiveModels: enableExpensive,
      modelOverrides: {},
    };

    // Handle specific model preferences
    if (preferGrok) {
      this.preferences.primaryReasoning = "grok_heavy";
      this.preferences.enableExpensiveModels = true;
    }

    if (preferO3) {
      this.preferences.primaryReasoning = "openai_gpt5_reason";
      this.preferences.enableExpensiveModels = true;
    }

    // Load model-specific overrides from environment
    this.loadModelOverrides();
  }

  /**
   * Load model-specific overrides
   */
  private loadModelOverrides(): void {
    // GPT-5 configuration (assumes OpenAI key)
    if (process.env.OPENAI_API_KEY) {
      this.preferences.modelOverrides!["gpt5"] = {
        enabled: process.env.DISABLE_GPT5 !== "true",
        priority: parseInt(process.env.GPT5_PRIORITY || "0"),
        maxTokens: parseInt(process.env.GPT5_MAX_TOKENS || "8000"),
        costLimit: parseFloat(process.env.GPT5_COST_LIMIT || "5.0"),
      };

      this.preferences.modelOverrides!["gpt5_mini"] = {
        enabled: process.env.DISABLE_GPT5_MINI === "true" ? false : true,
        priority: parseInt(process.env.GPT5_MINI_PRIORITY || "1"),
        maxTokens: parseInt(process.env.GPT5_MINI_MAX_TOKENS || "6000"),
        costLimit: parseFloat(process.env.GPT5_MINI_COST_LIMIT || "2.5"),
      };
    }

    // Grok configuration
    if (process.env.GROK_API_KEY) {
      this.preferences.modelOverrides!["grok_reason"] = {
        enabled: true,
        priority: parseInt(process.env.GROK_PRIORITY || "2"),
        maxTokens: parseInt(process.env.GROK_MAX_TOKENS || "100000"),
        costLimit: parseFloat(process.env.GROK_COST_LIMIT || "1.0"),
      };

      this.preferences.modelOverrides!["grok_heavy"] = {
        enabled: process.env.ENABLE_GROK_HEAVY === "true",
        priority: parseInt(process.env.GROK_HEAVY_PRIORITY || "1"),
        maxTokens: parseInt(process.env.GROK_HEAVY_MAX_TOKENS || "256000"),
        costLimit: parseFloat(process.env.GROK_HEAVY_COST_LIMIT || "5.0"),
      };
    }

    // GPT-5 reasoning configuration
    if (process.env.OPENAI_API_KEY) {
      this.preferences.modelOverrides!["gpt5_reason"] = {
        enabled: process.env.ENABLE_GPT5 === "true",
        priority: parseInt(process.env.GPT5_REASON_PRIORITY || "1"),
        maxTokens: parseInt(process.env.GPT5_REASON_MAX_TOKENS || "100000"),
        costLimit: parseFloat(process.env.GPT5_REASON_COST_LIMIT || "2.0"),
      };

      this.preferences.modelOverrides!["gpt5_mini_reason"] = {
        enabled: true, // Always enabled, no confirmation needed
        priority: parseInt(process.env.GPT5_MINI_REASON_PRIORITY || "2"),
        maxTokens: parseInt(process.env.GPT5_MINI_REASON_MAX_TOKENS || "128000"),
        costLimit: parseFloat(process.env.GPT5_MINI_REASON_COST_LIMIT || "1.5"),
      };
    }

    // DeepSeek R1
    if (process.env.DEEPSEEK_API_KEY) {
      this.preferences.modelOverrides!["deepseek_r1"] = {
        enabled: process.env.ENABLE_DEEPSEEK_R1 === "true",
        priority: parseInt(process.env.DEEPSEEK_R1_PRIORITY || "3"),
        maxTokens: parseInt(process.env.DEEPSEEK_R1_MAX_TOKENS || "64000"),
        costLimit: parseFloat(process.env.DEEPSEEK_R1_COST_LIMIT || "0.5"),
      };
    }

    // Qwen models via OpenRouter
    if (process.env.OPENROUTER_API_KEY) {
      this.preferences.modelOverrides!["qwen_coder"] = {
        enabled: true,
        priority: parseInt(process.env.QWEN_CODER_PRIORITY || "4"),
        maxTokens: parseInt(process.env.QWEN_CODER_MAX_TOKENS || "32000"),
        costLimit: parseFloat(process.env.QWEN_CODER_COST_LIMIT || "0.3"),
      };

      this.preferences.modelOverrides!["qwq_reason"] = {
        enabled: true,
        priority: parseInt(process.env.QWQ_PRIORITY || "3"),
        maxTokens: parseInt(process.env.QWQ_MAX_TOKENS || "32000"),
        costLimit: parseFloat(process.env.QWQ_COST_LIMIT || "0.2"),
      };
    }
  }

  /**
   * Initialize available models based on API keys
   */
  private initializeModels(): void {
    // Check which APIs are available
    const hasGrok = !!process.env.GROK_API_KEY;
    const hasOpenAI = !!process.env.OPENAI_API_KEY;
    const hasGemini = !!process.env.GOOGLE_API_KEY;
    const hasPerplexity = !!process.env.PERPLEXITY_API_KEY;
    const hasOpenRouter = !!process.env.OPENROUTER_API_KEY;
    const hasDeepSeek = !!process.env.DEEPSEEK_API_KEY;

    // Set up available models with default configs
    if (hasGrok) {
      this.availableModels.set("grok_reason", {
        enabled: true,
        priority: 5,
      });

      this.availableModels.set("grok_heavy", {
        enabled: this.preferences.enableExpensiveModels || false,
        priority: 2,
      });

      this.availableModels.set("grok_code", {
        enabled: true,
        priority: 4,
      });
    }

    if (hasOpenAI) {
      const gpt5Override = this.preferences.modelOverrides?.["gpt5"];
      this.availableModels.set("gpt5", {
        enabled: gpt5Override?.enabled !== false,
        priority: gpt5Override?.priority ?? 0,
        maxTokens: gpt5Override?.maxTokens,
        costLimit: gpt5Override?.costLimit,
      });

      const gpt5MiniOverride = this.preferences.modelOverrides?.["gpt5_mini"];
      this.availableModels.set("gpt5_mini", {
        enabled: gpt5MiniOverride?.enabled !== false,
        priority: gpt5MiniOverride?.priority ?? 1,
        maxTokens: gpt5MiniOverride?.maxTokens,
        costLimit: gpt5MiniOverride?.costLimit,
      });

      const gpt41Override = this.preferences.modelOverrides?.["gpt41_mini"];
      this.availableModels.set("gpt41_mini", {
        enabled: true,
        priority: Math.max(gpt41Override?.priority ?? 4, 4),
        maxTokens: gpt41Override?.maxTokens,
        costLimit: gpt41Override?.costLimit,
      });

      // Removed deprecated gpt4o - use gpt5_mini instead

      this.availableModels.set("gpt5_reason", {
        enabled: this.preferences.enableExpensiveModels || false,
        priority: 2,
      });

      this.availableModels.set("gpt5_mini_reason", {
        enabled: true, // Always available
        priority: 3,
      });
    }

    if (hasGemini) {
      this.availableModels.set("gemini_25_pro", {
        enabled: true,
        priority: 6,
      });

      this.availableModels.set("gemini_brainstorm", {
        enabled: true,
        priority: 7,
      });
    }

    if (hasDeepSeek) {
      this.availableModels.set("deepseek_r1", {
        enabled: this.preferences.enableExpensiveModels || false,
        priority: 3,
      });
    }

    if (hasOpenRouter) {
      this.availableModels.set("qwen_coder", {
        enabled: true,
        priority: 5,
      });

      this.availableModels.set("qwq_reason", {
        enabled: true,
        priority: 4,
      });
    }

    // Apply user overrides
    for (const [model, config] of Object.entries(
      this.preferences.modelOverrides || {},
    )) {
      if (this.availableModels.has(model)) {
        this.availableModels.set(model, {
          ...this.availableModels.get(model)!,
          ...config,
        });
      }
    }

    // Ensure primary reasoning defaults to GPT-5 when available
    if (
      !this.preferences.primaryReasoning &&
      this.availableModels.get("gpt5")?.enabled
    ) {
      this.preferences.primaryReasoning = "gpt5";
    }
  }

  /**
   * Get the best model for a specific task
   */
  getBestModelForTask(
    taskType: "reasoning" | "research" | "analysis" | "code",
    allowExpensive: boolean = false,
  ): string | null {
    // Check for explicit preferences first
    if (taskType === "reasoning" && this.preferences.primaryReasoning) {
      const model = this.availableModels.get(this.preferences.primaryReasoning);
      if (model?.enabled) {
        return this.preferences.primaryReasoning;
      }
    }

    if (taskType === "research" && this.preferences.primaryResearch) {
      const model = this.availableModels.get(this.preferences.primaryResearch);
      if (model?.enabled) {
        return this.preferences.primaryResearch;
      }
    }

    // Find best available model by priority
    const candidates: Array<[string, ModelConfig]> = [];

    for (const [modelId, config] of this.availableModels.entries()) {
      if (!config.enabled) continue;

      // Skip expensive models unless allowed
      if (!allowExpensive && !this.preferences.enableExpensiveModels) {
        const expensiveModels = [
          "grok_heavy",
          "gpt5_reason",
          "deepseek_r1",
        ];
        if (expensiveModels.includes(modelId)) continue;
      }

      // Filter by task type
      if (taskType === "reasoning") {
        if (
          modelId.includes("reason") ||
          modelId.includes("think") ||
          modelId.includes("gpt5") ||
          modelId === "grok_heavy" ||
          modelId === "deepseek_r1"
        ) {
          candidates.push([modelId, config]);
        }
      } else if (taskType === "code") {
        if (modelId.includes("code") || modelId.includes("coder")) {
          candidates.push([modelId, config]);
        }
      } else if (taskType === "research") {
        if (
          modelId.includes("perplexity") ||
          modelId.includes("scout") ||
          modelId.includes("research")
        ) {
          candidates.push([modelId, config]);
        }
      } else if (taskType === "analysis") {
        if (
          modelId.includes("analyze") ||
          modelId.includes("gpt5") ||
          modelId.includes("gemini")
        ) {
          candidates.push([modelId, config]);
        }
      }
    }

    // Sort by priority (lower number = higher priority)
    candidates.sort((a, b) => a[1].priority - b[1].priority);

    return candidates.length > 0 ? candidates[0][0] : null;
  }

  /**
   * Get fallback chain for a model
   */
  getFallbackChain(primaryModel: string): string[] {
    const chain: string[] = [];

    // Add user-specified backups first
    if (this.preferences.backupReasoning) {
      for (const backup of this.preferences.backupReasoning) {
        const model = this.availableModels.get(backup);
        if (model?.enabled && backup !== primaryModel) {
          chain.push(backup);
        }
      }
    }

    // Ensure GPT-5 family fallback ordering is respected
    const preferredFallbacks = ["gpt5_mini", "gpt41_mini", "gpt5"];
    for (const candidate of preferredFallbacks) {
      if (candidate !== primaryModel) {
        const config = this.availableModels.get(candidate);
        if (config?.enabled && !chain.includes(candidate)) {
          chain.push(candidate);
        }
      }
    }

    // Add automatic fallbacks based on availability and priority
    const sortedModels = Array.from(this.availableModels.entries())
      .filter(([id, config]) => config.enabled && id !== primaryModel)
      .sort((a, b) => a[1].priority - b[1].priority)
      .map(([id]) => id);

    // Add top 3 alternatives not already in chain
    for (const model of sortedModels) {
      if (!chain.includes(model)) {
        chain.push(model);
        if (chain.length >= 3) break;
      }
    }

    return chain;
  }

  /**
   * Check if a model is available and enabled
   */
  isModelAvailable(modelId: string): boolean {
    const model = this.availableModels.get(modelId);
    return model?.enabled || false;
  }

  /**
   * Get model configuration
   */
  getModelConfig(modelId: string): ModelConfig | null {
    return this.availableModels.get(modelId) || null;
  }

  /**
   * Update model preference at runtime
   */
  setModelPreference(modelId: string, config: Partial<ModelConfig>): void {
    const existing = this.availableModels.get(modelId);
    if (existing) {
      this.availableModels.set(modelId, { ...existing, ...config });
    }
  }

  /**
   * Get recommendations based on user's available APIs
   */
  getRecommendations(): string[] {
    const recommendations: string[] = [];
    const hasGrok = !!process.env.GROK_API_KEY;
    const hasOpenAI = !!process.env.OPENAI_API_KEY;

    if (hasGrok && !this.preferences.enableExpensiveModels) {
      recommendations.push(
        "You have Grok API access. Enable ENABLE_EXPENSIVE_MODELS=true to use Grok Heavy (256k context).",
      );
    }

    if (hasOpenAI && !this.isModelAvailable("gpt5_reason")) {
      recommendations.push(
        "You have OpenAI API access. Enable ENABLE_GPT5=true to use GPT-5 reasoning models.",
      );
    }

    if (!this.preferences.primaryReasoning) {
      const bestModel = this.getBestModelForTask("reasoning", true);
      if (bestModel) {
        recommendations.push(
          `Set PRIMARY_REASONING_MODEL=${bestModel} in .env for optimal performance.`,
        );
      }
    }

    return recommendations;
  }

  /**
   * Export current configuration for debugging
   */
  exportConfiguration(): {
    preferences: ModelPreferences;
    availableModels: Array<{ id: string; config: ModelConfig }>;
    recommendations: string[];
  } {
    return {
      preferences: this.preferences,
      availableModels: Array.from(this.availableModels.entries()).map(
        ([id, config]) => ({
          id,
          config,
        }),
      ),
      recommendations: this.getRecommendations(),
    };
  }
}

// Export singleton instance
export const modelPreferences = new ModelPreferencesManager();
