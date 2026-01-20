/**
 * FocusSession Types - Type definitions for Focus execution sessions
 * Supports step-by-step execution of focus plans with session management
 */

import { FocusDeepPlan } from "../../../../focus-deep.js";

/**
 * Output from a single focus step execution
 */
export interface FocusStepOutput {
  stepIndex: number;
  model: string;
  action: string;
  output: string;
  duration: number;
  timestamp: Date;
  error?: string;
}

/**
 * Focus session status
 */
export type FocusSessionStatus = 'running' | 'completed' | 'failed' | 'paused';

/**
 * Focus session configuration from parameters
 */
export interface FocusSessionConfig {
  rounds: number;
  models: string[];
  temperature: number;
  maxTokensPerRound: number;
  pingPongStyle: 'competitive' | 'collaborative' | 'debate' | 'build-upon';
  tokenEfficient: boolean;
  saveSession: boolean;
}

/**
 * Focus session - manages state for step-by-step focus execution
 */
export interface FocusSession {
  /** UUID v4 session identifier */
  sessionId: string;

  /** Focus mode being executed */
  mode: string;

  /** Original query/objective */
  query: string;

  /** Optional domain context */
  domain?: string;

  /** Current step being executed (0-indexed) */
  currentStepIndex: number;

  /** Total number of steps in the plan */
  totalSteps: number;

  /** The focus plan being executed */
  plan: FocusDeepPlan;

  /** Outputs from completed steps */
  stepOutputs: Map<number, FocusStepOutput>;

  /** Current session status */
  status: FocusSessionStatus;

  /** Session configuration from parameters */
  config: FocusSessionConfig;

  /** Session creation timestamp */
  createdAt: Date;

  /** Last activity timestamp (for timeout) */
  lastActivityAt: Date;

  /** Optional error message if status is 'failed' */
  error?: string;
}

/**
 * Parameters for starting a focus session
 */
export interface StartFocusSessionParams {
  query: string;
  mode: string;
  domain?: string;
  context?: string;
  rounds?: number;
  models?: string[];
  temperature?: number;
  maxTokensPerRound?: number;
  pingPongStyle?: 'competitive' | 'collaborative' | 'debate' | 'build-upon';
  tokenEfficient?: boolean;
  saveSession?: boolean;
}

/**
 * Result from starting or continuing a focus session
 */
export interface FocusExecutionResult {
  /** Session ID for continuation */
  sessionId: string;

  /** Current session status */
  status: FocusSessionStatus;

  /** Progress indicator (0-100) */
  progress: number;

  /** Output from the current/latest step */
  stepOutput?: FocusStepOutput;

  /** Formatted output string for display */
  output: string;

  /** Whether more steps remain */
  hasMoreSteps: boolean;

  /** Total steps in the session */
  totalSteps: number;

  /** Current step index */
  currentStep: number;

  /** All step outputs so far (for final summary) */
  allOutputs?: FocusStepOutput[];
}

/**
 * Session timeout configuration
 */
export const SESSION_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes
