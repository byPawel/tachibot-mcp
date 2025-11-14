import { IToolExecutionStrategy } from "../interfaces/IToolExecutionStrategy.js";

/**
 * Registry for tool execution strategies
 * Simple pattern: register strategies, find by model name
 */
export class ToolAdapterRegistry {
  private strategies: Map<string, IToolExecutionStrategy> = new Map();
  private fallbackStrategy: IToolExecutionStrategy | null = null;

  /**
   * Register a tool execution strategy
   */
  register(strategy: IToolExecutionStrategy): void {
    this.strategies.set(strategy.name, strategy);
  }

  /**
   * Register multiple strategies at once
   */
  registerMany(strategies: IToolExecutionStrategy[]): void {
    strategies.forEach(s => this.register(s));
  }

  /**
   * Set a fallback strategy for when no specific strategy is found
   */
  setFallback(strategy: IToolExecutionStrategy): void {
    this.fallbackStrategy = strategy;
  }

  /**
   * Find the best strategy for a given model
   * Returns null if no strategy can handle the model
   */
  findStrategy(model: string): IToolExecutionStrategy | null {
    // First, try exact match by strategy name
    const exactMatch = this.strategies.get(model);
    if (exactMatch && exactMatch.canExecute(model)) {
      return exactMatch;
    }

    // Then, try all strategies to see if any can execute this model
    for (const strategy of Array.from(this.strategies.values())) {
      if (strategy.canExecute(model)) {
        return strategy;
      }
    }

    // Finally, use fallback if available
    if (this.fallbackStrategy && this.fallbackStrategy.canExecute(model)) {
      return this.fallbackStrategy;
    }

    return null;
  }

  /**
   * Get all registered strategy names
   */
  getRegisteredStrategies(): string[] {
    return Array.from(this.strategies.keys());
  }

  /**
   * Check if a strategy is registered for a model
   */
  hasStrategy(model: string): boolean {
    return this.findStrategy(model) !== null;
  }
}

// Singleton instance for global use
export const toolAdapterRegistry = new ToolAdapterRegistry();
