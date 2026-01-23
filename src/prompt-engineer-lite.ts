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
Output format: Perspectives → Best Elements → Consensus → Conflicts → Final Synthesis`]
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
    'expert_council': 'council_of_experts'
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
      'council_of_experts': 'Council judge'
    };
    const key = this.techniqueMap[technique] || technique;
    return desc[key] || technique;
  }
}