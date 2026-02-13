import { ProfileConfig } from './types.js';

export const heavyCodingProfile: ProfileConfig = {
  description: "Default profile — heavy coding with all reasoning & code tools (40 tools)",
  tools: {
    // Core reasoning - all enabled
    think: true,
    focus: true,
    tachi: true,
    nextThought: true,
    usage_stats: true,

    // Perplexity - all enabled for research
    perplexity_ask: true,
    perplexity_reason: true,
    perplexity_research: true,

    // Grok - all enabled for heavy coding
    grok_reason: true,
    grok_code: true,
    grok_debug: true,
    grok_architect: true,
    grok_brainstorm: true,
    grok_search: true,

    // OpenAI - all enabled for heavy coding
    openai_reason: true,
    openai_brainstorm: true,
    openai_code_review: true,
    openai_explain: true,
    openai_search: true,

    // Gemini - all enabled
    gemini_brainstorm: true,
    gemini_analyze_code: true,
    gemini_analyze_text: true,
    gemini_judge: true,
    gemini_search: true,
    jury: true,

    // OpenRouter - coders enabled
    qwen_coder: true,
    qwen_algo: true,
    qwq_reason: true,
    qwen_reason: true,
    kimi_thinking: true,
    kimi_code: true,
    kimi_decompose: true,
    kimi_long_context: true,
    qwen_competitive: false,
    minimax_code: true,        // Cheap SWE - great for heavy coding
    minimax_agent: true,       // Cheap agentic - great for workflows

    // Workflow - minimal set for execution
    workflow: true,
    list_workflows: true,
    create_workflow: false,
    visualize_workflow: false,
    workflow_start: true,
    continue_workflow: true,
    workflow_status: false,
    validate_workflow: false,
    validate_workflow_file: false,
    list_prompt_techniques: true,
    preview_prompt_technique: true,
    execute_prompt_technique: true,

    // Planner tools (multi-model council)
    planner_maker: true,
    planner_runner: true,
    list_plans: true,
  }
};
