import { EventEmitter } from 'events';

/**
 * Enhanced fallback strategies for circuit breaker pattern
 * Provides multiple fallback options based on failure context
 */

export interface FallbackContext {
  stepId: string;
  failureReason: string;
  attemptNumber: number;
  previousResults?: any[];
  originalQuery?: string;
}

export interface FallbackStrategy {
  name: string;
  description: string;
  canHandle: (context: FallbackContext) => boolean;
  execute: (context: FallbackContext) => Promise<any>;
  priority: number; // Lower number = higher priority
}

/**
 * Collection of predefined fallback strategies
 */
export class FallbackStrategies {
  private strategies: FallbackStrategy[] = [];

  constructor() {
    this.initializeStrategies();
  }

  private initializeStrategies(): void {
    // 1. Use cached results fallback
    this.strategies.push({
      name: 'cached-results',
      description: 'Return previously cached successful results',
      priority: 1,
      canHandle: (context) => {
        return context.previousResults !== undefined && 
               context.previousResults.length > 0;
      },
      execute: async (context) => {
        return {
          result: context.previousResults![context.previousResults!.length - 1],
          fallbackUsed: 'cached-results',
          warning: 'Using cached results due to service failure'
        };
      }
    });

    // 2. Use simpler alternative tool
    this.strategies.push({
      name: 'simpler-tool',
      description: 'Use a simpler, more reliable tool',
      priority: 2,
      canHandle: (context) => {
        const complexTools = ['focus', 'architect', 'verifier'];
        return complexTools.includes(context.stepId);
      },
      execute: async (context) => {
        const simplifiedTools: Record<string, string> = {
          'focus': 'think',
          'architect': 'code_reviewer',
          'verifier': 'auditor',
          'perplexity_research': 'perplexity_ask',
          'focus_deep_research': 'scout'
        };
        
        return {
          alternativeTool: simplifiedTools[context.stepId] || 'think',
          fallbackUsed: 'simpler-tool',
          warning: `Using simpler alternative due to ${context.stepId} failure`
        };
      }
    });

    // 3. Use cheaper model fallback
    this.strategies.push({
      name: 'cheaper-model',
      description: 'Fallback to GPT-5 Nano for cost efficiency',
      priority: 3,
      canHandle: (context) => {
        const expensiveModels = ['gpt5'];
        return expensiveModels.some(model => context.stepId.includes(model));
      },
      execute: async (context) => {
        return {
          alternativeTool: 'gpt-5-nano',
          fallbackUsed: 'cheaper-model',
          warning: 'Falling back to GPT-5 Nano for cost efficiency'
        };
      }
    });

    // 4. Retry with reduced scope
    this.strategies.push({
      name: 'reduced-scope',
      description: 'Retry with reduced complexity or scope',
      priority: 4,
      canHandle: (context) => {
        return context.attemptNumber < 3 && 
               context.originalQuery !== undefined;
      },
      execute: async (context) => {
        // Simplify the query by taking first sentence or reducing length
        const simplifiedQuery = context.originalQuery!
          .split('.')[0]
          .substring(0, 200);
        
        return {
          simplifiedQuery,
          fallbackUsed: 'reduced-scope',
          warning: 'Retrying with reduced query scope'
        };
      }
    });

    // 5. Basic error response
    this.strategies.push({
      name: 'basic-response',
      description: 'Return basic error information',
      priority: 99,
      canHandle: () => true, // Always can handle as last resort
      execute: async (context) => {
        return {
          error: true,
          fallbackUsed: 'basic-response',
          message: `Service ${context.stepId} is temporarily unavailable`,
          reason: context.failureReason,
          suggestion: 'Please try again later or use a different approach'
        };
      }
    });
  }

  /**
   * Get the best fallback strategy for the given context
   */
  getBestStrategy(context: FallbackContext): FallbackStrategy | null {
    // Sort by priority and find first that can handle
    const availableStrategies = this.strategies
      .filter(s => s.canHandle(context))
      .sort((a, b) => a.priority - b.priority);
    
    return availableStrategies[0] || null;
  }

  /**
   * Execute fallback with the best available strategy
   */
  async executeFallback(context: FallbackContext): Promise<any> {
    const strategy = this.getBestStrategy(context);
    
    if (!strategy) {
      throw new Error(`No fallback strategy available for ${context.stepId}`);
    }
    
    console.error(`[Fallback] Using strategy: ${strategy.name} for ${context.stepId}`);
    return strategy.execute(context);
  }

  /**
   * Add custom fallback strategy
   */
  addStrategy(strategy: FallbackStrategy): void {
    this.strategies.push(strategy);
    // Re-sort by priority
    this.strategies.sort((a, b) => a.priority - b.priority);
  }

  /**
   * Remove a strategy by name
   */
  removeStrategy(name: string): void {
    this.strategies = this.strategies.filter(s => s.name !== name);
  }

  /**
   * Get all registered strategies
   */
  getAllStrategies(): FallbackStrategy[] {
    return [...this.strategies];
  }
}

/**
 * Health monitoring for circuit breakers
 */
export class HealthMonitor extends EventEmitter {
  private healthChecks = new Map<string, NodeJS.Timeout>();
  private healthStatus = new Map<string, boolean>();
  private alertThresholds = {
    consecutiveFailures: 3,
    failureRate: 0.5,
    responseTime: 10000 // 10 seconds
  };

  /**
   * Start monitoring a service
   */
  startMonitoring(
    serviceId: string, 
    checkFn: () => Promise<boolean>,
    intervalMs: number = 30000
  ): void {
    // Clear existing check if any
    this.stopMonitoring(serviceId);
    
    // Initial check
    this.performHealthCheck(serviceId, checkFn);
    
    // Set up interval
    const interval = setInterval(() => {
      this.performHealthCheck(serviceId, checkFn);
    }, intervalMs);
    
    this.healthChecks.set(serviceId, interval);
  }

  /**
   * Stop monitoring a service
   */
  stopMonitoring(serviceId: string): void {
    const interval = this.healthChecks.get(serviceId);
    if (interval) {
      clearInterval(interval);
      this.healthChecks.delete(serviceId);
    }
  }

  /**
   * Perform a health check
   */
  private async performHealthCheck(
    serviceId: string,
    checkFn: () => Promise<boolean>
  ): Promise<void> {
    const startTime = Date.now();
    
    try {
      const isHealthy = await checkFn();
      const responseTime = Date.now() - startTime;
      
      const wasHealthy = this.healthStatus.get(serviceId);
      this.healthStatus.set(serviceId, isHealthy);
      
      // Emit events based on health changes
      if (wasHealthy === false && isHealthy) {
        this.emit('service-recovered', { serviceId, responseTime });
      } else if (wasHealthy === true && !isHealthy) {
        this.emit('service-degraded', { serviceId, responseTime });
      }
      
      // Check response time threshold
      if (responseTime > this.alertThresholds.responseTime) {
        this.emit('slow-response', { serviceId, responseTime });
      }
      
    } catch (error) {
      this.healthStatus.set(serviceId, false);
      this.emit('health-check-failed', { 
        serviceId, 
        error: (error as Error).message 
      });
    }
  }

  /**
   * Get current health status
   */
  getHealthStatus(): Map<string, boolean> {
    return new Map(this.healthStatus);
  }

  /**
   * Check if a service is healthy
   */
  isHealthy(serviceId: string): boolean {
    return this.healthStatus.get(serviceId) || false;
  }

  /**
   * Get overall system health score (0-1)
   */
  getSystemHealthScore(): number {
    if (this.healthStatus.size === 0) return 1;
    
    let healthyCount = 0;
    for (const isHealthy of this.healthStatus.values()) {
      if (isHealthy) healthyCount++;
    }
    
    return healthyCount / this.healthStatus.size;
  }

  /**
   * Clean up all monitoring
   */
  cleanup(): void {
    for (const serviceId of this.healthChecks.keys()) {
      this.stopMonitoring(serviceId);
    }
    this.healthStatus.clear();
  }
}

/**
 * Proactive alert system for circuit breakers
 */
export class AlertManager extends EventEmitter {
  private alerts: Map<string, any[]> = new Map();
  private alertRules: Map<string, (data: any) => boolean> = new Map();

  constructor() {
    super();
    this.initializeDefaultRules();
  }

  private initializeDefaultRules(): void {
    // Critical failure rate
    this.alertRules.set('critical-failure-rate', (stats) => {
      return stats.failureRate > 0.8;
    });

    // Multiple services down
    this.alertRules.set('multiple-services-down', (health) => {
      return health.openBreakers > 3;
    });

    // Cascade failure risk
    this.alertRules.set('cascade-risk', (stats) => {
      return stats.halfOpenBreakers > 2 && stats.openBreakers > 1;
    });

    // Low system health
    this.alertRules.set('low-system-health', (health) => {
      return health.healthScore < 0.5;
    });
  }

  /**
   * Check alerts based on current state
   */
  checkAlerts(data: any): void {
    for (const [ruleName, ruleFn] of this.alertRules.entries()) {
      if (ruleFn(data)) {
        this.triggerAlert(ruleName, data);
      }
    }
  }

  /**
   * Trigger an alert
   */
  private triggerAlert(alertType: string, data: any): void {
    const alert = {
      type: alertType,
      timestamp: Date.now(),
      data,
      severity: this.getAlertSeverity(alertType)
    };

    // Store alert
    if (!this.alerts.has(alertType)) {
      this.alerts.set(alertType, []);
    }
    this.alerts.get(alertType)!.push(alert);

    // Emit alert event
    this.emit('alert', alert);

    // Log critical alerts
    if (alert.severity === 'critical') {
      console.error(`[CRITICAL ALERT] ${alertType}:`, data);
    }
  }

  /**
   * Get alert severity
   */
  private getAlertSeverity(alertType: string): 'info' | 'warning' | 'critical' {
    const criticalAlerts = ['multiple-services-down', 'cascade-risk'];
    const warningAlerts = ['critical-failure-rate', 'low-system-health'];
    
    if (criticalAlerts.includes(alertType)) return 'critical';
    if (warningAlerts.includes(alertType)) return 'warning';
    return 'info';
  }

  /**
   * Get recent alerts
   */
  getRecentAlerts(minutes: number = 5): any[] {
    const cutoff = Date.now() - (minutes * 60 * 1000);
    const recent: any[] = [];
    
    for (const alerts of this.alerts.values()) {
      recent.push(...alerts.filter(a => a.timestamp > cutoff));
    }
    
    return recent.sort((a, b) => b.timestamp - a.timestamp);
  }

  /**
   * Clear old alerts
   */
  clearOldAlerts(hours: number = 24): void {
    const cutoff = Date.now() - (hours * 60 * 60 * 1000);
    
    for (const [type, alerts] of this.alerts.entries()) {
      const filtered = alerts.filter(a => a.timestamp > cutoff);
      if (filtered.length > 0) {
        this.alerts.set(type, filtered);
      } else {
        this.alerts.delete(type);
      }
    }
  }

  /**
   * Add custom alert rule
   */
  addRule(name: string, ruleFn: (data: any) => boolean): void {
    this.alertRules.set(name, ruleFn);
  }

  /**
   * Remove alert rule
   */
  removeRule(name: string): void {
    this.alertRules.delete(name);
  }
}

// Export a singleton instance for global use
export const fallbackStrategies = new FallbackStrategies();
export const healthMonitor = new HealthMonitor();
export const alertManager = new AlertManager();

// Set up connections between components
healthMonitor.on('service-degraded', (data) => {
  alertManager.checkAlerts({ serviceDown: data.serviceId });
});

healthMonitor.on('slow-response', (data) => {
  alertManager.checkAlerts({ slowService: data.serviceId, responseTime: data.responseTime });
});