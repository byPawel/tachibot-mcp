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
    ['evidence', (q, c) => `Evidence for "${q}": support, contradict, cases, stats, experts.`],
    
    // Analytical
    ['analyze', (q, c) => `"${q}" systematic: components→relationships→patterns→strengths/risks→conclusions.`],
    ['first_prin', (q) => `"${q}" first principles: truths→assumptions→atomic units→rebuild.`],
    ['feasible', (q, c) => `"${q}" feasibility: technical/economic/time/resources/risks/metrics.`],
    
    // Reflective
    ['reflect', (q, c) => `"${q}" reflection: patterns, surprises, key insight, gaps, next steps.`],
    ['patterns', (q, c) => `"${q}" patterns: themes, causality, cycles, anomalies, system insights.`],
    ['decompose', (q) => `"${q}" breakdown: core→sub-problems→dependencies→constraints→steps.`],
    ['integrate', (q) => `"${q}" synthesis: convergent themes, complements, contradictions, meta-pattern.`]
  ]);

  // Compact technique mapping
  private techniqueMap: Record<string, string> = {
    'what_if_speculation': 'what_if',
    'alternative_perspectives': 'alt_view',
    'creative_applications': 'creative_use',
    'innovative_solutions': 'innovate',
    'comprehensive_investigation': 'investigate',
    'evidence_gathering': 'evidence',
    'systematic_analysis': 'analyze',
    'first_principles': 'first_prin',
    'feasibility_analysis': 'feasible',
    'quick_reflection': 'reflect',
    'pattern_recognition': 'patterns',
    'problem_decomposition': 'decompose',
    'integration_reflection': 'integrate'
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
      'what_if': 'What if...',
      'alt_view': 'Multi-angle',
      'creative_use': 'Applications',
      'innovate': 'Innovation',
      'investigate': '5W1H',
      'evidence': 'Evidence',
      'analyze': 'Analysis',
      'first_prin': 'First principles',
      'feasible': 'Feasibility',
      'reflect': 'Reflection',
      'patterns': 'Patterns',
      'decompose': 'Breakdown',
      'integrate': 'Synthesis'
    };
    const key = this.techniqueMap[technique] || technique;
    return desc[key] || technique;
  }
}