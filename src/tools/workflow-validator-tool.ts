/**
 * Workflow validator MCP tool
 */

import { z } from 'zod';
import { workflowValidator } from '../validators/workflow-validator.js';

// Get all registered tools from the server
// We'll treat ALL known tools as "enabled" for validation purposes
// The tool validator will distinguish between "unknown" (error) and "disabled" (warning)
function getAllKnownTools(): Set<string> {
  // Return all known tool names
  return new Set([
    // Core
    'think', 'focus', 'nextThought',
    // Perplexity
    'perplexity_ask', 'perplexity_reason', 'perplexity_research',
    // Grok
    'grok_reason', 'grok_code', 'grok_debug', 'grok_architect', 'grok_brainstorm', 'grok_search',
    // OpenAI
    'openai_brainstorm', 'openai_reason', 'openai_code_review', 'openai_explain',
    // Gemini
    'gemini_brainstorm', 'gemini_analyze_code', 'gemini_analyze_text',
    // Qwen
    'qwen_coder',
    // Kimi
    'kimi_thinking',
    // Advanced modes
    'verifier', 'scout', 'challenger', 'hunter',
    // Workflow
    'workflow', 'list_workflows', 'create_workflow', 'visualize_workflow',
    // Collaborative
    'pingpong', 'qwen_competitive'
  ]);
}

export const validateWorkflowTool = {
  name: 'validate_workflow',
  description: `Validates workflow YAML/JSON files for correctness.

Checks:
- Valid YAML/JSON syntax
- Interpolation references (\${step.output}, \${variable}) point to valid steps/variables
- Tool names exist and are enabled in tools.config.json
- No circular dependencies in step execution order
- Variable names follow snake_case convention

Returns detailed error messages with suggestions for fixing issues.`,
  parameters: z.object({
    workflowContent: z.string()
      .describe('The YAML or JSON content of the workflow to validate'),
    isJson: z.boolean()
      .optional()
      .default(false)
      .describe('Set to true if the content is JSON instead of YAML'),
    format: z.enum(['text', 'json'])
      .optional()
      .default('text')
      .describe('Output format: "text" for human-readable, "json" for structured data')
  }),
  execute: async (args: { workflowContent: string; isJson?: boolean; format?: 'text' | 'json' }) => {
    try {
      const result = await workflowValidator.validate(
        args.workflowContent,
        args.isJson || false,
        getAllKnownTools()
      );

      if (args.format === 'json') {
        return workflowValidator.formatResultsJSON(result);
      } else {
        return workflowValidator.formatResults(result);
      }
    } catch (error: any) {
      return `❌ Validation error: ${error.message}`;
    }
  }
};

export const validateWorkflowFileTool = {
  name: 'validate_workflow_file',
  description: `Validates a workflow file from the filesystem.

Checks:
- Valid YAML/JSON syntax
- Interpolation references (\${step.output}, \${variable}) point to valid steps/variables
- Tool names exist and are enabled in tools.config.json
- No circular dependencies in step execution order
- Variable names follow snake_case convention

Returns detailed error messages with suggestions for fixing issues.`,
  parameters: z.object({
    filePath: z.string()
      .describe('Path to the workflow file (YAML or JSON)'),
    format: z.enum(['text', 'json'])
      .optional()
      .default('text')
      .describe('Output format: "text" for human-readable, "json" for structured data')
  }),
  execute: async (args: { filePath: string; format?: 'text' | 'json' }) => {
    try {
      const result = await workflowValidator.validateFile(args.filePath, getAllKnownTools());

      if (args.format === 'json') {
        return workflowValidator.formatResultsJSON(result);
      } else {
        return workflowValidator.formatResults(result);
      }
    } catch (error: any) {
      return `❌ Validation error: ${error.message}`;
    }
  }
};
