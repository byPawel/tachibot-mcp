/**
 * Interface for workflow file management
 * Handles file references, output saving, and manifest updates
 */

import { FileReference } from './IVariableInterpolator.js';

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

export interface CreateFileReferenceOptions {
  stepName: string;
  content: string;
  workflowId: string;
  workflowName: string;
  saveToFile: boolean;
  outputDir?: string;
  stepNumber?: string;  // e.g., "1", "4a", "4b"
  modelName?: string;   // e.g., "gemini-2.5-flash"
}

export interface IWorkflowFileManager {
  /**
   * Creates a file reference for step output
   * Handles file saving or in-memory storage based on options
   * @param options - File reference creation options
   * @returns FileReference with lazy loading capability
   */
  createFileReference(
    options: CreateFileReferenceOptions
  ): Promise<FileReference>;

  /**
   * Initializes output directory for workflow execution
   * Creates directory structure and manifest.json
   * @param workflowName - Name of the workflow
   * @param workflowId - Unique ID for this execution
   * @param query - Input query/prompt
   * @returns Path to output directory
   */
  initializeOutputDirectory(
    workflowName: string,
    workflowId: string,
    query: string
  ): Promise<string>;

  /**
   * Updates workflow manifest with step status
   * @param outputDir - Path to workflow output directory
   * @param stepId - Step identifier
   * @param status - Step execution status
   * @param outputFile - Optional path to output file
   * @param error - Optional error message
   */
  updateManifest(
    outputDir: string,
    stepId: string,
    status: 'running' | 'completed' | 'failed',
    outputFile?: string,
    error?: string
  ): Promise<void>;

  /**
   * Extracts a summary from content (first 200 chars)
   * @param content - Full content string
   * @returns Summary string
   */
  extractSummary(content: string): string;
}
