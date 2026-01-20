/**
 * FocusExecutionService - Manages focus sessions and step execution
 * Enables executeNow mode for focus tool to actually run model calls
 */

import { randomBytes } from "crypto";
import { ToolExecutionService } from "../../../orchestrators/collaborative/services/tool-execution/ToolExecutionService.js";
import { ReasoningMode } from "../../../reasoning-chain.js";
import { createFocusDeepPlan, generateFocusDeepVisualization } from "../../../focus-deep.js";
import {
  FocusSession,
  FocusStepOutput,
  FocusExecutionResult,
  StartFocusSessionParams,
  SESSION_TIMEOUT_MS,
} from "./types/FocusSession.js";

/**
 * Generate UUID v4 using randomBytes
 */
function generateUUID(): string {
  const bytes = randomBytes(16);
  // Set version (4) and variant bits
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;

  const hex = bytes.toString('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/**
 * FocusExecutionService - Session management and step execution for focus modes
 */
export class FocusExecutionService {
  private sessions: Map<string, FocusSession> = new Map();
  private toolExecutionService: ToolExecutionService;
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor(toolExecutionService?: ToolExecutionService) {
    this.toolExecutionService = toolExecutionService || new ToolExecutionService({ verbose: false });
    // Start cleanup interval
    this.startCleanupInterval();
  }

  /**
   * Start a new focus session and execute the first step
   */
  async startFocusSession(params: StartFocusSessionParams): Promise<FocusExecutionResult> {
    const {
      query,
      mode,
      domain,
      rounds = 5,
      models = [],
      temperature = 0.7,
      maxTokensPerRound = 2000,
      pingPongStyle = "collaborative",
      tokenEfficient = false,
      saveSession = true,
    } = params;

    // Create the focus plan
    const plan = createFocusDeepPlan(query, domain);

    // Create session
    const sessionId = generateUUID();
    const session: FocusSession = {
      sessionId,
      mode,
      query,
      domain,
      currentStepIndex: 0,
      totalSteps: plan.steps.length,
      plan,
      stepOutputs: new Map(),
      status: "running",
      config: {
        rounds,
        models: models.length > 0 ? models : plan.availableModels,
        temperature,
        maxTokensPerRound,
        pingPongStyle,
        tokenEfficient,
        saveSession,
      },
      createdAt: new Date(),
      lastActivityAt: new Date(),
    };

    this.sessions.set(sessionId, session);

    // Execute first step
    return this.executeNextStep(session);
  }

  /**
   * Continue an existing focus session
   */
  async continueFocus(sessionId: string): Promise<FocusExecutionResult> {
    const session = this.sessions.get(sessionId);

    if (!session) {
      return {
        sessionId,
        status: "failed",
        progress: 0,
        output: `Error: Session not found. Session ID: ${sessionId}`,
        hasMoreSteps: false,
        totalSteps: 0,
        currentStep: 0,
      };
    }

    // Check timeout
    if (this.isSessionTimedOut(session)) {
      session.status = "failed";
      session.error = "Session timed out after 30 minutes of inactivity";
      return {
        sessionId,
        status: "failed",
        progress: this.calculateProgress(session),
        output: `Error: ${session.error}`,
        hasMoreSteps: false,
        totalSteps: session.totalSteps,
        currentStep: session.currentStepIndex,
      };
    }

    if (session.status === "completed") {
      return this.buildCompletedResult(session);
    }

    if (session.status === "failed") {
      return {
        sessionId,
        status: "failed",
        progress: this.calculateProgress(session),
        output: `Error: Session failed - ${session.error}`,
        hasMoreSteps: false,
        totalSteps: session.totalSteps,
        currentStep: session.currentStepIndex,
      };
    }

    // Execute next step
    return this.executeNextStep(session);
  }

  /**
   * Get session status without executing
   */
  getSession(sessionId: string): FocusSession | undefined {
    return this.sessions.get(sessionId);
  }

  /**
   * Execute the next step in the session
   */
  private async executeNextStep(session: FocusSession): Promise<FocusExecutionResult> {
    const stepIndex = session.currentStepIndex;
    const step = session.plan.steps[stepIndex];

    if (!step) {
      // No more steps - session complete
      session.status = "completed";
      return this.buildCompletedResult(session);
    }

    const startTime = Date.now();

    try {
      // Build context from previous steps
      const context = this.buildStepContext(session, stepIndex);

      // Build the prompt for this step
      const prompt = this.buildStepPrompt(session, step, context);

      // Execute the step using ToolExecutionService
      const output = await this.toolExecutionService.executeRealTool(
        step.model,
        prompt,
        ReasoningMode.DEEP_REASONING
      );

      const duration = Date.now() - startTime;

      // Store step output
      const stepOutput: FocusStepOutput = {
        stepIndex,
        model: step.model,
        action: step.action,
        output,
        duration,
        timestamp: new Date(),
      };

      session.stepOutputs.set(stepIndex, stepOutput);

      // Move to next step
      session.currentStepIndex++;
      session.lastActivityAt = new Date();

      // Check if we're done
      if (session.currentStepIndex >= session.totalSteps) {
        session.status = "completed";
        return this.buildCompletedResult(session);
      }

      // Return progress result
      return {
        sessionId: session.sessionId,
        status: "running",
        progress: this.calculateProgress(session),
        stepOutput,
        output: this.formatStepOutput(stepOutput, session),
        hasMoreSteps: true,
        totalSteps: session.totalSteps,
        currentStep: session.currentStepIndex,
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      const duration = Date.now() - startTime;

      // Store error output
      const stepOutput: FocusStepOutput = {
        stepIndex,
        model: step.model,
        action: step.action,
        output: "",
        duration,
        timestamp: new Date(),
        error: errorMsg,
      };

      session.stepOutputs.set(stepIndex, stepOutput);
      session.status = "failed";
      session.error = `Step ${stepIndex + 1} failed: ${errorMsg}`;

      return {
        sessionId: session.sessionId,
        status: "failed",
        progress: this.calculateProgress(session),
        stepOutput,
        output: `Error executing step ${stepIndex + 1} (${step.model}:${step.action}): ${errorMsg}`,
        hasMoreSteps: false,
        totalSteps: session.totalSteps,
        currentStep: session.currentStepIndex,
      };
    }
  }

  /**
   * Build context from previous step outputs
   */
  private buildStepContext(session: FocusSession, currentStepIndex: number): string {
    if (currentStepIndex === 0) {
      return "";
    }

    const previousOutputs: string[] = [];
    for (let i = 0; i < currentStepIndex; i++) {
      const output = session.stepOutputs.get(i);
      if (output && !output.error) {
        const step = session.plan.steps[i];
        previousOutputs.push(
          `### Step ${i + 1}: ${step.action} (${step.model})\n${output.output}`
        );
      }
    }

    return previousOutputs.join("\n\n---\n\n");
  }

  /**
   * Build prompt for a specific step
   */
  private buildStepPrompt(
    session: FocusSession,
    step: { model: string; action: string; prompt: string; reasoning?: string },
    previousContext: string
  ): string {
    let prompt = `## Objective\n${session.query}\n\n`;

    if (session.domain) {
      prompt += `## Domain\n${session.domain}\n\n`;
    }

    if (previousContext) {
      prompt += `## Previous Analysis\n${previousContext}\n\n---\n\n`;
    }

    prompt += `## Current Task: ${step.action.toUpperCase()}\n`;
    prompt += `${step.prompt}\n\n`;

    if (step.reasoning) {
      prompt += `**Why this step**: ${step.reasoning}\n\n`;
    }

    prompt += `Please provide your ${step.action} analysis.`;

    return prompt;
  }

  /**
   * Format step output for display
   */
  private formatStepOutput(stepOutput: FocusStepOutput, session: FocusSession): string {
    const step = session.plan.steps[stepOutput.stepIndex];
    const progress = this.calculateProgress(session);

    let output = `## Step ${stepOutput.stepIndex + 1}/${session.totalSteps}: ${step.action.toUpperCase()}\n`;
    output += `**Model**: ${stepOutput.model}\n`;
    output += `**Duration**: ${stepOutput.duration}ms\n`;
    output += `**Progress**: ${progress.toFixed(0)}%\n\n`;

    if (stepOutput.error) {
      output += `### Error\n${stepOutput.error}\n`;
    } else {
      output += `### Output\n${stepOutput.output}\n`;
    }

    output += `\n---\n`;
    output += `Session ID: \`${session.sessionId}\`\n`;
    output += `Use \`continue_focus\` with this session ID to continue.\n`;

    return output;
  }

  /**
   * Build completed session result with summary
   */
  private buildCompletedResult(session: FocusSession): FocusExecutionResult {
    // Collect all outputs
    const allOutputs: FocusStepOutput[] = [];
    for (let i = 0; i < session.totalSteps; i++) {
      const output = session.stepOutputs.get(i);
      if (output) {
        allOutputs.push(output);
      }
    }

    // Build summary output
    let output = `# Focus-Deep Session Complete\n\n`;
    output += `**Objective**: ${session.query}\n`;
    output += `**Mode**: ${session.mode}\n`;
    output += `**Steps Completed**: ${allOutputs.length}/${session.totalSteps}\n\n`;

    // Add each step's output
    output += `## Step-by-Step Analysis\n\n`;
    for (const stepOutput of allOutputs) {
      const step = session.plan.steps[stepOutput.stepIndex];
      output += `### Step ${stepOutput.stepIndex + 1}: ${step.action.toUpperCase()} (${stepOutput.model})\n`;
      output += `*Duration: ${stepOutput.duration}ms*\n\n`;

      if (stepOutput.error) {
        output += `**Error**: ${stepOutput.error}\n\n`;
      } else {
        output += `${stepOutput.output}\n\n`;
      }
      output += `---\n\n`;
    }

    // Add final synthesis prompt
    const lastOutput = allOutputs[allOutputs.length - 1];
    if (lastOutput && !lastOutput.error) {
      output += `## Final Synthesis\n\n`;
      output += `The focus-deep analysis has completed. The final step (${session.plan.steps[lastOutput.stepIndex].action}) provides the synthesized conclusion.\n`;
    }

    return {
      sessionId: session.sessionId,
      status: "completed",
      progress: 100,
      output,
      hasMoreSteps: false,
      totalSteps: session.totalSteps,
      currentStep: session.totalSteps,
      allOutputs,
    };
  }

  /**
   * Calculate session progress percentage
   */
  private calculateProgress(session: FocusSession): number {
    if (session.totalSteps === 0) return 100;
    return (session.currentStepIndex / session.totalSteps) * 100;
  }

  /**
   * Check if session has timed out
   */
  private isSessionTimedOut(session: FocusSession): boolean {
    const now = Date.now();
    const lastActivity = session.lastActivityAt.getTime();
    return now - lastActivity > SESSION_TIMEOUT_MS;
  }

  /**
   * Start interval to clean up timed out sessions
   */
  private startCleanupInterval(): void {
    // Clean up every 5 minutes
    this.cleanupInterval = setInterval(() => {
      this.cleanupTimedOutSessions();
    }, 5 * 60 * 1000);
  }

  /**
   * Clean up timed out sessions
   */
  private cleanupTimedOutSessions(): void {
    const now = Date.now();
    for (const [sessionId, session] of this.sessions) {
      const lastActivity = session.lastActivityAt.getTime();
      if (now - lastActivity > SESSION_TIMEOUT_MS) {
        this.sessions.delete(sessionId);
        console.error(`[FocusExecutionService] Cleaned up timed out session: ${sessionId}`);
      }
    }
  }

  /**
   * Stop the cleanup interval (for testing/shutdown)
   */
  stopCleanup(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }

  /**
   * Get plan-only visualization (for executeNow: false)
   */
  getPlanVisualization(query: string, domain?: string): string {
    const plan = createFocusDeepPlan(query, domain);
    return generateFocusDeepVisualization(plan);
  }
}

// Export singleton instance
export const focusExecutionService = new FocusExecutionService();
