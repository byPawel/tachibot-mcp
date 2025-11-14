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
            maxTokens: 500,
          },
          {
            name: "GPT-5 Creative",
            tool: "gpt5_mini",
            input: { prompt: "Build on previous ideas with creative twists" },
          },
          {
            name: "Perplexity Research",
            tool: "perplexity_research",
            input: { prompt: "Find real-world examples and evidence" },
          },
          {
            name: "Final Synthesis",
            tool: "focus",
            input: { prompt: "Combine all ideas into top 5 recommendations" },
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
   * Start workflow step-by-step (stub - needs implementation)
   */
  async startWorkflowStepByStep(
    workflowName: string,
    query: string,
    options?: {
      variables?: Record<string, string | number | boolean>;
    }
  ): Promise<{ sessionId: string; firstStepResult: string }> {
    throw new Error("Step-by-step execution not yet implemented in refactored engine");
  }

  /**
   * Continue workflow from session (stub - needs implementation)
   */
  async continueWorkflow(sessionId: string): Promise<string> {
    throw new Error("Continue workflow not yet implemented in refactored engine");
  }
}

// Export singleton
export const workflowEngine = new CustomWorkflowEngine();
