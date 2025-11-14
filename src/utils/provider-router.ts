/**
 * ProviderRouter - Smart routing and failover between multiple providers
 *
 * Features:
 * - Automatic failover on errors
 * - Priority-based provider selection
 * - Integration with SmartAPIClient for retries
 * - NO metrics collection - privacy-first design
 */

import { SmartAPIClient, SmartAPIConfig, smartAPIClient } from './smart-api-client.js';

export interface ProviderConfig<T = any> {
  name: string;                              // Provider identifier
  callable: (...args: any[]) => Promise<T>;  // The actual API call function
  enabled: boolean;                          // Is this provider configured?
  priority?: number;                         // Optional explicit priority (lower = higher priority)
}

export interface RouteRequest {
  query: string;
  options?: any;
}

export interface RouteResult<T> {
  result: T;
  provider: string;
  attempts: number;
  totalTime: number;
  failedProviders: string[];
}

export class ProviderRouter {
  private static instance: ProviderRouter;
  private smartClient: SmartAPIClient;

  private constructor() {
    this.smartClient = smartAPIClient;
  }

  public static getInstance(): ProviderRouter {
    if (!ProviderRouter.instance) {
      ProviderRouter.instance = new ProviderRouter();
    }
    return ProviderRouter.instance;
  }

  /**
   * Route request through providers with automatic failover
   */
  async route<T>(
    providers: ProviderConfig<T>[],
    request: RouteRequest,
    apiConfig: Partial<SmartAPIConfig>
  ): Promise<RouteResult<T>> {
    const startTime = Date.now();
    const failedProviders: string[] = [];
    let attempts = 0;

    // Filter and sort providers
    const availableProviders = this.selectAvailableProviders(providers);

    if (availableProviders.length === 0) {
      throw new Error('[ProviderRouter] No providers available or enabled');
    }

    console.log(
      `[ProviderRouter] Available providers: ${availableProviders.map(p => p.name).join(', ')}`
    );

    // Try each provider in order
    for (const provider of availableProviders) {
      attempts++;

      try {
        console.log(
          `[ProviderRouter] Attempting ${provider.name} (attempt ${attempts}/${availableProviders.length})`
        );

        const result = await this.smartClient.callWithRetries<T>(
          provider.callable,
          {
            provider: provider.name,
            ...apiConfig
          } as SmartAPIConfig
        );

        const totalTime = Date.now() - startTime;

        console.log(
          `[ProviderRouter] Success with ${provider.name} ` +
          `(total time: ${totalTime}ms, attempts: ${attempts})`
        );

        return {
          result,
          provider: provider.name,
          attempts,
          totalTime,
          failedProviders
        };

      } catch (error: any) {
        console.error(
          `[ProviderRouter] Provider ${provider.name} failed: ${error.message}`
        );

        failedProviders.push(provider.name);

        // If this was the last provider, throw
        if (attempts >= availableProviders.length) {
          const totalTime = Date.now() - startTime;
          throw new Error(
            `[ProviderRouter] All providers exhausted (${availableProviders.map(p => p.name).join(', ')}) ` +
            `after ${attempts} attempts in ${totalTime}ms. Last error: ${error.message}`
          );
        }

        // Otherwise continue to next provider
        console.log(
          `[ProviderRouter] Failing over to next provider...`
        );
      }
    }

    // Should never reach here, but TypeScript needs it
    throw new Error('[ProviderRouter] Unexpected routing failure');
  }

  /**
   * Select and order available providers based on priority
   */
  private selectAvailableProviders<T>(
    providers: ProviderConfig<T>[]
  ): ProviderConfig<T>[] {
    // Filter enabled providers
    const enabled = providers.filter(p => p.enabled);

    if (enabled.length === 0) {
      return [];
    }

    // Sort by priority (lower first)
    return enabled.sort((a, b) => {
      const priorityA = a.priority ?? 999;
      const priorityB = b.priority ?? 999;
      return priorityA - priorityB;
    });
  }
}

// Export singleton instance
export const providerRouter = ProviderRouter.getInstance();
