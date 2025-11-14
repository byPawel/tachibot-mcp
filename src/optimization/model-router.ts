/**
 * Smart Model Router - Optimized model selection based on query complexity
 * Part of Phase 1A implementation for cost optimization
 */

export enum ModelTier {
  // Tier 0: NEW! GPT-5 Nano - CHEAPEST OPTION
  ULTRA_CHEAP = "gpt-5-nano", // $0.00005/1K input - INSANELY CHEAP!

  // Tier 1: Ultra Fast & Cheap (< $0.001 per request)
  ULTRA_EFFICIENT = "gemini-2.5-flash", // $0.000075/1K - Second cheapest
  EFFICIENT = "gpt-5-mini", // Cost-efficient

  // Tier 2: Balanced ($0.001-$0.01 per request)
  STANDARD = "gpt-5", // Best for code
  GPT5_MINI = "gpt-5-mini", // $0.00025/1K - Good balance

  // Tier 3: Advanced ($0.01-$0.05 per request)
  WEB_SEARCH = "perplexity-sonar-pro", // $0.006/1K - With citations

  // Tier 4: Premium (Use with caution)
  GPT5_FULL = "gpt-5", // $0.00125/1K input, $0.01/1K output - EXPENSIVE
}

export interface QueryContext {
  query: string;
  complexity: "simple" | "moderate" | "complex";
  type?: "code" | "chat" | "analysis" | "research" | "reasoning";
  requiresWeb?: boolean;
  requiresReasoning?: boolean;
  urgency?: "realtime" | "fast" | "normal";
  costSensitive?: boolean;
  maxTokens?: number;
  temperature?: number;
}

export interface ModelSelection {
  primary: string;
  fallback: string;
  estimatedCost: number;
  estimatedLatency: number;
  requiresConfirmation: boolean;
  reasoning?: string;
}

interface ModelCosts {
  [key: string]: {
    input: number; // per 1K tokens
    output: number; // per 1K tokens
    latency: number; // ms
  };
}

const MODEL_COSTS: ModelCosts = {
  // GPT-5 Models (Nov 2025 pricing)
  "gpt-5-nano": { input: 0.00005, output: 0.0004, latency: 400 }, // CHEAPEST!
  "gpt-5-mini": { input: 0.00025, output: 0.002, latency: 800 },
  "gpt-5": { input: 0.00125, output: 0.01, latency: 2000 },

  // Existing models
  "gemini-2.5-flash": { input: 0.000075, output: 0.0003, latency: 500 },
  "gemini-2.5-pro": { input: 0.00015, output: 0.0006, latency: 1000 },
  qwencoder: { input: 0.00015, output: 0.0006, latency: 1000 },
  "perplexity-sonar-pro": { input: 0.006, output: 0.006, latency: 2000 },
};

export class SmartModelRouter {
  private complexityCache = new Map<
    string,
    "simple" | "moderate" | "complex"
  >();

  /**
   * Analyze query to determine complexity
   */
  private analyzeComplexity(query: string): "simple" | "moderate" | "complex" {
    // Check cache first
    const cached = this.complexityCache.get(query);
    if (cached) return cached;

    const wordCount = query.split(/\s+/).length;
    const hasCode = /```|function|class|import|const|let|var/.test(query);
    const hasMultiStep = /step|first|then|after|finally|additionally/.test(
      query.toLowerCase(),
    );
    const hasMath = /calculate|solve|equation|formula/.test(
      query.toLowerCase(),
    );
    const hasAnalysis = /analyze|compare|evaluate|assess/.test(
      query.toLowerCase(),
    );

    let complexity: "simple" | "moderate" | "complex" = "simple";

    if (wordCount > 100 || hasMultiStep || hasMath) {
      complexity = "complex";
    } else if (wordCount > 30 || hasCode || hasAnalysis) {
      complexity = "moderate";
    }

    // Cache for reuse
    this.complexityCache.set(query, complexity);
    return complexity;
  }

  /**
   * Detect query type from content
   */
  private detectQueryType(query: string): QueryContext["type"] {
    const lowerQuery = query.toLowerCase();

    if (/```|function|class|implement|debug|fix/.test(query)) {
      return "code";
    }
    if (/research|find|search|what is|explain/.test(lowerQuery)) {
      return "research";
    }
    if (/analyze|compare|evaluate|assess/.test(lowerQuery)) {
      return "analysis";
    }
    if (/think|reason|solve|calculate|prove/.test(lowerQuery)) {
      return "reasoning";
    }
    return "chat";
  }

  /**
   * Build context from query
   */
  buildContext(query: string, overrides?: Partial<QueryContext>): QueryContext {
    return {
      query,
      complexity: this.analyzeComplexity(query),
      type: this.detectQueryType(query),
      requiresWeb: /current|latest|today|news|http|www/.test(query),
      requiresReasoning: /why|how|solve|prove|calculate/.test(
        query.toLowerCase(),
      ),
      urgency: "normal",
      costSensitive: true, // Default to cost-sensitive
      ...overrides,
    };
  }

  /**
   * Select optimal model based on context
   */
  selectModel(context: QueryContext): ModelSelection {
    // Rule 1: Simple queries → GPT-5 Nano (CHEAPEST!)
    if (context.complexity === "simple" && context.costSensitive !== false) {
      // Check if GPT-5 is enabled
      const gpt5Enabled = process.env.ENABLE_GPT5 !== "false";

      if (gpt5Enabled) {
        return {
          primary: ModelTier.ULTRA_CHEAP, // gpt-5-nano
          fallback: ModelTier.ULTRA_EFFICIENT, // gemini-2.5-flash
          estimatedCost: 0.000008, // Even cheaper than gemini!
          estimatedLatency: 400,
          requiresConfirmation: false,
          reasoning: "Simple query - using GPT-5 Nano (cheapest option)",
        };
      } else {
        return {
          primary: ModelTier.ULTRA_EFFICIENT, // gemini-2.5-flash
          fallback: ModelTier.EFFICIENT,
          estimatedCost: 0.00001,
          estimatedLatency: 500,
          requiresConfirmation: false,
          reasoning: "Simple query - using Gemini Flash (GPT-5 disabled)",
        };
      }
    }

    // Rule 2: Web search required → Perplexity
    if (context.requiresWeb) {
      return {
        primary: ModelTier.WEB_SEARCH,
        fallback: ModelTier.STANDARD,
        estimatedCost: 0.006,
        estimatedLatency: 2000,
        requiresConfirmation: false,
        reasoning: "Web search required - using Perplexity",
      };
    }

    // Rule 3: Code generation → GPT-5 (proven best)
    if (context.type === "code") {
      if (context.complexity === "complex") {
        return {
          primary: ModelTier.STANDARD,
          fallback: ModelTier.EFFICIENT,
          estimatedCost: 0.005,
          estimatedLatency: 1500,
          requiresConfirmation: false,
          reasoning: "Complex code generation - using GPT-5",
        };
      }
      return {
        primary: ModelTier.EFFICIENT,
        fallback: ModelTier.ULTRA_EFFICIENT,
        estimatedCost: 0.0003,
        estimatedLatency: 1000,
        requiresConfirmation: false,
        reasoning: "Simple code task - using GPT-5-mini",
      };
    }

    // Rule 4: Complex reasoning → GPT-5 models
    if (context.requiresReasoning && context.complexity !== "simple") {
      if (context.urgency === "fast" || context.costSensitive) {
        return {
          primary: ModelTier.EFFICIENT,
          fallback: ModelTier.STANDARD,
          estimatedCost: 0.003,
          estimatedLatency: 2000,
          requiresConfirmation: false,
          reasoning: "Reasoning required - using gpt-5-mini for speed/cost",
        };
      }

      if (context.complexity === "complex") {
        return {
          primary: ModelTier.STANDARD,
          fallback: ModelTier.EFFICIENT,
          estimatedCost: 0.015,
          estimatedLatency: 3000,
          requiresConfirmation: true, // Expensive
          reasoning:
            "Complex reasoning - using gpt-5 (requires confirmation)",
        };
      }
    }

    // Rule 5: Moderate complexity → Balanced
    if (context.complexity === "moderate") {
      return {
        primary: ModelTier.EFFICIENT,
        fallback: ModelTier.ULTRA_EFFICIENT,
        estimatedCost: 0.0003,
        estimatedLatency: 1000,
        requiresConfirmation: false,
        reasoning: "Moderate complexity - using GPT-5-mini",
      };
    }

    // Default: Cost-efficient
    return {
      primary: ModelTier.EFFICIENT,
      fallback: ModelTier.ULTRA_EFFICIENT,
      estimatedCost: 0.00015,
      estimatedLatency: 1000,
      requiresConfirmation: false,
      reasoning: "Default selection - using cost-efficient model",
    };
  }

  /**
   * Estimate cost for a request
   */
  estimateCost(model: string, estimatedTokens: number): number {
    const costs = MODEL_COSTS[model];
    if (!costs) return 0.001; // Default estimate

    // Assume 40% input, 60% output for typical usage
    const inputTokens = estimatedTokens * 0.4;
    const outputTokens = estimatedTokens * 0.6;

    return (inputTokens * costs.input + outputTokens * costs.output) / 1000;
  }

  /**
   * Get model recommendations for a query
   */
  getRecommendations(query: string): {
    optimal: ModelSelection;
    alternatives: ModelSelection[];
    context: QueryContext;
  } {
    const context = this.buildContext(query);
    const optimal = this.selectModel(context);

    // Generate alternatives
    const alternatives: ModelSelection[] = [];

    // Cheaper alternative
    const cheaperContext = {
      ...context,
      costSensitive: true,
      complexity: "simple" as const,
    };
    const cheaper = this.selectModel(cheaperContext);
    if (cheaper.primary !== optimal.primary) {
      alternatives.push({ ...cheaper, reasoning: "Cheaper alternative" });
    }

    // Faster alternative
    const fasterContext = { ...context, urgency: "fast" as const };
    const faster = this.selectModel(fasterContext);
    if (
      faster.primary !== optimal.primary &&
      faster.primary !== cheaper.primary
    ) {
      alternatives.push({ ...faster, reasoning: "Faster alternative" });
    }

    // Higher quality alternative
    const qualityContext = {
      ...context,
      costSensitive: false,
      complexity: "complex" as const,
    };
    const quality = this.selectModel(qualityContext);
    if (quality.primary !== optimal.primary) {
      alternatives.push({
        ...quality,
        reasoning: "Higher quality alternative",
      });
    }

    return {
      optimal,
      alternatives: alternatives.slice(0, 3), // Max 3 alternatives
      context,
    };
  }

  /**
   * Clear complexity cache (call periodically to prevent memory growth)
   */
  clearCache(): void {
    if (this.complexityCache.size > 1000) {
      this.complexityCache.clear();
    }
  }
}

// Export singleton instance
export const modelRouter = new SmartModelRouter();
