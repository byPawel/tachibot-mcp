import { EventEmitter } from 'events';

/**
 * Performance Monitoring System
 * Real-time monitoring, token tracking, and cost optimization
 */

export interface PerformanceMetrics {
  timestamp: number;
  requestId: string;
  tool: string;
  duration: number;
  tokensUsed: {
    input: number;
    output: number;
    total: number;
  };
  cost: number;
  success: boolean;
  error?: string;
  metadata?: any;
}

export interface AggregatedMetrics {
  tool: string;
  totalRequests: number;
  successRate: number;
  avgDuration: number;
  p50Duration: number;
  p95Duration: number;
  p99Duration: number;
  totalTokens: number;
  totalCost: number;
  avgTokensPerRequest: number;
  avgCostPerRequest: number;
  throughput: number; // requests per second
}

export interface SystemMetrics {
  timestamp: number;
  activeTasks: number;
  queuedTasks: number;
  memoryUsage: number;
  cpuUsage: number;
  networkLatency: number;
  errorRate: number;
  systemHealth: number;
}

export interface CostModel {
  model: string;
  inputTokenCost: number; // per 1k tokens
  outputTokenCost: number; // per 1k tokens
  baseCost?: number; // fixed cost per request
}

/**
 * Performance monitoring for workflow execution
 */
export class PerformanceMonitor extends EventEmitter {
  private metrics: PerformanceMetrics[] = [];
  private systemMetrics: SystemMetrics[] = [];
  private costModels: Map<string, CostModel> = new Map();
  private activeRequests = new Map<string, { start: number; tool: string }>();
  private metricsRetention = 3600000; // 1 hour default
  private aggregationInterval?: NodeJS.Timeout;
  private systemMonitorInterval?: NodeJS.Timeout;

  constructor() {
    super();
    this.initializeCostModels();
    this.startAggregation();
    this.startSystemMonitoring();
  }

  /**
   * Initialize cost models for different AI providers
   */
  private initializeCostModels(): void {
    // GPT-5 flagship
    this.costModels.set('gpt5', {
      model: 'gpt5',
      inputTokenCost: 0.00125,
      outputTokenCost: 0.01
    });

    // Gemini 2.5 Pro
    this.costModels.set('gemini_25_pro', {
      model: 'gemini_25_pro',
      inputTokenCost: 0.00125,
      outputTokenCost: 0.005
    });

    // GPT-5-mini (cost-effective, balanced)
    this.costModels.set('gpt5_mini', {
      model: 'gpt5_mini',
      inputTokenCost: 0.00075,
      outputTokenCost: 0.003
    });

    // Perplexity
    this.costModels.set('perplexity', {
      model: 'perplexity',
      inputTokenCost: 0.001,
      outputTokenCost: 0.001
    });

    // Focus deep reasoning (expensive)
    this.costModels.set('focus', {
      model: 'focus',
      inputTokenCost: 0.005,
      outputTokenCost: 0.02,
      baseCost: 0.01
    });
  }

  /**
   * Start tracking a request
   */
  startRequest(requestId: string, tool: string): void {
    this.activeRequests.set(requestId, {
      start: Date.now(),
      tool
    });
    
    this.emit('request-started', { requestId, tool });
  }

  /**
   * Complete tracking a request
   */
  completeRequest(
    requestId: string,
    success: boolean,
    tokensUsed?: { input: number; output: number },
    error?: string,
    metadata?: any
  ): void {
    const request = this.activeRequests.get(requestId);
    if (!request) return;
    
    const duration = Date.now() - request.start;
    const cost = this.calculateCost(request.tool, tokensUsed);
    
    const metric: PerformanceMetrics = {
      timestamp: Date.now(),
      requestId,
      tool: request.tool,
      duration,
      tokensUsed: {
        input: tokensUsed?.input || 0,
        output: tokensUsed?.output || 0,
        total: (tokensUsed?.input || 0) + (tokensUsed?.output || 0)
      },
      cost,
      success,
      error,
      metadata
    };
    
    this.metrics.push(metric);
    this.activeRequests.delete(requestId);
    
    // Clean old metrics
    this.cleanOldMetrics();
    
    // Emit events
    this.emit('request-completed', metric);
    
    // Check for performance issues
    this.checkPerformanceAlerts(metric);
  }

  /**
   * Calculate cost based on token usage
   */
  private calculateCost(tool: string, tokensUsed?: { input: number; output: number }): number {
    if (!tokensUsed) return 0;
    
    const costModel = this.costModels.get(tool);
    if (!costModel) return 0;
    
    const inputCost = (tokensUsed.input / 1000) * costModel.inputTokenCost;
    const outputCost = (tokensUsed.output / 1000) * costModel.outputTokenCost;
    const baseCost = costModel.baseCost || 0;
    
    return inputCost + outputCost + baseCost;
  }

  /**
   * Check for performance alerts
   */
  private checkPerformanceAlerts(metric: PerformanceMetrics): void {
    // Slow response alert
    if (metric.duration > 30000) {
      this.emit('slow-response-alert', {
        tool: metric.tool,
        duration: metric.duration,
        requestId: metric.requestId
      });
    }
    
    // High cost alert
    if (metric.cost > 0.1) {
      this.emit('high-cost-alert', {
        tool: metric.tool,
        cost: metric.cost,
        tokens: metric.tokensUsed.total,
        requestId: metric.requestId
      });
    }
    
    // High token usage alert (potential 25k limit issue)
    if (metric.tokensUsed.total > 20000) {
      this.emit('high-token-alert', {
        tool: metric.tool,
        tokens: metric.tokensUsed.total,
        requestId: metric.requestId,
        warning: 'Approaching 25k token limit'
      });
    }
    
    // Error rate alert
    if (!metric.success) {
      const recentErrors = this.getRecentErrorRate();
      if (recentErrors > 0.3) {
        this.emit('high-error-rate', {
          errorRate: recentErrors,
          tool: metric.tool
        });
      }
    }
  }

  /**
   * Get recent error rate
   */
  private getRecentErrorRate(): number {
    const recent = this.getRecentMetrics(5); // Last 5 minutes
    if (recent.length === 0) return 0;
    
    const errors = recent.filter(m => !m.success).length;
    return errors / recent.length;
  }

  /**
   * Get recent metrics
   */
  private getRecentMetrics(minutes: number): PerformanceMetrics[] {
    const cutoff = Date.now() - (minutes * 60 * 1000);
    return this.metrics.filter(m => m.timestamp > cutoff);
  }

  /**
   * Start aggregation interval
   */
  private startAggregation(): void {
    this.aggregationInterval = setInterval(() => {
      const aggregated = this.aggregateMetrics();
      this.emit('metrics-aggregated', aggregated);
    }, 60000); // Every minute
  }

  /**
   * Start system monitoring
   */
  private startSystemMonitoring(): void {
    this.systemMonitorInterval = setInterval(() => {
      const metrics = this.collectSystemMetrics();
      this.systemMetrics.push(metrics);
      this.emit('system-metrics', metrics);
      
      // Clean old system metrics
      const cutoff = Date.now() - this.metricsRetention;
      this.systemMetrics = this.systemMetrics.filter(m => m.timestamp > cutoff);
    }, 10000); // Every 10 seconds
  }

  /**
   * Collect system metrics
   */
  private collectSystemMetrics(): SystemMetrics {
    const memUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();
    
    return {
      timestamp: Date.now(),
      activeTasks: this.activeRequests.size,
      queuedTasks: 0, // Would come from message queue
      memoryUsage: memUsage.heapUsed / 1024 / 1024, // MB
      cpuUsage: (cpuUsage.user + cpuUsage.system) / 1000000, // seconds
      networkLatency: 0, // Would need actual measurement
      errorRate: this.getRecentErrorRate(),
      systemHealth: this.calculateSystemHealth()
    };
  }

  /**
   * Calculate system health score
   */
  private calculateSystemHealth(): number {
    let health = 1.0;
    
    // Deduct for high error rate
    const errorRate = this.getRecentErrorRate();
    if (errorRate > 0.1) health -= 0.3;
    if (errorRate > 0.3) health -= 0.3;
    
    // Deduct for slow responses
    const recent = this.getRecentMetrics(5);
    const avgDuration = recent.length > 0
      ? recent.reduce((sum, m) => sum + m.duration, 0) / recent.length
      : 0;
    if (avgDuration > 10000) health -= 0.2;
    if (avgDuration > 30000) health -= 0.2;
    
    // Deduct for high memory usage
    const memUsage = process.memoryUsage().heapUsed / 1024 / 1024;
    if (memUsage > 500) health -= 0.1;
    if (memUsage > 1000) health -= 0.2;
    
    return Math.max(health, 0);
  }

  /**
   * Aggregate metrics by tool
   */
  aggregateMetrics(): Map<string, AggregatedMetrics> {
    const aggregated = new Map<string, AggregatedMetrics>();
    const recent = this.getRecentMetrics(60); // Last hour
    
    // Group by tool
    const byTool = new Map<string, PerformanceMetrics[]>();
    for (const metric of recent) {
      if (!byTool.has(metric.tool)) {
        byTool.set(metric.tool, []);
      }
      byTool.get(metric.tool)!.push(metric);
    }
    
    // Aggregate each tool
    for (const [tool, metrics] of byTool.entries()) {
      const durations = metrics.map(m => m.duration).sort((a, b) => a - b);
      const successful = metrics.filter(m => m.success).length;
      
      const agg: AggregatedMetrics = {
        tool,
        totalRequests: metrics.length,
        successRate: successful / metrics.length,
        avgDuration: durations.reduce((a, b) => a + b, 0) / durations.length,
        p50Duration: this.percentile(durations, 0.5),
        p95Duration: this.percentile(durations, 0.95),
        p99Duration: this.percentile(durations, 0.99),
        totalTokens: metrics.reduce((sum, m) => sum + m.tokensUsed.total, 0),
        totalCost: metrics.reduce((sum, m) => sum + m.cost, 0),
        avgTokensPerRequest: 0,
        avgCostPerRequest: 0,
        throughput: 0
      };
      
      agg.avgTokensPerRequest = agg.totalTokens / metrics.length;
      agg.avgCostPerRequest = agg.totalCost / metrics.length;
      
      // Calculate throughput (requests per second)
      if (metrics.length > 1) {
        const timeSpan = metrics[metrics.length - 1].timestamp - metrics[0].timestamp;
        agg.throughput = (metrics.length / timeSpan) * 1000;
      }
      
      aggregated.set(tool, agg);
    }
    
    return aggregated;
  }

  /**
   * Calculate percentile
   */
  private percentile(sorted: number[], p: number): number {
    if (sorted.length === 0) return 0;
    const index = Math.ceil(sorted.length * p) - 1;
    return sorted[Math.max(0, Math.min(index, sorted.length - 1))];
  }

  /**
   * Clean old metrics
   */
  private cleanOldMetrics(): void {
    const cutoff = Date.now() - this.metricsRetention;
    this.metrics = this.metrics.filter(m => m.timestamp > cutoff);
  }

  /**
   * Get dashboard data
   */
  getDashboardData(): {
    currentRequests: number;
    recentMetrics: PerformanceMetrics[];
    aggregatedMetrics: Map<string, AggregatedMetrics>;
    systemMetrics: SystemMetrics | null;
    costBreakdown: Array<{ tool: string; cost: number; percentage: number }>;
    performanceAlerts: string[];
  } {
    const aggregated = this.aggregateMetrics();
    const recent = this.getRecentMetrics(5);
    const latestSystem = this.systemMetrics[this.systemMetrics.length - 1] || null;
    
    // Calculate cost breakdown
    const costBreakdown: Array<{ tool: string; cost: number; percentage: number }> = [];
    let totalCost = 0;
    
    for (const [tool, metrics] of aggregated.entries()) {
      totalCost += metrics.totalCost;
      costBreakdown.push({
        tool,
        cost: metrics.totalCost,
        percentage: 0
      });
    }
    
    // Calculate percentages
    for (const item of costBreakdown) {
      item.percentage = totalCost > 0 ? (item.cost / totalCost) * 100 : 0;
    }
    
    // Sort by cost
    costBreakdown.sort((a, b) => b.cost - a.cost);
    
    // Generate alerts
    const alerts: string[] = [];
    
    if (latestSystem) {
      if (latestSystem.errorRate > 0.3) {
        alerts.push(`High error rate: ${(latestSystem.errorRate * 100).toFixed(1)}%`);
      }
      if (latestSystem.systemHealth < 0.5) {
        alerts.push(`Low system health: ${(latestSystem.systemHealth * 100).toFixed(0)}%`);
      }
      if (latestSystem.memoryUsage > 1000) {
        alerts.push(`High memory usage: ${latestSystem.memoryUsage.toFixed(0)}MB`);
      }
    }
    
    // Check for expensive tools
    for (const [tool, metrics] of aggregated.entries()) {
      if (metrics.avgCostPerRequest > 0.05) {
        alerts.push(`High cost for ${tool}: $${metrics.avgCostPerRequest.toFixed(3)}/request`);
      }
    }
    
    return {
      currentRequests: this.activeRequests.size,
      recentMetrics: recent,
      aggregatedMetrics: aggregated,
      systemMetrics: latestSystem,
      costBreakdown,
      performanceAlerts: alerts
    };
  }

  /**
   * Get cost optimization recommendations
   */
  getCostOptimizationRecommendations(): string[] {
    const recommendations: string[] = [];
    const aggregated = this.aggregateMetrics();
    
    for (const [tool, metrics] of aggregated.entries()) {
      // Check for high token usage
      if (metrics.avgTokensPerRequest > 10000) {
        recommendations.push(
          `${tool}: High token usage (${metrics.avgTokensPerRequest.toFixed(0)} avg). Consider chunking or summarization.`
        );
      }
      
      // Check for low success rate
      if (metrics.successRate < 0.8) {
        recommendations.push(
          `${tool}: Low success rate (${(metrics.successRate * 100).toFixed(1)}%). Consider fallback strategies.`
        );
      }
      
      // Check for slow performance
      if (metrics.avgDuration > 20000) {
        recommendations.push(
          `${tool}: Slow performance (${(metrics.avgDuration / 1000).toFixed(1)}s avg). Consider timeout or alternative.`
        );
      }
    }
    
    // General recommendations
    if (this.getRecentErrorRate() > 0.2) {
      recommendations.push(
        'High overall error rate. Enable circuit breakers and fallback strategies.'
      );
    }
    
    const totalCost = Array.from(aggregated.values())
      .reduce((sum, m) => sum + m.totalCost, 0);
    if (totalCost > 10) {
      recommendations.push(
        `High cost in last hour: $${totalCost.toFixed(2)}. Review workflow efficiency.`
      );
    }
    
    return recommendations;
  }

  /**
   * Export metrics for analysis
   */
  exportMetrics(format: 'json' | 'csv' = 'json'): string {
    if (format === 'json') {
      return JSON.stringify({
        metrics: this.metrics,
        systemMetrics: this.systemMetrics,
        aggregated: Object.fromEntries(this.aggregateMetrics()),
        exported: new Date().toISOString()
      }, null, 2);
    } else {
      // CSV format
      const headers = [
        'timestamp', 'requestId', 'tool', 'duration', 
        'inputTokens', 'outputTokens', 'totalTokens', 
        'cost', 'success', 'error'
      ].join(',');
      
      const rows = this.metrics.map(m => [
        m.timestamp,
        m.requestId,
        m.tool,
        m.duration,
        m.tokensUsed.input,
        m.tokensUsed.output,
        m.tokensUsed.total,
        m.cost.toFixed(4),
        m.success,
        m.error || ''
      ].join(','));
      
      return [headers, ...rows].join('\n');
    }
  }

  /**
   * Set metrics retention period
   */
  setRetention(milliseconds: number): void {
    this.metricsRetention = milliseconds;
    this.cleanOldMetrics();
  }

  /**
   * Cleanup
   */
  cleanup(): void {
    if (this.aggregationInterval) {
      clearInterval(this.aggregationInterval);
    }
    if (this.systemMonitorInterval) {
      clearInterval(this.systemMonitorInterval);
    }
    
    this.metrics = [];
    this.systemMetrics = [];
    this.activeRequests.clear();
    this.removeAllListeners();
  }
}

// Export singleton instance
export const performanceMonitor = new PerformanceMonitor();
