import { ProfileConfig } from './types.js';

export const fullProfile: ProfileConfig = {
  description: "Default profile — all tools enabled for maximum capability (62 tools)",
  tools: {
    think: true,
    focus: true,
    tachi: true,
    doctor: true,
    nextThought: true,
    usage_stats: true,
    perplexity_ask: true,
    perplexity_reason: true,
    grok_reason: true,
    grok_code: true,
    grok_debug: true,
    debug_triage: true,
    grok_architect: true,
    grok_brainstorm: true,
    grok_search: true,
    openai_reason: true,
    openai_brainstorm: true,
    openai_code_review: true,
    openai_explain: true,
    openai_search: true,
    spec_writer: true,
    gemini_brainstorm: true,
    gemini_analyze_code: true,
    gemini_analyze_text: true,
    gemini_judge: true,
    gemini_search: true,
    jury: true,
    qwen_coder: true,
    qwen_algo: true,
    qwq_reason: true,
    qwen_reason: true,
    kimi_thinking: true,
    kimi_code: true,
    kimi_decompose: true,
    kimi_long_context: true,
    qwen_competitive: true,
    minimax_code: true,
    minimax_agent: true,
    deepseek_reason: true,
    deepseek_algo: true,
    glm_reason: true,
    stepfun_reason: true,
    ernie_reason: true,
    local_query: true,
    workflow: true,
    list_workflows: true,
    create_workflow: true,
    visualize_workflow: true,
    workflow_start: true,
    continue_workflow: true,
    workflow_status: true,
    validate_workflow: true,
    validate_workflow_file: true,
    list_prompt_techniques: true,
    preview_prompt_technique: true,
    execute_prompt_technique: true,

    // Planner tools (multi-model council)
    planner_maker: true,
    planner_runner: true,
    list_plans: true,

    // Test generation
    testgen: true,

    // Security audit
    security_review: true,

    // Diff-aware code review
    diff_review: true,

    // Adversarial plan red-team
    plan_critique: true,
  }
};
