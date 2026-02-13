import { ToolResult } from './types.js';

export class PromptEngineerLite {
  private t: Map<string, (q: string, c?: string) => string> = new Map([
    // Creative
    ['what_if', (q) => `What if "${q}" had no limits? Explore wild possibilities.`],
    ['alt_view', (q) => `"${q}" from 5 angles: child, scientist, artist, strategist, futurist.`],
    ['creative_use', (q, c) => `Creative applications of "${q}"${c ? ' findings' : ''} across domains.`],
    ['innovate', (q) => `Generate creative, unconventional solutions for "${q}". Consider multiple approaches: rethinking existing processes, drawing inspiration from other domains, removing constraints, and combining different methods. Provide 3+ novel, practical approaches.`],

    // Research
    ['investigate', (q) => `5W1H analysis of "${q}": Who/What/When/Where/Why/How + recent developments.`],
    ['evidence', (q, _c) => `Evidence for "${q}": support, contradict, cases, stats, experts.`],

    // Analytical
    ['analyze', (q, _c) => `"${q}" systematic: components→relationships→patterns→strengths/risks→conclusions.`],
    ['first_prin', (q) => `"${q}" first principles: truths→assumptions→atomic units→rebuild.`],
    ['feasible', (q, _c) => `"${q}" feasibility: technical/economic/time/resources/risks/metrics.`],

    // Reflective
    ['reflect', (q, _c) => `"${q}" reflection: patterns, surprises, key insight, gaps, next steps.`],
    ['patterns', (q, _c) => `"${q}" patterns: themes, causality, cycles, anomalies, system insights.`],
    ['decompose', (q) => `"${q}" breakdown: core→sub-problems→dependencies→constraints→steps.`],
    ['integrate', (q) => `"${q}" synthesis: convergent themes, complements, contradictions, meta-pattern.`],

    // Reasoning (2025-2026 patterns)
    ['chain_of_thought', (q) => `Think step-by-step about "${q}": 1) Identify the core question, 2) Break into sub-problems, 3) Apply logical reasoning to each, 4) Synthesize conclusion.`],
    ['tree_of_thoughts', (q) => `For "${q}": Branch into 3 distinct solution paths, explore each path's implications, evaluate pros/cons, prune weak branches, synthesize best elements.`],
    ['graph_of_thoughts', (q) => `Map "${q}" as an idea graph: identify key concept nodes, draw connection edges (supports/contradicts/depends), find feedback loops and central hubs.`],

    // Verification
    ['self_consistency', (q) => `For "${q}": Generate 3 independent solutions, compare approaches, identify consensus points, vote on best answer, explain confidence level.`],
    ['constitutional', (q) => `Solve "${q}", then critique your answer against: accuracy (is it factually correct?), safety (any risks?), helpfulness (does it address the need?). Revise based on critique.`],

    // Meta
    ['meta_prompting', (q) => `First, write a better prompt for "${q}" that would get a more useful response. Then, answer using that improved prompt.`],

    // Debate
    ['adversarial', (q) => `For "${q}": First argue strongly FOR this position with best evidence. Then argue strongly AGAINST with counterarguments. Finally, synthesize a balanced view.`],
    ['persona_simulation', (q) => `Simulate expert debate on "${q}": Have a skeptic raise concerns, an optimist highlight benefits, a pragmatist focus on implementation, and a visionary explore possibilities. Synthesize insights.`],

    // Judgment (Council of Experts)
    ['council_of_experts', (q) => `Multi-model council analysis for "${q}":
1. GATHER PERSPECTIVES: Consider this from multiple expert angles (researcher, engineer, skeptic, innovator)
2. EXTRACT BEST ELEMENTS: What's the most valuable insight from each perspective?
3. IDENTIFY CONSENSUS: Where do all perspectives agree?
4. RESOLVE CONFLICTS: Where perspectives differ, weigh the tradeoffs
5. SYNTHESIZE VERDICT: Combine the best elements into a unified, actionable answer
Output format: Perspectives → Best Elements → Consensus → Conflicts → Final Synthesis`],

    // Engineering (coding-specific, 2026)
    ['reflexion', (q) => `For "${q}": 1) Generate initial solution, 2) Critique it against: correctness, edge cases, performance, readability, 3) Score each criterion 1-10, 4) Revise based on weakest scores, 5) Re-critique the revision. Repeat until score ≥8 or 3 rounds.`],
    ['react', (q) => `Solve "${q}" using Thought→Action→Observation loops:
Thought 1: What's the immediate sub-goal?
Action 1: Write the code/command to achieve it.
Observation 1: What happened? Did it work?
Thought 2: Based on observation, what's next?
Continue until goal is met or blocked. If blocked, state why and what's needed.`],
    ['rubber_duck', (q) => `Explain "${q}" line by line to a junior developer who knows nothing about this codebase. For each line/block: what does it do, why is it there, what assumption does it make? Flag any line where your explanation reveals a bug, unnecessary complexity, or hidden assumption.`],
    ['test_driven', (q) => `For "${q}": 1) List 5+ edge cases and failure modes FIRST, 2) Write minimal test cases that cover them, 3) Write the simplest code that passes ALL tests, 4) Refactor for clarity without breaking tests. Tests before code, always.`],

    // Research (complex analysis, 2026)
    ['least_to_most', (q) => `For "${q}": 1) Identify the hardest part of this problem, 2) Decompose into atomic sub-problems (simplest first), 3) Solve each sub-problem in order (each solution builds on the last), 4) Combine sub-solutions into full answer. Start with what you CAN solve, build up to what seems impossible.`],

    // Decision Making (risk/bias reduction, 2026)
    ['pre_mortem', (q) => `Pre-mortem analysis for "${q}": Assume this project has FAILED spectacularly 6 months from now. 1) Brainstorm 7-10 specific reasons it failed, 2) Rank by likelihood (high/medium/low), 3) For the top 5: what early warning sign would you see? what mitigation would prevent it? 4) Which mitigations should be implemented NOW vs. monitored?`],

    // Structured Coding (2025 research-backed)
    ['scot', (q) => `For "${q}": Before writing ANY code, reason through the solution using explicit programming structures:
1. SEQUENCE: What operations happen in order? List them.
2. BRANCHES: What conditions determine different paths? State each if/else.
3. LOOPS: What repeats? State the loop variable, condition, and body.
4. DATA FLOW: What goes in, what transforms, what comes out?
Now write the code that implements exactly this structure. The code should mirror your reasoning 1:1.`],
    ['pre_post', (q) => `For "${q}": Before implementing, state the CONTRACT:
PRECONDITIONS (what must be true BEFORE this runs):
- Input types and valid ranges
- Required state (initialized, connected, authenticated, etc.)
- Assumptions about data (non-null, sorted, unique, etc.)
POSTCONDITIONS (what is GUARANTEED AFTER this runs):
- Return value type and constraints
- Side effects (files written, state changed, events emitted)
- Invariants preserved (no resource leaks, no data corruption)
Now implement code that satisfies this contract. Validate preconditions at entry, guarantee postconditions at exit.`],
    ['bdd_spec', (q) => `For "${q}": Write behavioral specifications in Given/When/Then format FIRST:
FEATURE: [one-line description]
  Scenario 1: [happy path]
    Given [initial state]
    When [action]
    Then [expected outcome]
  Scenario 2: [edge case]
    Given [boundary condition]
    When [action]
    Then [expected behavior]
  Scenario 3: [error case]
    Given [invalid input or failure condition]
    When [action]
    Then [error handling behavior]
Now implement code that passes ALL scenarios. Each scenario becomes a test.`]
  ]);

  // Compact technique mapping (aliases to canonical names)
  private techniqueMap: Record<string, string> = {
    // Existing aliases
    'what_if_speculation': 'what_if',
    'alternative_perspectives': 'alt_view',
    'perspectives': 'alt_view',
    'creative_applications': 'creative_use',
    'applications': 'creative_use',
    'innovative_solutions': 'innovate',
    'solutions': 'innovate',
    'comprehensive_investigation': 'investigate',
    '5w1h': 'investigate',
    'evidence_gathering': 'evidence',
    'facts': 'evidence',
    'systematic_analysis': 'analyze',
    'systematic': 'analyze',
    'first_principles': 'first_prin',
    'feasibility_analysis': 'feasible',
    'feasibility': 'feasible',
    'quick_reflection': 'reflect',
    'pattern_recognition': 'patterns',
    'connections': 'patterns',
    'problem_decomposition': 'decompose',
    'breakdown': 'decompose',
    'integration_reflection': 'integrate',
    'synthesize': 'integrate',

    // New technique aliases (2025-2026)
    'step_by_step': 'chain_of_thought',
    'explore_paths': 'tree_of_thoughts',
    'idea_map': 'graph_of_thoughts',
    'consensus': 'self_consistency',
    'principles': 'constitutional',
    'improve_prompt': 'meta_prompting',
    'critic': 'adversarial',
    'debate': 'persona_simulation',

    // Judgment aliases
    'judge': 'council_of_experts',
    'council': 'council_of_experts',
    'expert_council': 'council_of_experts',

    // Engineering aliases (2026)
    'reflexion_loop': 'reflexion',
    'iterate': 'reflexion',
    'react_prompting': 'react',
    'thought_action': 'react',
    'rubber_duck_debugging': 'rubber_duck',
    'explain_code': 'rubber_duck',
    'test_driven_prompting': 'test_driven',
    'tdd': 'test_driven',

    // Research aliases (2026)
    'least_to_most_prompting': 'least_to_most',
    'build_up': 'least_to_most',

    // Decision aliases (2026)
    'pre_mortem_analysis': 'pre_mortem',
    'failure_analysis': 'pre_mortem',

    // Structured Coding aliases (2025)
    'structured_cot': 'scot',
    'structured_chain_of_thought': 'scot',
    'code_structure': 'scot',
    'pre_post_conditions': 'pre_post',
    'contracts': 'pre_post',
    'design_by_contract': 'pre_post',
    'bdd': 'bdd_spec',
    'given_when_then': 'bdd_spec',
    'behavioral': 'bdd_spec'
  };

  applyTechnique(tool: string, technique: string, query: string, prev?: ToolResult[]): string {
    const key = this.techniqueMap[technique] || technique;
    const handler = this.t.get(key) || ((q) => q);
    const context = prev?.length ? this.extractContext(prev[prev.length - 1].output) : undefined;
    return this.adaptForTool(tool, handler(query, context));
  }

  private extractContext(output: string): string {
    const lines = output.split('\n').filter(l => l.trim());
    const keyLine = lines.findIndex(l => /(summary|key|conclusion)/i.test(l));
    return keyLine >= 0 ? lines.slice(keyLine, keyLine + 3).join(' ') : lines.slice(0, 2).join(' ');
  }

  private adaptForTool(tool: string, prompt: string): string {
    const suffix: Record<string, string> = {
      'gemini_brainstorm': ' Think creatively.',
      'perplexity_research': ' Find concrete data.',
      'openai_reason': ' Structure clearly.',
      'openai_brainstorm': ' Explore alternatives.'
    };
    return prompt + (suffix[tool] || '');
  }

  getTechniqueDescription(technique: string): string {
    const desc: Record<string, string> = {
      // Creative
      'what_if': 'What if...',
      'alt_view': 'Multi-angle',
      'creative_use': 'Applications',
      'innovate': 'Innovation',
      // Research
      'investigate': '5W1H',
      'evidence': 'Evidence',
      // Analytical
      'analyze': 'Analysis',
      'first_prin': 'First principles',
      'feasible': 'Feasibility',
      // Reflective
      'reflect': 'Reflection',
      'patterns': 'Patterns',
      'decompose': 'Breakdown',
      'integrate': 'Synthesis',
      // Reasoning (2025-2026)
      'chain_of_thought': 'Step-by-step',
      'tree_of_thoughts': 'Explore paths',
      'graph_of_thoughts': 'Idea map',
      // Verification
      'self_consistency': 'Consensus',
      'constitutional': 'Principles check',
      // Meta
      'meta_prompting': 'Improve prompt',
      // Debate
      'adversarial': 'Pro/Con',
      'persona_simulation': 'Expert debate',
      // Judgment
      'council_of_experts': 'Council judge',
      // Engineering (2026)
      'reflexion': 'Generate→Critique→Revise',
      'react': 'Thought→Action→Observe',
      'rubber_duck': 'Explain line-by-line',
      'test_driven': 'Tests first→Code→Refactor',
      // Research (2026)
      'least_to_most': 'Atomic→Build up',
      // Decision (2026)
      'pre_mortem': 'Assume failure→Prevent',
      // Structured Coding (2025)
      'scot': 'Reason in code structures',
      'pre_post': 'Contract: pre/postconditions',
      'bdd_spec': 'Given/When/Then specs'
    };
    const key = this.techniqueMap[technique] || technique;
    return desc[key] || technique;
  }
}