/**
 * Interface for variable interpolation in workflow templates
 * Handles ${variable} and ${step.output} syntax in strings
 */

export interface FileReference {
  id: string;              // Unique identifier (workflowId-stepName-timestamp)
  stepName: string;        // Step name for traceability
  summary: string;         // 200-char preview (always available)
  filePath: string | null; // Full path (null for in-memory)
  sizeBytes: number;       // Original content size
  getContent: () => Promise<string>; // Lazy loader for full content
  _inMemoryContent?: string; // Hidden: for in-memory refs only
}

export interface InterpolationContext {
  variables: Record<string, any>;
  stepOutputs: Map<string, any>;
  fileReferences: Map<string, FileReference>;
}

export interface IVariableInterpolator {
  /**
   * Interpolates variables and step outputs in template strings
   * @param template - Template string with ${variable} or ${step.output} syntax
   * @param context - Context containing variables, step outputs, and file references
   * @returns Interpolated string with all variables replaced
   */
  interpolate(
    template: string,
    context: InterpolationContext
  ): Promise<string>;

  /**
   * Interpolates variables in an object (recursive)
   * @param obj - Object with potential template strings in values
   * @param context - Context containing variables and step outputs
   * @returns New object with all template strings interpolated
   */
  interpolateObject(
    obj: Record<string, any>,
    context: InterpolationContext
  ): Promise<Record<string, any>>;
}
