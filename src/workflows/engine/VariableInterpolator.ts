/**
 * Variable Interpolation Utility
 * Handles ${variable} and ${step.output} syntax in workflow templates
 */

import {
  IVariableInterpolator,
  InterpolationContext,
  FileReference
} from './interfaces/IVariableInterpolator.js';

export class VariableInterpolator implements IVariableInterpolator {
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
   * Interpolates variables and step outputs in template strings
   */
  async interpolate(
    template: string,
    context: InterpolationContext
  ): Promise<string> {
    const mergedContext: Record<string, any> = {
      ...context.variables,
      ...Object.fromEntries(context.fileReferences)
    };

    // Collect all variable references
    const matches = [...template.matchAll(/\${([^}]+)}/g)];

    // Resolve each variable (possibly async)
    const replacements = await Promise.all(
      matches.map(async (match) => {
        const fullMatch = match[0];
        const key = match[1];
        let value: any;

        // Check for property access (e.g., step.content, step.summary)
        const parts = key.split('.');
        const baseKey = parts[0];
        const property = parts[1];

        // Get base value
        value = mergedContext[baseKey];

        // Support ${step-name.output} syntax
        if (value === undefined && baseKey.endsWith('.output')) {
          const stepName = baseKey.slice(0, -7);
          if (mergedContext[stepName] !== undefined) {
            value = mergedContext[stepName];
            console.error(`🔄 Resolved ${baseKey} → ${stepName}`);
          }
        }

        // Handle undefined
        if (value === undefined) {
          const available = Object.keys(mergedContext).join(', ');
          throw new Error(
            `Variable '${key}' not found!\n` +
            `Available: [${available}]\n` +
            `Check previous step's output.variable setting.`
          );
        }

        // Handle FileReference objects
        if (this.isFileReference(value)) {
          if (!property || property === 'summary') {
            // Default: return summary
            console.error(`✓ Interpolated '${key}': using summary (${value.summary.length} chars)`);
            return { match: fullMatch, replacement: value.summary };
          } else if (property === 'content') {
            // Explicit: load full content
            const content = await value.getContent();
            console.error(`✓ Interpolated '${key}': loaded content (${content.length} chars)`);
            return { match: fullMatch, replacement: content };
          } else if (property === 'filePath') {
            // Return file path
            const path = value.filePath || 'in-memory';
            console.error(`✓ Interpolated '${key}': filePath = ${path}`);
            return { match: fullMatch, replacement: path };
          } else if (property === 'savedTo') {
            // Return filename
            const filename = value.filePath ? value.filePath.split('/').pop() || 'in-memory' : 'in-memory';
            console.error(`✓ Interpolated '${key}': savedTo = ${filename}`);
            return { match: fullMatch, replacement: filename };
          } else if (property === 'output') {
            // Handle ${step.output} by returning summary
            console.error(`✓ Interpolated '${key}': using summary (${value.summary.length} chars)`);
            return { match: fullMatch, replacement: value.summary };
          } else {
            throw new Error(`Unknown FileReference property: ${property}`);
          }
        }

        // Handle primitive values
        console.error(`✓ Interpolated '${key}': type=${typeof value}, length=${String(value).length}`);
        return { match: fullMatch, replacement: String(value) };
      })
    );

    // Apply all replacements
    let result = template;
    for (const { match, replacement } of replacements) {
      result = result.replace(match, replacement);
    }

    return result;
  }

  /**
   * Interpolates variables in an object (recursive)
   */
  async interpolateObject(
    obj: Record<string, any>,
    context: InterpolationContext
  ): Promise<Record<string, any>> {
    const result: Record<string, any> = {};

    for (const [key, value] of Object.entries(obj)) {
      if (typeof value === 'string') {
        result[key] = await this.interpolate(value, context);
      } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        result[key] = await this.interpolateObject(value, context);
      } else if (Array.isArray(value)) {
        result[key] = await Promise.all(
          value.map(item =>
            typeof item === 'string'
              ? this.interpolate(item, context)
              : typeof item === 'object' && item !== null
              ? this.interpolateObject(item, context)
              : item
          )
        );
      } else {
        result[key] = value;
      }
    }

    return result;
  }
}
