/**
 * Centralized Timeout Configuration
 *
 * Provides configurable timeouts for all MCP operations to prevent premature
 * termination of long-running AI operations.
 *
 * See docs/ADR-002-timeout-configuration.md for rationale.
 */

export interface TimeoutConfig {
  default: number;
  verifier: number;
  challenger: number;
  scout: number;
  focus: number;
  workflow: number;
  pingpong: number;
  api: number;
  openrouter: number;
  progressThreshold: number;
}

/**
 * Get timeout configuration from environment variables with fallbacks
 */
export function getTimeoutConfig(): TimeoutConfig {
  return {
    // Global default (90 seconds)
    default: parseInt(process.env.TACHI_DEFAULT_TIMEOUT || '90000'),

    // Per-tool timeouts
    verifier: parseInt(process.env.TACHI_VERIFIER_TIMEOUT || '120000'),     // 2 minutes
    challenger: parseInt(process.env.TACHI_CHALLENGER_TIMEOUT || '180000'), // 3 minutes
    scout: parseInt(process.env.TACHI_SCOUT_TIMEOUT || '180000'),           // 3 minutes
    focus: parseInt(process.env.TACHI_FOCUS_TIMEOUT || '300000'),           // 5 minutes
    workflow: parseInt(process.env.TACHI_WORKFLOW_TIMEOUT || '300000'),     // 5 minutes
    pingpong: parseInt(process.env.TACHI_PINGPONG_TIMEOUT || '600000'),     // 10 minutes

    // Individual API call timeout (60 seconds)
    api: parseInt(process.env.TACHI_API_TIMEOUT || '60000'),

    // OpenRouter timeout (180 seconds for thinking models like Qwen)
    openrouter: parseInt(process.env.TACHI_OPENROUTER_TIMEOUT || '180000'),

    // Progress threshold (30 seconds)
    progressThreshold: parseInt(process.env.TACHI_PROGRESS_THRESHOLD || '30000'),
  };
}

/**
 * Get timeout for specific tool with fallback to default
 */
export function getToolTimeout(toolName: string): number {
  const config = getTimeoutConfig();

  const toolKey = toolName.toLowerCase() as keyof TimeoutConfig;
  return config[toolKey] || config.default;
}

/**
 * Format timeout duration for display
 */
export function formatTimeout(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) {
    return `${seconds}s`;
  }
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  if (remainingSeconds === 0) {
    return `${minutes}m`;
  }
  return `${minutes}m ${remainingSeconds}s`;
}

/**
 * Create timeout promise for use with Promise.race()
 */
export function createTimeoutPromise<T = never>(ms: number, message?: string): Promise<T> {
  return new Promise((_, reject) => {
    setTimeout(() => {
      reject(new Error(message || `Operation timed out after ${formatTimeout(ms)}`));
    }, ms);
  });
}

/**
 * Wrap promise with timeout
 */
export async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  toolName?: string
): Promise<T> {
  const timeoutMessage = toolName
    ? `${toolName} operation timed out after ${formatTimeout(timeoutMs)}`
    : `Operation timed out after ${formatTimeout(timeoutMs)}`;

  return Promise.race([
    promise,
    createTimeoutPromise<T>(timeoutMs, timeoutMessage)
  ]);
}

/**
 * Check if we should show progress (operation exceeds threshold)
 */
export function shouldShowProgress(elapsedMs: number): boolean {
  const config = getTimeoutConfig();
  return elapsedMs >= config.progressThreshold;
}

/**
 * Smart Timeout Configuration for SmartAPIClient
 */
export interface SmartTimeoutConfig {
  interactive: {
    base: number;      // Base timeout for interactive requests
    max: number;       // Maximum adaptive timeout
    retries: number;   // Number of retry attempts
  };
  batch: {
    base: number;      // Base timeout for batch/background requests
    max: number;       // Maximum adaptive timeout
    retries: number;   // Number of retry attempts
  };
  providers: {
    perplexity: { base: number; max: number; };
    grok: { base: number; max: number; };
    openai: { base: number; max: number; };
    anthropic: { base: number; max: number; };
    google: { base: number; max: number; };
    openrouter: { base: number; max: number; };
  };
}

export const SMART_TIMEOUT_DEFAULTS: SmartTimeoutConfig = {
  interactive: {
    base: 15000,      // 15 seconds
    max: 45000,       // 45 seconds
    retries: 3
  },
  batch: {
    base: 30000,      // 30 seconds
    max: 120000,      // 2 minutes
    retries: 5
  },
  providers: {
    perplexity: {
      base: 30000,    // 30 seconds - Perplexity can be slow
      max: 90000      // 90 seconds
    },
    grok: {
      base: 30000,    // 30 seconds
      max: 90000      // 90 seconds
    },
    openai: {
      base: 20000,    // 20 seconds
      max: 60000      // 60 seconds
    },
    anthropic: {
      base: 20000,    // 20 seconds
      max: 60000      // 60 seconds
    },
    google: {
      base: 15000,    // 15 seconds
      max: 45000      // 45 seconds
    },
    openrouter: {
      base: 90000,    // 90 seconds - thinking models need more time
      max: 300000     // 5 minutes max for complex reasoning
    }
  }
};

/**
 * Get smart timeout for specific provider and priority
 */
export function getSmartTimeout(
  provider: string,
  priority: 'interactive' | 'batch'
): { base: number; max: number; retries: number } {
  const providerConfig = (SMART_TIMEOUT_DEFAULTS.providers as any)[provider];
  const priorityConfig = SMART_TIMEOUT_DEFAULTS[priority];

  return {
    base: providerConfig?.base || priorityConfig.base,
    max: providerConfig?.max || priorityConfig.max,
    retries: priorityConfig.retries
  };
}

// Export singleton instance
export const timeouts = getTimeoutConfig();

// Re-export for convenience
export { getTimeoutConfig as default };
