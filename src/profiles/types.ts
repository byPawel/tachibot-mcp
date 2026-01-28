/**
 * Profile configuration types
 * Defines the structure for tool profiles
 */

export interface ProfileConfig {
  description: string;
  tools: ToolsConfig;
}

export interface ToolsConfig {
  // Core reasoning tools
  think: boolean;
  focus: boolean;
  tachi: boolean;
  nextThought: boolean;
  usage_stats: boolean;

  // Perplexity tools
  perplexity_ask: boolean;
  perplexity_reason: boolean;
  perplexity_research: boolean;

  // Grok tools
  grok_reason: boolean;
  grok_code: boolean;
  grok_debug: boolean;
  grok_architect: boolean;
  grok_brainstorm: boolean;
  grok_search: boolean;

  // OpenAI tools
  openai_reason: boolean;
  openai_brainstorm: boolean;
  openai_code_review: boolean;
  openai_explain: boolean;
  openai_search: boolean;

  // Gemini tools
  gemini_brainstorm: boolean;
  gemini_analyze_code: boolean;
  gemini_analyze_text: boolean;
  gemini_search: boolean;

  // OpenRouter tools
  qwen_coder: boolean;
  qwen_algo: boolean;
  qwen_reason: boolean;        // NEW: Qwen3-Max-Thinking (heavy reasoning)
  kimi_thinking: boolean;
  qwen_competitive: boolean;
  minimax_code: boolean;       // NEW: MiniMax M2.1 (SWE tasks, cheap)
  minimax_agent: boolean;      // NEW: MiniMax M2.1 (agentic, cheap)

  // Workflow tools
  workflow: boolean;
  list_workflows: boolean;
  create_workflow: boolean;
  visualize_workflow: boolean;
  workflow_start: boolean;
  continue_workflow: boolean;
  workflow_status: boolean;
  validate_workflow: boolean;
  validate_workflow_file: boolean;

  // Prompt technique tools
  list_prompt_techniques: boolean;
  preview_prompt_technique: boolean;
  execute_prompt_technique: boolean;
}
