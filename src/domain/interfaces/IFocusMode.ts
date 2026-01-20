/**
 * IFocusMode Interface - Strategy pattern for Focus tool modes
 * Follows Open/Closed Principle (SOLID) - extend via new implementations
 */

export interface FocusResult {
  /** Output text/data from the mode execution */
  output: string;

  /** Optional metadata about the execution */
  metadata?: Record<string, unknown>;
}

export interface IFocusMode {
  /** Unique mode identifier (e.g., "analyze", "brainstorm", "debug") */
  readonly modeName: string;

  /** Optional mode description */
  readonly description?: string;

  /**
   * Whether this mode supports step-by-step execution via FocusExecutionService
   * When true, the mode can be executed with executeNow: true for actual model calls
   */
  readonly supportsExecution?: boolean;

  /**
   * Execute the focus mode with given parameters
   * @param params Mode-specific parameters (includes executeNow for execution control)
   * @returns Promise resolving to FocusResult
   */
  execute(params: Record<string, unknown>): Promise<FocusResult>;
}
