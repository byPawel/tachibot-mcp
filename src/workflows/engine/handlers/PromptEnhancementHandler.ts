/**
 * Prompt Enhancement Handler
 * Wraps PromptEngineer to enhance step prompts before tool invocation
 * Subscribes to workflow.tool.before_invoke events
 */

import { WorkflowEventBus, WorkflowEvents } from '../events/WorkflowEventBus.js';
import { PromptEngineer, EnhancementContext } from '../../../prompt-engineer.js';
import { WorkflowStep } from '../../workflow-types.js';
import { ToolResult } from '../../../types.js';

// Workflow step input type (from WorkflowStepSchema)
export type StepInput = string | Record<string, unknown>;

export interface ToolBeforeInvokeEvent {
  stepName: string;
  tool: string;
  input: StepInput;
  context: {
    step: WorkflowStep;
    variables: Record<string, unknown>;
    accumulatedResults?: ToolResult[];
    // NEW: Enhanced context for Phase 3
    stepIndex?: number;
    totalSteps?: number;
    workflowName?: string;
  };
}

export class PromptEnhancementHandler {
  private eventBus: WorkflowEventBus;
  private promptEngineer: PromptEngineer;
  private enhancedSteps: Set<string> = new Set(); // Track enhanced steps to prevent double-enhancement

  constructor(eventBus: WorkflowEventBus) {
    this.eventBus = eventBus;
    this.promptEngineer = new PromptEngineer();

    // Subscribe to before_invoke events
    this.eventBus.subscribe(
      WorkflowEvents.TOOL_BEFORE_INVOKE,
      this.handleBeforeInvoke.bind(this)
    );
  }

  private async handleBeforeInvoke(event: ToolBeforeInvokeEvent): Promise<void> {
    const { tool, input, context } = event;
    const { step } = context;

    // Check if already enhanced (prevent double-enhancement)
    if (this.enhancedSteps.has(step.name)) {
      return;
    }

    // Check if step has promptTechnique specified
    const technique = step.promptTechnique;
    if (!technique) {
      // No enhancement needed
      return;
    }

    // Mark as enhanced
    this.enhancedSteps.add(step.name);

    try {
      // Extract the query/prompt from input
      const query = this.extractQuery(input);
      if (!query) {
        console.error(`[PromptEnhancement] No query found in input for step ${step.name}`);
        return;
      }

      // Get accumulated results for context (legacy)
      const previousResults = event.context.accumulatedResults || [];

      // Build EnhancementContext (NEW - Phase 3)
      const enhancementContext: EnhancementContext = {
        stepNumber: context.stepIndex !== undefined ? context.stepIndex + 1 : undefined,
        totalSteps: context.totalSteps,
        workflowName: context.workflowName,
        previousSteps: previousResults.map((result, idx) => ({
          name: result.tool || `step-${idx}`,  // ToolResult has 'tool' not 'step'
          output: result.output,
          technique: undefined  // Not tracked yet
        })),
        workflowVariables: context.variables,
        targetModel: tool
      };

      // Apply prompt engineering technique with enhanced context
      const enhancedPrompt = this.promptEngineer.applyTechnique(
        tool,
        technique,
        query,
        previousResults,  // Legacy - still pass for backwards compat
        enhancementContext  // NEW - rich context
      );

      // Update the input with enhanced prompt
      this.updateInputWithEnhancedPrompt(input, enhancedPrompt);

      // Log enhancement
      const description = this.promptEngineer.getTechniqueDescription(technique);
      console.error(
        `[PromptEnhancement] Applied "${description}" to ${step.name} (${tool})`
      );

      // Publish enhancement event
      await this.eventBus.publish('workflow.prompt.enhanced', {
        stepName: step.name,
        technique,
        originalQuery: query.substring(0, 100),
        enhancedLength: enhancedPrompt.length
      });

    } catch (error) {
      console.error(`[PromptEnhancement] Error enhancing prompt for ${step.name}:`, error);
      // Non-fatal - continue with original prompt
    }
  }

  /**
   * Extract query/prompt from various input formats
   */
  private extractQuery(input: StepInput): string | null {
    if (typeof input === 'string') {
      return input;
    }

    // Try common field names
    const record = input as Record<string, unknown>;
    const query =
      record.query ||
      record.prompt ||
      record.thought ||
      record.problem ||
      record.topic ||
      record.content;

    return typeof query === 'string' ? query : null;
  }

  /**
   * Update input object with enhanced prompt
   */
  private updateInputWithEnhancedPrompt(input: StepInput, enhancedPrompt: string): void {
    if (typeof input === 'string') {
      // Can't modify string input - this shouldn't happen as we'd extract query first
      return;
    }

    const record = input as Record<string, unknown>;

    // Update the field that contained the query
    if (record.query !== undefined) record.query = enhancedPrompt;
    else if (record.prompt !== undefined) record.prompt = enhancedPrompt;
    else if (record.thought !== undefined) record.thought = enhancedPrompt;
    else if (record.problem !== undefined) record.problem = enhancedPrompt;
    else if (record.topic !== undefined) record.topic = enhancedPrompt;
    else if (record.content !== undefined) record.content = enhancedPrompt;
  }
}
