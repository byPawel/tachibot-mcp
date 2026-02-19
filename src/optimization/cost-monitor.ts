/**
 * Cost Monitor - Real-time tracking and limits for API usage
 * Part of Phase 1C implementation for cost control
 */

import { EventEmitter } from "events";

export interface ModelCost {
  model: string;
  inputCost: number; // per 1K tokens
  outputCost: number; // per 1K tokens
}

export interface UsageRecord {
  timestamp: number;
  model: string;
  inputTokens: number;
  outputTokens: number;
  cost: number;
  requestId?: string;
  userId?: string;
}

export interface CostAlert {
  type: "warning" | "critical" | "limit_exceeded";
  message: string;
  currentCost: number;
  limit: number;
  timeframe: "hourly" | "daily" | "monthly";
}

export interface UsageReport {
  hourly: {
    used: number;
    limit: number;
    remaining: number;
    percentage: number;
  };
  daily: {
    used: number;
    limit: number;
    remaining: number;
    percentage: number;
  };
  monthly: {
    used: number;
    limit: number;
    remaining: number;
    percentage: number;
  };
  topModels: Array<{
    model: string;
    usage: number;
    cost: number;
  }>;
  alerts: CostAlert[];
}

export class CostMonitor extends EventEmitter {
  // Cost limits
  private limits = {
    hourly: 1.0, // $1 per hour
    daily: 10.0, // $10 per day
    monthly: 300.0, // $300 per month
  };

  // Warning thresholds (percentage of limit)
  private thresholds = {
    warning: 0.75, // 75% of limit
    critical: 0.9, // 90% of limit
  };

  // Usage tracking
  private usage: Map<string, number> = new Map();
  private records: UsageRecord[] = [];
  private modelUsage: Map<string, { count: number; cost: number }> = new Map();

  // Model pricing (updated Nov 2025 - includes GPT-5)
  private modelCosts: Map<string, ModelCost> = new Map([
    // GPT-5 Models (Official pricing as of Nov 2025)
    [
      "gpt-5-nano",
      { model: "gpt-5-nano", inputCost: 0.00005, outputCost: 0.0004 },
    ], // ULTRA CHEAP!
    [
      "gpt-5-mini",
      { model: "gpt-5-mini", inputCost: 0.00025, outputCost: 0.002 },
    ],
    ["gpt-5", { model: "gpt-5", inputCost: 0.00125, outputCost: 0.01 }],
    [
      "gpt-5-chat-latest",
      { model: "gpt-5-chat-latest", inputCost: 0.00125, outputCost: 0.01 },
    ],

    // Existing models
    [
      "gemini-3.1-pro-preview",
      { model: "gemini-3.1-pro-preview", inputCost: 0.0002, outputCost: 0.0008 },
    ],
    ["gpt-5-nano", { model: "gpt-5-nano", inputCost: 0.00005, outputCost: 0.0004 }],
    [
      "gpt-5-mini",
      { model: "gpt-5-mini", inputCost: 0.00025, outputCost: 0.002 },
    ],
    ["gpt-5", { model: "gpt-5", inputCost: 0.0025, outputCost: 0.01 }],
    [
      "perplexity-sonar-pro",
      { model: "perplexity-sonar-pro", inputCost: 0.006, outputCost: 0.006 },
    ],
    [
      "claude-3.5-sonnet",
      { model: "claude-3.5-sonnet", inputCost: 0.003, outputCost: 0.015 },
    ],
    ["grok-4", { model: "grok-4", inputCost: 0.005, outputCost: 0.015 }],
  ]);

  constructor() {
    super();

    // Clean up old records periodically
    setInterval(() => this.cleanupOldRecords(), 60 * 60 * 1000); // Every hour
  }

  /**
   * Set custom limits
   */
  setLimits(limits: Partial<typeof this.limits>): void {
    this.limits = { ...this.limits, ...limits };
  }

  /**
   * Calculate cost for a request
   */
  calculateCost(
    model: string,
    inputTokens: number,
    outputTokens: number,
  ): number {
    const normalizedModel = this.normalizeModelId(model);
    const pricing = this.modelCosts.get(normalizedModel);
    if (!pricing) {
      console.warn(`Unknown model pricing for: ${model}, using default`);
      return (inputTokens * 0.001 + outputTokens * 0.002) / 1000; // Default pricing
    }

    return (
      (inputTokens * pricing.inputCost + outputTokens * pricing.outputCost) /
      1000
    );
  }

  /**
   * Track usage for a request
   */
  async trackUsage(
    model: string,
    inputTokens: number,
    outputTokens: number,
    requestId?: string,
    userId?: string,
  ): Promise<{ allowed: boolean; cost: number; alert?: CostAlert }> {
    const normalizedModel = this.normalizeModelId(model);
    const cost = this.calculateCost(model, inputTokens, outputTokens);
    const now = Date.now();

    // Check if request would exceed limits
    const hourKey = this.getTimeKey("hour");
    const dayKey = this.getTimeKey("day");
    const monthKey = this.getTimeKey("month");

    const hourlyUsage = (this.usage.get(`hour:${hourKey}`) || 0) + cost;
    const dailyUsage = (this.usage.get(`day:${dayKey}`) || 0) + cost;
    const monthlyUsage = (this.usage.get(`month:${monthKey}`) || 0) + cost;

    // Check hard limits
    if (hourlyUsage > this.limits.hourly) {
      const alert: CostAlert = {
        type: "limit_exceeded",
        message: `Hourly limit exceeded. Current: $${hourlyUsage.toFixed(2)}, Limit: $${this.limits.hourly}`,
        currentCost: hourlyUsage,
        limit: this.limits.hourly,
        timeframe: "hourly",
      };
      this.emit("limitExceeded", alert);
      return { allowed: false, cost, alert };
    }

    if (dailyUsage > this.limits.daily) {
      const alert: CostAlert = {
        type: "limit_exceeded",
        message: `Daily limit exceeded. Current: $${dailyUsage.toFixed(2)}, Limit: $${this.limits.daily}`,
        currentCost: dailyUsage,
        limit: this.limits.daily,
        timeframe: "daily",
      };
      this.emit("limitExceeded", alert);
      return { allowed: false, cost, alert };
    }

    // Record the usage
    const record: UsageRecord = {
      timestamp: now,
      model: normalizedModel,
      inputTokens,
      outputTokens,
      cost,
      requestId,
      userId,
    };

    this.records.push(record);
    this.usage.set(`hour:${hourKey}`, hourlyUsage);
    this.usage.set(`day:${dayKey}`, dailyUsage);
    this.usage.set(`month:${monthKey}`, monthlyUsage);

    // Update model usage stats
    const modelStats = this.modelUsage.get(normalizedModel) || {
      count: 0,
      cost: 0,
    };
    modelStats.count++;
    modelStats.cost += cost;
    this.modelUsage.set(normalizedModel, modelStats);

    // Check warning thresholds
    let alert: CostAlert | undefined;

    if (hourlyUsage > this.limits.hourly * this.thresholds.critical) {
      alert = {
        type: "critical",
        message: `Critical: Approaching hourly limit (${((hourlyUsage / this.limits.hourly) * 100).toFixed(0)}%)`,
        currentCost: hourlyUsage,
        limit: this.limits.hourly,
        timeframe: "hourly",
      };
      this.emit("criticalAlert", alert);
    } else if (hourlyUsage > this.limits.hourly * this.thresholds.warning) {
      alert = {
        type: "warning",
        message: `Warning: ${((hourlyUsage / this.limits.hourly) * 100).toFixed(0)}% of hourly limit used`,
        currentCost: hourlyUsage,
        limit: this.limits.hourly,
        timeframe: "hourly",
      };
      this.emit("warningAlert", alert);
    }

    return { allowed: true, cost, alert };
  }

  /**
   * Check if a request would be allowed
   */
  async checkRequest(
    model: string,
    estimatedTokens: number,
  ): Promise<{
    allowed: boolean;
    estimatedCost: number;
    requiresConfirmation: boolean;
    warning?: string;
  }> {
    // Estimate 40% input, 60% output
    const inputTokens = estimatedTokens * 0.4;
    const outputTokens = estimatedTokens * 0.6;
    const estimatedCost = this.calculateCost(model, inputTokens, outputTokens);

    const hourKey = this.getTimeKey("hour");
    const dayKey = this.getTimeKey("day");

    const hourlyUsage = this.usage.get(`hour:${hourKey}`) || 0;
    const dailyUsage = this.usage.get(`day:${dayKey}`) || 0;

    // Check if it would exceed limits
    if (hourlyUsage + estimatedCost > this.limits.hourly) {
      return {
        allowed: false,
        estimatedCost,
        requiresConfirmation: true,
        warning: `Would exceed hourly limit ($${this.limits.hourly})`,
      };
    }

    if (dailyUsage + estimatedCost > this.limits.daily) {
      return {
        allowed: false,
        estimatedCost,
        requiresConfirmation: true,
        warning: `Would exceed daily limit ($${this.limits.daily})`,
      };
    }

    // Check if confirmation needed
    const requiresConfirmation = estimatedCost > 0.1; // Confirm for requests > $0.10

    return {
      allowed: true,
      estimatedCost,
      requiresConfirmation,
      warning: requiresConfirmation
        ? `High cost request: $${estimatedCost.toFixed(2)}`
        : undefined,
    };
  }

  /**
   * Get usage report
   */
  getUsageReport(): UsageReport {
    const hourKey = this.getTimeKey("hour");
    const dayKey = this.getTimeKey("day");
    const monthKey = this.getTimeKey("month");

    const hourlyUsage = this.usage.get(`hour:${hourKey}`) || 0;
    const dailyUsage = this.usage.get(`day:${dayKey}`) || 0;
    const monthlyUsage = this.usage.get(`month:${monthKey}`) || 0;

    // Get top models by cost
    const topModels = Array.from(this.modelUsage.entries())
      .map(([model, stats]) => ({
        model,
        usage: stats.count,
        cost: stats.cost,
      }))
      .sort((a, b) => b.cost - a.cost)
      .slice(0, 5);

    // Generate alerts
    const alerts: CostAlert[] = [];

    if (hourlyUsage > this.limits.hourly * this.thresholds.warning) {
      alerts.push({
        type:
          hourlyUsage > this.limits.hourly * this.thresholds.critical
            ? "critical"
            : "warning",
        message: `${((hourlyUsage / this.limits.hourly) * 100).toFixed(0)}% of hourly limit used`,
        currentCost: hourlyUsage,
        limit: this.limits.hourly,
        timeframe: "hourly",
      });
    }

    if (dailyUsage > this.limits.daily * this.thresholds.warning) {
      alerts.push({
        type:
          dailyUsage > this.limits.daily * this.thresholds.critical
            ? "critical"
            : "warning",
        message: `${((dailyUsage / this.limits.daily) * 100).toFixed(0)}% of daily limit used`,
        currentCost: dailyUsage,
        limit: this.limits.daily,
        timeframe: "daily",
      });
    }

    return {
      hourly: {
        used: hourlyUsage,
        limit: this.limits.hourly,
        remaining: Math.max(0, this.limits.hourly - hourlyUsage),
        percentage: (hourlyUsage / this.limits.hourly) * 100,
      },
      daily: {
        used: dailyUsage,
        limit: this.limits.daily,
        remaining: Math.max(0, this.limits.daily - dailyUsage),
        percentage: (dailyUsage / this.limits.daily) * 100,
      },
      monthly: {
        used: monthlyUsage,
        limit: this.limits.monthly,
        remaining: Math.max(0, this.limits.monthly - monthlyUsage),
        percentage: (monthlyUsage / this.limits.monthly) * 100,
      },
      topModels,
      alerts,
    };
  }

  private normalizeModelId(model: string): string {
    switch (model) {
      case "gpt5":
        return "gpt-5";
      case "gpt5_mini":
        return "gpt-5-mini";
      case "gpt5_nano":
        return "gpt-5-nano";
      default:
        return model;
    }
  }

  /**
   * Get time key for usage tracking
   */
  private getTimeKey(period: "hour" | "day" | "month"): string {
    const now = new Date();
    switch (period) {
      case "hour":
        return now.toISOString().slice(0, 13); // YYYY-MM-DDTHH
      case "day":
        return now.toISOString().slice(0, 10); // YYYY-MM-DD
      case "month":
        return now.toISOString().slice(0, 7); // YYYY-MM
    }
  }

  /**
   * Clean up old records
   */
  private cleanupOldRecords(): void {
    const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;

    // Remove records older than 24 hours
    this.records = this.records.filter((r) => r.timestamp > oneDayAgo);

    // Clean up old usage keys
    const currentHour = this.getTimeKey("hour");
    const currentDay = this.getTimeKey("day");
    const currentMonth = this.getTimeKey("month");

    for (const [key] of this.usage.entries()) {
      if (key.startsWith("hour:") && !key.includes(currentHour.slice(0, 10))) {
        this.usage.delete(key);
      } else if (key.startsWith("day:") && !key.includes(currentMonth)) {
        this.usage.delete(key);
      }
    }
  }

  /**
   * Reset all usage data
   */
  reset(): void {
    this.usage.clear();
    this.records = [];
    this.modelUsage.clear();
  }

  /**
   * Export usage data for analysis
   */
  exportUsageData(): {
    records: UsageRecord[];
    summary: UsageReport;
    modelBreakdown: Map<string, { count: number; cost: number }>;
  } {
    return {
      records: this.records,
      summary: this.getUsageReport(),
      modelBreakdown: this.modelUsage,
    };
  }
}

// Export singleton instance
export const costMonitor = new CostMonitor();
