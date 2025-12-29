import { ProfileConfig } from './types.js';

export const heavyCodingProfile: ProfileConfig = {
  description: "Heavy coding with all reasoning & code tools (~14k tokens, 22 tools)",
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

    // OpenAI - reason & brainstorm only
    openai_reason: true,
    openai_brainstorm: true,
    openai_code_review: false,
    openai_explain: false,

    // Gemini - all enabled
    gemini_brainstorm: true,
    gemini_analyze_code: true,
    gemini_analyze_text: true,

    // OpenRouter - coders enabled
    qwen_coder: true,
    kimi_thinking: true,
    qwen_competitive: false,

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
  }
};
