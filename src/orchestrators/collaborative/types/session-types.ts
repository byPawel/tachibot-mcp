/**
 * Shared types for Collaborative Orchestrator
 * Extracted to break circular dependency between CollaborativeOrchestrator and VisualizationService
 */

import { ReasoningChainConfig, TechnicalDomain, ModelResponse } from '../../../reasoning-chain.js';

export type { ModelResponse }; // Re-export for convenience

export interface CollaborationSession {
  id: string;
  domain: TechnicalDomain;
  objective: string;
  chain: ReasoningChainConfig;
  responses: ModelResponse[];
  currentStep: number;
  status: "active" | "completed" | "paused";
  startTime: Date;
  metadata?: Record<string, any>;
  modelOverrides?: Record<string, string>; // Allow model overrides
}

export interface OrchestrationResult {
  session: CollaborationSession;
  finalSynthesis: string;
  modelContributions: Map<string, string[]>;
  consensusScore?: number;
  insights: string[];
  actionItems: string[];
}
