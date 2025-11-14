/**
 * Workflow Type Definitions
 * Extracted from custom-workflows.ts to break circular dependencies
 */

import { z } from "zod";

// ═══════════════════════════════════════════════════════════════════════════
// Workflow Step Schema
// ═══════════════════════════════════════════════════════════════════════════

export const WorkflowStepSchema = z.object({
  name: z.string(),
  tool: z.string(), // Tool name or model name
  input: z
    .union([
      z.string(),
      z.record(z.any()), // Allow any object with any fields
    ])
    .optional(),
  model: z.string().optional(), // Override model selection (supports ${variable})
  maxTokens: z.union([z.number(), z.string()]).optional(), // Accepts number OR "${variable}"
  temperature: z.union([z.number(), z.string()]).optional(), // Accepts number OR "${variable}"
  condition: z
    .object({
      if: z.string().optional(), // Condition expression
      skip: z.boolean().optional(),
      failOnError: z.boolean().optional(),
    })
    .optional(),
  parallel: z.boolean().optional(), // Run in parallel with next step
  dependsOn: z.array(z.string()).optional(), // Step dependencies for parallel execution
  retry: z
    .object({
      attempts: z.number().default(3),
      backoff: z.number().default(1000),
    })
    .optional(),
  output: z
    .object({
      save: z.boolean().optional(),
      format: z.enum(["text", "json", "markdown"]).optional(),
      variable: z.string().optional(), // Save to variable for later use
    })
    .optional(),
  saveToFile: z.boolean().optional(), // Save step output to file
  loadFiles: z.array(z.string()).optional(), // Load previous step files
  promptTechnique: z.string().optional(), // Prompt engineering technique to apply
});

// ═══════════════════════════════════════════════════════════════════════════
// Complete Workflow Schema
// ═══════════════════════════════════════════════════════════════════════════

export const WorkflowSchema = z.object({
  name: z.string(),
  description: z.string().optional(),
  version: z.string().default("1.0"),

  // Global settings
  settings: z
    .object({
      maxCost: z.number().optional(), // Max cost in dollars
      maxTime: z.number().optional(), // Max time in seconds
      defaultModel: z.string().optional(),
      optimization: z
        .object({
          enabled: z.boolean().default(true),
          cacheResults: z.boolean().default(true),
          compressPrompts: z.boolean().default(true),
          smartRouting: z.boolean().default(true),
        })
        .optional(),
      autoSynthesis: z
        .object({
          enabled: z.boolean().default(false),
          tokenThreshold: z.number().optional(),
          synthesisTool: z.string().optional(),
          synthesisMaxTokens: z.number().optional(),
          checkpointInterval: z.number().optional(),
          maxRetries: z.number().optional(),
          logLevel: z.enum(['silent', 'error', 'info']).optional(),
        })
        .optional(),
    })
    .optional(),

  // Variables that can be used in steps
  variables: z.record(z.any()).optional(),

  // The workflow steps
  steps: z.array(WorkflowStepSchema),

  // Post-processing
  output: z
    .object({
      format: z.enum(["summary", "detailed", "json"]).default("summary"),
      saveToFile: z.string().optional(),
      notifications: z.array(z.string()).optional(),
      truncateSteps: z.boolean().optional(),
      maxStepTokens: z.number().optional(),
    })
    .optional(),
});

// ═══════════════════════════════════════════════════════════════════════════
// Inferred Types
// ═══════════════════════════════════════════════════════════════════════════

export type WorkflowStep = z.infer<typeof WorkflowStepSchema>;
export type Workflow = z.infer<typeof WorkflowSchema>;

// ═══════════════════════════════════════════════════════════════════════════
// Runtime Types
// ═══════════════════════════════════════════════════════════════════════════

/** FileReference for lazy-loaded step outputs */
export interface FileReference {
  id: string;
  stepName: string;
  summary: string;
  filePath: string | null;
  sizeBytes: number;
  getContent: () => Promise<string>;
  _inMemoryContent?: string;
}

/** Workflow manifest for tracking execution */
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

/** Execution record for workflow history */
export interface ExecutionRecord {
  workflowName: string;
  workflowId: string;
  outputDir: string;
  startTime: Date;
  endTime?: Date;
  status: "running" | "completed" | "failed";
  cost: number;
  outputs: Array<{
    step: string;
    input?: string;
    output: string;
    filePath?: string;
  }>;
}
