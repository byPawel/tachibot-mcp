/**
 * Optimization Module - Exports for Phase 1 improvements
 * Provides smart model routing, token optimization, and cost monitoring
 */

// Import singletons
import { modelRouter } from './model-router.js';
import { tokenOptimizer } from './token-optimizer.js';
import { costMonitor, type CostAlert } from './cost-monitor.js';

// Re-export all types and classes
export {
  SmartModelRouter,
  modelRouter,
  ModelTier,
  type QueryContext,
  type ModelSelection
} from './model-router.js';

export {
  TokenOptimizer,
  tokenOptimizer,
  type TokenRequest,
  type OptimizedRequest,
  type CachedResponse
} from './token-optimizer.js';

export {
  CostMonitor,
  costMonitor,
  type ModelCost,
  type UsageRecord,
  type CostAlert,
  type UsageReport
} from './cost-monitor.js';

/**
 * Initialize all optimization modules
 */
export function initializeOptimizations(config?: {
  costLimits?: {
    hourly?: number;
    daily?: number;
    monthly?: number;
  };
  enableCaching?: boolean;
  enableBatching?: boolean;
}) {
  // Set cost limits if provided
  if (config?.costLimits) {
    costMonitor.setLimits(config.costLimits);
  }

  // Listen for cost alerts
  costMonitor.on('warningAlert', (alert: CostAlert) => {
    console.warn(`⚠️ Cost Warning: ${alert.message}`);
  });

  costMonitor.on('criticalAlert', (alert: CostAlert) => {
    console.error(`🚨 Cost Critical: ${alert.message}`);
  });

  costMonitor.on('limitExceeded', (alert: CostAlert) => {
    console.error(`🛑 Cost Limit Exceeded: ${alert.message}`);
  });

  console.error('✅ Optimizations initialized:');
  console.error('  • Smart model routing enabled');
  console.error('  • Token optimization active');
  console.error('  • Cost monitoring configured');

  return {
    modelRouter,
    tokenOptimizer,
    costMonitor,
  };
}

/**
 * Get optimization statistics
 */
export function getOptimizationStats() {
  const tokenMetrics = tokenOptimizer.getMetrics();
  const costReport = costMonitor.getUsageReport();

  return {
    tokenOptimization: {
      cacheHitRate: tokenMetrics.cacheHitRate,
      compressionRatio: tokenMetrics.compressionRatio,
      tokensSaved: tokenMetrics.totalSaved,
      batchesProcessed: tokenMetrics.batchesProcessed,
    },
    costMonitoring: {
      hourlyUsage: costReport.hourly.used,
      dailyUsage: costReport.daily.used,
      monthlyUsage: costReport.monthly.used,
      topModels: costReport.topModels,
    },
    recommendations: [
      ...tokenMetrics.recommendations,
      ...costReport.alerts.map((a: CostAlert) => a.message),
    ],
  };
}