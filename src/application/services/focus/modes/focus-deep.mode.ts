/**
 * FocusDeep Mode - Ultimate reasoning combining Sequential Thinking + Multi-Model
 * Extracted from server.ts (Phase 2: SOLID refactoring)
 * Wraps existing focus-deep.ts functionality
 *
 * Supports two modes:
 * - executeNow: false - Returns plan visualization (current behavior)
 * - executeNow: true - Actual execution handled by FocusExecutionService in FocusTool.service.ts
 */

import { IFocusMode, FocusResult } from '../../../../domain/interfaces/IFocusMode.js';
import {
  createFocusDeepPlan,
  generateFocusDeepVisualization
} from '../../../../focus-deep.js';

export class FocusDeepMode implements IFocusMode {
  readonly modeName = 'focus-deep';
  readonly description = 'Ultimate reasoning combining Sequential Thinking + Multi-Model orchestration';
  readonly supportsExecution = true;

  async execute(params: Record<string, unknown>): Promise<FocusResult> {
    const query = params.query as string;
    const domain = params.domain as string | undefined;
    const executeNow = params.executeNow as boolean | undefined;

    // Create the plan (needed for both visualization and execution metadata)
    const plan = createFocusDeepPlan(query, domain);

    // If executeNow is explicitly false, return plan visualization only
    // (executeNow: true is handled by FocusExecutionService in FocusTool.service.ts)
    if (executeNow === false) {
      const viz = generateFocusDeepVisualization(plan);
      return {
        output: viz,
        metadata: {
          mode: this.modeName,
          sessionId: plan.sessionId,
          models: plan.availableModels,
          estimatedThoughts: plan.estimatedThoughts,
          executeNow: false
        }
      };
    }

    // Default: return plan visualization
    // Note: When executeNow is true and FocusExecutionService is available,
    // the request is intercepted by FocusTool.service.ts before reaching here
    const viz = generateFocusDeepVisualization(plan);
    return {
      output: viz,
      metadata: {
        mode: this.modeName,
        sessionId: plan.sessionId,
        models: plan.availableModels,
        estimatedThoughts: plan.estimatedThoughts
      }
    };
  }
}
