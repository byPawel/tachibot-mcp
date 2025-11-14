/**
 * Step Execution Handler
 * Subscribes to step.ready events and executes workflow steps
 *
 * Phase 1: Event infrastructure and state management
 * Phase 2: Will integrate with actual tool execution
 */

import { WorkflowEventBus, WorkflowEvents } from '../events/WorkflowEventBus.js';
import { WorkflowStateMachine } from '../state/WorkflowStateMachine.js';
import { WorkflowState } from '../state/interfaces/IStateMachine.js';
import { WorkflowStep } from '../../workflow-types.js';

export interface StepExecutionContext {
  workflowId: string;
  workflowName: string;
  step: WorkflowStep;
  stepIndex: number;
  totalSteps: number;
  variables: Record<string, any>;
  fileReferences: Map<string, any>;
  accumulatedResults: any[];
}

export interface StepExecutionResult {
  stepName: string;
  success: boolean;
  output: any;
  error?: Error;
  duration: number;
  tokensUsed?: number;
  cost?: number;
}

export class StepExecutionHandler {
  private eventBus: WorkflowEventBus;
  private stateMachine: WorkflowStateMachine;
  private activeExecutions: Map<string, AbortController> = new Map();

  constructor(
    eventBus: WorkflowEventBus,
    stateMachine: WorkflowStateMachine
  ) {
    this.eventBus = eventBus;
    this.stateMachine = stateMachine;

    // Subscribe to step ready events
    this.eventBus.subscribe(WorkflowEvents.STEP_READY, this.handleStepReady.bind(this));
  }

  private async handleStepReady(context: StepExecutionContext): Promise<void> {
    const { step, workflowId, stepIndex, totalSteps } = context;

    try {
      // Transition to executing state
      this.stateMachine.transition(WorkflowState.STEP_EXECUTING, {
        workflowId,
        workflowName: context.workflowName,
        currentStep: step.name,
        stepIndex,
        totalSteps
      });

      // Check if step should be skipped
      if (await this.shouldSkipStep(step, context)) {
        await this.eventBus.publish(WorkflowEvents.STEP_SKIPPED, {
          stepName: step.name,
          reason: 'condition not met'
        });

        // Transition back to running
        this.stateMachine.transition(WorkflowState.RUNNING, {
          workflowId,
          workflowName: context.workflowName
        });
        return;
      }

      // Execute step with retry logic
      const result = await this.executeStepWithRetry(context);

      // Publish completion event
      await this.eventBus.publish(WorkflowEvents.STEP_COMPLETED, result);

      // Transition back to running
      this.stateMachine.transition(WorkflowState.RUNNING, {
        workflowId,
        workflowName: context.workflowName
      });

    } catch (error) {
      // Handle step failure
      await this.handleStepFailure(context, error as Error);
    }
  }

  private async executeStepWithRetry(context: StepExecutionContext): Promise<StepExecutionResult> {
    const { step, workflowId } = context;
    const maxAttempts = step.retry?.attempts || 1;
    const backoff = step.retry?.backoff || 1000;

    let lastError: Error | undefined;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        if (attempt > 1) {
          // Transition to retrying state
          this.stateMachine.transition(WorkflowState.RETRYING, {
            workflowId,
            workflowName: context.workflowName,
            currentStep: step.name,
            metadata: {
              retryAttempt: attempt,
              maxRetries: maxAttempts
            }
          });

          // Wait with exponential backoff
          await this.delay(backoff * Math.pow(2, attempt - 2));
        }

        // Execute the step
        const result = await this.executeStep(context);
        return result;

      } catch (error) {
        lastError = error as Error;
        console.error(`[StepExecutionHandler] Attempt ${attempt}/${maxAttempts} failed:`, error);

        // If this was the last attempt, throw
        if (attempt === maxAttempts) {
          throw lastError;
        }
      }
    }

    // Should never reach here, but TypeScript requires it
    throw lastError || new Error('Step execution failed');
  }

  private async executeStep(context: StepExecutionContext): Promise<StepExecutionResult> {
    const { step } = context;
    const startTime = Date.now();

    // Create abort controller for this execution
    const abortController = new AbortController();
    this.activeExecutions.set(step.name, abortController);

    try {
      // Publish before invoke event (for PromptEnhancementHandler)
      await this.eventBus.publish(WorkflowEvents.TOOL_BEFORE_INVOKE, {
        stepName: step.name,
        tool: step.tool,
        input: step.input,
        context
      });

      // TODO Phase 2: Integrate with actual tool execution via tool-mapper.ts
      // For now, just simulate execution
      const mockResult = {
        output: `[Phase 1] Simulated execution of ${step.tool}`,
        tokensUsed: 0,
        cost: 0
      };

      // Publish tool success event
      await this.eventBus.publish(WorkflowEvents.TOOL_SUCCESS, {
        stepName: step.name,
        tool: step.tool,
        result: mockResult
      });

      const duration = Date.now() - startTime;

      return {
        stepName: step.name,
        success: true,
        output: mockResult.output,
        duration,
        tokensUsed: mockResult.tokensUsed,
        cost: mockResult.cost
      };

    } catch (error) {
      const duration = Date.now() - startTime;

      // Publish tool failure event
      await this.eventBus.publish(WorkflowEvents.TOOL_FAILURE, {
        stepName: step.name,
        tool: step.tool,
        error
      });

      throw error;

    } finally {
      this.activeExecutions.delete(step.name);
    }
  }

  private async shouldSkipStep(step: WorkflowStep, context: StepExecutionContext): Promise<boolean> {
    // Check condition.skip flag
    if (step.condition?.skip) {
      return true;
    }

    // Check condition.if expression
    if (step.condition?.if) {
      // Simple condition evaluation (can be enhanced)
      const conditionMet = this.evaluateCondition(step.condition.if, context.variables);
      return !conditionMet;
    }

    return false;
  }

  private evaluateCondition(condition: string, variables: Record<string, any>): boolean {
    // Simple equality check: "variable == value"
    const match = condition.match(/^(\w+)\s*==\s*(.+)$/);
    if (match) {
      const [, variable, expectedValue] = match;
      const actualValue = variables[variable];
      return String(actualValue).trim() === expectedValue.trim().replace(/['"]/, '');
    }

    // Default: check if variable exists and is truthy
    return !!variables[condition];
  }

  private async handleStepFailure(context: StepExecutionContext, error: Error): Promise<void> {
    const { step, workflowId } = context;

    // Check if step allows failure
    const failOnError = step.condition?.failOnError !== false;

    if (failOnError) {
      // Publish step failed event
      await this.eventBus.publish(WorkflowEvents.STEP_FAILED, {
        stepName: step.name,
        error,
        fatal: true
      });

      // Transition to failed state
      this.stateMachine.transition(WorkflowState.FAILED, {
        workflowId,
        workflowName: context.workflowName,
        currentStep: step.name,
        error
      });

      // Publish workflow failed event
      await this.eventBus.publish(WorkflowEvents.WORKFLOW_FAILED, {
        workflowId,
        workflowName: context.workflowName,
        error,
        failedAt: step.name
      });

    } else {
      // Non-fatal failure - continue workflow
      await this.eventBus.publish(WorkflowEvents.STEP_FAILED, {
        stepName: step.name,
        error,
        fatal: false
      });

      // Transition back to running
      this.stateMachine.transition(WorkflowState.RUNNING, {
        workflowId,
        workflowName: context.workflowName
      });
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Abort a specific step execution
   */
  abortStep(stepName: string): void {
    const controller = this.activeExecutions.get(stepName);
    if (controller) {
      controller.abort();
      this.activeExecutions.delete(stepName);
    }
  }

  /**
   * Abort all active step executions
   */
  abortAll(): void {
    for (const controller of this.activeExecutions.values()) {
      controller.abort();
    }
    this.activeExecutions.clear();
  }
}
