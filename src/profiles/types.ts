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
  nextThought: boolean;

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

  // Gemini tools
  gemini_brainstorm: boolean;
  gemini_analyze_code: boolean;
  gemini_analyze_text: boolean;

  // OpenRouter tools
  qwen_coder: boolean;
  kimi_thinking: boolean;
  qwen_competitive: boolean;

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
}
