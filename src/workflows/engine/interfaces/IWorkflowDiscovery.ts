/**
 * Interface for workflow discovery and loading
 */

import { Workflow } from '../../workflow-types.js';

export interface ValidationError {
  file: string;
  source: string;
  error: string;
}

export interface WorkflowDiscoveryResult {
  workflows: Map<string, Workflow>;
  errors: ValidationError[];
}

export interface IWorkflowDiscovery {
  /**
   * Discover and load workflows from all configured locations
   * @returns Map of workflows and validation errors
   */
  discoverWorkflows(): WorkflowDiscoveryResult;

  /**
   * Load a single workflow from file path
   * @param filePath - Absolute or relative path to workflow file
   * @returns Parsed and validated workflow
   */
  loadWorkflowFile(filePath: string): Workflow;
}
