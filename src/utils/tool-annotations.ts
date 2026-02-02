/**
 * Centralized tool annotations registry.
 * Provides MCP tool annotations (title, readOnlyHint, openWorldHint, streamingHint)
 * for all TachiBot tools. Used by safeAddTool() to enrich tool metadata.
 */

export interface ToolAnnotation {
  title: string;
  readOnlyHint: boolean;
  openWorldHint: boolean;
  streamingHint: boolean;
  destructiveHint?: boolean;
  idempotentHint?: boolean;
}

const annotations: Record<string, ToolAnnotation> = {
  // ─── Core / Internal ───
  think: {
    title: "Think (Log Reasoning)",
    readOnlyHint: true,
    openWorldHint: false,
    streamingHint: false,
  },
  usage_stats: {
    title: "Usage Statistics",
    readOnlyHint: true,
    openWorldHint: false,
    streamingHint: false,
  },
  focus: {
    title: "Focus Mode Orchestrator",
    readOnlyHint: true,
    openWorldHint: true,
    streamingHint: false,
  },
  nextThought: {
    title: "Sequential Thinking Chain",
    readOnlyHint: true,
    openWorldHint: true,
    streamingHint: false,
  },

  // ─── Perplexity ───
  perplexity_ask: {
    title: "Perplexity Quick Ask",
    readOnlyHint: true,
    openWorldHint: true,
    streamingHint: true,
  },
  perplexity_reason: {
    title: "Perplexity Deep Reasoning",
    readOnlyHint: true,
    openWorldHint: true,
    streamingHint: true,
  },
  perplexity_research: {
    title: "Perplexity Web Research",
    readOnlyHint: true,
    openWorldHint: true,
    streamingHint: true,
  },

  // ─── Grok ───
  grok_reason: {
    title: "Grok Deep Reasoning",
    readOnlyHint: true,
    openWorldHint: true,
    streamingHint: true,
  },
  grok_code: {
    title: "Grok Code Generation",
    readOnlyHint: true,
    openWorldHint: true,
    streamingHint: true,
  },
  grok_debug: {
    title: "Grok Debugging",
    readOnlyHint: true,
    openWorldHint: true,
    streamingHint: true,
  },
  grok_architect: {
    title: "Grok Architecture Design",
    readOnlyHint: true,
    openWorldHint: true,
    streamingHint: true,
  },
  grok_brainstorm: {
    title: "Grok Brainstorming",
    readOnlyHint: true,
    openWorldHint: true,
    streamingHint: true,
  },
  grok_search: {
    title: "Grok Web Search",
    readOnlyHint: true,
    openWorldHint: true,
    streamingHint: true,
  },

  // ─── OpenAI ───
  openai_reason: {
    title: "OpenAI Deep Reasoning",
    readOnlyHint: true,
    openWorldHint: true,
    streamingHint: true,
  },
  openai_brainstorm: {
    title: "OpenAI Brainstorming",
    readOnlyHint: true,
    openWorldHint: true,
    streamingHint: true,
  },
  openai_search: {
    title: "OpenAI Web Search",
    readOnlyHint: true,
    openWorldHint: true,
    streamingHint: true,
  },

  // ─── Gemini ───
  gemini_brainstorm: {
    title: "Gemini Brainstorming",
    readOnlyHint: true,
    openWorldHint: true,
    streamingHint: true,
  },
  gemini_analyze_code: {
    title: "Gemini Code Analysis",
    readOnlyHint: true,
    openWorldHint: true,
    streamingHint: true,
  },
  gemini_analyze_text: {
    title: "Gemini Text Analysis",
    readOnlyHint: true,
    openWorldHint: true,
    streamingHint: true,
  },
  gemini_search: {
    title: "Gemini Search",
    readOnlyHint: true,
    openWorldHint: true,
    streamingHint: true,
  },

  // ─── OpenRouter (Qwen, Kimi, MiniMax) ───
  qwen_coder: {
    title: "Qwen Code Expert",
    readOnlyHint: true,
    openWorldHint: true,
    streamingHint: true,
  },
  qwen_algo: {
    title: "Qwen Algorithm Expert",
    readOnlyHint: true,
    openWorldHint: true,
    streamingHint: true,
  },
  qwen_reason: {
    title: "Qwen Reasoning",
    readOnlyHint: true,
    openWorldHint: true,
    streamingHint: true,
  },
  kimi_thinking: {
    title: "Kimi Deep Thinking",
    readOnlyHint: true,
    openWorldHint: true,
    streamingHint: true,
  },
  kimi_code: {
    title: "Kimi Code Analysis",
    readOnlyHint: true,
    openWorldHint: true,
    streamingHint: true,
  },
  kimi_decompose: {
    title: "Kimi Problem Decomposition",
    readOnlyHint: true,
    openWorldHint: true,
    streamingHint: true,
  },
  kimi_long_context: {
    title: "Kimi Long Context",
    readOnlyHint: true,
    openWorldHint: true,
    streamingHint: true,
  },
  minimax_code: {
    title: "MiniMax Code Generation",
    readOnlyHint: true,
    openWorldHint: true,
    streamingHint: true,
  },
  minimax_agent: {
    title: "MiniMax Agent",
    readOnlyHint: true,
    openWorldHint: true,
    streamingHint: true,
  },

  // ─── Planner & Workflows ───
  planner_maker: {
    title: "Plan Creator",
    readOnlyHint: false,
    openWorldHint: true,
    streamingHint: false,
  },
  planner_runner: {
    title: "Plan Executor",
    readOnlyHint: false,
    openWorldHint: true,
    streamingHint: false,
  },
  list_plans: {
    title: "List Plans",
    readOnlyHint: true,
    openWorldHint: false,
    streamingHint: false,
  },
  workflow: {
    title: "Run Workflow",
    readOnlyHint: false,
    openWorldHint: true,
    streamingHint: false,
  },
  workflow_start: {
    title: "Start Workflow (Async)",
    readOnlyHint: false,
    openWorldHint: true,
    streamingHint: false,
  },
  continue_workflow: {
    title: "Continue Workflow",
    readOnlyHint: false,
    openWorldHint: true,
    streamingHint: false,
  },
  list_workflows: {
    title: "List Workflows",
    readOnlyHint: true,
    openWorldHint: false,
    streamingHint: false,
  },

  // ─── Smart Router ───
  tachi: {
    title: "Tachi Smart Router",
    readOnlyHint: true,
    openWorldHint: true,
    streamingHint: true,
  },

  // ─── Prompt Techniques ───
  list_prompt_techniques: {
    title: "List Prompt Techniques",
    readOnlyHint: true,
    openWorldHint: false,
    streamingHint: false,
  },
  preview_prompt_technique: {
    title: "Preview Prompt Technique",
    readOnlyHint: true,
    openWorldHint: false,
    streamingHint: false,
  },
  execute_prompt_technique: {
    title: "Execute Prompt Technique",
    readOnlyHint: true,
    openWorldHint: true,
    streamingHint: true,
  },
};

/**
 * Get annotations for a tool by name.
 * Returns undefined if no annotations are registered.
 */
export function getToolAnnotations(toolName: string): ToolAnnotation | undefined {
  return annotations[toolName];
}

/**
 * Check if a tool should use streaming+distillation.
 * Returns true for tools with streamingHint: true.
 */
export function shouldStreamAndDistill(toolName: string): boolean {
  return annotations[toolName]?.streamingHint === true;
}
