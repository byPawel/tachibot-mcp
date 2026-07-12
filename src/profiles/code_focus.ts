import { ProfileConfig } from './types.js';

export const codeFocusProfile: ProfileConfig = {
  description: "Code-heavy work with debugging and analysis (42 tools)",
  tools: {
    think: true,
    focus: true,
    tachi: true,
    doctor: true,
    nextThought: true,
    usage_stats: true,
    perplexity_ask: true,
    perplexity_reason: false,
    grok_reason: true,
    grok_code: true,
    grok_debug: true,
    debug_triage: true,
    grok_architect: false,
    grok_brainstorm: false,
    grok_search: false,
    grok_search_lite: false,
    openai_reason: false,
    openai_brainstorm: false,
    openai_code_review: true,
    openai_explain: false,
    openai_search: false,
    spec_writer: true,
    refine_prompt: true,
    gemini_brainstorm: true,
    gemini_analyze_code: true,
    gemini_analyze_text: false,
    gemini_judge: false,
    gemini_search: false,
    jury: false,
    qwen_coder: true,
    qwen_algo: true,
    qwq_reason: true,          // Multi-perspective deliberation (free tier)
    qwen_reason: false,        // Not needed for code focus
    kimi_thinking: true,
    kimi_code: true,
    kimi_decompose: true,
    kimi_long_context: true,
    qwen_competitive: false,
    minimax_code: true,        // Cheap SWE - perfect for code focus
    minimax_agent: false,
    deepseek_reason: true,     // Frontier reasoning for hard logic
    deepseek_algo: true,       // Algorithmic review - top AIME/CodeElo
    glm_reason: true,          // Agentic SWE reasoning
    stepfun_reason: true,      // Efficient reasoning for code logic
    ernie_reason: false,       // Broad-knowledge model not needed for code focus
    local_query: true,
    workflow: true,
    list_workflows: true,
    create_workflow: false,
    visualize_workflow: false,
    workflow_start: false,
    continue_workflow: false,
    workflow_status: false,
    validate_workflow: true,
    validate_workflow_file: false,
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
