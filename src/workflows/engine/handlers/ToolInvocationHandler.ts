/**
 * Tool Invocation Handler
 * Handles actual tool execution via tool-mapper
 * Subscribes to workflow.tool.invoke events
 */

import { WorkflowEventBus, WorkflowEvents } from '../events/WorkflowEventBus.js';

export interface ToolInvokeEvent {
  stepName: string;
  tool: string;
  input: string | Record<string, unknown>;
  options: {
    model?: string;
    maxTokens?: number;
    temperature?: number;
    skipValidation?: boolean;
  };
}

export interface ToolInvokeResult {
  stepName: string;
  success: boolean;
  result?: string;
  modelUsed?: string;
  error?: Error;
  tokensUsed?: number;
  cost?: number;
  duration: number;
}

export class ToolInvocationHandler {
  private eventBus: WorkflowEventBus;

  constructor(eventBus: WorkflowEventBus) {
    this.eventBus = eventBus;

    // Subscribe to tool invoke events
    this.eventBus.subscribe(
      WorkflowEvents.TOOL_INVOKED,
      this.handleToolInvoke.bind(this)
    );
  }

  private async handleToolInvoke(event: ToolInvokeEvent): Promise<void> {
    const { stepName, tool, input, options } = event;
    const startTime = Date.now();

    try {
      // Dynamic import to avoid circular dependencies
      const { executeWorkflowTool } = await import('../../tool-mapper.js');

      console.error(`[ToolInvocation] Executing ${tool} for step ${stepName}`);

      // Execute the tool
      const toolResult = await executeWorkflowTool(tool, input, options);

      const duration = Date.now() - startTime;

      // Publish success event
      await this.eventBus.publish(WorkflowEvents.TOOL_SUCCESS, {
        stepName,
        success: true,
        result: toolResult.result,
        modelUsed: toolResult.modelUsed,
        duration,
        tokensUsed: 0, // TODO: Extract from toolResult if available
        cost: 0 // TODO: Calculate based on model and tokens
      } as ToolInvokeResult);

    } catch (error) {
      const duration = Date.now() - startTime;

      console.error(`[ToolInvocation] Error executing ${tool} for step ${stepName}:`, error);

      // Publish failure event
      await this.eventBus.publish(WorkflowEvents.TOOL_FAILURE, {
        stepName,
        success: false,
        error: error as Error,
        duration
      } as ToolInvokeResult);
    }
  }
}
