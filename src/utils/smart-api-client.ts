/**
 * SmartAPIClient - Adaptive timeout and retry system for external API calls
 *
 * Features:
 * - Fixed timeouts with priority-based adjustment (interactive vs batch)
 * - Exponential backoff with full jitter
 * - Proper resource cleanup with AbortController
 * - NO metrics collection - privacy-first design
 */

export interface SmartAPIConfig {
  provider: string;                    // 'perplexity' | 'grok' | 'openai' | etc.
  priority: 'interactive' | 'batch';   // Affects timeout calculation
  maxRetries?: number;                 // Default: 3
  baseTimeoutMs?: number;              // Default: 30000 (30s)
  maxTimeoutMs?: number;               // Default: 120000 (2min)
  backoffBase?: number;                // Default: 2 (exponential)
  enableJitter?: boolean;              // Default: true
}

export class SmartAPIClient {
  private static instance: SmartAPIClient;

  // Default configuration
  private readonly defaults = {
    maxRetries: 3,
    baseTimeoutMs: 30000,      // 30 seconds
    maxTimeoutMs: 120000,      // 2 minutes
    backoffBase: 2,
    enableJitter: true
  };

  // Priority-specific timeout multipliers
  private readonly priorityMultipliers = {
    interactive: {
      base: 0.5,    // 50% of base timeout
      max: 0.5      // 50% of max timeout
    },
    batch: {
      base: 1.0,    // 100% of base timeout
      max: 1.0      // 100% of max timeout
    }
  };

  private constructor() {
    // Singleton pattern
  }

  public static getInstance(): SmartAPIClient {
    if (!SmartAPIClient.instance) {
      SmartAPIClient.instance = new SmartAPIClient();
    }
    return SmartAPIClient.instance;
  }

  /**
   * Call API with timeout and retry logic
   */
  async callWithRetries<T>(
    apiCall: () => Promise<T>,
    config: SmartAPIConfig
  ): Promise<T> {
    const fullConfig = { ...this.defaults, ...config };
    const startTime = Date.now();

    let lastError: Error | undefined;
    let attempt = 0;

    while (attempt < fullConfig.maxRetries) {
      const controller = new AbortController();
      const timeoutMs = this.calculateTimeout(
        fullConfig.priority,
        fullConfig.baseTimeoutMs,
        fullConfig.maxTimeoutMs
      );

      const timeoutId = setTimeout(() => {
        controller.abort();
      }, timeoutMs);

      try {
        const attemptStart = Date.now();

        // Execute API call
        const result = await Promise.race([
          apiCall(),
          this.createTimeoutPromise<T>(timeoutMs, fullConfig.provider)
        ]);

        clearTimeout(timeoutId);

        const latency = Date.now() - attemptStart;

        console.log(
          `[SmartAPIClient] Success: ${fullConfig.provider} ` +
          `(attempt ${attempt + 1}, ${latency}ms, timeout=${timeoutMs}ms)`
        );

        return result;

      } catch (error: any) {
        clearTimeout(timeoutId);
        lastError = error;

        console.error(
          `[SmartAPIClient] Attempt ${attempt + 1} failed for ${fullConfig.provider}: ${error.message}`
        );

        // Check if we should retry
        if (!this.shouldRetry(error, attempt, fullConfig.maxRetries)) {
          break;
        }

        // Wait before retry with exponential backoff + jitter
        await this.backoffWithJitter(
          attempt,
          fullConfig.backoffBase,
          fullConfig.enableJitter
        );

        attempt++;

      } finally {
        // Ensure cleanup
        if (!controller.signal.aborted) {
          controller.abort();
        }
      }
    }

    const totalTime = Date.now() - startTime;

    throw new Error(
      `[SmartAPIClient] All retries exhausted for ${fullConfig.provider} ` +
      `(${attempt} attempts in ${totalTime}ms): ${lastError?.message || 'Unknown error'}`
    );
  }

  /**
   * Calculate timeout based on priority
   */
  private calculateTimeout(
    priority: 'interactive' | 'batch',
    baseTimeout: number,
    maxTimeout: number
  ): number {
    const finalTimeout = Math.min(
      baseTimeout * this.priorityMultipliers[priority].base,
      maxTimeout * this.priorityMultipliers[priority].max
    );

    return finalTimeout;
  }

  /**
   * Exponential backoff with full jitter
   */
  private async backoffWithJitter(
    attempt: number,
    base: number,
    enableJitter: boolean
  ): Promise<void> {
    const exponentialDelay = Math.pow(base, attempt) * 1000;
    const cappedDelay = Math.min(exponentialDelay, 10000); // Cap at 10 seconds

    const finalDelay = enableJitter
      ? Math.random() * cappedDelay  // Full jitter: random(0, cappedDelay)
      : cappedDelay;

    console.log(
      `[SmartAPIClient] Backing off for ${Math.round(finalDelay)}ms ` +
      `(attempt ${attempt + 1}, ${enableJitter ? 'with' : 'without'} jitter)`
    );

    await new Promise(resolve => setTimeout(resolve, finalDelay));
  }

  /**
   * Determine if we should retry based on error type and attempt count
   */
  private shouldRetry(error: any, attempt: number, maxRetries: number): boolean {
    if (attempt >= maxRetries - 1) {
      return false;
    }

    // Retry on timeout, network errors, 5xx errors
    const retryablePatterns = [
      'timeout',
      'ETIMEDOUT',
      'ECONNRESET',
      'ENOTFOUND',
      'ECONNREFUSED',
      '500',
      '502',
      '503',
      '504'
    ];

    const errorMessage = error?.message?.toLowerCase() || '';
    const isRetryable = retryablePatterns.some(pattern =>
      errorMessage.includes(pattern.toLowerCase())
    );

    console.log(
      `[SmartAPIClient] Error "${errorMessage.slice(0, 50)}..." is ` +
      `${isRetryable ? 'retryable' : 'not retryable'}`
    );

    return isRetryable;
  }

  /**
   * Create a timeout promise for Promise.race
   */
  private createTimeoutPromise<T>(timeoutMs: number, provider: string): Promise<T> {
    return new Promise((_, reject) => {
      setTimeout(() => {
        reject(new Error(`Timeout after ${timeoutMs}ms for ${provider}`));
      }, timeoutMs);
    });
  }
}

// Export singleton instance
export const smartAPIClient = SmartAPIClient.getInstance();
