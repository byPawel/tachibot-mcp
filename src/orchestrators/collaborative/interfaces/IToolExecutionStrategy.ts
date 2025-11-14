/**
 * Tool Execution Strategy Interface
 * Simple abstraction for executing different AI model tools
 */

export interface ToolExecutionContext {
  model: string;
  prompt: string;
  mode: string;
  context?: any;
}

export interface ToolExecutionResult {
  content: string;
  metadata?: {
    model: string;
    provider: string;
    duration?: number;
    tokens?: number;
  };
}

/**
 * Strategy for executing a specific tool/model
 */
export interface IToolExecutionStrategy {
  /**
   * The name of this strategy (e.g., "grok", "gemini", "qwen")
   */
  readonly name: string;

  /**
   * Check if this strategy can execute the given model
   */
  canExecute(model: string): boolean;

  /**
   * Execute the tool with the given context
   */
  execute(context: ToolExecutionContext): Promise<ToolExecutionResult>;
}
