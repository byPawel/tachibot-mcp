/**
 * Output usage validator - detects unused step outputs
 * Ensures every step's output is consumed (unless it's final, parallel, or explicitly saved)
 */

import { ValidationError, ValidationContext, Step } from './types.js';

export class OutputUsageValidator {
  private readonly interpolationRegex = /\$\{([^}]+)\}/g;

  validate(context: ValidationContext): ValidationError[] {
    const errors: ValidationError[] = [];
    const steps: Step[] = context.workflow.steps;

    if (steps.length === 0) return errors;

    // Build usage maps
    const interpolationUsage = this.buildInterpolationUsageMap(steps);
    const fileUsage = this.buildFileUsageMap(steps);

    // Check each step (except last)
    steps.forEach((step: Step, index: number) => {
      const isLast = index === steps.length - 1;

      // Skip validation for special cases
      if (isLast) return; // Final step output is always "used"
      if (step.parallel === true) return; // Parallel steps are side effects

      const stepName = step.name;
      const usedViaInterpolation = interpolationUsage.has(stepName);
      const usedViaFile = fileUsage.has(stepName);
      const hasSaveToFile = step.saveToFile === true;

      // Case 1: Not used at all → ERROR
      if (!usedViaInterpolation && !usedViaFile) {
        errors.push({
          type: 'output-usage',
          severity: 'error',
          message: `Step '${stepName}' produces output but nothing uses it`,
          path: `$.steps[${index}]`,
          suggestion: hasSaveToFile
            ? `Add 'loadFiles: ["${stepName}"]' to a later step, or remove 'saveToFile'`
            : `Either:\n      - Remove this step to save cost\n      - Reference it in a later step: \${${stepName}}\n      - Add 'saveToFile: true' and load it later`
        });
      }
      // Case 2: Saved to file but never loaded → WARNING
      else if (hasSaveToFile && !usedViaFile) {
        errors.push({
          type: 'output-usage',
          severity: 'warning',
          message: `Step '${stepName}' saves output to file but no step loads it`,
          path: `$.steps[${index}]`,
          suggestion: usedViaInterpolation
            ? `File is saved but unused. Consider removing 'saveToFile: true' to save disk space`
            : `Add 'loadFiles: ["${stepName}"]' to a later step, or remove 'saveToFile'`
        });
      }
      // Case 3: Only used via file (not interpolated) → INFO
      else if (usedViaFile && !usedViaInterpolation && hasSaveToFile) {
        // This is actually fine - file-based workflows are intentional
        // Only warn if output is large (can't determine here, so skip)
      }
    });

    return errors;
  }

  /**
   * Build map of which steps are referenced via ${step-name} or ${variable} interpolation
   */
  private buildInterpolationUsageMap(steps: Step[]): Set<string> {
    const used = new Set<string>();

    // Build map of variable names to step names
    const varToStep = new Map<string, string>();
    steps.forEach(step => {
      if (step.output?.variable) {
        varToStep.set(step.output.variable, step.name);
        console.error(`[DEBUG] Mapped variable '${step.output.variable}' → step '${step.name}'`);
      }
    });
    console.error(`[DEBUG] varToStep has ${varToStep.size} entries`);

    steps.forEach((step: Step) => {
      // Check input field
      if (step.input) {
        const inputStr = JSON.stringify(step.input);
        const matches = inputStr.matchAll(this.interpolationRegex);

        for (const match of matches) {
          const reference = match[1]; // e.g., "step-name", "step-name.output", or "variable_name"

          // Extract step name (remove .output suffix if present)
          const stepName = reference.includes('.')
            ? reference.split('.')[0]
            : reference;

          // Check if it's a direct step reference
          if (steps.some(s => s.name === stepName)) {
            console.error(`[DEBUG] Found step reference: ${stepName}`);
            used.add(stepName);
          }
          // Check if it's a variable name that maps to a step
          else if (varToStep.has(reference)) {
            const mappedStep = varToStep.get(reference)!;
            console.error(`[DEBUG] Found variable reference: ${reference} → ${mappedStep}`);
            used.add(mappedStep);
          } else {
            console.error(`[DEBUG] Unknown reference: ${reference}`);
          }
        }
      }

      // Check 'when' condition
      if (step.when) {
        const matches = step.when.matchAll(this.interpolationRegex);

        for (const match of matches) {
          const reference = match[1];
          const stepName = reference.includes('.')
            ? reference.split('.')[0]
            : reference;

          if (steps.some(s => s.name === stepName)) {
            used.add(stepName);
          } else if (varToStep.has(reference)) {
            used.add(varToStep.get(reference)!);
          }
        }
      }

      // Check condition.if field
      if (step.condition?.if) {
        const matches = step.condition.if.matchAll(this.interpolationRegex);

        for (const match of matches) {
          const reference = match[1];
          const stepName = reference.includes('.')
            ? reference.split('.')[0]
            : reference;

          if (steps.some(s => s.name === stepName)) {
            used.add(stepName);
          } else if (varToStep.has(reference)) {
            used.add(varToStep.get(reference)!);
          }
        }
      }
    });

    return used;
  }

  /**
   * Build map of which steps are loaded via loadFiles
   */
  private buildFileUsageMap(steps: Step[]): Set<string> {
    const used = new Set<string>();

    steps.forEach((step: Step) => {
      if (step.loadFiles && Array.isArray(step.loadFiles)) {
        step.loadFiles.forEach((fileRef: string) => {
          used.add(fileRef);
        });
      }
    });

    return used;
  }
}
