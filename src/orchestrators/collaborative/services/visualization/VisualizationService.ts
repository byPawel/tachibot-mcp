import { IExtendedVisualizationRenderer } from "../../interfaces/IVisualizationRenderer.js";
import { CollaborationSession } from "../../types/session-types.js";
import { ReasoningMode, REASONING_TEMPLATES, MODEL_PERSONAS } from "../../../../reasoning-chain.js";
// import {
//   renderWorkflowCascade,
//   renderProgressReel,
//   renderThinkingChainArbor,
//   renderGradientDivider,
//   renderGradientBorderBox,
//   renderTable,
//   renderKeyValueTable,
//   renderQuickFlow,
//   icons,
//   WorkflowStep,
//   ProgressPhase,
// } from "../../../../utils/ink-renderer.js";
// Ink disabled - using plain text functions
interface WorkflowStep {
  name: string;
  model: string;
  status: 'completed' | 'running' | 'pending';
  duration?: number;
}
interface ProgressPhase {
  name: string;
  status: 'completed' | 'active' | 'pending';
}
const renderWorkflowCascade = (steps: WorkflowStep[], title: string): string => {
  const lines = [`## ${title}`];
  steps.forEach((s, i) => lines.push(`${i + 1}. [${s.status}] ${s.name} (${s.model})`));
  return lines.join('\n');
};
const renderProgressReel = (phases: ProgressPhase[], title: string): string => {
  const lines = [`## ${title}`];
  phases.forEach(p => lines.push(`- [${p.status}] ${p.name}`));
  return lines.join('\n');
};
const renderThinkingChainArbor = (thoughts: { thought: string; model: string; isRevision?: boolean; isBranch?: boolean }[], title: string): string => {
  const lines = [`## ${title}`];
  thoughts.forEach((t, i) => lines.push(`${i + 1}. (${t.model}) ${t.thought}`));
  return lines.join('\n');
};
const renderGradientDivider = (width: number = 50, _preset?: string): string => '-'.repeat(width);
const renderGradientBorderBox = (content: string, _opts?: { width?: number; gradient?: string }): string => {
  return `--- ${content} ---`;
};
const renderTable = (data: Record<string, string>[]): string => {
  if (data.length === 0) return '';
  const keys = Object.keys(data[0]);
  const header = '| ' + keys.join(' | ') + ' |';
  const separator = '|' + keys.map(() => '---').join('|') + '|';
  const rows = data.map(row => '| ' + keys.map(k => row[k] || '').join(' | ') + ' |');
  return [header, separator, ...rows].join('\n');
};
const renderKeyValueTable = (data: Record<string, string | number>): string => {
  return Object.entries(data).map(([k, v]) => `${k}: ${v}`).join('\n');
};
const renderQuickFlow = (steps: string[], title: string): string => {
  return `## ${title}\n${steps.join(' -> ')}`;
};
const icons = {
  brain: '*',
  sparkle: '*',
  workflow: '>',
};

/**
 * Visualization Service - Now with React Ink components!
 * Beautiful terminal visualizations for collaborative reasoning
 */
export class VisualizationService implements IExtendedVisualizationRenderer {
  private modelTurnTaking: boolean;
  private enableVisualization: boolean;

  constructor(options?: {
    modelTurnTaking?: boolean;
    enableVisualization?: boolean;
  }) {
    this.modelTurnTaking = options?.modelTurnTaking ?? true;
    this.enableVisualization = options?.enableVisualization ?? true;
  }

  /**
   * Generate visual orchestration plan using Ink components
   */
  generateOrchestrationPlan(session: CollaborationSession): string {
    const steps = session.chain.steps;
    const lines: string[] = [];

    // Header with gradient border box
    lines.push(renderGradientBorderBox(
      `${icons.brain} Collaborative Reasoning\n\n${session.objective}\n\nDomain: ${session.domain} | Session: ${session.id.slice(0, 8)}`,
      { width: 60, gradient: 'cristal' }
    ));
    lines.push('');

    // Workflow cascade showing model flow
    const cascadeSteps: WorkflowStep[] = steps.map((step, idx) => ({
      name: `${this.getModeIcon(step.mode)} ${step.mode}`,
      model: step.model,
      status: idx < session.currentStep ? 'completed' :
              idx === session.currentStep ? 'running' : 'pending',
      duration: idx < session.currentStep ? 1000 + Math.random() * 2000 : undefined,
    }));

    lines.push(renderWorkflowCascade(cascadeSteps, 'Reasoning Chain'));
    lines.push('');

    // Quick flow diagram
    const flowSteps = steps.map(s => `${s.model}: ${s.mode}`);
    lines.push(renderQuickFlow(flowSteps, 'Execution Flow'));
    lines.push('');

    // Progress reel
    const progressSteps: ProgressPhase[] = steps.map((step, idx) => ({
      name: `${step.model} - ${step.mode}`,
      status: idx < session.currentStep ? 'completed' :
              idx === session.currentStep ? 'active' : 'pending',
    }));
    lines.push(renderProgressReel(progressSteps, 'Step Progress'));
    lines.push('');

    // Detailed steps table
    const tableData = steps.map((step, idx) => {
      const persona = Object.values(MODEL_PERSONAS).find(p => p.model === step.model);
      return {
        '#': String(idx + 1),
        Mode: `${this.getModeIcon(step.mode)} ${step.mode}`,
        Model: step.model,
        Role: persona?.role || 'AI',
        Status: idx < session.currentStep ? '✓' : idx === session.currentStep ? '⟳' : '○',
      };
    });
    lines.push(renderTable(tableData));
    lines.push('');

    // Session info
    lines.push(renderKeyValueTable({
      'Session ID': session.id,
      'Total Steps': String(steps.length),
      'Current Step': String(session.currentStep + 1),
      'Turn Taking': this.modelTurnTaking ? 'Sequential' : 'Parallel',
    }));
    lines.push('');

    lines.push(renderGradientDivider(60, 'rainbow'));

    return lines.join('\n');
  }

  /**
   * Generate progress visualization using Ink
   */
  generateTachiBotVisualization(session: CollaborationSession): string {
    const stage = session.currentStep;
    const totalSteps = session.chain.steps.length;
    const currentStep = session.chain.steps[stage];
    const currentMode = currentStep?.mode || ReasoningMode.BRAINSTORM;

    const lines: string[] = [];

    // Thinking chain visualization
    const thoughts = session.chain.steps.slice(0, stage + 1).map((step, idx) => ({
      thought: `${step.mode}: ${step.prompt.slice(0, 50)}...`,
      model: step.model,
      isRevision: step.mode === ReasoningMode.CRITIQUE,
      isBranch: step.mode === ReasoningMode.DEBATE,
    }));

    if (thoughts.length > 0) {
      lines.push(renderThinkingChainArbor(thoughts, 'Reasoning Progress'));
      lines.push('');
    }

    // Current status with gradient box
    const statusIcon = this.getModeIcon(currentMode);
    const statusText = this.getModeDescription(currentMode);

    lines.push(renderGradientBorderBox(
      `${statusIcon} ${currentMode.toUpperCase()}\n\n${statusText}\n\nModel: ${currentStep?.model || 'pending'}\nProgress: ${stage + 1}/${totalSteps}`,
      { width: 50, gradient: this.getModeGradient(currentMode) }
    ));

    return lines.join('\n');
  }

  /**
   * Get gradient preset for reasoning mode
   */
  private getModeGradient(mode: ReasoningMode): 'cristal' | 'passion' | 'teen' | 'mind' | 'rainbow' {
    const gradients: Record<ReasoningMode, 'cristal' | 'passion' | 'teen' | 'mind' | 'rainbow'> = {
      [ReasoningMode.BRAINSTORM]: 'teen',
      [ReasoningMode.CRITIQUE]: 'passion',
      [ReasoningMode.ENHANCE]: 'cristal',
      [ReasoningMode.VALIDATE]: 'mind',
      [ReasoningMode.SYNTHESIZE]: 'rainbow',
      [ReasoningMode.DEBATE]: 'passion',
      [ReasoningMode.CONSENSUS]: 'teen',
      [ReasoningMode.DEEP_REASONING]: 'mind',
      [ReasoningMode.PINGPONG]: 'cristal',
    };
    return gradients[mode] || 'cristal';
  }

  /**
   * Get description for reasoning mode
   */
  private getModeDescription(mode: ReasoningMode): string {
    const descriptions: Record<ReasoningMode, string> = {
      [ReasoningMode.BRAINSTORM]: 'Generating creative ideas and possibilities',
      [ReasoningMode.CRITIQUE]: 'Analyzing critically, finding flaws and improvements',
      [ReasoningMode.ENHANCE]: 'Building upon and improving existing ideas',
      [ReasoningMode.VALIDATE]: 'Verifying correctness and feasibility',
      [ReasoningMode.SYNTHESIZE]: 'Combining insights into final solution',
      [ReasoningMode.DEBATE]: 'Arguing different perspectives',
      [ReasoningMode.CONSENSUS]: 'Finding common ground between models',
      [ReasoningMode.DEEP_REASONING]: 'Deep analytical thinking',
      [ReasoningMode.PINGPONG]: 'Back-and-forth collaborative refinement',
    };
    return descriptions[mode] || 'Processing...';
  }

  /**
   * Get icon for reasoning mode
   */
  getModeIcon(mode: ReasoningMode): string {
    const modeIcons: Record<ReasoningMode, string> = {
      [ReasoningMode.BRAINSTORM]: "💡",
      [ReasoningMode.CRITIQUE]: "🔍",
      [ReasoningMode.ENHANCE]: "⚡",
      [ReasoningMode.VALIDATE]: "✅",
      [ReasoningMode.SYNTHESIZE]: "🎯",
      [ReasoningMode.DEBATE]: "⚔️",
      [ReasoningMode.CONSENSUS]: "🤝",
      [ReasoningMode.DEEP_REASONING]: "🧠",
      [ReasoningMode.PINGPONG]: "🏓"
    };
    return modeIcons[mode] || "🤖";
  }

  /**
   * Generate example workflows with Ink formatting
   */
  getExampleWorkflows(): string {
    const lines: string[] = [];

    lines.push(renderGradientBorderBox(
      `${icons.sparkle} Example Workflows\n\nReady-to-use collaborative reasoning patterns`,
      { width: 60, gradient: 'rainbow' }
    ));
    lines.push('');

    const examples = [
      { mode: 'deep-reasoning', desc: 'Multi-model deep analysis', example: 'Design a distributed cache system' },
      { mode: 'architecture-debate', desc: 'Architectural decisions', example: 'Microservices vs Monolith' },
      { mode: 'algorithm-optimize', desc: 'Algorithm improvement', example: 'Optimize graph traversal' },
      { mode: 'security-audit', desc: 'Security review', example: 'Review auth system' },
      { mode: 'debug-detective', desc: 'Debug complex issues', example: 'Memory leak in React app' },
      { mode: 'performance-council', desc: 'Performance tuning', example: 'Optimize DB queries' },
    ];

    const tableData = examples.map(e => ({
      Mode: e.mode,
      Description: e.desc,
      Example: e.example,
    }));

    lines.push(renderTable(tableData));
    lines.push('');

    // Quick usage
    lines.push(renderKeyValueTable({
      'Usage': 'focus({ mode: "deep-reasoning", query: "your question" })',
      'List modes': 'focus({ mode: "list-templates" })',
    }));

    lines.push('');
    lines.push(renderGradientDivider(60, 'cristal'));

    return lines.join('\n');
  }

  /**
   * Get available templates with Ink table
   */
  getAvailableTemplates(): string {
    const lines: string[] = [];

    lines.push(renderGradientBorderBox(
      `${icons.workflow} Available Templates\n\nPre-built reasoning chains for common tasks`,
      { width: 60, gradient: 'mind' }
    ));
    lines.push('');

    const tableData = Object.entries(REASONING_TEMPLATES).map(([key, template]) => ({
      Key: key,
      Name: template.name,
      Steps: String(template.chain.length),
      Models: Array.from(new Set(template.chain.map(s => s.model))).slice(0, 3).join(', '),
    }));

    lines.push(renderTable(tableData));
    lines.push('');
    lines.push(renderGradientDivider(60, 'teen'));

    return lines.join('\n');
  }

  /**
   * Update settings
   */
  updateSettings(options: {
    modelTurnTaking?: boolean;
    enableVisualization?: boolean;
  }): void {
    if (options.modelTurnTaking !== undefined) {
      this.modelTurnTaking = options.modelTurnTaking;
    }
    if (options.enableVisualization !== undefined) {
      this.enableVisualization = options.enableVisualization;
    }
  }
}

// Singleton instance
export const visualizationService = new VisualizationService();
