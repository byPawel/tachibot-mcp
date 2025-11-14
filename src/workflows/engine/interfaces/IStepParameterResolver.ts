/**
 * Interface for resolving step parameters (model, temperature, maxTokens)
 * Handles interpolation of ${variable} syntax in step configuration
 */

import { WorkflowStep } from '../../workflow-types.js';
import { FileReference } from './IVariableInterpolator.js';

export interface ResolutionContext {
  variables: Record<string, any>;
  stepOutputs: Record<string, FileReference>;
}

export interface ResolvedParameters {
  model?: string;
  temperature?: number;
  maxTokens?: number;
}

export interface IStepParameterResolver {
  /**
   * Resolves step parameters (model, temperature, maxTokens)
   * Interpolates ${variable} references and converts types
   * @param step - Workflow step with potential template strings
   * @param context - Context containing variables and step outputs
   * @returns Resolved parameters with correct types
   */
  resolve(
    step: WorkflowStep,
    context: ResolutionContext
  ): ResolvedParameters;
}
