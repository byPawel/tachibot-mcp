/**
 * ITool Interface - Base abstraction for all MCP tools
 * Follows Interface Segregation Principle (SOLID)
 */

export interface ITool {
  /** Unique tool identifier */
  readonly name: string;

  /** Tool description for documentation */
  readonly description?: string;

  /**
   * Execute the tool with given parameters
   * @param params Tool-specific parameters
   * @returns Promise resolving to tool output
   */
  execute(params: Record<string, unknown>): Promise<unknown>;

  /**
   * Optional validation of input parameters
   * @param params Parameters to validate
   * @returns true if valid, false otherwise
   */
  validate?(params: Record<string, unknown>): boolean;
}
