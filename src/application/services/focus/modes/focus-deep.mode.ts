/**
 * FocusDeep Mode - Ultimate reasoning combining Sequential Thinking + Multi-Model
 * Extracted from server.ts (Phase 2: SOLID refactoring)
 * Wraps existing focus-deep.ts functionality
 */

import { IFocusMode, FocusResult } from '../../../../domain/interfaces/IFocusMode.js';
import {
  createFocusDeepPlan,
  generateFocusDeepVisualization
} from '../../../../focus-deep.js';

export class FocusDeepMode implements IFocusMode {
  readonly modeName = 'focus-deep';
  readonly description = 'Ultimate reasoning combining Sequential Thinking + Multi-Model orchestration';

  async execute(params: Record<string, unknown>): Promise<FocusResult> {
    const query = params.query as string;
    const domain = params.domain as string | undefined;

    const plan = createFocusDeepPlan(query, domain);
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
