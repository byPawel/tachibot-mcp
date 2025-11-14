import { EventEmitter } from 'events';

export enum CircuitState {
  CLOSED = 'CLOSED',    // Normal operation
  OPEN = 'OPEN',        // Failures detected, circuit open
  HALF_OPEN = 'HALF_OPEN' // Testing if service recovered
}

export interface CircuitBreakerOptions {
  failureThreshold: number;      // Number of failures before opening circuit
  recoveryTimeout: number;       // Time to wait before trying HALF_OPEN (ms)
  successThreshold: number;      // Successes needed in HALF_OPEN to close circuit
  monitoringWindow: number;      // Time window for failure tracking (ms)
  fallback?: () => Promise<any>; // Fallback function when circuit is open
}

export interface CircuitBreakerStats {
  state: CircuitState;
  failures: number;
  successes: number;
  lastFailure: number;
  lastSuccess: number;
  totalRequests: number;
  totalFailures: number;
  uptime: number;
}

export class CircuitBreaker extends EventEmitter {
  private state: CircuitState = CircuitState.CLOSED;
  private failures = 0;
  private successes = 0;
  private lastFailureTime = 0;
  private lastSuccessTime = 0;
  private totalRequests = 0;
  private totalFailures = 0;
  private startTime = Date.now();
  private nextAttempt = 0;

  constructor(
    private stepId: string,
    private options: CircuitBreakerOptions
  ) {
    super();
    this.setMaxListeners(20); // Allow multiple listeners
  }

  async execute<T>(operation: () => Promise<T>): Promise<T> {
    this.totalRequests++;

    if (this.state === CircuitState.OPEN) {
      if (this.shouldAttemptReset()) {
        this.state = CircuitState.HALF_OPEN;
        this.successes = 0;
        this.emit('half-open', { stepId: this.stepId });
      } else {
        this.emit('fallback', { stepId: this.stepId, reason: 'circuit-open' });
        return this.executeFallback();
      }
    }

    try {
      const result = await operation();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure(error as Error);
      throw error;
    }
  }

  private onSuccess(): void {
    this.failures = 0;
    this.successes++;
    this.lastSuccessTime = Date.now();

    if (this.state === CircuitState.HALF_OPEN) {
      if (this.successes >= this.options.successThreshold) {
        this.state = CircuitState.CLOSED;
        this.emit('closed', { stepId: this.stepId });
      }
    }

    this.emit('success', { stepId: this.stepId, state: this.state });
  }

  private onFailure(error: Error): void {
    this.failures++;
    this.totalFailures++;
    this.lastFailureTime = Date.now();

    if (this.state === CircuitState.HALF_OPEN) {
      this.state = CircuitState.OPEN;
      this.nextAttempt = Date.now() + this.options.recoveryTimeout;
      this.emit('opened', { stepId: this.stepId, reason: 'half-open-failure' });
    } else if (this.state === CircuitState.CLOSED) {
      if (this.failures >= this.options.failureThreshold) {
        this.state = CircuitState.OPEN;
        this.nextAttempt = Date.now() + this.options.recoveryTimeout;
        this.emit('opened', { stepId: this.stepId, reason: 'failure-threshold' });
      }
    }

    this.emit('failure', { stepId: this.stepId, error: error.message, state: this.state });
  }

  private shouldAttemptReset(): boolean {
    return Date.now() >= this.nextAttempt;
  }

  private async executeFallback<T>(): Promise<T> {
    if (this.options.fallback) {
      try {
        const result = await this.options.fallback();
        this.emit('fallback-success', { stepId: this.stepId });
        return result;
      } catch (error) {
        this.emit('fallback-failure', { stepId: this.stepId, error: (error as Error).message });
        throw new Error(`Circuit breaker open for ${this.stepId} and fallback failed: ${(error as Error).message}`);
      }
    }

    throw new Error(`Circuit breaker open for ${this.stepId} and no fallback configured`);
  }

  getStats(): CircuitBreakerStats {
    return {
      state: this.state,
      failures: this.failures,
      successes: this.successes,
      lastFailure: this.lastFailureTime,
      lastSuccess: this.lastSuccessTime,
      totalRequests: this.totalRequests,
      totalFailures: this.totalFailures,
      uptime: Date.now() - this.startTime
    };
  }

  // Manual control methods
  forceOpen(): void {
    this.state = CircuitState.OPEN;
    this.nextAttempt = Date.now() + this.options.recoveryTimeout;
    this.emit('force-opened', { stepId: this.stepId });
  }

  forceClose(): void {
    this.state = CircuitState.CLOSED;
    this.failures = 0;
    this.successes = 0;
    this.emit('force-closed', { stepId: this.stepId });
  }

  forceHalfOpen(): void {
    this.state = CircuitState.HALF_OPEN;
    this.successes = 0;
    this.emit('force-half-open', { stepId: this.stepId });
  }
}

export class CircuitBreakerManager extends EventEmitter {
  private breakers = new Map<string, CircuitBreaker>();
  private defaultOptions: CircuitBreakerOptions = {
    failureThreshold: 5,
    recoveryTimeout: 30000, // 30 seconds
    successThreshold: 2,
    monitoringWindow: 60000, // 1 minute
  };

  getOrCreateCircuitBreaker(stepId: string, options?: Partial<CircuitBreakerOptions>): CircuitBreaker {
    if (!this.breakers.has(stepId)) {
      const finalOptions = { ...this.defaultOptions, ...options };
      const breaker = new CircuitBreaker(stepId, finalOptions);
      
      // Proxy all events to the manager
      breaker.on('opened', (data) => this.emit('breaker-opened', data));
      breaker.on('closed', (data) => this.emit('breaker-closed', data));
      breaker.on('half-open', (data) => this.emit('breaker-half-open', data));
      breaker.on('failure', (data) => this.emit('breaker-failure', data));
      breaker.on('success', (data) => this.emit('breaker-success', data));
      breaker.on('fallback', (data) => this.emit('breaker-fallback', data));
      
      this.breakers.set(stepId, breaker);
    }
    
    return this.breakers.get(stepId)!;
  }

  getAllStats(): Record<string, CircuitBreakerStats> {
    const stats: Record<string, CircuitBreakerStats> = {};
    
    for (const [stepId, breaker] of this.breakers.entries()) {
      stats[stepId] = breaker.getStats();
    }
    
    return stats;
  }

  getHealthReport(): {
    totalBreakers: number;
    openBreakers: number;
    halfOpenBreakers: number;
    closedBreakers: number;
    healthScore: number;
  } {
    const stats = this.getAllStats();
    const total = Object.keys(stats).length;
    
    let open = 0;
    let halfOpen = 0;
    let closed = 0;
    
    for (const stat of Object.values(stats)) {
      switch (stat.state) {
        case CircuitState.OPEN:
          open++;
          break;
        case CircuitState.HALF_OPEN:
          halfOpen++;
          break;
        case CircuitState.CLOSED:
          closed++;
          break;
      }
    }
    
    const healthScore = total === 0 ? 1.0 : closed / total;
    
    return {
      totalBreakers: total,
      openBreakers: open,
      halfOpenBreakers: halfOpen,
      closedBreakers: closed,
      healthScore
    };
  }

  // Cleanup unused breakers
  cleanup(): void {
    const now = Date.now();
    const maxIdle = 300000; // 5 minutes
    
    for (const [stepId, breaker] of this.breakers.entries()) {
      const stats = breaker.getStats();
      const lastActivity = Math.max(stats.lastSuccess, stats.lastFailure);
      
      if (lastActivity > 0 && (now - lastActivity) > maxIdle) {
        breaker.removeAllListeners();
        this.breakers.delete(stepId);
        this.emit('breaker-cleanup', { stepId });
      }
    }
  }
}