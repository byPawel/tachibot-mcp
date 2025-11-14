/**
 * Interface for automatic workflow synthesis
 * Summarizes large multi-step workflow outputs to bypass MCP 25k token limit
 */

import { Workflow, WorkflowStep } from '../../workflow-types.js';

export interface SynthesisContext {
  workflow: Workflow;
  variables: Record<string, any>;
  sessionDir: string | null;
}

export interface IAutoSynthesizer {
  /**
   * Determines if auto-synthesis should run
   * Checks token threshold and saveToFile flags
   * @param workflow - Workflow definition
   * @param accumulatedResults - Results from executed steps
   * @param currentStepIndex - Current step index in workflow
   * @returns True if synthesis should be triggered
   */
  shouldSynthesize(
    workflow: Workflow,
    accumulatedResults: any[],
    currentStepIndex: number
  ): boolean;

  /**
   * Creates a synthesis step that summarizes all previous outputs
   * @param context - Context with workflow, variables, and session directory
   * @returns Synthesis step definition
   */
  createSynthesisStep(
    context: SynthesisContext
  ): WorkflowStep;

  /**
   * Estimates total tokens across accumulated results
   * @param results - Array of step results
   * @returns Estimated token count
   */
  estimateTotalTokens(results: any[]): number;
}
