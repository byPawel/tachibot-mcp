/**
 * Interpolation validator - validates ${...} references in workflow
 */

import { ValidationError, ValidationContext } from './types.js';

export class InterpolationValidator {
  // Matches ${anything} patterns
  private readonly interpolationRegex = /\$\{([^}]+)\}/g;

  validate(context: ValidationContext): ValidationError[] {
    const errors: ValidationError[] = [];

    // Build step index for quick lookup
    const stepNames = new Set(context.workflow.steps.map(s => s.name));
    const stepOrder = new Map(context.workflow.steps.map((s, i) => [s.name, i]));

    // Build list of step output variables
    const stepOutputVars = new Set<string>();
    context.workflow.steps.forEach(step => {
      if (step.output?.variable) {
        stepOutputVars.add(step.output.variable);
      }
    });

    // Add runtime variables that are always available
    const runtimeVars = ['input', 'timestamp', 'query'];

    // Validate each step's interpolations
    context.workflow.steps.forEach((step, index) => {
      this.validateStepInterpolations(
        step,
        index,
        stepNames,
        stepOrder,
        context,
        errors,
        stepOutputVars,
        runtimeVars
      );
    });

    // Validate output interpolations if present
    if (context.workflow.output?.saveToFile && typeof context.workflow.output.saveToFile === 'string') {
      const allVars = [
        ...Array.from(stepOutputVars),
        ...runtimeVars,
        ...(context.workflow.variables ? Object.keys(context.workflow.variables) : [])
      ];
      this.validateStringInterpolations(
        context.workflow.output.saveToFile,
        stepNames,
        allVars,
        '$.output.saveToFile',
        errors,
        stepOrder.size // All steps are valid for output
      );
    }

    return errors;
  }

  private validateStepInterpolations(
    step: any,
    stepIndex: number,
    stepNames: Set<string>,
    stepOrder: Map<string, number>,
    context: ValidationContext,
    errors: ValidationError[],
    stepOutputVars: Set<string>,
    runtimeVars: string[]
  ) {
    // Collect all available variables at this point
    const availableVars = [
      ...Array.from(stepOutputVars),
      ...runtimeVars,
      ...(context.workflow.variables ? Object.keys(context.workflow.variables) : [])
    ];

    // Validate input field interpolations
    if (step.input) {
      const inputStr = JSON.stringify(step.input);
      this.validateStringInterpolations(
        inputStr,
        stepNames,
        availableVars,
        `$.steps[${stepIndex}].input`,
        errors,
        stepIndex,
        stepOrder
      );
    }

    // Validate 'when' condition interpolations
    if (step.when) {
      this.validateStringInterpolations(
        step.when,
        stepNames,
        availableVars,
        `$.steps[${stepIndex}].when`,
        errors,
        stepIndex,
        stepOrder
      );
    }

    // Validate loadFiles references
    if (step.loadFiles && Array.isArray(step.loadFiles)) {
      step.loadFiles.forEach((fileRef: string, idx: number) => {
        if (!stepNames.has(fileRef)) {
          errors.push({
            type: 'interpolation',
            severity: 'error',
            message: `loadFiles references unknown step '${fileRef}'`,
            path: `$.steps[${stepIndex}].loadFiles[${idx}]`,
            suggestion: `Ensure step '${fileRef}' is defined and has saveToFile: true`
          });
        } else if (stepOrder.get(fileRef)! >= stepIndex) {
          errors.push({
            type: 'interpolation',
            severity: 'error',
            message: `loadFiles references step '${fileRef}' that comes after current step`,
            path: `$.steps[${stepIndex}].loadFiles[${idx}]`,
            suggestion: 'Can only load files from previous steps'
          });
        } else {
          // Check for redundancy: is this loadFiles unnecessary?
          const referencedStep = context.workflow.steps.find(s => s.name === fileRef);
          if (referencedStep?.output?.variable) {
            const varName = referencedStep.output.variable;
            const inputStr = step.input ? JSON.stringify(step.input) : '';
            if (inputStr.includes(`\${${varName}}`)) {
              errors.push({
                type: 'redundancy',
                severity: 'warning',
                message: `loadFiles includes '${fileRef}' but its output variable '\${${varName}}' is already used in input`,
                path: `$.steps[${stepIndex}].loadFiles[${idx}]`,
                suggestion: `Remove '${fileRef}' from loadFiles - data is already in memory from previous step`
              });
            }
          }
        }
      });
    }

    // Validate dependsOn references
    if (step.dependsOn && Array.isArray(step.dependsOn)) {
      step.dependsOn.forEach((depName: string, idx: number) => {
        if (!stepNames.has(depName)) {
          errors.push({
            type: 'interpolation',
            severity: 'error',
            message: `dependsOn references unknown step '${depName}'`,
            path: `$.steps[${stepIndex}].dependsOn[${idx}]`,
            suggestion: `Ensure step '${depName}' is defined`
          });
        } else if (stepOrder.get(depName)! >= stepIndex) {
          errors.push({
            type: 'interpolation',
            severity: 'error',
            message: `dependsOn references step '${depName}' that comes after current step`,
            path: `$.steps[${stepIndex}].dependsOn[${idx}]`,
            suggestion: 'Dependencies must come before dependent steps'
          });
        }
      });
    }
  }

  private validateStringInterpolations(
    content: string,
    stepNames: Set<string>,
    variables: string[],
    path: string,
    errors: ValidationError[],
    currentStepIndex?: number,
    stepOrder?: Map<string, number>
  ) {
    // Safety check: return early if content is null/undefined
    if (!content || typeof content !== 'string') {
      return;
    }

    const matches = content.matchAll(this.interpolationRegex);

    for (const match of matches) {
      const fullMatch = match[0]; // e.g., "${step1.output}"
      const reference = match[1];  // e.g., "step1.output"

      this.validateSingleReference(
        reference,
        fullMatch,
        stepNames,
        variables,
        path,
        errors,
        currentStepIndex,
        stepOrder
      );
    }
  }

  private validateSingleReference(
    reference: string,
    fullMatch: string,
    stepNames: Set<string>,
    variables: string[],
    path: string,
    errors: ValidationError[],
    currentStepIndex?: number,
    stepOrder?: Map<string, number>
  ) {
    // Check for step output reference: step_name.output or step_name.something
    if (reference.includes('.')) {
      const parts = reference.split('.');
      const stepName = parts[0];
      const property = parts.slice(1).join('.');

      // Validate step exists
      if (!stepNames.has(stepName)) {
        errors.push({
          type: 'interpolation',
          severity: 'error',
          message: `Reference '${fullMatch}' points to undefined step '${stepName}'`,
          path,
          suggestion: `Define step '${stepName}' or correct the reference`
        });
        return;
      }

      // Validate step order (if applicable)
      if (currentStepIndex !== undefined && stepOrder) {
        const refStepIndex = stepOrder.get(stepName);
        if (refStepIndex !== undefined && refStepIndex >= currentStepIndex) {
          errors.push({
            type: 'interpolation',
            severity: 'error',
            message: `Reference '${fullMatch}' points to step '${stepName}' which appears later in the workflow`,
            path,
            suggestion: `Move step '${stepName}' before the current step, or remove the reference`
          });
        }
      }

      // Validate property name - accept 'output' as valid
      if (!property || property.trim() === '') {
        errors.push({
          type: 'interpolation',
          severity: 'warning',
          message: `Reference '${fullMatch}' is missing property after '${stepName}.'`,
          path,
          suggestion: 'Common properties: output, result, data'
        });
      } else if (property !== 'output') {
        // Warn if using non-standard property (not 'output')
        errors.push({
          type: 'interpolation',
          severity: 'warning',
          message: `Reference '${fullMatch}' uses property '${property}' - only '.output' is guaranteed to exist`,
          path,
          suggestion: `Use '\${${stepName}.output}' for step outputs, or '\${${stepName}}' for direct reference`
        });
      }
      // else property === 'output' → Valid, no error
    }
    // Variable reference (no dot)
    else {
      // Check if this is a direct step reference (valid - runtime supports this)
      if (stepNames.has(reference)) {
        // ✅ VALID: Direct step reference like ${step-name}
        // Runtime will use the step's output

        // Validate step order (if applicable)
        if (currentStepIndex !== undefined && stepOrder) {
          const refStepIndex = stepOrder.get(reference);
          if (refStepIndex !== undefined && refStepIndex >= currentStepIndex) {
            errors.push({
              type: 'interpolation',
              severity: 'error',
              message: `Reference '${fullMatch}' points to step '${reference}' which appears later in the workflow`,
              path,
              suggestion: `Move step '${reference}' before the current step`
            });
          }
        }

        return; // Valid step reference, no error
      }

      // Check variable name format
      if (!/^[a-z][a-z0-9_]*$/.test(reference)) {
        errors.push({
          type: 'interpolation',
          severity: 'warning',
          message: `Variable reference '${fullMatch}' should use snake_case`,
          path,
          suggestion: 'Use lowercase with underscores, e.g., "${my_variable}"'
        });
      }

      // Check if variable is defined
      if (!variables.includes(reference)) {
        errors.push({
          type: 'interpolation',
          severity: 'error',
          message: `Reference '${fullMatch}' points to undefined variable '${reference}'`,
          path,
          suggestion: 'Define the variable in the workflow variables section'
        });
      }
    }
  }
}
