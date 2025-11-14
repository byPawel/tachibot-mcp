/**
 * Auto-Synthesizer
 * Automatically summarizes large workflow outputs to bypass MCP 25k token limit
 */

import {
  IAutoSynthesizer,
  SynthesisContext
} from './interfaces/IAutoSynthesizer.js';
import { Workflow, WorkflowStep } from '../workflow-types.js';

export class AutoSynthesizer implements IAutoSynthesizer {
  /**
   * Determines if auto-synthesis should run
   */
  shouldSynthesize(
    workflow: Workflow,
    accumulatedResults: any[],
    currentStepIndex: number
  ): boolean {
    // Check if auto-synthesis is enabled
    const autoSynthesis = workflow.settings?.autoSynthesis;
    if (!autoSynthesis?.enabled) {
      return false;
    }

    // Check if any step up to current has saveToFile: true
    const hasSaveToFile = workflow.steps
      .slice(0, currentStepIndex + 1)
      .some((step) => step.saveToFile === true);

    // Estimate total tokens accumulated
    const totalTokens = this.estimateTotalTokens(accumulatedResults);

    // Trigger if:
    // 1. Any step saves to file (indicates large/important outputs), OR
    // 2. Total tokens exceed threshold
    const shouldTrigger =
      hasSaveToFile || totalTokens >= (autoSynthesis.tokenThreshold ?? 20000);

    return shouldTrigger;
  }

  /**
   * Creates a synthesis step that summarizes all previous outputs
   */
  createSynthesisStep(
    context: SynthesisContext
  ): WorkflowStep {
    const { workflow, variables, sessionDir } = context;
    const autoSynthesis = workflow.settings?.autoSynthesis;
    const synthesisTool = autoSynthesis?.synthesisTool ?? 'gemini_analyze_text';
    const maxTokens = autoSynthesis?.synthesisMaxTokens ?? 6000;

    // Collect all step outputs (variable names)
    const stepOutputs = workflow.steps
      .filter((step) => step.output?.variable)
      .map((step) => step.output?.variable)
      .filter((varName): varName is string => varName !== undefined);

    // Build text parameter with all outputs
    const allOutputsText = stepOutputs
      .map((varName) => `${variables[varName] ?? ''}`)
      .join('\n\n');

    // Build list of saved files if applicable
    const savedFiles = sessionDir
      ? workflow.steps
          .filter((step) => step.saveToFile)
          .map((step) => `- ${step.name}.md`)
          .join('\n')
      : '';

    const fileNote = savedFiles
      ? `\n\nNote: Full outputs saved to ${sessionDir}/\nFiles:\n${savedFiles}\n\nEnd with: "Use Read tool on saved files for full detailed analysis."`
      : '';

    // Create synthesis task instruction
    const synthesisTask = `Synthesize all workflow outputs into executive summary:

1. Key findings (brief, top 3-5 points)
2. Main insights or patterns discovered
3. Critical issues or challenges identified
4. Recommended next steps with priorities
5. Overall assessment${fileNote}

Keep under 2000 words for Claude Code.`;

    // Create the synthesis step
    const synthesisStep: WorkflowStep = {
      name: 'auto-synthesis',
      tool: synthesisTool,
      input: {
        text: allOutputsText,
        task: synthesisTask,
      },
      maxTokens,
      output: {
        variable: 'executive_summary',
      },
    };

    return synthesisStep;
  }

  /**
   * Estimates total tokens across accumulated results
   */
  estimateTotalTokens(results: any[]): number {
    let total = 0;
    for (const result of results) {
      total += this.estimateTokens(result);
    }
    return total;
  }

  /**
   * Estimate token count for any data type
   * Uses character-based approximation: tokens ≈ characters / 4
   */
  private estimateTokens(data: any): number {
    const text = typeof data === 'string' ? data : JSON.stringify(data);
    return Math.ceil(text.length / 4);
  }
}
