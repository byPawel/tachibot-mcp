/**
 * Optimized Tools Wrapper - Integrates Phase 1 optimizations
 * Wraps existing tool calls with model routing, token optimization, and cost monitoring
 */

import { modelRouter, tokenOptimizer, costMonitor } from '../optimization/index.js';
import type { QueryContext, ModelSelection } from '../optimization/model-router.js';

export interface OptimizedToolCall {
  tool: string;
  query: string;
  model?: string;
  maxTokens?: number;
  temperature?: number;
  metadata?: Record<string, any>;
}

export interface OptimizedToolResult {
  result: any;
  model: string;
  cost: number;
  cached: boolean;
  optimized: boolean;
  tokensSaved?: number;
  alert?: string;
}

/**
 * Main optimization wrapper for tool calls
 */
export class OptimizedToolWrapper {
  private readonly defaultMaxTokens = 1000;
  private readonly confirmationThreshold = 0.10; // $0.10

  /**
   * Execute tool call with optimizations
   */
  async executeOptimized(
    toolCall: OptimizedToolCall,
    executor: (model: string, prompt: string, options: any) => Promise<any>
  ): Promise<OptimizedToolResult> {
    // Step 1: Build context and select model
    const context = modelRouter.buildContext(toolCall.query, {
      maxTokens: toolCall.maxTokens,
      temperature: toolCall.temperature,
    });

    const selection = this.selectModelWithOverride(context, toolCall.model);

    // Step 2: Check cost limits
    const costCheck = await costMonitor.checkRequest(
      selection.primary,
      toolCall.maxTokens || this.defaultMaxTokens
    );

    if (!costCheck.allowed) {
      throw new Error(`Cost limit exceeded: ${costCheck.warning}`);
    }

    if (costCheck.requiresConfirmation && costCheck.estimatedCost > this.confirmationThreshold) {
      console.warn(`⚠️ High cost request: $${costCheck.estimatedCost.toFixed(2)} for model ${selection.primary}`);
      // In production, this would trigger a user confirmation
    }

    // Step 3: Optimize the request
    const optimizedRequest = await tokenOptimizer.optimize({
      prompt: toolCall.query,
      model: selection.primary,
      maxTokens: toolCall.maxTokens,
      temperature: toolCall.temperature,
      metadata: toolCall.metadata,
      canBatch: true,
    });

    // Step 4: If cached, return immediately
    if (optimizedRequest.fromCache) {
      return {
        result: optimizedRequest.prompt, // In real implementation, this would be the cached response
        model: selection.primary,
        cost: 0,
        cached: true,
        optimized: true,
        tokensSaved: optimizedRequest.originalLength ?
          optimizedRequest.originalLength - optimizedRequest.prompt.length : 0,
      };
    }

    // Step 5: Execute with selected model
    let result: any;
    let actualModel = selection.primary;
    let inputTokens = 0;
    let outputTokens = 0;

    try {
      // Execute with primary model
      result = await executor(selection.primary, optimizedRequest.prompt, {
        maxTokens: toolCall.maxTokens || this.defaultMaxTokens,
        temperature: toolCall.temperature || 0.7,
        ...toolCall.metadata,
      });

      // Estimate tokens (in production, get actual counts from API response)
      inputTokens = Math.ceil(optimizedRequest.prompt.length / 4);
      outputTokens = Math.ceil((typeof result === 'string' ? result.length : JSON.stringify(result).length) / 4);

    } catch (error) {
      // Try fallback model
      console.warn(`Primary model ${selection.primary} failed, trying fallback ${selection.fallback}`);
      actualModel = selection.fallback;

      result = await executor(selection.fallback, optimizedRequest.prompt, {
        maxTokens: toolCall.maxTokens || this.defaultMaxTokens,
        temperature: toolCall.temperature || 0.7,
        ...toolCall.metadata,
      });

      inputTokens = Math.ceil(optimizedRequest.prompt.length / 4);
      outputTokens = Math.ceil((typeof result === 'string' ? result.length : JSON.stringify(result).length) / 4);
    }

    // Step 6: Track usage
    const usage = await costMonitor.trackUsage(
      actualModel,
      inputTokens,
      outputTokens,
      `tool-${toolCall.tool}-${Date.now()}`,
    );

    // Step 7: Return optimized result
    return {
      result,
      model: actualModel,
      cost: usage.cost,
      cached: false,
      optimized: optimizedRequest.compressed || false,
      tokensSaved: optimizedRequest.originalLength ?
        optimizedRequest.originalLength - (optimizedRequest.compressedLength || optimizedRequest.prompt.length) : 0,
      alert: usage.alert?.message,
    };
  }

  /**
   * Select model with optional override
   */
  private selectModelWithOverride(context: QueryContext, override?: string): ModelSelection {
    if (override) {
      // User specified a model, use it but still calculate costs
      const cost = modelRouter.estimateCost(override, context.maxTokens || this.defaultMaxTokens);
      return {
        primary: override,
        fallback: modelRouter.selectModel(context).primary,
        estimatedCost: cost,
        estimatedLatency: 2000,
        requiresConfirmation: cost > this.confirmationThreshold,
        reasoning: 'User-specified model override',
      };
    }

    return modelRouter.selectModel(context);
  }

  /**
   * Get optimization statistics
   */
  getStats() {
    const tokenMetrics = tokenOptimizer.getMetrics();
    const costReport = costMonitor.getUsageReport();

    return {
      optimization: {
        cacheHitRate: `${(tokenMetrics.cacheHitRate * 100).toFixed(1)}%`,
        compressionRatio: `${(tokenMetrics.compressionRatio * 100).toFixed(1)}%`,
        tokensSaved: tokenMetrics.totalSaved,
        batchesProcessed: tokenMetrics.batchesProcessed,
      },
      costs: {
        hourly: `$${costReport.hourly.used.toFixed(2)} / $${costReport.hourly.limit.toFixed(2)}`,
        daily: `$${costReport.daily.used.toFixed(2)} / $${costReport.daily.limit.toFixed(2)}`,
        remaining: {
          hourly: `$${costReport.hourly.remaining.toFixed(2)}`,
          daily: `$${costReport.daily.remaining.toFixed(2)}`,
        },
      },
      topModels: costReport.topModels.map(m =>
        `${m.model}: $${m.cost.toFixed(3)} (${m.usage} calls)`
      ),
      alerts: costReport.alerts.map(a => a.message),
      recommendations: [
        ...tokenMetrics.recommendations,
        ...this.generateRecommendations(tokenMetrics, costReport),
      ],
    };
  }

  /**
   * Generate optimization recommendations
   */
  private generateRecommendations(tokenMetrics: any, costReport: any): string[] {
    const recs: string[] = [];

    // Check if using expensive models too much
    const expensiveModels = ['gpt-5'];
    const topModel = costReport.topModels[0];

    if (topModel && expensiveModels.includes(topModel.model)) {
      recs.push(`💰 Consider using cheaper models - ${topModel.model} is your top cost driver`);
    }

    // Check cache effectiveness
    if (tokenMetrics.cacheHitRate > 0.5) {
      recs.push('✅ Cache is working effectively');
    }

    // Check compression
    if (tokenMetrics.compressionRatio > 0.3) {
      recs.push(`📦 Good compression ratio: ${(tokenMetrics.compressionRatio * 100).toFixed(0)}% reduction`);
    }

    // Cost savings estimate
    const potentialSavings = costReport.daily.used * 0.7; // 70% reduction target
    if (potentialSavings > 1) {
      recs.push(`💎 Optimizations could save ~$${potentialSavings.toFixed(2)}/day`);
    }

    return recs;
  }

  /**
   * Reset all metrics
   */
  resetMetrics() {
    tokenOptimizer.resetMetrics();
    costMonitor.reset();
  }
}

// Export singleton instance
export const optimizedWrapper = new OptimizedToolWrapper();

/**
 * Helper function to wrap any tool with optimizations
 */
export function wrapWithOptimization(
  toolName: string,
  originalExecutor: (model: string, prompt: string, options: any) => Promise<any>
) {
  return async (query: string, options?: any) => {
    const result = await optimizedWrapper.executeOptimized(
      {
        tool: toolName,
        query,
        model: options?.model,
        maxTokens: options?.maxTokens,
        temperature: options?.temperature,
        metadata: options,
      },
      originalExecutor
    );

    // Log optimization info
    if (result.cached) {
      console.error(`✅ Cached response used for ${toolName}`);
    }
    if (result.tokensSaved && result.tokensSaved > 0) {
      console.error(`📦 Saved ${result.tokensSaved} tokens through optimization`);
    }
    if (result.alert) {
      console.warn(`⚠️ Cost alert: ${result.alert}`);
    }

    return result.result;
  };
}