/**
 * Smart Model Router - Optimized model selection based on query complexity
 * Part of Phase 1A implementation for cost optimization
 */

// Tiers refreshed Aug 12, 2026. These were stuck on Mar-2026 models (gpt-5.4,
// gpt-5.4-pro, gemini-3-flash-preview) — the workflow engine was routing live traffic to
// a legacy lineup, and estimateCost() fell through to its flat $0.001 default for every
// current model because none of them were in MODEL_COSTS below.
export enum ModelTier {
  // Tier 0: Cheapest — Gemini 3.5 Flash-Lite ($0.30/$2.50, Jul 21 2026)
  ULTRA_CHEAP = "gemini-3.5-flash-lite",

  // Tier 1: Fast & Efficient
  ULTRA_EFFICIENT = "gemini-3.7-flash", // $0.75/$3.75 intro workhorse (Aug 13 2026 GA; $1.50/$7.50 from Jan 2027)
  EFFICIENT = "gpt-5.6-luna", // $0.20/$1.20 after the Jul 30 -80% cut

  // Tier 2: Balanced — gpt-5.6-terra is gpt-5.5-level at $2/$12
  STANDARD = "gpt-5.6-terra",
  GPT5_MINI = "gpt-5.6-luna", // Legacy alias: the "mini" tier is now luna

  // Tier 3: Advanced
  WEB_SEARCH = "perplexity-sonar-pro", // With citations

  // Tier 4: Premium (opt-in only)
  GPT5_FULL = "gpt-5.6-sol", // Flagship $5/$30; crank reasoning.effort for "pro"
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

// Prices are per 1K tokens (0.005 = $5.00 per 1M). Any model missing here silently
// falls through to estimateCost()'s flat $0.001 default, so every routable tier above
// MUST have an entry.
const MODEL_COSTS: ModelCosts = {
  // GPT-6 Astra (Sep 3, 2026) — current OpenAI default. Latency is an estimate, not measured.
  "gpt-6-astra": { input: 0.010, output: 0.050, latency: 2400 },

  // GPT-5.6 family (Jul 9, 2026; terra/luna repriced Jul 30, 2026)
  "gpt-5.6-sol": { input: 0.005, output: 0.030, latency: 2200 },        // Flagship
  "gpt-5.6-terra": { input: 0.002, output: 0.012, latency: 1300 },      // Balanced (-20%)
  "gpt-5.6-luna": { input: 0.0002, output: 0.0012, latency: 700 },      // Cheap (-80%)

  // GPT-5.5 fallback
  "gpt-5.5": { input: 0.005, output: 0.030, latency: 2000 },

  // Legacy GPT-5.4 (kept so historical workflow runs still cost out)
  "gpt-5.4": { input: 0.0025, output: 0.015, latency: 1500 },
  "gpt-5.4-mini": { input: 0.00075, output: 0.0045, latency: 800 },
  "gpt-5.4-pro": { input: 0.030, output: 0.180, latency: 2500 },

  // Gemini
  "gemini-3.7-flash": { input: 0.00075, output: 0.00375, latency: 600 },     // Aug 13, 2026 (intro pricing through Dec 31, 2026)
  "gemini-3.6-flash": { input: 0.0015, output: 0.0075, latency: 600 },       // Jul 21, 2026
  "gemini-3.5-flash-lite": { input: 0.0003, output: 0.0025, latency: 400 },  // Jul 21, 2026
  "gemini-3.5-flash": { input: 0.0015, output: 0.009, latency: 600 },        // May 19, 2026
  "gemini-3.1-pro-preview": { input: 0.002, output: 0.012, latency: 1200 },  // Judge/reasoning default
  "gemini-3-flash-preview": { input: 0.0005, output: 0.003, latency: 500 },  // Legacy

  // Other models
  qwencoder: { input: 0.00015, output: 0.0006, latency: 1000 },
  "perplexity-sonar-pro": { input: 0.006, output: 0.006, latency: 2000 },
  sonar: { input: 0.001, output: 0.001, latency: 1500 },
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
    // Rule 1: Simple queries → GPT-5.1 Codex Mini (CHEAPEST!)
    if (context.complexity === "simple" && context.costSensitive !== false) {
      // Check if GPT-5 is enabled
      const gpt5Enabled = process.env.ENABLE_GPT5 !== "false";

      if (gpt5Enabled) {
        return {
          primary: ModelTier.ULTRA_CHEAP, // gemini-3-flash
          fallback: ModelTier.ULTRA_EFFICIENT, // gemini-3-flash
          estimatedCost: 0.002,
          estimatedLatency: 800,
          requiresConfirmation: false,
          reasoning: "Simple query - using cheapest option",
        };
      } else {
        return {
          primary: ModelTier.ULTRA_EFFICIENT, // gemini-3.1-pro-preview
          fallback: ModelTier.EFFICIENT,
          estimatedCost: 0.0002,
          estimatedLatency: 800,
          requiresConfirmation: false,
          reasoning: "Simple query - using Gemini 3 Pro Preview (GPT-5 disabled)",
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
