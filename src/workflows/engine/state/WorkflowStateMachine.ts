/**
 * Workflow State Machine
 * Manages workflow state transitions with event emission
 * Follows CircuitBreaker pattern (extends EventEmitter)
 */

import { EventEmitter } from 'events';
import { WorkflowState, StateTransitionContext, IStateMachine } from './interfaces/IStateMachine.js';

interface StateHistoryEntry {
  state: WorkflowState;
  timestamp: Date;
  context?: StateTransitionContext;
}

export class WorkflowStateMachine extends EventEmitter implements IStateMachine {
  private currentState: WorkflowState = WorkflowState.INITIALIZED;
  private stateHistory: StateHistoryEntry[] = [];

  // Valid state transitions (adjacency list)
  private readonly validTransitions: Map<WorkflowState, WorkflowState[]> = new Map([
    [WorkflowState.INITIALIZED, [
      WorkflowState.VALIDATING,
      WorkflowState.FAILED
    ]],
    [WorkflowState.VALIDATING, [
      WorkflowState.RUNNING,
      WorkflowState.FAILED
    ]],
    [WorkflowState.RUNNING, [
      WorkflowState.STEP_EXECUTING,
      WorkflowState.SYNTHESIZING,
      WorkflowState.COMPLETED,
      WorkflowState.FAILED,
      WorkflowState.PAUSED
    ]],
    [WorkflowState.STEP_EXECUTING, [
      WorkflowState.WAITING,
      WorkflowState.RUNNING,
      WorkflowState.RETRYING,
      WorkflowState.FAILED
    ]],
    [WorkflowState.WAITING, [
      WorkflowState.STEP_EXECUTING,
      WorkflowState.RUNNING,
      WorkflowState.FAILED
    ]],
    [WorkflowState.RETRYING, [
      WorkflowState.STEP_EXECUTING,
      WorkflowState.FAILED
    ]],
    [WorkflowState.SYNTHESIZING, [
      WorkflowState.STEP_EXECUTING,
      WorkflowState.COMPLETED,
      WorkflowState.FAILED
    ]],
    [WorkflowState.PAUSED, [
      WorkflowState.RUNNING,
      WorkflowState.FAILED
    ]],
    [WorkflowState.COMPLETED, []],
    [WorkflowState.FAILED, []]
  ]);

  constructor() {
    super();
    this.recordState(WorkflowState.INITIALIZED, {
      workflowId: '',
      workflowName: ''
    });
  }

  getCurrentState(): WorkflowState {
    return this.currentState;
  }

  canTransition(to: WorkflowState): boolean {
    const allowedStates = this.validTransitions.get(this.currentState) || [];
    return allowedStates.includes(to);
  }

  transition(to: WorkflowState, context: StateTransitionContext): void {
    const from = this.currentState;

    // Validate transition
    if (!this.canTransition(to)) {
      throw new Error(
        `Invalid state transition: ${from} -> ${to}. ` +
        `Allowed transitions from ${from}: ${this.validTransitions.get(from)?.join(', ') || 'none'}`
      );
    }

    // Update state
    this.currentState = to;
    this.recordState(to, context);

    // Emit state change event
    this.emit('state:changed', {
      from,
      to,
      context,
      timestamp: new Date()
    });

    // Emit specific workflow lifecycle events
    this.emitLifecycleEvents(to, context);
  }

  private emitLifecycleEvents(state: WorkflowState, context: StateTransitionContext): void {
    switch (state) {
      case WorkflowState.VALIDATING:
        this.emit('workflow:validating', context);
        break;

      case WorkflowState.RUNNING:
        this.emit('workflow:started', context);
        break;

      case WorkflowState.STEP_EXECUTING:
        this.emit('step:started', {
          stepName: context.currentStep,
          stepIndex: context.stepIndex,
          totalSteps: context.totalSteps,
          workflowId: context.workflowId
        });
        break;

      case WorkflowState.WAITING:
        this.emit('step:waiting', {
          stepName: context.currentStep,
          reason: context.metadata?.waitReason || 'dependency'
        });
        break;

      case WorkflowState.RETRYING:
        this.emit('step:retrying', {
          stepName: context.currentStep,
          attempt: context.metadata?.retryAttempt || 1,
          maxAttempts: context.metadata?.maxRetries || 3,
          error: context.error
        });
        break;

      case WorkflowState.SYNTHESIZING:
        this.emit('workflow:synthesizing', {
          workflowId: context.workflowId,
          reason: context.metadata?.synthesisReason || 'auto'
        });
        break;

      case WorkflowState.COMPLETED:
        this.emit('workflow:completed', {
          workflowId: context.workflowId,
          workflowName: context.workflowName,
          totalSteps: context.totalSteps,
          duration: this.calculateDuration()
        });
        break;

      case WorkflowState.FAILED:
        this.emit('workflow:failed', {
          workflowId: context.workflowId,
          workflowName: context.workflowName,
          error: context.error,
          failedAt: context.currentStep,
          duration: this.calculateDuration()
        });
        break;

      case WorkflowState.PAUSED:
        this.emit('workflow:paused', {
          workflowId: context.workflowId,
          pausedAt: context.currentStep
        });
        break;
    }
  }

  getStateHistory(): StateHistoryEntry[] {
    return [...this.stateHistory];
  }

  reset(): void {
    this.currentState = WorkflowState.INITIALIZED;
    this.stateHistory = [];
    this.recordState(WorkflowState.INITIALIZED, {
      workflowId: '',
      workflowName: ''
    });
    this.emit('state:reset');
  }

  private recordState(state: WorkflowState, context: StateTransitionContext): void {
    this.stateHistory.push({
      state,
      timestamp: new Date(),
      context
    });
  }

  private calculateDuration(): number {
    if (this.stateHistory.length < 2) return 0;
    const start = this.stateHistory[0].timestamp.getTime();
    const end = this.stateHistory[this.stateHistory.length - 1].timestamp.getTime();
    return end - start;
  }

  /**
   * Get human-readable state description
   */
  getStateDescription(): string {
    const descriptions: Record<WorkflowState, string> = {
      [WorkflowState.INITIALIZED]: 'Ready to start',
      [WorkflowState.VALIDATING]: 'Validating workflow configuration',
      [WorkflowState.RUNNING]: 'Running workflow',
      [WorkflowState.STEP_EXECUTING]: 'Executing step',
      [WorkflowState.WAITING]: 'Waiting for dependencies',
      [WorkflowState.RETRYING]: 'Retrying failed step',
      [WorkflowState.SYNTHESIZING]: 'Synthesizing results',
      [WorkflowState.COMPLETED]: 'Completed successfully',
      [WorkflowState.FAILED]: 'Failed with errors',
      [WorkflowState.PAUSED]: 'Paused'
    };
    return descriptions[this.currentState];
  }
}
