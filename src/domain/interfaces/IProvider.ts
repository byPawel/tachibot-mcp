/**
 * IProvider Interface - Abstraction for AI providers
 * Follows Dependency Inversion Principle (SOLID)
 * Allows swapping providers without changing dependent code
 */

export interface IProvider {
  /** Provider identifier (e.g., "perplexity", "grok", "openai") */
  readonly name: string;

  /** Check if provider is available (API key configured) */
  readonly isAvailable: boolean;

  /**
   * Query the AI provider
   * @param data Query data/parameters
   * @returns Promise resolving to provider response
   */
  query(data: unknown): Promise<unknown>;

  /**
   * Optional validation of API credentials
   * @returns true if credentials are valid
   */
  validateCredentials?(): Promise<boolean>;
}
