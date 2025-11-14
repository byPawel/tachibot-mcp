/**
 * Workflow Helper Utilities
 * Small helper functions for workflow processing
 */

import { WorkflowStep, Workflow } from '../workflow-types.js';

export class WorkflowHelpers {
  /**
   * Group workflow steps by dependencies for parallel execution
   * Steps with no dependencies run first, then steps depending on them, etc.
   */
  static groupStepsByDependencies(steps: WorkflowStep[]): WorkflowStep[][] {
    const groups: WorkflowStep[][] = [];
    const processed = new Set<string>();

    while (processed.size < steps.length) {
      const group: WorkflowStep[] = [];

      for (const step of steps) {
        if (processed.has(step.name)) continue;

        // Check if all dependencies are satisfied
        const ready = !step.dependsOn ||
          step.dependsOn.every(dep => processed.has(dep));

        if (ready) {
          group.push(step);
        }
      }

      if (group.length === 0) {
        throw new Error('Circular dependency detected in workflow steps');
      }

      groups.push(group);
      group.forEach(step => processed.add(step.name));
    }

    return groups;
  }

  /**
   * Calculate step numbers for display (handles parallel execution)
   * Example: step1=1, step2=2, step3=3a, step4=3b (parallel), step5=4
   *
   * Rules:
   * - Steps are SEQUENTIAL by default (1, 2, 3...)
   * - Steps marked with `parallel: true` share the same number (3a, 3b)
   * - The `parallel` flag means "run in parallel with NEXT step"
   */
  static calculateStepNumbers(workflow: Workflow): Map<string, string> {
    const stepNumbers = new Map<string, string>();
    let sequentialNumber = 1;
    let i = 0;

    while (i < workflow.steps.length) {
      const step = workflow.steps[i];

      // Check if this step and subsequent steps form a parallel group
      const parallelGroup: WorkflowStep[] = [step];
      let j = i + 1;

      // If current step has parallel flag, collect all subsequent parallel steps
      if (step.parallel === true) {
        while (j < workflow.steps.length && workflow.steps[j - 1].parallel === true) {
          parallelGroup.push(workflow.steps[j]);
          j++;
        }
      }

      // Assign numbers
      console.error(`[WorkflowHelpers] Step ${step.name}: parallelGroup.length = ${parallelGroup.length}`);
      if (parallelGroup.length === 1) {
        // Single sequential step
        stepNumbers.set(step.name, String(sequentialNumber));
        console.error(`[WorkflowHelpers] Assigned sequential: ${step.name} -> ${sequentialNumber}`);
      } else {
        // Parallel group - use letters (3a, 3b, 3c)
        console.error(`[WorkflowHelpers] Parallel group with ${parallelGroup.length} steps`);
        parallelGroup.forEach((parallelStep, index) => {
          const letter = String.fromCharCode(97 + index); // 97 = 'a'
          stepNumbers.set(parallelStep.name, `${sequentialNumber}${letter}`);
          console.error(`[WorkflowHelpers] Assigned parallel: ${parallelStep.name} -> ${sequentialNumber}${letter}`);
        });
      }

      sequentialNumber++;
      i = j;
    }

    return stepNumbers;
  }

  /**
   * Check if two dependency sets are identical
   */
  static haveSameDependencies(deps1: Set<string>, deps2: Set<string>): boolean {
    if (deps1.size !== deps2.size) return false;
    for (const dep of deps1) {
      if (!deps2.has(dep)) return false;
    }
    return true;
  }

  /**
   * Estimate token count for any data type
   * Uses character-based approximation: tokens ≈ characters / 4
   */
  static estimateTokens(data: any): number {
    const text = typeof data === 'string' ? data : JSON.stringify(data);
    return Math.ceil(text.length / 4);
  }

  /**
   * Evaluate a condition string (basic implementation)
   * Returns true/false based on condition evaluation
   */
  static evaluateCondition(condition: string, context: Record<string, any>): boolean {
    // Simple equality check: "variable == value"
    const match = condition.match(/^(\w+)\s*==\s*(.+)$/);
    if (match) {
      const [, variable, expectedValue] = match;
      const actualValue = context[variable];
      return String(actualValue).trim() === expectedValue.trim().replace(/['"]/g, '');
    }

    // Default: if variable exists and is truthy
    return !!context[condition];
  }
}
