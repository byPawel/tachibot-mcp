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
   * Evaluate a condition string against variables/step outputs.
   *
   *   "flag"                                  truthy check
   *   "mode == fast"                          string equality (quotes optional)
   *   "gate.answers.grounded.noul >= 0.7"     dotted path + numeric compare
   *   "gate.answers.pick.choice != redis"
 *   "evidence-gate.answers.ok.noul < 0.5"   hyphenated step names work
   *
   * Operators: == != > >= < <=. A `${...}` wrapper is tolerated. Paths walk
   * into objects, or into JSON parsed from a string value — that is how a
   * jev_decide step's output becomes branchable. FileReference step outputs
   * must be loaded first via resolveConditionContext (their content is async).
   * Unresolvable paths are undefined: comparisons against them are false.
   */
  static evaluateCondition(condition: string, context: Record<string, any>): boolean {
    const expr = condition.trim().replace(/^\$\{([\s\S]*)\}$/, '$1').trim();
    const match = expr.match(/^([\w.[\]-]+)\s*(==|!=|>=|<=|>|<)\s*(.+)$/);
    if (!match) return !!WorkflowHelpers.resolvePath(expr, context);

    const [, path, op, rawExpected] = match;
    const actual = WorkflowHelpers.resolvePath(path, context);
    const expected = rawExpected.trim().replace(/^['"]|['"]$/g, '');

    if (op === '==' || op === '!=') {
      const equal = actual !== undefined && String(actual).trim() === expected;
      return op === '==' ? equal : !equal;
    }

    const a = typeof actual === 'number' ? actual : parseFloat(String(actual));
    const b = parseFloat(expected);
    if (actual === undefined || actual === null || Number.isNaN(a) || Number.isNaN(b)) return false;
    switch (op) {
      case '>': return a > b;
      case '>=': return a >= b;
      case '<': return a < b;
      default: return a <= b;
    }
  }

  /** Walk a dotted/indexed path, parsing JSON strings on the way down. */
  static resolvePath(path: string, context: Record<string, any>): any {
    const parts = path.replace(/\[([\w-]+)\]/g, '.$1').split('.').filter(Boolean);
    let value: any = context;
    for (let i = 0; i < parts.length; i++) {
      if (value === undefined || value === null) return undefined;
      if (typeof value === 'string' && i > 0) value = WorkflowHelpers.parseJsonLoose(value);
      if (typeof value !== 'object' || value === null) return undefined;
      value = value[parts[i]];
    }
    return value;
  }

  /** JSON.parse that also accepts output with text around a single JSON object. */
  static parseJsonLoose(text: string): any {
    try {
      return JSON.parse(text);
    } catch {
      const start = text.indexOf('{');
      const end = text.lastIndexOf('}');
      if (start === -1 || end <= start) return undefined;
      try {
        return JSON.parse(text.slice(start, end + 1));
      } catch {
        return undefined;
      }
    }
  }

  /**
   * Return a copy of the context where the condition's root variable, if it is a
   * FileReference step output, is replaced by its loaded content so
   * evaluateCondition can read into it synchronously.
   */
  static async resolveConditionContext(
    condition: string,
    context: Record<string, any>,
  ): Promise<Record<string, any>> {
    const root = condition.trim().replace(/^\$\{/, '').match(/^[\w-]+/)?.[0];
    const value = root ? context[root] : undefined;
    if (!value || typeof value !== 'object' || typeof value.getContent !== 'function') return context;
    try {
      return { ...context, [root!]: await value.getContent() };
    } catch {
      return { ...context, [root!]: value.summary };
    }
  }
}
