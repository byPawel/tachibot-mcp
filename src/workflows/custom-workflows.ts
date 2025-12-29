/**
 * Custom Workflow System - User-configurable workflows with YAML/JSON support
 * Part of TachiBot's extensibility features
 *
 * This file now delegates to engine modules for better maintainability.
 */

import * as fs from "fs";
import * as path from "path";
import * as yaml from "yaml";
import { costMonitor } from "../optimization/cost-monitor.js";
import { randomUUID } from "crypto";

// Load workflow limits from config
function loadWorkflowLimits(): { stepTokenLimit: number; minLimit: number; maxLimit: number } {
  const configPath = path.join(path.dirname(new URL(import.meta.url).pathname), '../../config/workflow-limits.json');
  try {
    if (fs.existsSync(configPath)) {
      const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
      return {
        stepTokenLimit: config.stepTokenLimit || 6400,
        minLimit: config.minLimit || 1000,
        maxLimit: config.maxLimit || 50000,
      };
    }
  } catch (e) {
    console.error('[WorkflowLimits] Failed to load config, using defaults');
  }
  return { stepTokenLimit: 6400, minLimit: 1000, maxLimit: 50000 };
}

const WORKFLOW_LIMITS = loadWorkflowLimits();

/**
 * Session for step-by-step workflow execution
 */
export interface WorkflowSession {
  sessionId: string;
  workflowName: string;
  workflow: Workflow;
  currentStepIndex: number;
  totalSteps: number;
  variables: Record<string, string | number | boolean | null>;
  stepOutputs: Record<string, FileReference>;
  previousOutput: string;
  startTime: number;
  updatedAt: number;
  outputDir: string;
  status: 'running' | 'completed' | 'failed';
  error?: {
    code: string;
    message: string;
    stepIndex?: number;
  };
}

// Session management constants (no magic numbers)
const SESSION_TIMEOUT_MS = 30 * 60 * 1000;           // 30 minutes - session expiry
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000;           // 5 minutes - cleanup check interval
const COMPLETED_SESSION_RETENTION_MS = 5 * 60 * 1000; // 5 minutes - keep completed sessions for status checks

/**
 * Validate session ID format (UUID v4)
 */
function isValidSessionId(sessionId: string): boolean {
  return /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(sessionId);
}

/**
 * Simple async lock for session operations (prevents race conditions)
 */
class SessionLock {
  private locks: Map<string, Promise<void>> = new Map();
  private resolvers: Map<string, () => void> = new Map();

  async acquire(sessionId: string): Promise<() => void> {
    // Wait for any existing lock
    while (this.locks.has(sessionId)) {
      await this.locks.get(sessionId);
    }

    // Create new lock
    let release: () => void;
    const lockPromise = new Promise<void>(resolve => {
      release = resolve;
    });
    this.locks.set(sessionId, lockPromise);
    this.resolvers.set(sessionId, release!);

    // Return release function
    return () => {
      this.locks.delete(sessionId);
      this.resolvers.delete(sessionId);
      release!();
    };
  }

  /**
   * Clear all locks (for cleanup)
   */
  clear(): void {
    // Resolve all pending locks to prevent hanging
    for (const resolver of this.resolvers.values()) {
      try {
        resolver();
      } catch {
        // Ignore errors during cleanup
      }
    }
    this.locks.clear();
    this.resolvers.clear();
  }
}

// Import shared types (breaks circular dependency)
import {
  WorkflowSchema,
  WorkflowStepSchema,
  type Workflow,
  type WorkflowStep,
  type FileReference,
  type WorkflowManifest,
  type ExecutionRecord
} from "./workflow-types.js";

// Re-export types for backward compatibility
export type { Workflow, WorkflowStep, FileReference, WorkflowManifest, ExecutionRecord };
export { WorkflowSchema, WorkflowStepSchema };

// Import engine modules
import { VariableInterpolator } from "./engine/VariableInterpolator.js";
import { StepParameterResolver } from "./engine/StepParameterResolver.js";
import { WorkflowHelpers } from "./engine/WorkflowHelpers.js";
import { WorkflowDiscovery } from "./engine/WorkflowDiscovery.js";
import { WorkflowFileManager } from "./engine/WorkflowFileManager.js";
import { WorkflowOutputFormatter } from "./engine/WorkflowOutputFormatter.js";
import { AutoSynthesizer } from "./engine/AutoSynthesizer.js";
import { executeWorkflowImpl } from "./engine/WorkflowExecutionEngine.js";
import { WorkflowEventBus } from "./engine/events/WorkflowEventBus.js";
import { SessionPersistenceHandler } from "./engine/handlers/SessionPersistenceHandler.js";
import { PromptEnhancementHandler } from "./engine/handlers/PromptEnhancementHandler.js";
import { ErrorRecoveryHandler } from "./engine/handlers/ErrorRecoveryHandler.js";
import { StepExecutionHandler } from "./engine/handlers/StepExecutionHandler.js";
import { ToolInvocationHandler } from "./engine/handlers/ToolInvocationHandler.js";
import { WorkflowStateMachine } from "./engine/state/WorkflowStateMachine.js";

export class CustomWorkflowEngine {
  private workflows: Map<string, Workflow> = new Map();
  private executionHistory: ExecutionRecord[] = [];

  // Session management for step-by-step execution
  public sessions: Map<string, WorkflowSession> = new Map();
  private sessionLock: SessionLock = new SessionLock();
  private cleanupIntervalRef: ReturnType<typeof setInterval> | null = null;

  // Engine modules
  private variableInterpolator: VariableInterpolator;
  private parameterResolver: StepParameterResolver;
  private fileManager: WorkflowFileManager;
  private outputFormatter: WorkflowOutputFormatter;
  private autoSynthesizer: AutoSynthesizer;
  public eventBus: WorkflowEventBus;
  public stateMachine: WorkflowStateMachine;

  // Event handlers
  public promptEnhancer: PromptEnhancementHandler;
  public errorRecovery: ErrorRecoveryHandler;
  public stepExecutor: StepExecutionHandler;
  public toolInvoker: ToolInvocationHandler;

  constructor() {
    // Initialize engine modules
    this.variableInterpolator = new VariableInterpolator();
    this.parameterResolver = new StepParameterResolver();
    this.fileManager = new WorkflowFileManager();
    this.outputFormatter = new WorkflowOutputFormatter();
    this.autoSynthesizer = new AutoSynthesizer();
    this.eventBus = new WorkflowEventBus();
    this.stateMachine = new WorkflowStateMachine();

    // Initialize event handlers (Phase 3: Full event-driven architecture)
    this.promptEnhancer = new PromptEnhancementHandler(this.eventBus);
    this.errorRecovery = new ErrorRecoveryHandler(this.eventBus);
    this.stepExecutor = new StepExecutionHandler(this.eventBus, this.stateMachine);
    this.toolInvoker = new ToolInvocationHandler(this.eventBus);

    console.error('[CustomWorkflowEngine] Phase 3 handlers initialized:');
    console.error('  ✓ PromptEnhancementHandler - 13 prompt engineering techniques');
    console.error('  ✓ ErrorRecoveryHandler - Circuit breaker pattern');
    console.error('  ✓ StepExecutionHandler - Step lifecycle tracking');
    console.error('  ✓ ToolInvocationHandler - Tool execution coordination');
    console.error('  ℹ Progress tracking: manifest.json in workflow-output/');

    // Load workflows
    this.loadBuiltInWorkflows();
    this.loadUserWorkflows();

    // Start session cleanup interval (stored for proper cleanup)
    this.cleanupIntervalRef = setInterval(() => this.cleanupStaleSessions(), CLEANUP_INTERVAL_MS);
    console.error('  ✓ Session cleanup interval started (5 min)');
  }

  /**
   * Load built-in workflow templates
   */
  private loadBuiltInWorkflows() {
    const builtInWorkflows: Workflow[] = [
      {
        name: "code-review",
        description: "Comprehensive code review with multiple perspectives",
        version: "1.0",
        settings: {
          maxCost: 0.5,
          optimization: {
            enabled: true,
            cacheResults: true,
            compressPrompts: true,
            smartRouting: true,
          },
        },
        steps: [
          {
            name: "Initial Analysis",
            tool: "gemini_analyze_code",
            input: { prompt: "Analyze this code for issues and improvements" },
            output: { variable: "initial_analysis" },
          },
          {
            name: "Security Check",
            tool: "verifier",
            input: {
              prompt: "Check for security vulnerabilities",
              previousStep: "initial_analysis",
            },
            parallel: true,
          },
          {
            name: "Performance Review",
            tool: "gemini_analyze_code", // Use Gemini for performance analysis
            input: {
              prompt: "Analyze performance of: ${input}"
            },
            parallel: true,
          },
          {
            name: "Best Practices",
            tool: "code_reviewer",
            input: { prompt: "Evaluate against best practices" },
          },
          {
            name: "Synthesis",
            tool: "gpt5_analyze",
            input: {
              prompt: "Synthesize all findings into actionable recommendations",
              context: "Combine all previous analyses",
            },
          },
        ],
      },
      {
        name: "brainstorm",
        description: "Multi-model brainstorming session",
        version: "1.0",
        settings: {
          maxCost: 1.0,
          defaultModel: "gpt-5-mini",
        },
        steps: [
          {
            name: "Gemini Ideas",
            tool: "gemini_brainstorm",
            input: { prompt: "${query}" },
            maxTokens: 500,
          },
          {
            name: "GPT-5 Creative",
            tool: "gpt5_mini",
            input: { prompt: "Build on these ideas with creative twists for: ${query}\n\nPrevious ideas: ${Gemini Ideas.output}" },
          },
          {
            name: "Perplexity Research",
            tool: "perplexity_research",
            input: { prompt: "Find real-world examples and evidence for: ${query}" },
          },
          {
            name: "Final Synthesis",
            tool: "focus",
            input: { prompt: "Synthesize all brainstorming results into top 5 creative recommendations for: ${query}\n\nIdeas to combine:\n${Gemini Ideas.output}\n${GPT-5 Creative.output}\n${Perplexity Research.output}" },
          },
        ],
      },
      {
        name: "debug-assistant",
        description: "Multi-stage debugging helper",
        version: "1.0",
        steps: [
          {
            name: "Error Analysis",
            tool: "grok_debug",
            input: {
              prompt: "Analyze the error message and stack trace: ${input}"
            },
            output: { variable: "error_analysis" },
          },
          {
            name: "Code Context",
            tool: "grok_code",
            input: {
              prompt: "Analyze the code path leading to this error",
              previousStep: "error_analysis",
            },
          },
          {
            name: "Solution Search",
            tool: "perplexity_code_search",
            input: { prompt: "Find solutions for similar errors" },
            parallel: true,
          },
          {
            name: "Fix Suggestion",
            tool: "gpt5_mini",
            input: {
              prompt: "Suggest specific code fixes",
              context: "Based on all previous analysis",
            },
          },
        ],
      },
    ];

    for (const workflow of builtInWorkflows) {
      this.workflows.set(workflow.name, workflow);
    }
  }

  /**
   * Load user-defined workflows from config directory
   * Delegates to WorkflowDiscovery for multi-location workflow loading
   */
  private loadUserWorkflows() {
    const packageRoot = WorkflowDiscovery.getPackageRoot();
    const discovery = new WorkflowDiscovery({
      packageRoot,
      workflowSchema: WorkflowSchema,
      preprocessVariables: this.preprocessWorkflowVariables.bind(this),
    });

    const { workflows, errors } = discovery.discoverWorkflows();

    // Merge discovered workflows
    for (const [name, workflow] of workflows.entries()) {
      this.workflows.set(name, workflow);
    }

    // Log validation errors if any
    if (errors.length > 0) {
      console.error(`⚠️  ${errors.length} workflow validation error(s):`);
      for (const error of errors) {
        console.error(`   [${error.source}] ${error.file}: ${error.error}`);
      }
    }
  }

  /**
   * Pre-process workflow to interpolate initial variables (load-time)
   * This resolves ${variable} references from the variables: section
   */
  private preprocessWorkflowVariables(
    obj: any,
    variables: Record<string, any>,
  ): any {
    if (typeof obj === "string") {
      // Check if this string contains ${variable} references
      if (!obj.includes("${")) {
        return obj; // No interpolation needed
      }

      // Interpolate ${variable} references
      const interpolated = obj.replace(/\${([^}]+)}/g, (match, key) => {
        const value = variables[key];
        if (value === undefined) {
          return match; // Keep unresolved for runtime (e.g., ${step_output})
        }

        // Return the actual value, preserving its type
        // If the entire string is just "${variable}", return the raw value (number stays number)
        // Otherwise convert to string for concatenation
        return value;
      });

      // If the ENTIRE string was just "${variable}", return the value with its original type
      const singleVarMatch = obj.match(/^\${([^}]+)}$/);
      if (singleVarMatch) {
        const value = variables[singleVarMatch[1]];
        return value !== undefined ? value : obj; // Preserve number type!
      }

      return interpolated;
    }
    if (Array.isArray(obj)) {
      return obj.map((item) =>
        this.preprocessWorkflowVariables(item, variables),
      );
    }
    if (obj && typeof obj === "object") {
      const result: any = {};
      for (const [key, value] of Object.entries(obj)) {
        if (key === "variables") {
          // Don't interpolate variable definitions themselves
          result[key] = value;
        } else {
          result[key] = this.preprocessWorkflowVariables(value, variables);
        }
      }
      return result;
    }
    return obj;
  }

  /**
   * Execute a workflow by name
   * Delegates to WorkflowExecutionEngine for the actual execution logic
   */
  async executeWorkflow(
    workflowName: string,
    input: string,
    options?: {
      variables?: Record<string, string | number | boolean>;
      dryRun?: boolean;
      truncateSteps?: boolean;
      maxStepTokens?: number;
    },
  ): Promise<string | Record<string, unknown>> {
    const workflow = this.workflows.get(workflowName);
    if (!workflow) {
      throw new Error(`Workflow '${workflowName}' not found`);
    }

    // Check cost limit
    const maxCost = workflow.settings?.maxCost || 10.0;
    const costCheck = await costMonitor.checkRequest("workflow", 1000);
    if (!costCheck.allowed) {
      throw new Error(`Cost limit would be exceeded: ${costCheck.warning}`);
    }

    // Delegate to execution engine
    return executeWorkflowImpl(this, workflowName, input, options);
  }

  /**
   * Helper to evaluate conditions - delegates to WorkflowHelpers
   */
  evaluateCondition(
    condition: string,
    variables: Record<string, any>,
    outputs: Record<string, any>,
  ): boolean {
    const context = { ...variables, ...outputs };
    return WorkflowHelpers.evaluateCondition(condition, context);
  }

  /**
   * Helper to interpolate variables in strings - delegates to VariableInterpolator
   */
  async interpolateVariables(
    template: string,
    variables: Record<string, any>,
    stepOutputs: Record<string, FileReference>,
  ): Promise<string> {
    return this.variableInterpolator.interpolate(template, {
      variables,
      stepOutputs: new Map(Object.entries(stepOutputs)),
      fileReferences: new Map(Object.entries(stepOutputs)),
    });
  }

  /**
   * Resolve step parameters at runtime - delegates to StepParameterResolver
   */
  resolveStepParameters(
    step: WorkflowStep,
    variables: Record<string, any>,
    stepOutputs: Record<string, FileReference>,
  ): { model?: string; temperature?: number; maxTokens?: number } {
    return this.parameterResolver.resolve(step, {
      variables,
      stepOutputs,
    });
  }

  /**
   * Call a tool - now integrated with actual MCP tools!
   */
  async callTool(
    toolName: string,
    input:
      | string
      | { prompt?: string; context?: string; previousStep?: string },
    options: { model?: string; maxTokens?: number; temperature?: number; skipValidation?: boolean },
  ): Promise<{ result: string; modelUsed: string }> {
    // Import tool mapper dynamically to avoid circular dependencies
    const { executeWorkflowTool } = await import("./tool-mapper.js");

    console.error(`Calling ${toolName} with`, { input, options });

    // Execute the actual tool - returns { result, modelUsed }
    return await executeWorkflowTool(toolName, input, options);
  }

  /**
   * Format workflow output - delegates to WorkflowOutputFormatter
   */
  formatOutput(
    execution: ExecutionRecord,
    format: 'summary' | 'detailed' | 'json',
    truncateSteps: boolean = true,
    maxStepTokens: number = 2500
  ): string | Record<string, unknown> {
    return this.outputFormatter.format(execution, format, truncateSteps, maxStepTokens);
  }

  /**
   * Create FileReference for step output - delegates to WorkflowFileManager
   */
  async createFileReference(
    stepName: string,
    content: string,
    workflowId: string,
    workflowName: string,
    saveToFile: boolean,
    outputDir: string,
    stepNumber?: string,
    modelName?: string
  ): Promise<FileReference> {
    return this.fileManager.createFileReference({
      stepName,
      content,
      workflowId,
      workflowName,
      saveToFile,
      outputDir,
      stepNumber,
      modelName
    });
  }

  /**
   * Extract input summary for logging
   */
  extractInputSummary(input: string | Record<string, any>): string {
    if (typeof input === 'string') {
      return input.length > 200 ? input.substring(0, 200) + '...' : input;
    }
    return JSON.stringify(input).substring(0, 200) + '...';
  }

  /**
   * Calculate step numbers for display - delegates to WorkflowHelpers
   */
  calculateStepNumbers(workflow: Workflow): Map<string, string> {
    return WorkflowHelpers.calculateStepNumbers(workflow);
  }

  /**
   * Estimate total tokens - delegates to AutoSynthesizer
   */
  estimateTotalTokens(results: any[]): number {
    return this.autoSynthesizer.estimateTotalTokens(results);
  }

  /**
   * Check if auto-synthesis should run - delegates to AutoSynthesizer
   */
  shouldAutoSynthesize(
    workflow: Workflow,
    accumulatedResults: any[],
    currentStepIndex: number
  ): boolean {
    return this.autoSynthesizer.shouldSynthesize(workflow, accumulatedResults, currentStepIndex);
  }

  /**
   * Create synthesis step - delegates to AutoSynthesizer
   */
  createSynthesisStep(
    workflow: Workflow,
    variables: Record<string, any>,
    sessionDir?: string
  ): WorkflowStep {
    return this.autoSynthesizer.createSynthesisStep({
      workflow,
      variables,
      sessionDir: sessionDir || null
    });
  }

  /**
   * Create checkpoint (stub for now)
   */
  async createCheckpoint(
    workflowName: string,
    outputDir: string,
    variables: Record<string, any>,
    stepIndex: number
  ): Promise<void> {
    // Implementation to be added if needed
  }

  /**
   * Delete checkpoint (stub for now)
   */
  async deleteCheckpoint(outputDir: string): Promise<void> {
    // Implementation to be added if needed
  }

  /**
   * List available workflows
   */
  listWorkflows(): Array<{
    name: string;
    description?: string;
    steps: number;
  }> {
    return Array.from(this.workflows.values()).map((w) => ({
      name: w.name,
      description: w.description,
      steps: w.steps.length,
    }));
  }

  /**
   * Get workflow definition
   */
  getWorkflow(name: string): Workflow | undefined {
    return this.workflows.get(name);
  }

  /**
   * Save a new workflow
   */
  async saveWorkflow(
    workflow: Workflow,
    format: "yaml" | "json" = "yaml",
  ): Promise<void> {
    const dir = path.join(process.cwd(), ".tachi", "workflows");
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    const filename = `${workflow.name}.${format}`;
    const filepath = path.join(dir, filename);

    const content =
      format === "json"
        ? JSON.stringify(workflow, null, 2)
        : yaml.stringify(workflow);

    fs.writeFileSync(filepath, content);
    this.workflows.set(workflow.name, workflow);

    console.log(`✅ Saved workflow: ${workflow.name} to ${filepath}`);
  }

  /**
   * Load and execute workflow from file (stub - needs implementation)
   */
  async loadAndExecuteWorkflowFile(
    filePath: string,
    query: string,
    options?: {
      variables?: Record<string, string | number | boolean>;
      dryRun?: boolean;
      truncateSteps?: boolean;
      maxStepTokens?: number;
    }
  ): Promise<string | Record<string, unknown>> {
    // Load workflow from file
    const discovery = new WorkflowDiscovery({
      packageRoot: WorkflowDiscovery.getPackageRoot(),
      workflowSchema: WorkflowSchema,
      preprocessVariables: this.preprocessWorkflowVariables.bind(this),
    });

    const workflow = discovery.loadWorkflowFile(filePath);

    // Temporarily add to workflows map
    this.workflows.set(workflow.name, workflow);

    // Execute it
    return this.executeWorkflow(workflow.name, query, options);
  }

  /**
   * Get validation errors from workflow loading (stub)
   */
  getValidationErrors(): Array<{ file: string; source: string; error: string }> {
    // TODO: Implement validation error tracking
    return [];
  }

  /**
   * Start workflow step-by-step execution
   * Returns sessionId for continuation and first step result
   */
  async startWorkflowStepByStep(
    workflowName: string,
    query: string,
    options?: {
      variables?: Record<string, string | number | boolean>;
    }
  ): Promise<{
    sessionId: string;
    step: number;
    totalSteps: number;
    stepName: string;
    output: string;
    hasMore: boolean;
    duration: number;
  }> {
    const workflow = this.workflows.get(workflowName);
    if (!workflow) {
      throw new Error(`Workflow '${workflowName}' not found`);
    }

    // Generate session ID and output directory
    const sessionId = randomUUID();
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const outputDir = path.join(process.cwd(), 'workflow-output', workflowName, timestamp);

    // Create output directory
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    // Validate session ID format
    if (!isValidSessionId(sessionId)) {
      throw new Error(`Invalid session ID format: ${sessionId}`);
    }

    const now = Date.now();

    // Initialize session with proper typing
    const session: WorkflowSession = {
      sessionId,
      workflowName,
      workflow,
      currentStepIndex: 0,
      totalSteps: workflow.steps.length,
      variables: { query, ...options?.variables } as Record<string, string | number | boolean | null>,
      stepOutputs: {},
      previousOutput: '',
      startTime: now,
      updatedAt: now,
      outputDir,
      status: 'running',
    };

    // Store session
    this.sessions.set(sessionId, session);

    // Execute first step
    return this.executeCurrentStep(session);
  }

  /**
   * Continue workflow from session - executes next step
   * Uses session lock to prevent race conditions from concurrent calls
   */
  async continueWorkflow(sessionId: string): Promise<{
    sessionId: string;
    step: number;
    totalSteps: number;
    stepName: string;
    output: string;
    hasMore: boolean;
    duration: number;
  }> {
    // Validate session ID format (before acquiring lock)
    if (!isValidSessionId(sessionId)) {
      throw new Error(`Invalid session ID format: ${sessionId}`);
    }

    // Acquire lock to prevent concurrent access to same session
    const releaseLock = await this.sessionLock.acquire(sessionId);

    try {
      const session = this.sessions.get(sessionId);
      if (!session) {
        throw new Error(`Session '${sessionId}' not found. It may have completed or expired.`);
      }

      // Check for session timeout
      const now = Date.now();
      if (now - session.updatedAt > SESSION_TIMEOUT_MS) {
        this.sessions.delete(sessionId);
        throw new Error(`Session '${sessionId}' has expired (30 minute timeout).`);
      }

      // Update last accessed time
      session.updatedAt = now;

      if (session.status !== 'running') {
        throw new Error(`Session '${sessionId}' is ${session.status}, cannot continue.`);
      }

      // Move to next step (atomic within lock)
      session.currentStepIndex++;
      session.updatedAt = Date.now();

      // Check if workflow is complete (all steps executed)
      if (session.currentStepIndex >= session.totalSteps) {
        session.status = 'completed';
        const duration = Date.now() - session.startTime;

        // Generate final summary
        const summary = await this.generateWorkflowSummary(session);

        // Schedule session cleanup (use constant)
        setTimeout(() => this.sessions.delete(sessionId), COMPLETED_SESSION_RETENTION_MS);

        return {
          sessionId,
          step: session.totalSteps,
          totalSteps: session.totalSteps,
          stepName: 'Summary',
          output: summary,
          hasMore: false,
          duration,
        };
      }

      // Execute the current step (index already incremented)
      return this.executeCurrentStep(session);
    } finally {
      // Always release lock, even on error
      releaseLock();
    }
  }

  /**
   * Check if value is a plain object (not Array, Date, RegExp, Function, etc.)
   * Handles Object.create(null) and {} / new Object()
   */
  private isPlainObject(value: any): boolean {
    if (typeof value !== 'object' || value === null) {
      return false;
    }
    const proto = Object.getPrototypeOf(value);
    return proto === null || proto === Object.prototype;
  }

  /**
   * Deep recursive interpolation - handles nested objects, arrays, and parallel execution
   * Uses isPlainObject to skip Date, RegExp, Function, Map, Set, Buffer, etc.
   * Includes circular reference detection via WeakSet (throws error on cycle)
   * 10/10 implementation per Qwen/Gemini review
   */
  private async interpolateDeep(
    target: any,
    variables: Record<string, any>,
    stepOutputs: Record<string, FileReference>,
    visited: WeakSet<object> = new WeakSet()
  ): Promise<any> {
    // 1. String: interpolate variables
    if (typeof target === 'string') {
      return this.interpolateVariables(target, variables, stepOutputs);
    }

    // 2. Primitives, null, undefined: return as-is
    if (typeof target !== 'object' || target === null) {
      return target;
    }

    // 3. Circular reference check - throw error (invalid for workflow configs)
    if (visited.has(target)) {
      throw new Error('Circular reference detected in workflow input interpolation');
    }
    visited.add(target);

    // 4. Array: recursively interpolate each element in parallel
    if (Array.isArray(target)) {
      return Promise.all(
        target.map(item => this.interpolateDeep(item, variables, stepOutputs, visited))
      );
    }

    // 5. Plain object: recursively interpolate all properties in parallel
    if (this.isPlainObject(target)) {
      const entries = Object.entries(target);
      const interpolatedEntries = await Promise.all(
        entries.map(async ([key, val]) => {
          const interpolatedVal = await this.interpolateDeep(val, variables, stepOutputs, visited);
          return [key, interpolatedVal] as const;
        })
      );
      return Object.fromEntries(interpolatedEntries);
    }

    // 6. Pass-through for Date, RegExp, Function, Map, Set, etc.
    return target;
  }

  /**
   * Execute the current step in a session
   */
  private async executeCurrentStep(session: WorkflowSession): Promise<{
    sessionId: string;
    step: number;
    totalSteps: number;
    stepName: string;
    output: string;
    hasMore: boolean;
    duration: number;
  }> {
    const stepStartTime = Date.now();
    const step = session.workflow.steps[session.currentStepIndex];
    const stepNumber = session.currentStepIndex + 1;

    try {
      // Deep interpolate step input - handles strings, objects, arrays, nested structures
      // Uses Promise.all for parallel interpolation of object properties/array elements
      let toolInput = await this.interpolateDeep(step.input, session.variables, session.stepOutputs);

      // Add previous output context if available
      if (session.previousOutput && typeof step.input === 'object' && step.input?.previousStep) {
        if (typeof toolInput === 'string') {
          toolInput = `${toolInput}\n\nPrevious step output:\n${session.previousOutput}`;
        } else if (this.isPlainObject(toolInput)) {
          toolInput.previousStepOutput = session.previousOutput;
        }
      }

      // Execute the tool
      const maxTokens = typeof step.maxTokens === 'number' ? step.maxTokens : 4000;
      const { result, modelUsed } = await this.callTool(step.tool, toolInput, {
        maxTokens,
      });

      // Create file reference for full output
      const fileRef = await this.createFileReference(
        step.name,
        result,
        session.sessionId,
        session.workflowName,
        true,
        session.outputDir,
        String(stepNumber),
        modelUsed
      );

      // Store step output
      session.stepOutputs[step.name] = fileRef;
      session.previousOutput = result;

      // Store in variable if specified
      if (step.output?.variable) {
        session.variables[step.output.variable] = result;
      }

      // Truncate output for display (configurable limit)
      const displayOutput = this.truncateForDisplay(result, WORKFLOW_LIMITS.stepTokenLimit);

      const duration = Date.now() - stepStartTime;

      return {
        sessionId: session.sessionId,
        step: stepNumber,
        totalSteps: session.totalSteps,
        stepName: step.name,
        output: displayOutput,
        hasMore: session.currentStepIndex < session.totalSteps - 1,
        duration,
      };
    } catch (error: any) {
      session.status = 'failed';
      session.error = {
        code: 'STEP_EXECUTION_FAILED',
        message: error.message || 'Unknown error occurred',
        stepIndex: session.currentStepIndex,
      };
      session.updatedAt = Date.now();
      throw new Error(`Step '${step.name}' failed: ${error.message}`);
    }
  }

  /**
   * Generate workflow summary after all steps complete
   */
  private async generateWorkflowSummary(session: WorkflowSession): Promise<string> {
    const stepSummaries: string[] = [];

    for (const [stepName, fileRef] of Object.entries(session.stepOutputs)) {
      const content = await fileRef.getContent();
      const firstLines = content.split('\n').slice(0, 5).join('\n');
      stepSummaries.push(`### ${stepName}\n${firstLines}${content.length > 500 ? '\n...(truncated)' : ''}`);
    }

    const duration = ((Date.now() - session.startTime) / 1000).toFixed(1);

    return `# Workflow Complete: ${session.workflowName}

**Duration:** ${duration}s
**Steps:** ${session.totalSteps}

## Step Summaries

${stepSummaries.join('\n\n')}

---
Full outputs saved to: ${session.outputDir}`;
  }

  /**
   * Truncate output for display while preserving useful content
   * Uses configurable token limit (default 6400 tokens ≈ 25600 chars)
   */
  private truncateForDisplay(content: string, tokenLimit: number = 6400): string {
    // Rough estimate: 1 token ≈ 4 characters
    const charLimit = tokenLimit * 4;

    if (content.length <= charLimit) {
      return content;
    }

    // Truncate with ellipsis
    return content.substring(0, charLimit - 50) + '\n\n...(truncated, full output saved to file)';
  }

  /**
   * Get token limit from config
   */
  getStepTokenLimit(): number {
    return WORKFLOW_LIMITS.stepTokenLimit;
  }

  /**
   * Cleanup stale sessions (called periodically)
   * Removes sessions that have exceeded the timeout
   */
  cleanupStaleSessions(): number {
    const now = Date.now();
    const expiredSessionIds: string[] = [];

    for (const [sessionId, session] of this.sessions.entries()) {
      if (now - session.updatedAt > SESSION_TIMEOUT_MS) {
        expiredSessionIds.push(sessionId);
      }
    }

    for (const sessionId of expiredSessionIds) {
      this.sessions.delete(sessionId);
    }

    if (expiredSessionIds.length > 0) {
      console.error(`[WorkflowEngine] Cleaned up ${expiredSessionIds.length} stale sessions`);
    }

    return expiredSessionIds.length;
  }

  /**
   * Get session by ID (with timeout check)
   */
  getSession(sessionId: string): WorkflowSession | undefined {
    if (!isValidSessionId(sessionId)) {
      return undefined;
    }

    const session = this.sessions.get(sessionId);
    if (session && Date.now() - session.updatedAt > SESSION_TIMEOUT_MS) {
      this.sessions.delete(sessionId);
      return undefined;
    }

    return session;
  }

  /**
   * Destroy the workflow engine (cleanup resources)
   * Call this when shutting down the server
   */
  destroy(): void {
    // Clear cleanup interval
    if (this.cleanupIntervalRef) {
      clearInterval(this.cleanupIntervalRef);
      this.cleanupIntervalRef = null;
    }

    // Clear session locks (resolve pending locks to prevent hanging)
    this.sessionLock.clear();

    // Clear all sessions
    this.sessions.clear();

    console.error('[WorkflowEngine] Destroyed - cleanup interval cleared, locks released, sessions cleared');
  }
}

// Export singleton
export const workflowEngine = new CustomWorkflowEngine();
