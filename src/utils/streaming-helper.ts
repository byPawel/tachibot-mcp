/**
 * Streaming Helper - Progress Heartbeats for Long-Running MCP Tools
 *
 * Prevents MCP timeout (~60s) by sending periodic progress notifications.
 * Uses standard MCP notifications/progress which should work with all clients.
 */

export interface ProgressReport {
  progress: number;
  total: number;
}

export interface HeartbeatOptions {
  intervalMs?: number;  // Default: 5000 (5 seconds)
  reportProgress: (p: ProgressReport) => Promise<void>;
  onError?: (error: Error) => void;
}

export interface Heartbeat {
  stop: () => void;
  complete: () => Promise<void>;
}

/**
 * Create a heartbeat that sends progress notifications at regular intervals.
 * Useful for keeping MCP connections alive during long-running operations.
 */
export function createHeartbeat(options: HeartbeatOptions): Heartbeat {
  const { intervalMs = 5000, reportProgress, onError } = options;
  let progress = 0;
  let stopped = false;

  const interval = setInterval(async () => {
    if (stopped) return;

    // Increment progress, cap at 90% (leave room for completion)
    progress = Math.min(progress + 10, 90);

    try {
      await reportProgress({ progress, total: 100 });
    } catch (error) {
      // Client may have disconnected - stop heartbeat
      if (onError && error instanceof Error) {
        onError(error);
      }
      stopped = true;
      clearInterval(interval);
    }
  }, intervalMs);

  return {
    stop: () => {
      stopped = true;
      clearInterval(interval);
    },
    complete: async () => {
      stopped = true;
      clearInterval(interval);
      try {
        await reportProgress({ progress: 100, total: 100 });
      } catch {
        // Ignore completion errors - client may have disconnected
      }
    }
  };
}

/**
 * Execute a function with automatic progress heartbeats.
 * Heartbeat starts immediately, stops when function completes (success or error).
 *
 * @example
 * ```typescript
 * const result = await withHeartbeat(
 *   () => callExternalAPI(prompt),
 *   context.reportProgress
 * );
 * ```
 */
export async function withHeartbeat<T>(
  fn: () => Promise<T>,
  reportProgress: (p: ProgressReport) => Promise<void>,
  intervalMs: number = 5000
): Promise<T> {
  const heartbeat = createHeartbeat({ intervalMs, reportProgress });

  try {
    const result = await fn();
    await heartbeat.complete();
    return result;
  } catch (error) {
    heartbeat.stop();
    throw error;
  }
}

/**
 * Wrapper for streaming API responses with heartbeat support.
 * Sends progress while waiting for streaming response to complete.
 *
 * @param stream - AsyncIterable of chunks (e.g., from OpenAI streaming API)
 * @param reportProgress - Progress reporter from MCP context
 * @param onChunk - Optional callback for each chunk (for streamContent)
 */
export async function withStreamingHeartbeat<T>(
  stream: AsyncIterable<T>,
  reportProgress: (p: ProgressReport) => Promise<void>,
  onChunk?: (chunk: T) => Promise<void>
): Promise<T[]> {
  const heartbeat = createHeartbeat({ reportProgress });
  const chunks: T[] = [];

  try {
    for await (const chunk of stream) {
      chunks.push(chunk);
      if (onChunk) {
        await onChunk(chunk);
      }
    }
    await heartbeat.complete();
    return chunks;
  } catch (error) {
    heartbeat.stop();
    throw error;
  }
}

/**
 * Check if reportProgress is available in the context.
 * FastMCP always provides it, but this is a safety check.
 */
export function hasProgressSupport(context: unknown): context is { reportProgress: (p: ProgressReport) => Promise<void> } {
  return (
    typeof context === 'object' &&
    context !== null &&
    'reportProgress' in context &&
    typeof (context as { reportProgress: unknown }).reportProgress === 'function'
  );
}
