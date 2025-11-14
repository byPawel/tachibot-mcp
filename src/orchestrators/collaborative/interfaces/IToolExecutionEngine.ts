import { ReasoningMode } from "../../../reasoning-chain.js";

/**
 * Tool Execution Engine Interface
 * Handles execution of AI model tools with parameter building and error handling
 */
export interface IToolExecutionEngine {
  /**
   * Execute a tool for a given model and reasoning mode
   */
  executeRealTool(
    model: string,
    prompt: string,
    mode: ReasoningMode,
    context?: any
  ): Promise<string>;

  /**
   * Set verbose mode for detailed logging
   */
  setVerbose(verbose: boolean): void;
}
