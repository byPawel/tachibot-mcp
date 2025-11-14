/**
 * Syntax validator - validates YAML/JSON structure
 */

import { load as yamlLoad } from 'js-yaml';
import { ValidationError, Workflow } from './types.js';

export class SyntaxValidator {
  validate(workflowContent: string, isJson: boolean = false): {
    valid: boolean;
    errors: ValidationError[];
    workflow?: Workflow;
  } {
    const errors: ValidationError[] = [];
    let workflow: Workflow | undefined;

    try {
      // Parse YAML or JSON
      workflow = isJson
        ? JSON.parse(workflowContent)
        : yamlLoad(workflowContent) as Workflow;

      // Ensure workflow is not undefined
      if (!workflow) {
        errors.push({
          type: 'syntax',
          severity: 'error',
          message: 'Failed to parse workflow content',
          path: '$'
        });
        return { valid: false, errors };
      }

      // Validate required fields
      if (!workflow.name) {
        errors.push({
          type: 'syntax',
          severity: 'error',
          message: 'Missing required field: name',
          path: '$.name'
        });
      }

      if (!workflow.steps || !Array.isArray(workflow.steps)) {
        errors.push({
          type: 'syntax',
          severity: 'error',
          message: 'Missing or invalid required field: steps (must be an array)',
          path: '$.steps'
        });
      }

      // Validate each step has required fields
      if (workflow.steps && Array.isArray(workflow.steps)) {
        workflow.steps.forEach((step, index) => {
          if (!step.name) {
            errors.push({
              type: 'syntax',
              severity: 'error',
              message: 'Step is missing required field: name',
              path: `$.steps[${index}].name`
            });
          }

          if (!step.tool) {
            errors.push({
              type: 'syntax',
              severity: 'error',
              message: 'Step is missing required field: tool',
              path: `$.steps[${index}].tool`
            });
          }

          // Check for valid step name format (snake_case or kebab-case)
          if (step.name && !/^[a-z][a-z0-9_-]*$/.test(step.name)) {
            errors.push({
              type: 'syntax',
              severity: 'warning',
              message: `Step name '${step.name}' should use snake_case or kebab-case`,
              path: `$.steps[${index}].name`,
              suggestion: 'Use lowercase with underscores or hyphens, e.g., "my_step" or "my-step"'
            });
          }
        });
      }

      // Validate variable names if present
      if (workflow.variables) {
        for (const varName of Object.keys(workflow.variables)) {
          if (!/^[a-z][a-z0-9_]*$/.test(varName)) {
            errors.push({
              type: 'syntax',
              severity: 'warning',
              message: `Variable name '${varName}' should use snake_case`,
              path: `$.variables.${varName}`,
              suggestion: 'Use lowercase with underscores, e.g., "my_variable"'
            });
          }
        }
      }

    } catch (e: any) {
      errors.push({
        type: 'syntax',
        severity: 'error',
        message: `Invalid ${isJson ? 'JSON' : 'YAML'} syntax: ${e.message}`,
        path: '$',
        suggestion: 'Check for proper indentation, missing colons, or invalid characters'
      });
    }

    return {
      valid: errors.filter(e => e.severity === 'error').length === 0,
      errors,
      workflow
    };
  }
}
