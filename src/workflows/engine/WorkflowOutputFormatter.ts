/**
 * Workflow Output Formatter
 * Formats workflow execution results in multiple formats (summary, detailed, JSON)
 */

import {
  IWorkflowOutputFormatter,
  ExecutionRecord
} from './interfaces/IWorkflowOutputFormatter.js';

export class WorkflowOutputFormatter implements IWorkflowOutputFormatter {
  /**
   * Formats workflow execution results
   */
  format(
    execution: ExecutionRecord,
    format: 'summary' | 'detailed' | 'json',
    truncateSteps: boolean,
    maxStepTokens: number
  ): string | Record<string, unknown> {
    // Check if auto-synthesis ran - if so, return ONLY the synthesis
    const synthesisStep = execution.outputs.find(step => step.step === 'auto-synthesis');
    if (synthesisStep) {
      // Auto-synthesis ran - return only the synthesis output to prevent MCP 25k limit
      // DEFENSIVE: Ensure output is a string
      return this.ensureString(synthesisStep.output);
    }

    switch (format) {
      case "json":
        return {
          workflowName: execution.workflowName,
          workflowId: execution.workflowId,
          outputDir: execution.outputDir,
          status: execution.status,
          steps: execution.outputs.map(out => ({
            step: out.step,
            summary: this.ensureString(out.output),
            filePath: out.filePath
          }))
        };

      case "detailed":
        return this.formatDetailed(execution);

      case "summary":
      default:
        return this.formatSummary(execution);
    }
  }

  /**
   * Ensures a value is converted to a string (handles FileReference and objects)
   */
  private ensureString(value: unknown): string {
    if (value === null || value === undefined) {
      return '[No output]';
    }
    if (typeof value === 'string') {
      return value;
    }
    if (typeof value === 'object') {
      // Handle FileReference objects - extract summary or content
      if ('summary' in (value as any) && typeof (value as any).summary === 'string') {
        return (value as any).summary;
      }
      if ('content' in (value as any) && typeof (value as any).content === 'string') {
        return (value as any).content;
      }
      return JSON.stringify(value, null, 2);
    }
    return String(value);
  }

  /**
   * Formats detailed output with all step information
   */
  private formatDetailed(execution: ExecutionRecord): string {
    const duration = execution.endTime && execution.startTime
      ? (execution.endTime.getTime() - execution.startTime.getTime()) / 1000
      : 0;

    let output = `# Workflow: ${execution.workflowName}\n\n`;
    output += `**Duration:** ${duration.toFixed(1)}s\n`;
    output += `**Steps Completed:** ${execution.outputs.length}\n`;

    if (execution.outputDir) {
      output += `**Output Directory:** ${execution.outputDir}\n`;
    }

    output += `\n---\n\n`;

    // Show summaries for each step
    for (let i = 0; i < execution.outputs.length; i++) {
      const step = execution.outputs[i];
      output += `## Step ${i + 1}: ${step.step}\n\n`;

      if (step.input && step.input !== '[cached]') {
        output += `**Input:**\n${step.input}...\n\n`;
      }

      output += `${this.ensureString(step.output)}\n\n`;

      if (step.filePath) {
        output += `📄 *Full output saved to: ${step.filePath}*\n\n`;
      }

      output += `---\n\n`;
    }

    output += `\n**Workflow Complete** ✓\n\n`;
    output += `**Next Steps:**\nUse Read tool to analyze full outputs from saved files.\n`;
    return output;
  }

  /**
   * Formats summary output with last step and file paths
   */
  private formatSummary(execution: ExecutionRecord): string {
    const lastOutput = execution.outputs[execution.outputs.length - 1];
    const savedFiles = execution.outputs
      .filter(out => out.filePath)
      .map(out => `  - ${out.step}: ${out.filePath}`)
      .join('\n');

    let result = lastOutput ? this.ensureString(lastOutput.output) : "Workflow completed";

    if (savedFiles) {
      result += `\n\n**Files saved:**\n${savedFiles}\n\n`;
      result += `Use Read tool to access full content for detailed analysis.`;
    }

    return result;
  }
}
