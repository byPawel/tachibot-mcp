export interface TokenMetrics {
  input: number;
  output: number;
  total: number;
  cost: number;
  model: string;
  timestamp: number;
}

export interface TokenReport {
  totalTokens: number;
  totalCost: number;
  byModel: Map<string, TokenMetrics>;
  byStep: Map<string, TokenMetrics>;
  savings: number;
  optimizationRate: number;
}

export class TokenTracker {
  private metrics: Map<string, TokenMetrics> = new Map();
  private modelCosts: Map<string, number> = new Map([
    ['gpt5', 12],
    ['gpt5_mini', 8],
    ['gpt5_nano', 2],
    ['gemini-3.1-pro-preview', 10],
    ['perplexity-sonar-pro', 6],
    ['qwen3-coder-480b', 12],
    ['qwq-32b', 10],
    ['think', 0],
  ]);

  track(
    stepId: string,
    response: any,
    model: string,
    inputTokens?: number,
    outputTokens?: number
  ): TokenMetrics {
    const input = inputTokens || this.estimateInputTokens(response);
    const output = outputTokens || this.estimateOutputTokens(response);
    const total = input + output;
    const cost = this.calculateCost(model, total);

    const metrics: TokenMetrics = {
      input,
      output,
      total,
      cost,
      model,
      timestamp: Date.now()
    };

    this.metrics.set(stepId, metrics);
    return metrics;
  }

  getReport(): TokenReport {
    let totalTokens = 0;
    let totalCost = 0;
    const byModel = new Map<string, TokenMetrics>();
    const byStep = new Map<string, TokenMetrics>();

    for (const [stepId, metrics] of this.metrics) {
      totalTokens += metrics.total;
      totalCost += metrics.cost;
      byStep.set(stepId, metrics);

      const existing = byModel.get(metrics.model);
      if (existing) {
        byModel.set(metrics.model, {
          ...existing,
          input: existing.input + metrics.input,
          output: existing.output + metrics.output,
          total: existing.total + metrics.total,
          cost: existing.cost + metrics.cost
        });
      } else {
        byModel.set(metrics.model, { ...metrics });
      }
    }

    const baselineCost = this.calculateBaselineCost(totalTokens);
    const savings = baselineCost - totalCost;
    const optimizationRate = savings / baselineCost;

    return {
      totalTokens,
      totalCost,
      byModel,
      byStep,
      savings,
      optimizationRate
    };
  }

  reset(): void {
    this.metrics.clear();
  }

  private estimateInputTokens(response: any): number {
    if (typeof response === 'string') {
      return Math.ceil(response.length / 4);
    }
    if (response && response.prompt) {
      return Math.ceil(response.prompt.length / 4);
    }
    return 100;
  }

  private estimateOutputTokens(response: any): number {
    if (typeof response === 'string') {
      return Math.ceil(response.length / 4);
    }
    if (response && response.content) {
      return Math.ceil(response.content.length / 4);
    }
    if (response && response.response) {
      return Math.ceil(response.response.length / 4);
    }
    return 500;
  }

  calculateCost(model: string, tokens: number): number {
    const costPerMillion = this.modelCosts.get(model) || 5;
    return (tokens / 1000000) * costPerMillion;
  }

  private calculateBaselineCost(tokens: number): number {
    const baselineModel = 'gpt5';
    return this.calculateCost(baselineModel, tokens);
  }

  getOptimizationSuggestions(): string[] {
    const suggestions: string[] = [];
    const report = this.getReport();

    if (report.optimizationRate < 0.5) {
      suggestions.push('Consider batching requests to optimize token usage');
    }

    for (const [model, metrics] of report.byModel) {
      if (model !== 'think' && metrics.total > 10000) {
        suggestions.push(`High token usage for ${model}: ${metrics.total} tokens. Consider chunking or summarization.`);
      }
    }

    const expensiveModels = ['gpt5_reason', 'qwen3-coder-480b'];
    for (const model of expensiveModels) {
      if (report.byModel.has(model)) {
        suggestions.push(`Using expensive model ${model}. Ensure it's necessary for the task complexity.`);
      }
    }

    return suggestions;
  }
}
