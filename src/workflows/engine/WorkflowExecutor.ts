/**
 * Workflow Executor
 * Handles the main workflow execution logic
 * Extracted from CustomWorkflowEngine to reduce file size
 */

import * as path from 'path';
import { promises as fsPromises } from 'fs';
import { SessionLogger } from '../../session/session-logger.js';
import { generateWorkflowId } from '../../utils/timestamp-formatter.js';
import { loadConfig } from '../../config.js';
import { WorkflowEventBus } from './events/WorkflowEventBus.js';
import { VariableInterpolator } from './VariableInterpolator.js';
import { StepParameterResolver } from './StepParameterResolver.js';
import { WorkflowFileManager } from './WorkflowFileManager.js';
import { WorkflowOutputFormatter } from './WorkflowOutputFormatter.js';
import { AutoSynthesizer } from './AutoSynthesizer.js';
import { WorkflowHelpers } from './WorkflowHelpers.js';
import type { Workflow, WorkflowStep } from '../workflow-types.js';

export interface ExecutionRecord {
  workflowName: string;
  workflowId?: string;
  outputDir?: string;
  startTime: Date;
  endTime?: Date;
  status: 'running' | 'completed' | 'failed';
  cost: number;
  outputs: Array<{
    step: string;
    input?: string;
    output: string;
    filePath?: string;
  }>;
}

export interface FileReference {
  id: string;
  stepName: string;
  summary: string;
  filePath: string | null;
  sizeBytes: number;
  getContent: () => Promise<string>;
  _inMemoryContent?: string;
}

export interface WorkflowManifest {
  workflowId: string;
  workflowName: string;
  startTime: string;
  endTime: string | null;
  status: 'running' | 'completed' | 'failed';
  query: string;
  steps: Array<{
    id: string;
    status: 'running' | 'completed' | 'failed';
    outputFile?: string;
    error?: string;
    timestamp: string;
  }>;
}

export interface ExecutionOptions {
  variables?: Record<string, string | number | boolean>;
  dryRun?: boolean;
  truncateSteps?: boolean;
  maxStepTokens?: number;
}

export class WorkflowExecutor {
  private sessionLogger: SessionLogger;
  private eventBus: WorkflowEventBus;
  private variableInterpolator: VariableInterpolator;
  private stepParameterResolver: StepParameterResolver;
  private fileManager: WorkflowFileManager;
  private outputFormatter: WorkflowOutputFormatter;
  private autoSynthesizer: AutoSynthesizer;

  // Callback for tool invocation (injected from CustomWorkflowEngine)
  private callToolFn: (
    toolName: string,
    input: string | Record<string, any>,
    options: { model?: string; maxTokens?: number; temperature?: number; skipValidation?: boolean }
  ) => Promise<{ result: string; modelUsed: string }>;

  constructor(
    sessionLogger: SessionLogger,
    eventBus: WorkflowEventBus,
    variableInterpolator: VariableInterpolator,
    stepParameterResolver: StepParameterResolver,
    fileManager: WorkflowFileManager,
    outputFormatter: WorkflowOutputFormatter,
    autoSynthesizer: AutoSynthesizer,
    callToolFn: any
  ) {
    this.sessionLogger = sessionLogger;
    this.eventBus = eventBus;
    this.variableInterpolator = variableInterpolator;
    this.stepParameterResolver = stepParameterResolver;
    this.fileManager = fileManager;
    this.outputFormatter = outputFormatter;
    this.autoSynthesizer = autoSynthesizer;
    this.callToolFn = callToolFn;
  }

  async execute(
    workflow: Workflow,
    input: string,
    options?: ExecutionOptions
  ): Promise<string | Record<string, unknown>> {
    // Generate unique workflow ID
    const workflowId = generateWorkflowId();

    // Setup output directory
    const config = loadConfig();
    const baseOutputDir = config.workflow.outputDir;
    const outputDir = path.join(process.cwd(), baseOutputDir, workflow.name, workflowId);

    // Initialize execution tracking
    const execution: ExecutionRecord = {
      workflowName: workflow.name,
      workflowId,
      outputDir,
      startTime: new Date(),
      status: 'running',
      cost: 0,
      outputs: []
    };

    // Start session logging
    const sessionId = await this.sessionLogger.startSession(
      `workflow-${workflow.name}`,
      input,
      workflow.name
    );
    console.error(`\n📝 Session log: .workflow-sessions/${sessionId}.md`);
    console.error(`   To monitor progress: tail -f .workflow-sessions/${sessionId}.md\n`);

    // Merge variables
    const variables: Record<string, any> = {
      ...workflow.variables,
      ...options?.variables,
      input,
      query: input
    };
    console.error(`🔍 Workflow variables initialized:`, JSON.stringify(variables, null, 2));

    // Calculate step numbers
    const stepNumbers = WorkflowHelpers.calculateStepNumbers(workflow);
    console.error(
      `📊 Step numbering calculated:`,
      Array.from(stepNumbers.entries())
        .map(([name, num]) => `${num}: ${name}`)
        .join(', ')
    );

    // Execute steps
    const stepOutputs: Record<string, FileReference> = {};
    let previousOutput: string = input;

    // Initialize output directory if needed
    const needsFileOutput = workflow.steps.some((s) => s.saveToFile);
    if (needsFileOutput) {
      try {
        await fsPromises.mkdir(outputDir, { recursive: true });

        const manifest: WorkflowManifest = {
          workflowId,
          workflowName: workflow.name,
          startTime: new Date().toISOString(),
          endTime: null,
          status: 'running',
          query: input,
          steps: []
        };

        await fsPromises.writeFile(
          path.join(outputDir, 'manifest.json'),
          JSON.stringify(manifest, null, 2)
        );

        console.error(`📁 Workflow output directory: ${outputDir}`);
      } catch (error) {
        console.error('⚠️  Failed to initialize workflow directory:', error);
      }
    }

    try {
      // Execute all steps
      for (let i = 0; i < workflow.steps.length; i++) {
        const step = workflow.steps[i];

        // Delegate to step execution (will be extracted further)
        const result = await this.executeStep(
          step,
          i,
          workflow,
          variables,
          stepOutputs,
          previousOutput,
          execution,
          options
        );

        if (result) {
          previousOutput = result.output;
          if (result.fileRef) {
            stepOutputs[step.name] = result.fileRef;
          }
        }
      }

      execution.status = 'completed';
      execution.endTime = new Date();

      // End session
      const sessionFile = await this.sessionLogger.endSession(true);
      console.error(`\n✅ Workflow complete! Full session saved to: ${sessionFile}\n`);

      // Format output
      return this.outputFormatter.format(
        execution,
        workflow.output?.format || 'summary',
        options?.truncateSteps ?? workflow.output?.truncateSteps ?? true,
        options?.maxStepTokens ?? workflow.output?.maxStepTokens ?? 2500
      );
    } catch (error) {
      execution.status = 'failed';
      execution.endTime = new Date();
      await this.sessionLogger.endSession(true);
      throw error;
    }
  }

  private async executeStep(
    step: WorkflowStep,
    index: number,
    workflow: Workflow,
    variables: Record<string, any>,
    stepOutputs: Record<string, FileReference>,
    previousOutput: string,
    execution: ExecutionRecord,
    options?: ExecutionOptions
  ): Promise<{ output: string; fileRef?: FileReference } | null> {
    // This will be extracted further in next iteration
    // For now, just return null to indicate "not yet implemented"
    return null;
  }
}
