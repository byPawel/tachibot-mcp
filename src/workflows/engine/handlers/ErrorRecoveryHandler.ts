/**
 * Error Recovery Handler
 * Implements circuit breaker pattern for failing steps
 * Tracks failure rates and applies recovery strategies
 */

import { EventEmitter } from 'events';
import { WorkflowEventBus, WorkflowEvents } from '../events/WorkflowEventBus.js';

interface StepFailureRecord {
  stepName: string;
  failures: number;
  lastFailureTime: number;
  consecutiveFailures: number;
}

enum CircuitState {
  CLOSED = 'CLOSED', // Normal operation
  OPEN = 'OPEN', // Too many failures, reject immediately
  HALF_OPEN = 'HALF_OPEN' // Testing if service recovered
}

export class ErrorRecoveryHandler extends EventEmitter {
  private eventBus: WorkflowEventBus;
  private failureRecords: Map<string, StepFailureRecord> = new Map();
  private circuitStates: Map<string, CircuitState> = new Map();

  // Circuit breaker thresholds
  private readonly failureThreshold = 3; // Open circuit after 3 failures
  private readonly recoveryTimeout = 30000; // 30 seconds
  private readonly halfOpenAttempts = 1; // Allow 1 attempt in half-open state

  constructor(eventBus: WorkflowEventBus) {
    super();
    this.eventBus = eventBus;

    // Subscribe to failure events
    this.eventBus.subscribe(
      WorkflowEvents.STEP_FAILED,
      this.handleStepFailure.bind(this)
    );

    this.eventBus.subscribe(
      WorkflowEvents.STEP_COMPLETED,
      this.handleStepSuccess.bind(this)
    );

    this.eventBus.subscribe(
      WorkflowEvents.TOOL_FAILURE,
      this.handleToolFailure.bind(this)
    );
  }

  private async handleStepFailure(event: { stepName: string; error: Error; fatal: boolean }): Promise<void> {
    const { stepName, error } = event;

    // Update failure record
    const record = this.failureRecords.get(stepName) || {
      stepName,
      failures: 0,
      lastFailureTime: 0,
      consecutiveFailures: 0
    };

    record.failures++;
    record.consecutiveFailures++;
    record.lastFailureTime = Date.now();
    this.failureRecords.set(stepName, record);

    console.error(
      `[ErrorRecovery] Step ${stepName} failed (${record.consecutiveFailures} consecutive failures)`
    );

    // Check if circuit should open
    if (record.consecutiveFailures >= this.failureThreshold) {
      await this.openCircuit(stepName);
    }

    // Emit recovery suggestions
    const suggestions = this.getRecoverySuggestions(stepName, error);
    await this.eventBus.publish('workflow.error.recovery_suggestions', {
      stepName,
      suggestions
    });
  }

  private async handleStepSuccess(event: { stepName: string }): Promise<void> {
    const { stepName } = event;

    // Reset consecutive failures
    const record = this.failureRecords.get(stepName);
    if (record) {
      record.consecutiveFailures = 0;
      this.failureRecords.set(stepName, record);
    }

    // Close circuit if it was open
    const state = this.circuitStates.get(stepName);
    if (state === CircuitState.HALF_OPEN) {
      await this.closeCircuit(stepName);
    }
  }

  private async handleToolFailure(event: { stepName: string; tool: string; error: Error }): Promise<void> {
    const { stepName, tool, error } = event;

    console.error(`[ErrorRecovery] Tool ${tool} failed for step ${stepName}`);

    // Check if we should attempt recovery
    const shouldRecover = await this.shouldAttemptRecovery(stepName);
    if (shouldRecover) {
      await this.eventBus.publish(WorkflowEvents.ERROR_RECOVERED, {
        stepName,
        tool,
        recoveryAction: 'retry'
      });
    }
  }

  private async openCircuit(stepName: string): Promise<void> {
    this.circuitStates.set(stepName, CircuitState.OPEN);
    console.error(`[ErrorRecovery] Circuit OPEN for step ${stepName} - rejecting requests`);

    this.emit('circuit:opened', { stepName });

    // Schedule half-open transition
    setTimeout(() => {
      this.transitionToHalfOpen(stepName);
    }, this.recoveryTimeout);
  }

  private async closeCircuit(stepName: string): Promise<void> {
    this.circuitStates.set(stepName, CircuitState.CLOSED);
    console.error(`[ErrorRecovery] Circuit CLOSED for step ${stepName} - normal operation`);

    this.emit('circuit:closed', { stepName });
  }

  private transitionToHalfOpen(stepName: string): void {
    const state = this.circuitStates.get(stepName);
    if (state === CircuitState.OPEN) {
      this.circuitStates.set(stepName, CircuitState.HALF_OPEN);
      console.error(
        `[ErrorRecovery] Circuit HALF_OPEN for step ${stepName} - testing recovery`
      );

      this.emit('circuit:half_open', { stepName });
    }
  }

  private async shouldAttemptRecovery(stepName: string): Promise<boolean> {
    const state = this.circuitStates.get(stepName) || CircuitState.CLOSED;

    // Don't attempt recovery if circuit is open
    if (state === CircuitState.OPEN) {
      return false;
    }

    // In half-open state, allow limited attempts
    if (state === CircuitState.HALF_OPEN) {
      return true;
    }

    // In closed state, always attempt recovery
    return true;
  }

  private getRecoverySuggestions(stepName: string, error: Error): string[] {
    const suggestions: string[] = [];

    const errorMessage = error.message.toLowerCase();

    // Rate limiting
    if (errorMessage.includes('rate limit') || errorMessage.includes('429')) {
      suggestions.push('Wait for rate limit to reset');
      suggestions.push('Consider using a different model or provider');
    }

    // Timeout errors
    if (errorMessage.includes('timeout') || errorMessage.includes('timed out')) {
      suggestions.push('Increase maxTokens or timeout settings');
      suggestions.push('Simplify the prompt or split into smaller steps');
    }

    // Model errors
    if (errorMessage.includes('model') || errorMessage.includes('404')) {
      suggestions.push('Check if model name is correct');
      suggestions.push('Try a different model or fallback option');
    }

    // Generic suggestions
    if (suggestions.length === 0) {
      suggestions.push('Review step configuration');
      suggestions.push('Check input data validity');
      suggestions.push('Enable retry with backoff');
    }

    return suggestions;
  }

  /**
   * Get circuit state for a step
   */
  getCircuitState(stepName: string): CircuitState {
    return this.circuitStates.get(stepName) || CircuitState.CLOSED;
  }

  /**
   * Get failure statistics for a step
   */
  getFailureStats(stepName: string): StepFailureRecord | null {
    return this.failureRecords.get(stepName) || null;
  }

  /**
   * Reset circuit breaker for a step
   */
  resetCircuit(stepName: string): void {
    this.circuitStates.delete(stepName);
    this.failureRecords.delete(stepName);
    console.error(`[ErrorRecovery] Circuit reset for step ${stepName}`);
  }
}
