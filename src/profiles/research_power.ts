import { ProfileConfig } from './types.js';

export const researchPowerProfile: ProfileConfig = {
  description: "Research-focused with Grok search + all Perplexity + brainstorming (36 tools)",
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
    grok_code: false,
    grok_debug: false,
    debug_triage: false,
    grok_architect: false,
    grok_brainstorm: false,
    grok_search: true,
    grok_search_lite: true,
    openai_reason: false,
    openai_brainstorm: true,
    openai_code_review: false,
    openai_explain: false,
    openai_search: true,
    spec_writer: false,
    refine_prompt: false,
    gemini_brainstorm: true,
    gemini_analyze_code: false,
    gemini_analyze_text: false,
    gemini_judge: true,          // Judge is useful for research synthesis
    gemini_search: true,
    jury: true,                  // Full jury for research decisions
    qwen_coder: true,
    qwen_algo: false,
    qwq_reason: true,          // Multi-perspective deliberation for research
    qwen_reason: true,         // Heavy reasoning for research
    kimi_thinking: true,
    kimi_code: true,
    kimi_decompose: true,
    kimi_long_context: true,
    qwen_competitive: false,
    minimax_code: false,
    minimax_agent: true,       // Agentic for research workflows
    deepseek_reason: true,     // Frontier reasoning for research synthesis
    deepseek_algo: false,      // Algo review not needed for research
    glm_reason: true,          // Agentic reasoning for research workflows
    stepfun_reason: true,      // Efficient reasoning for research
    ernie_reason: true,        // Broad-knowledge / arena strength for research
    local_query: false,        // Research leans on cloud/search, not local
    workflow: true,
    list_workflows: false,
    create_workflow: false,
    visualize_workflow: false,
    workflow_start: false,
    continue_workflow: false,
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

    // Test generation
    testgen: false,

    // Security audit
    security_review: false,

    // Diff-aware code review
    diff_review: false,

    // Adversarial plan red-team
    plan_critique: false,
  }
};
