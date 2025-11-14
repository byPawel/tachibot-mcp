/**
 * State Machine Interface
 * Defines contract for workflow state management
 */

export enum WorkflowState {
  INITIALIZED = 'INITIALIZED',
  VALIDATING = 'VALIDATING',
  RUNNING = 'RUNNING',
  STEP_EXECUTING = 'STEP_EXECUTING',
  WAITING = 'WAITING',
  RETRYING = 'RETRYING',
  SYNTHESIZING = 'SYNTHESIZING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  PAUSED = 'PAUSED'
}

export interface StateTransitionContext {
  workflowId: string;
  workflowName: string;
  currentStep?: string;
  stepIndex?: number;
  totalSteps?: number;
  error?: Error;
  metadata?: Record<string, any>;
}

export interface IStateMachine {
  /**
   * Get current state
   */
  getCurrentState(): WorkflowState;

  /**
   * Transition to a new state
   * @param to Target state
   * @param context Transition context
   * @throws Error if transition is invalid
   */
  transition(to: WorkflowState, context: StateTransitionContext): void;

  /**
   * Check if transition is valid from current state
   * @param to Target state
   * @returns true if transition is allowed
   */
  canTransition(to: WorkflowState): boolean;

  /**
   * Get state history
   */
  getStateHistory(): Array<{ state: WorkflowState; timestamp: Date; context?: StateTransitionContext }>;

  /**
   * Reset state machine to initial state
   */
  reset(): void;
}
