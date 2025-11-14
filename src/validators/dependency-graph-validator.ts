/**
 * Dependency graph validator - detects circular dependencies and validates execution order
 */

import { ValidationError, ValidationContext } from './types.js';

export class DependencyGraphValidator {
  private readonly interpolationRegex = /\$\{([^.}]+)(?:\.[^}]+)?\}/g;

  validate(context: ValidationContext): ValidationError[] {
    const errors: ValidationError[] = [];

    // Build dependency graph
    const graph = this.buildDependencyGraph(context.workflow.steps);

    // Check for circular dependencies
    const cycle = this.detectCycle(graph);
    if (cycle) {
      errors.push({
        type: 'dependency',
        severity: 'error',
        message: `Circular dependency detected: ${cycle.join(' → ')} → ${cycle[0]}`,
        path: '$.steps',
        suggestion: 'Reorganize steps to remove circular dependencies'
      });
    }

    // Validate execution order
    const orderErrors = this.validateExecutionOrder(context.workflow.steps, graph);
    errors.push(...orderErrors);

    return errors;
  }

  /**
   * Build dependency graph from workflow steps
   * Returns Map<stepName, Set<dependencies>>
   */
  private buildDependencyGraph(steps: any[]): Map<string, Set<string>> {
    const graph = new Map<string, Set<string>>();

    steps.forEach(step => {
      graph.set(step.name, new Set());

      // Add explicit dependencies
      if (step.dependsOn && Array.isArray(step.dependsOn)) {
        step.dependsOn.forEach((dep: string) => graph.get(step.name)!.add(dep));
      }

      // Add dependencies from loadFiles
      if (step.loadFiles && Array.isArray(step.loadFiles)) {
        step.loadFiles.forEach((fileRef: string) => graph.get(step.name)!.add(fileRef));
      }

      // Add implicit dependencies from interpolations in input
      if (step.input) {
        const inputStr = JSON.stringify(step.input);
        const matches = inputStr.matchAll(this.interpolationRegex);

        for (const match of matches) {
          const reference = match[1]; // Get the step name part
          // Only add if it's referencing another step (not a variable)
          if (steps.some(s => s.name === reference)) {
            graph.get(step.name)!.add(reference);
          }
        }
      }

      // Add implicit dependencies from 'when' condition
      if (step.when) {
        const matches = step.when.matchAll(this.interpolationRegex);

        for (const match of matches) {
          const reference = match[1];
          if (steps.some(s => s.name === reference)) {
            graph.get(step.name)!.add(reference);
          }
        }
      }
    });

    return graph;
  }

  /**
   * Detect circular dependencies using DFS
   * Returns the cycle path if found, null otherwise
   */
  private detectCycle(graph: Map<string, Set<string>>): string[] | null {
    const visiting = new Set<string>();
    const visited = new Set<string>();
    const path: string[] = [];

    for (const node of graph.keys()) {
      if (!visited.has(node)) {
        if (this.hasCycleDFS(node, graph, visiting, visited, path)) {
          // Extract just the cycle from the path
          const cycleStart = path.indexOf(path[path.length - 1]);
          return path.slice(cycleStart);
        }
      }
    }

    return null;
  }

  /**
   * DFS helper to detect cycles
   */
  private hasCycleDFS(
    node: string,
    graph: Map<string, Set<string>>,
    visiting: Set<string>,
    visited: Set<string>,
    path: string[]
  ): boolean {
    if (visiting.has(node)) {
      // Found a cycle - add the node that creates the cycle
      path.push(node);
      return true;
    }

    if (visited.has(node)) {
      return false;
    }

    visiting.add(node);
    path.push(node);

    const neighbors = graph.get(node) || new Set();
    for (const neighbor of neighbors) {
      if (this.hasCycleDFS(neighbor, graph, visiting, visited, path)) {
        return true;
      }
    }

    visiting.delete(node);
    visited.add(node);
    path.pop();

    return false;
  }

  /**
   * Validate that dependencies appear before dependent steps
   */
  private validateExecutionOrder(steps: any[], graph: Map<string, Set<string>>): ValidationError[] {
    const errors: ValidationError[] = [];
    const stepPositions = new Map(steps.map((s, i) => [s.name, i]));

    for (const [stepName, dependencies] of graph.entries()) {
      const currentPos = stepPositions.get(stepName);
      if (currentPos === undefined) continue;

      for (const dep of dependencies) {
        const depPos = stepPositions.get(dep);

        if (depPos === undefined) {
          errors.push({
            type: 'dependency',
            severity: 'error',
            message: `Step '${stepName}' depends on undefined step '${dep}'`,
            path: `$.steps[${currentPos}]`,
            suggestion: `Define step '${dep}' or remove the dependency`
          });
        } else if (depPos >= currentPos) {
          errors.push({
            type: 'dependency',
            severity: 'error',
            message: `Step '${stepName}' depends on '${dep}' which appears later in the workflow`,
            path: `$.steps[${currentPos}]`,
            suggestion: `Move step '${dep}' (currently at position ${depPos + 1}) before step '${stepName}' (position ${currentPos + 1})`
          });
        }
      }
    }

    return errors;
  }
}
