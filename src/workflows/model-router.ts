export interface Task {
  type: string;
  complexity: number;
  needsCurrentInfo?: boolean;
  needsCode?: boolean;
  needsReasoning?: boolean;
}

export interface Constraints {
  budget?: number;
  speed?: boolean;
  quality?: boolean;
  local?: boolean;
}

export interface ModelInfo {
  id: string;
  cost: number;
  quality: number;
  speed: number;
  reasoning: number;
  context?: string;
  useFor: string[];
}

export class ModelRouter {
  private models: Map<string, ModelInfo> = new Map([
    ['claude-code', {
      id: 'claude-code',
      cost: 0,
      quality: 10,
      speed: 8,
      reasoning: 10,
      useFor: ['primary reasoning', 'code', 'analysis']
    }],
    ['gemini-2.5-pro', {
      id: 'gemini-2.5-pro',
      cost: 10,
      quality: 9,
      speed: 7,
      reasoning: 9,
      context: '1M tokens',
      useFor: ['deep reasoning', 'complex analysis', 'when quality matters']
    }],
    ['gemini-2.5-flash', {
      id: 'gemini-2.5-flash',
      cost: 2,
      quality: 7,
      speed: 10,
      reasoning: 7,
      context: '1M tokens',
      useFor: ['scout mode', 'quick analysis', 'high-volume tasks']
    }],
    ['perplexity-sonar-pro', {
      id: 'perplexity-sonar-pro',
      cost: 6,
      quality: 9,
      speed: 7,
      reasoning: 8,
      useFor: ['web search', 'fact-checking', 'citations']
    }],
    ['perplexity-sonar-reasoning', {
      id: 'perplexity-sonar-reasoning',
      cost: 10,
      quality: 10,
      speed: 5,
      reasoning: 10,
      useFor: ['complex reasoning with evidence']
    }],
    ['grok-4', {
      id: 'grok-4',
      cost: 9,
      quality: 9,
      speed: 6,
      reasoning: 9,
      useFor: ['first-principles', 'architecture', 'challenging assumptions']
    }],
    ['grok-4-heavy', {
      id: 'grok-4-heavy',
      cost: 12,
      quality: 10,
      speed: 4,
      reasoning: 10,
      useFor: ['deep reasoning', 'complex problems']
    }],
    ['gpt5', {
      id: 'gpt5',
      cost: 12,
      quality: 10,
      speed: 7,
      reasoning: 10,
      useFor: ['primary reasoning', 'complex analysis', 'critical workflows']
    }],
    ['gpt5_mini', {
      id: 'gpt5_mini',
      cost: 8,
      quality: 9,
      speed: 9,
      reasoning: 9,
      useFor: ['fallback reasoning', 'challenger mode', 'cost-aware reasoning']
    }],
    ['gpt5_reason', {
      id: 'gpt5_reason',
      cost: 12,
      quality: 10,
      speed: 7,
      reasoning: 10,
      useFor: ['deep research', 'complex reasoning']
    }],
    ['qwen3-coder-480b', {
      id: 'qwen3-coder-480b',
      cost: 12,
      quality: 10,
      speed: 4,
      reasoning: 8,
      useFor: ['code generation', 'code analysis', 'refactoring']
    }],
    ['qwq-32b', {
      id: 'qwq-32b',
      cost: 10,
      quality: 9,
      speed: 5,
      reasoning: 10,
      useFor: ['mathematical reasoning', 'step-by-step logic']
    }],
    ['qwen3-30b', {
      id: 'qwen3-30b',
      cost: 6,
      quality: 8,
      speed: 7,
      reasoning: 8,
      useFor: ['general tasks', 'cheaper alternative']
    }],
    ['think', {
      id: 'think',
      cost: 0,
      quality: 6,
      speed: 10,
      reasoning: 6,
      useFor: ['synthesis', 'internal reasoning', 'combining insights']
    }]
  ]);

  selectModel(task: Task, constraints: Constraints = {}): string {
    if (task.needsCurrentInfo || task.type === 'facts' || task.type === 'research') {
      return 'perplexity-sonar-pro';
    }
    
    if (task.complexity > 0.8 && !constraints.budget) {
      return constraints.budget !== undefined && constraints.budget < 10 ? 'gpt5_mini' : 'gpt5';
    }
    
    if (task.complexity < 0.2 && task.type === 'format') {
      return 'gemini-2.5-flash';
    }
    
    if (task.type === 'synthesis') {
      return 'think';
    }
    
    if (constraints.local) {
      return 'lmstudio-local';
    }
    
    const taskTypeMap: Record<string, string> = {
      'code': task.complexity > 0.7 ? 'qwen3-coder-480b' : 'gemini-2.5-flash',
      'research': 'perplexity-sonar-pro',
      'reasoning': task.complexity > 0.5 ? 'gpt5' : 'gpt5_mini',
      'scout': 'multi-model',
      'verifier': task.complexity > 0.5 ? 'gpt5' : 'gpt5_mini',
      'challenger': 'gpt5_mini',
      'auditor': 'perplexity-sonar-pro',
      'architect': 'grok-4',
      'commit_guardian': 'gemini-2.5-flash'
    };
    
    return taskTypeMap[task.type] || this.selectByConstraints(task, constraints);
  }

  selectByConstraints(task: Task, constraints: Constraints): string {
    let candidates = Array.from(this.models.values());
    
    if (constraints.budget !== undefined) {
      candidates = candidates.filter(m => m.cost <= constraints.budget!);
    }
    
    if (constraints.speed) {
      candidates.sort((a, b) => b.speed - a.speed);
    } else if (constraints.quality) {
      candidates.sort((a, b) => b.quality - a.quality);
    } else {
      candidates.sort((a, b) => {
        const scoreA = (a.quality * 0.4 + a.speed * 0.3 + a.reasoning * 0.3) / a.cost;
        const scoreB = (b.quality * 0.4 + b.speed * 0.3 + b.reasoning * 0.3) / b.cost;
        return scoreB - scoreA;
      });
    }
    
    return candidates[0]?.id || 'gpt5_mini';
  }

  getModelInfo(modelId: string): ModelInfo | undefined {
    return this.models.get(modelId);
  }

  estimateCost(modelId: string, tokens: number): number {
    const model = this.models.get(modelId);
    if (!model) return 0;
    
    const costPerMillion = model.cost;
    return (tokens / 1000000) * costPerMillion;
  }

  selectModelsForVerification(variant: string): string[] {
    const variants: Record<string, string[]> = {
      'quick_verify': ['gpt5_mini', 'gemini-2.5-flash', 'qwen3-30b'],
      'deep_verify': ['gpt5', 'qwq-32b', 'gpt5_reason', 'gemini-2.5-pro', 'qwen3-coder-480b'],
      'fact_check': ['perplexity-sonar-pro', 'gpt5', 'gemini-2.5-pro'],
      'code_verify': ['qwen3-coder-480b', 'gpt5', 'gemini-2.5-pro'],
      'security_verify': ['gpt5', 'qwen3-coder-480b', 'grok-4']
    };

    return variants[variant] || variants['quick_verify'];
  }
}
