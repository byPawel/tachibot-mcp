/**
 * Step Parameter Resolver
 * Resolves step parameters (model, temperature, maxTokens) with variable interpolation
 */

import {
  IStepParameterResolver,
  ResolutionContext,
  ResolvedParameters
} from './interfaces/IStepParameterResolver.js';
import { WorkflowStep } from '../workflow-types.js';
import { FileReference } from './interfaces/IVariableInterpolator.js';

export class StepParameterResolver implements IStepParameterResolver {
  /**
   * Type guard to check if value is a FileReference
   */
  private isFileReference(value: any): value is FileReference {
    return (
      value &&
      typeof value === 'object' &&
      'stepName' in value &&
      'summary' in value &&
      'getContent' in value &&
      typeof value.getContent === 'function'
    );
  }

  /**
   * Resolves step parameters (model, temperature, maxTokens)
   */
  resolve(
    step: WorkflowStep,
    context: ResolutionContext
  ): ResolvedParameters {
    const mergedContext = { ...context.variables, ...context.stepOutputs };

    // Helper to resolve a value (string or already-resolved)
    const resolve = (
      value: string | number | undefined,
      type: "string" | "number",
    ): any => {
      if (value === undefined) return undefined;

      // Already the correct type
      if (type === "number" && typeof value === "number") return value;
      if (
        type === "string" &&
        typeof value === "string" &&
        !value.includes("${")
      )
        return value;

      // Interpolate ${variable} if it's a string
      if (typeof value === "string") {
        const interpolated = value.replace(/\${([^}]+)}/g, (match, key) => {
          const resolved = mergedContext[key];
          // Handle FileReference objects - return summary by default
          if (this.isFileReference(resolved)) {
            return resolved.summary;
          }
          // Preserve placeholder if undefined (better for debugging than empty string)
          return resolved !== undefined ? String(resolved) : match;
        });

        // Convert to number if needed
        if (type === "number") {
          const num = parseFloat(interpolated);
          if (isNaN(num)) {
            console.warn(
              `⚠️ Could not convert "${interpolated}" to number, using undefined`,
            );
            return undefined;
          }
          return num;
        }

        return interpolated;
      }

      return value;
    };

    const resolved = {
      model: resolve(step.model, "string") as string | undefined,
      temperature: resolve(step.temperature, "number") as number | undefined,
      maxTokens: resolve(step.maxTokens, "number") as number | undefined,
    };

    // Log if interpolation happened
    if (step.model && step.model !== resolved.model) {
      console.error(`🔄 Resolved model: "${step.model}" → "${resolved.model}"`);
    }
    if (step.temperature && step.temperature !== resolved.temperature) {
      console.error(
        `🔄 Resolved temperature: "${step.temperature}" → ${resolved.temperature}`,
      );
    }
    if (step.maxTokens && step.maxTokens !== resolved.maxTokens) {
      console.error(
        `🔄 Resolved maxTokens: "${step.maxTokens}" → ${resolved.maxTokens}`,
      );
    }

    return resolved;
  }
}
