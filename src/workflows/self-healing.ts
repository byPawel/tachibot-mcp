import { EventEmitter } from 'events';
import { CircuitBreakerManager } from './circuit-breaker.js';
import { MessageQueueOrchestrator } from './message-queue.js';
import { healthMonitor, alertManager } from './fallback-strategies.js';

/**
 * Self-Healing Subagent Manager
 * Provides automatic restart, task rerouting, and predictive failure detection
 */

export interface SubagentConfig {
  id: string;
  type: string;
  config: any;
  maxRetries: number;
  memoryLimit: number;
  cpuLimit: number;
  timeout: number;
}

export interface SubagentHealth {
  id: string;
  status: 'healthy' | 'degraded' | 'failed' | 'recovering';
  lastHeartbeat: number;
  failureCount: number;
  restartCount: number;
  memoryUsage: number;
  cpuUsage: number;
  tasksProcessed: number;
  avgResponseTime: number;
}

export interface TaskRoute {
  taskId: string;
  originalAgent: string;
  currentAgent: string;
  rerouteCount: number;
  timestamp: number;
}

/**
 * Self-healing subagent instance
 */
export class SelfHealingSubagent extends EventEmitter {
  private health: SubagentHealth;
  private healthCheckInterval?: NodeJS.Timeout;
  private performanceMetrics: number[] = [];
  private isRestarting = false;

  constructor(public readonly config: SubagentConfig) {
    super();
    this.health = {
      id: config.id,
      status: 'healthy',
      lastHeartbeat: Date.now(),
      failureCount: 0,
      restartCount: 0,
      memoryUsage: 0,
      cpuUsage: 0,
      tasksProcessed: 0,
      avgResponseTime: 0
    };
    
    this.startHealthMonitoring();
  }

  /**
   * Start health monitoring
   */
  private startHealthMonitoring(): void {
    this.healthCheckInterval = setInterval(async () => {
      try {
        await this.performHealthCheck();
      } catch (error) {
        await this.handleHealthCheckFailure(error as Error);
      }
    }, 10000); // Check every 10 seconds
  }

  /**
   * Perform health check
   */
  private async performHealthCheck(): Promise<void> {
    const now = Date.now();
    
    // Check heartbeat timeout (30 seconds)
    if (now - this.health.lastHeartbeat > 30000) {
      throw new Error('Heartbeat timeout');
    }
    
    // Check memory usage
    if (this.health.memoryUsage > this.config.memoryLimit * 0.9) {
      this.health.status = 'degraded';
      this.emit('memory-pressure', { 
        id: this.config.id, 
        usage: this.health.memoryUsage 
      });
    }
    
    // Check CPU usage
    if (this.health.cpuUsage > this.config.cpuLimit * 0.9) {
      this.health.status = 'degraded';
      this.emit('cpu-pressure', { 
        id: this.config.id, 
        usage: this.health.cpuUsage 
      });
    }
    
    // Check response time degradation
    if (this.health.avgResponseTime > this.config.timeout * 0.8) {
      this.health.status = 'degraded';
      this.emit('slow-response', { 
        id: this.config.id, 
        avgTime: this.health.avgResponseTime 
      });
    }
    
    // Recover if metrics are good
    if (this.health.status === 'degraded' &&
        this.health.memoryUsage < this.config.memoryLimit * 0.7 &&
        this.health.cpuUsage < this.config.cpuLimit * 0.7 &&
        this.health.avgResponseTime < this.config.timeout * 0.5) {
      this.health.status = 'healthy';
      this.emit('recovered', { id: this.config.id });
    }
  }

  /**
   * Handle health check failure
   */
  private async handleHealthCheckFailure(error: Error): Promise<void> {
    this.health.failureCount++;
    
    if (this.health.failureCount >= 3) {
      this.health.status = 'failed';
      await this.selfHeal();
    } else {
      this.health.status = 'degraded';
      this.emit('health-degraded', { 
        id: this.config.id, 
        error: error.message 
      });
    }
  }

  /**
   * Self-heal by restarting
   */
  async selfHeal(): Promise<void> {
    if (this.isRestarting) {
      return; // Already restarting
    }
    
    if (this.health.restartCount >= this.config.maxRetries) {
      // Escalate - too many restarts
      this.health.status = 'failed';
      this.emit('escalate-failure', { 
        id: this.config.id, 
        restarts: this.health.restartCount 
      });
      return;
    }
    
    this.isRestarting = true;
    this.health.status = 'recovering';
    this.emit('self-healing', { id: this.config.id });
    
    try {
      // Restart the subagent
      await this.restart();
      
      // Reset health metrics
      this.health.failureCount = 0;
      this.health.status = 'healthy';
      this.health.restartCount++;
      this.health.lastHeartbeat = Date.now();
      
      this.emit('self-healed', { 
        id: this.config.id, 
        restartCount: this.health.restartCount 
      });
      
    } catch (error) {
      this.health.status = 'failed';
      this.emit('self-heal-failed', { 
        id: this.config.id, 
        error: (error as Error).message 
      });
    } finally {
      this.isRestarting = false;
    }
  }

  /**
   * Restart the subagent
   */
  private async restart(): Promise<void> {
    // Stop current instance
    this.stop();
    
    // Wait a moment
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Start new instance
    await this.start();
  }

  /**
   * Start the subagent
   */
  private async start(): Promise<void> {
    // Implementation depends on runtime (serverless, container, etc.)
    // This is a placeholder for the actual start logic
    this.emit('started', { id: this.config.id });
  }

  /**
   * Stop the subagent
   */
  private stop(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }
    this.emit('stopped', { id: this.config.id });
  }

  /**
   * Update heartbeat
   */
  updateHeartbeat(): void {
    this.health.lastHeartbeat = Date.now();
  }

  /**
   * Update metrics
   */
  updateMetrics(metrics: Partial<SubagentHealth>): void {
    Object.assign(this.health, metrics);
    
    // Update performance history
    if (metrics.avgResponseTime !== undefined) {
      this.performanceMetrics.push(metrics.avgResponseTime);
      if (this.performanceMetrics.length > 100) {
        this.performanceMetrics.shift();
      }
    }
  }

  /**
   * Get health status
   */
  getHealth(): SubagentHealth {
    return { ...this.health };
  }

  /**
   * Predict failure probability
   */
  predictFailure(): number {
    if (this.performanceMetrics.length < 10) {
      return 0; // Not enough data
    }
    
    // Simple trend analysis
    const recent = this.performanceMetrics.slice(-10);
    const older = this.performanceMetrics.slice(-20, -10);
    
    if (older.length === 0) return 0;
    
    const recentAvg = recent.reduce((a, b) => a + b, 0) / recent.length;
    const olderAvg = older.reduce((a, b) => a + b, 0) / older.length;
    
    // Calculate degradation rate
    const degradation = (recentAvg - olderAvg) / olderAvg;
    
    // Combine with current health metrics
    let probability = 0;
    
    if (degradation > 0.5) probability += 0.3;
    if (this.health.failureCount > 0) probability += 0.2;
    if (this.health.status === 'degraded') probability += 0.3;
    if (this.health.memoryUsage > this.config.memoryLimit * 0.8) probability += 0.1;
    if (this.health.cpuUsage > this.config.cpuLimit * 0.8) probability += 0.1;
    
    return Math.min(probability, 1.0);
  }

  /**
   * Cleanup
   */
  cleanup(): void {
    this.stop();
    this.removeAllListeners();
  }
}

/**
 * Manager for multiple self-healing subagents
 */
export class SelfHealingManager extends EventEmitter {
  private subagents = new Map<string, SelfHealingSubagent>();
  private taskRoutes = new Map<string, TaskRoute>();
  private circuitBreakers: CircuitBreakerManager;
  private messageQueue: MessageQueueOrchestrator;
  private predictionInterval?: NodeJS.Timeout;

  constructor() {
    super();
    this.circuitBreakers = new CircuitBreakerManager();
    this.messageQueue = new MessageQueueOrchestrator();
    this.startPredictiveMonitoring();
  }

  /**
   * Register a new subagent
   */
  registerSubagent(config: SubagentConfig): SelfHealingSubagent {
    const subagent = new SelfHealingSubagent(config);
    
    // Set up event listeners
    subagent.on('self-healing', (data) => this.handleSelfHealing(data));
    subagent.on('escalate-failure', (data) => this.handleEscalation(data));
    subagent.on('health-degraded', (data) => this.handleDegradation(data));
    
    this.subagents.set(config.id, subagent);
    
    // Register with health monitor
    healthMonitor.startMonitoring(config.id, async () => {
      const health = subagent.getHealth();
      return health.status === 'healthy';
    });
    
    this.emit('subagent-registered', { id: config.id });
    return subagent;
  }

  /**
   * Handle self-healing event
   */
  private handleSelfHealing(data: any): void {
    // Reroute pending tasks
    this.rerouteTasks(data.id);
    
    // Notify other systems
    this.emit('subagent-healing', data);
  }

  /**
   * Handle escalation
   */
  private handleEscalation(data: any): void {
    // Try to spawn replacement
    this.spawnReplacement(data.id);
    
    // Alert administrators
    alertManager.checkAlerts({ 
      subagentFailed: data.id, 
      restarts: data.restarts 
    });
    
    this.emit('subagent-escalated', data);
  }

  /**
   * Handle degradation
   */
  private handleDegradation(data: any): void {
    // Reduce load on degraded subagent
    this.reduceLoad(data.id);
    
    // Monitor for recovery
    this.emit('subagent-degraded', data);
  }

  /**
   * Reroute tasks from failed subagent
   */
  private rerouteTasks(failedAgentId: string): void {
    const healthyAgents = this.getHealthySubagents();
    
    if (healthyAgents.length === 0) {
      this.emit('no-healthy-agents', { failedAgent: failedAgentId });
      return;
    }
    
    // Find tasks assigned to failed agent
    for (const [taskId, route] of this.taskRoutes.entries()) {
      if (route.currentAgent === failedAgentId) {
        // Select new agent (round-robin for simplicity)
        const newAgent = healthyAgents[route.rerouteCount % healthyAgents.length];
        
        route.currentAgent = newAgent.config.id;
        route.rerouteCount++;
        route.timestamp = Date.now();
        
        // Send reroute message
        this.messageQueue.delegateToSubagent({
          id: taskId,
          type: 'reroute',
          config: { 
            from: failedAgentId, 
            to: newAgent.config.id 
          },
          payload: {}
        });
        
        this.emit('task-rerouted', { 
          taskId, 
          from: failedAgentId, 
          to: newAgent.config.id 
        });
      }
    }
  }

  /**
   * Spawn replacement subagent
   */
  private async spawnReplacement(failedAgentId: string): Promise<void> {
    const failed = this.subagents.get(failedAgentId);
    if (!failed) return;
    
    const config = failed.config;
    const newId = `${config.type}-replacement-${Date.now()}`;
    
    try {
      // Spawn new subagent
      await this.messageQueue.spawnEphemeralSubagent(config.type, {
        ...config.config,
        id: newId
      });
      
      // Register new subagent
      this.registerSubagent({
        ...config,
        id: newId
      });
      
      // Remove failed subagent
      this.removeSubagent(failedAgentId);
      
      this.emit('replacement-spawned', { 
        failed: failedAgentId, 
        replacement: newId 
      });
      
    } catch (error) {
      this.emit('replacement-failed', { 
        failed: failedAgentId, 
        error: (error as Error).message 
      });
    }
  }

  /**
   * Reduce load on degraded subagent
   */
  private reduceLoad(agentId: string): void {
    // Implement load reduction strategy
    // For example, reduce batch size or increase processing interval
    const subagent = this.subagents.get(agentId);
    if (subagent) {
      // Update circuit breaker to be more conservative
      const breaker = this.circuitBreakers.getOrCreateCircuitBreaker(agentId, {
        failureThreshold: 2, // More sensitive
        recoveryTimeout: 60000 // Longer recovery
      });
      
      this.emit('load-reduced', { agentId });
    }
  }

  /**
   * Get healthy subagents
   */
  private getHealthySubagents(): SelfHealingSubagent[] {
    const healthy: SelfHealingSubagent[] = [];
    
    for (const subagent of this.subagents.values()) {
      const health = subagent.getHealth();
      if (health.status === 'healthy') {
        healthy.push(subagent);
      }
    }
    
    return healthy;
  }

  /**
   * Start predictive monitoring
   */
  private startPredictiveMonitoring(): void {
    this.predictionInterval = setInterval(() => {
      this.predictFailures();
    }, 30000); // Check every 30 seconds
  }

  /**
   * Predict and prevent failures
   */
  private predictFailures(): void {
    for (const [id, subagent] of this.subagents.entries()) {
      const failureProbability = subagent.predictFailure();
      
      if (failureProbability > 0.7) {
        // High risk - take preventive action
        this.emit('high-failure-risk', { 
          agentId: id, 
          probability: failureProbability 
        });
        
        // Preventive actions
        this.takePreventiveAction(id, failureProbability);
      }
    }
  }

  /**
   * Take preventive action for high-risk subagent
   */
  private takePreventiveAction(agentId: string, probability: number): void {
    if (probability > 0.9) {
      // Very high risk - spawn backup immediately
      this.spawnReplacement(agentId);
    } else if (probability > 0.8) {
      // High risk - reduce load and prepare backup
      this.reduceLoad(agentId);
      this.prepareBackup(agentId);
    } else {
      // Moderate risk - just reduce load
      this.reduceLoad(agentId);
    }
  }

  /**
   * Prepare backup subagent
   */
  private prepareBackup(agentId: string): void {
    const subagent = this.subagents.get(agentId);
    if (!subagent) return;
    
    // Pre-warm a backup instance
    const config = subagent.config;
    const backupId = `${config.type}-backup-${Date.now()}`;
    
    this.emit('backup-preparing', { 
      original: agentId, 
      backup: backupId 
    });
    
    // Register but don't activate yet
    // Will be activated if original fails
  }

  /**
   * Remove subagent
   */
  private removeSubagent(agentId: string): void {
    const subagent = this.subagents.get(agentId);
    if (subagent) {
      subagent.cleanup();
      this.subagents.delete(agentId);
      healthMonitor.stopMonitoring(agentId);
      this.emit('subagent-removed', { id: agentId });
    }
  }

  /**
   * Get system health report
   */
  getHealthReport(): {
    total: number;
    healthy: number;
    degraded: number;
    failed: number;
    recovering: number;
    healthScore: number;
    predictions: Array<{ agentId: string; failureProbability: number }>;
  } {
    let healthy = 0;
    let degraded = 0;
    let failed = 0;
    let recovering = 0;
    const predictions: Array<{ agentId: string; failureProbability: number }> = [];
    
    for (const [id, subagent] of this.subagents.entries()) {
      const health = subagent.getHealth();
      
      switch (health.status) {
        case 'healthy': healthy++; break;
        case 'degraded': degraded++; break;
        case 'failed': failed++; break;
        case 'recovering': recovering++; break;
      }
      
      predictions.push({
        agentId: id,
        failureProbability: subagent.predictFailure()
      });
    }
    
    const total = this.subagents.size;
    const healthScore = total === 0 ? 1 : healthy / total;
    
    return {
      total,
      healthy,
      degraded,
      failed,
      recovering,
      healthScore,
      predictions: predictions.sort((a, b) => b.failureProbability - a.failureProbability)
    };
  }

  /**
   * Cleanup
   */
  cleanup(): void {
    if (this.predictionInterval) {
      clearInterval(this.predictionInterval);
    }
    
    for (const subagent of this.subagents.values()) {
      subagent.cleanup();
    }
    
    this.subagents.clear();
    this.taskRoutes.clear();
    this.circuitBreakers.cleanup();
    this.messageQueue.cleanup();
    this.removeAllListeners();
  }
}

// Export singleton instance
export const selfHealingManager = new SelfHealingManager();