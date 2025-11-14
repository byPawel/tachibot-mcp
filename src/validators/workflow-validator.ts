/**
 * Main workflow validator - orchestrates all validation checks
 */

import { SyntaxValidator } from './syntax-validator.js';
import { InterpolationValidator } from './interpolation-validator.js';
import { ToolRegistryValidator } from './tool-registry-validator.js';
import { DependencyGraphValidator } from './dependency-graph-validator.js';
import { OutputUsageValidator } from './output-usage-validator.js';
import { ValidationResult, ValidationContext, ValidationError } from './types.js';
import { getEnabledTools } from '../utils/tool-config.js';

export class WorkflowValidator {
  private syntaxValidator: SyntaxValidator;
  private interpolationValidator: InterpolationValidator;
  private toolValidator: ToolRegistryValidator;
  private dependencyValidator: DependencyGraphValidator;
  private outputUsageValidator: OutputUsageValidator;

  constructor() {
    this.syntaxValidator = new SyntaxValidator();
    this.interpolationValidator = new InterpolationValidator();
    this.toolValidator = new ToolRegistryValidator();
    this.dependencyValidator = new DependencyGraphValidator();
    this.outputUsageValidator = new OutputUsageValidator();
  }

  /**
   * Validate a workflow from YAML/JSON content
   */
  async validate(
    workflowContent: string,
    isJson: boolean = false,
    enabledToolsOverride?: Set<string>
  ): Promise<ValidationResult> {
    const allErrors: ValidationError[] = [];

    // Step 1: Syntax validation
    const syntaxResult = this.syntaxValidator.validate(workflowContent, isJson);
    allErrors.push(...syntaxResult.errors);

    // If syntax validation failed, can't proceed
    if (!syntaxResult.valid || !syntaxResult.workflow) {
      return {
        valid: false,
        errors: allErrors.filter(e => e.severity === 'error'),
        warnings: allErrors.filter(e => e.severity === 'warning')
      };
    }

    // Step 2: Build validation context
    // If override provided, it contains ALL known tools
    // Otherwise, get from config (which may be empty if config not loaded)
    const allKnownTools = enabledToolsOverride || new Set(getEnabledTools());
    const enabledTools = new Set(getEnabledTools());

    const context: ValidationContext = {
      workflow: syntaxResult.workflow,
      allKnownTools,
      enabledTools: enabledTools.size > 0 ? enabledTools : allKnownTools, // Fallback to all if none enabled
      sourceMap: new Map() // TODO: Implement source mapping for line numbers
    };

    // Step 3: Run all validators in parallel
    const [
      interpolationErrors,
      toolErrors,
      dependencyErrors,
      outputUsageErrors
    ] = await Promise.all([
      Promise.resolve(this.interpolationValidator.validate(context)),
      Promise.resolve(this.toolValidator.validate(context)),
      Promise.resolve(this.dependencyValidator.validate(context)),
      Promise.resolve(this.outputUsageValidator.validate(context))
    ]);

    allErrors.push(...interpolationErrors);
    allErrors.push(...toolErrors);
    allErrors.push(...dependencyErrors);
    allErrors.push(...outputUsageErrors);

    // Separate errors and warnings
    const errors = allErrors.filter(e => e.severity === 'error');
    const warnings = allErrors.filter(e => e.severity === 'warning');

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Validate a workflow from a file path
   */
  async validateFile(filePath: string, enabledToolsOverride?: Set<string>): Promise<ValidationResult> {
    const fs = await import('fs');
    const path = await import('path');

    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      const isJson = path.extname(filePath).toLowerCase() === '.json';
      return this.validate(content, isJson, enabledToolsOverride);
    } catch (error: any) {
      return {
        valid: false,
        errors: [{
          type: 'syntax',
          severity: 'error',
          message: `Failed to read file: ${error.message}`,
          path: '$'
        }],
        warnings: []
      };
    }
  }

  /**
   * Format validation results as human-readable text
   */
  formatResults(result: ValidationResult): string {
    const lines: string[] = [];

    if (result.valid) {
      lines.push('✅ Workflow validation passed!');
      if (result.warnings.length > 0) {
        lines.push(`\n⚠️  ${result.warnings.length} warning(s):\n`);
        result.warnings.forEach((warning, i) => {
          lines.push(this.formatError(warning, i + 1));
        });
      }
    } else {
      lines.push(`❌ Workflow validation failed with ${result.errors.length} error(s)!\n`);
      result.errors.forEach((error, i) => {
        lines.push(this.formatError(error, i + 1));
      });

      if (result.warnings.length > 0) {
        lines.push(`\n⚠️  ${result.warnings.length} warning(s):\n`);
        result.warnings.forEach((warning, i) => {
          lines.push(this.formatError(warning, i + 1));
        });
      }
    }

    return lines.join('\n');
  }

  /**
   * Format a single error/warning
   */
  private formatError(error: ValidationError, index: number): string {
    const icon = error.severity === 'error' ? '❌' : '⚠️';
    const location = error.line ? ` (line ${error.line}${error.column ? `:${error.column}` : ''})` : '';
    const suggestion = error.suggestion ? `\n   💡 ${error.suggestion}` : '';

    return `${icon} ${index}. [${error.type.toUpperCase()}]${location}\n   ${error.message}\n   Path: ${error.path}${suggestion}\n`;
  }

  /**
   * Format validation results as JSON
   */
  formatResultsJSON(result: ValidationResult): string {
    return JSON.stringify(result, null, 2);
  }
}

// Export singleton instance
export const workflowValidator = new WorkflowValidator();
