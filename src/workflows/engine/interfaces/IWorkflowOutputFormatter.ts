/**
 * Interface for formatting workflow execution results
 * Supports multiple output formats (summary, detailed, JSON)
 */

export interface ExecutionRecord {
  workflowName: string;
  workflowId?: string;
  outputDir?: string;
  startTime: Date;
  endTime?: Date;
  status: "running" | "completed" | "failed";
  cost: number;
  outputs: Array<{
    step: string;
    input?: string;
    output: string;
    filePath?: string;
  }>;
}

export interface IWorkflowOutputFormatter {
  /**
   * Formats workflow execution results
   * @param execution - Execution record with step outputs
   * @param format - Output format (summary, detailed, json)
   * @param truncateSteps - Whether to truncate step outputs
   * @param maxStepTokens - Maximum tokens per step output
   * @returns Formatted output string or JSON object
   */
  format(
    execution: ExecutionRecord,
    format: 'summary' | 'detailed' | 'json',
    truncateSteps: boolean,
    maxStepTokens: number
  ): string | Record<string, unknown>;
}
