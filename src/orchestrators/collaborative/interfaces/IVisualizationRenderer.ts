import { CollaborationSession } from "../types/session-types.js"; // ✅ Break circular dependency
import { ReasoningMode } from "../../../reasoning-chain.js";

/**
 * Visualization Renderer Interface
 * Handles rendering of orchestration plans, progress, and TachiBot visualizations
 */
export interface IVisualizationRenderer {
  /**
   * Generate visual orchestration plan for a session
   */
  generateOrchestrationPlan(session: CollaborationSession): string;

  /**
   * Generate TachiBot visualization for current session state
   */
  generateTachiBotVisualization(session: CollaborationSession): string;

  /**
   * Get icon for a reasoning mode
   */
  getModeIcon(mode: ReasoningMode): string;
}

/**
 * Extended renderer with additional utility methods
 */
export interface IExtendedVisualizationRenderer extends IVisualizationRenderer {
  /**
   * Get example workflow demonstrations
   */
  getExampleWorkflows(): string;

  /**
   * Get available reasoning templates
   */
  getAvailableTemplates(): string;
}
