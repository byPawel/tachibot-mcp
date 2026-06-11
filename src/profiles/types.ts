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
  gemini_judge: boolean;         // Multi-perspective evaluation & synthesis
  gemini_search: boolean;
  jury: boolean;                 // Multi-model jury panel with Gemini judge

  // OpenRouter tools
  qwen_coder: boolean;
  qwen_algo: boolean;
  qwq_reason: boolean;         // QwQ-32B (multi-perspective deliberation, free tier)
  qwen_reason: boolean;        // Qwen3-Max-Thinking (heavy mathematical reasoning)
  kimi_thinking: boolean;
  kimi_code: boolean;            // NEW: Kimi K2.5 (SWE-focused code, 76.8%)
  kimi_decompose: boolean;       // NEW: Kimi K2.5 (task decomposition)
  kimi_long_context: boolean;    // NEW: Kimi K2.5 (256K context analysis)
  qwen_competitive: boolean;
  minimax_code: boolean;       // MiniMax M3 (1M ctx, MSA sparse attention, agentic/coding)
  minimax_agent: boolean;      // MiniMax M3 (agentic, multimodal, long-horizon)
  deepseek_reason: boolean;    // DeepSeek V4 Pro (open-weight frontier reasoning/math)
  deepseek_algo: boolean;      // DeepSeek V4 Pro (algorithmic code review — top AIME/CodeElo)
  glm_reason: boolean;         // Zhipu GLM-5.1 (agentic reasoning, SWE-Bench Pro leader)
  stepfun_reason: boolean;     // StepFun Step 3.7 Flash (efficient reasoning)
  ernie_reason: boolean;       // Baidu ERNIE 4.5 VL (broad-knowledge reasoning)
  local_query: boolean;        // Local open-weight models (Ollama/LM Studio/llama.cpp/vLLM) — zero-cost, offline

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

  // Planner tools (multi-model council)
  planner_maker: boolean;
  planner_runner: boolean;
  list_plans: boolean;
}
