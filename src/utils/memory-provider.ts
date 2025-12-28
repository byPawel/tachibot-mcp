/**
 * Pluggable Memory Provider System
 *
 * ARCHITECTURE: This is a FORMATTER, not an executor.
 * - tachibot formats session data into provider-specific hints
 * - Claude (the orchestrator) calls the actual devlog/mem0 tools
 * - This keeps tachibot pure (reasoning only) with zero coupling to other MCPs
 *
 * Supported providers:
 * - devlog: Session logging with devlog-mcp
 * - mem0: AI memory with semantic search
 * - custom: Any MCP with save/load capabilities
 */

/**
 * Configuration for a memory provider
 * Maps provider name to its MCP tool names
 */
export interface MemoryProviderDefinition {
  name: string;
  description: string;
  tools: {
    save?: string;     // Tool to save context/session (e.g., "devlog_session_log")
    load?: string;     // Tool to load context (e.g., "devlog_workspace_status")
    query?: string;    // Tool to query memory (e.g., "mem0_search")
  };
  /**
   * Transform session data to provider-specific format
   */
  formatSaveInput?: (data: MemorySaveData) => Record<string, unknown>;
}

/**
 * Data to save to memory provider
 */
export interface MemorySaveData {
  sessionId: string;
  objective?: string;
  thoughts: Array<{
    number: number;
    content: string;
    model?: string;
    modelResponse?: string;
  }>;
  distilledContext?: {
    task: string;
    constraints: string[];
    keyInsights: string[];
    decisions: string[];
  };
  finalJudgeResponse?: string;
  timestamp: Date;
}

/**
 * Hint returned to Claude for memory operations
 * Claude sees this and calls the appropriate MCP tool
 */
export interface MemorySaveHint {
  provider: string;
  tool: string;
  input: Record<string, unknown>;
  description: string;
}

/**
 * Registry of available memory providers
 * Extensible at runtime via registerProvider()
 */
class MemoryProviderRegistry {
  private providers: Map<string, MemoryProviderDefinition> = new Map();

  constructor() {
    this.registerBuiltinProviders();
  }

  private registerBuiltinProviders(): void {
    // devlog-mcp provider
    this.register({
      name: "devlog",
      description: "Session logging with devlog-mcp (workspace tracking, daily logs)",
      tools: {
        save: "devlog_session_log",
        load: "devlog_workspace_status",
      },
      formatSaveInput: (data) => ({
        entry: this.formatDevlogEntry(data),
        type: "progress",
      }),
    });

    // mem0 provider
    this.register({
      name: "mem0",
      description: "AI memory with semantic search via mem0",
      tools: {
        save: "mem0_add",
        load: "mem0_search",
        query: "mem0_search",
      },
      formatSaveInput: (data) => ({
        content: this.formatMem0Entry(data),
        metadata: {
          sessionId: data.sessionId,
          objective: data.objective,
          timestamp: data.timestamp.toISOString(),
        },
      }),
    });
  }

  private formatDevlogEntry(data: MemorySaveData): string {
    const parts: string[] = [];

    if (data.objective) {
      parts.push(`**Objective**: ${data.objective}`);
    }

    parts.push(`**Session**: ${data.thoughts.length} thoughts processed`);

    if (data.distilledContext) {
      if (data.distilledContext.keyInsights.length > 0) {
        parts.push(`**Insights**: ${data.distilledContext.keyInsights.join("; ")}`);
      }
      if (data.distilledContext.decisions.length > 0) {
        parts.push(`**Decisions**: ${data.distilledContext.decisions.join("; ")}`);
      }
    }

    if (data.finalJudgeResponse) {
      const verdict = data.finalJudgeResponse.substring(0, 300);
      parts.push(`**Verdict**: ${verdict}${data.finalJudgeResponse.length > 300 ? "..." : ""}`);
    }

    return parts.join("\n");
  }

  private formatMem0Entry(data: MemorySaveData): string {
    const parts: string[] = [];

    if (data.objective) {
      parts.push(`Objective: ${data.objective}`);
    }

    for (const thought of data.thoughts.slice(-3)) {
      if (thought.modelResponse) {
        parts.push(`[${thought.model}] ${thought.modelResponse.substring(0, 500)}`);
      }
    }

    if (data.finalJudgeResponse) {
      parts.push(`Final verdict: ${data.finalJudgeResponse.substring(0, 500)}`);
    }

    return parts.join("\n\n");
  }

  register(provider: MemoryProviderDefinition): void {
    this.providers.set(provider.name.toLowerCase(), provider);
  }

  get(name: string): MemoryProviderDefinition | undefined {
    return this.providers.get(name.toLowerCase());
  }

  list(): string[] {
    return Array.from(this.providers.keys());
  }

  has(name: string): boolean {
    return this.providers.has(name.toLowerCase());
  }
}

// Singleton instance
export const memoryProviderRegistry = new MemoryProviderRegistry();

/**
 * Format session data into a save hint for Claude
 * Returns structured data that Claude can use to call the appropriate MCP tool
 *
 * NOTE: This does NOT execute anything. Claude sees the hint and acts on it.
 */
export function formatMemorySaveHint(
  providerName: string,
  data: MemorySaveData
): MemorySaveHint | null {
  const provider = memoryProviderRegistry.get(providerName);
  if (!provider || !provider.tools.save) {
    return null;
  }

  const input = provider.formatSaveInput?.(data) ?? { content: JSON.stringify(data) };

  return {
    provider: providerName,
    tool: provider.tools.save,
    input,
    description: `Save session to ${providerName}: Call ${provider.tools.save} with the provided input`,
  };
}

/**
 * Get available providers for display
 */
export function getAvailableMemoryProviders(): Array<{ name: string; description: string }> {
  const providers: Array<{ name: string; description: string }> = [];
  for (const name of memoryProviderRegistry.list()) {
    const provider = memoryProviderRegistry.get(name);
    if (provider) {
      providers.push({ name: provider.name, description: provider.description });
    }
  }
  return providers;
}
