/**
 * Workflow validator MCP tool
 */

import { z } from 'zod';
import { workflowValidator } from '../validators/workflow-validator.js';
import { defineModelTool } from './factory/define-model-tool.js';
import { PROVIDER_GROUPS, ALWAYS_ON_TOOLS } from './provider-catalog.js';

// Get all registered tools from the server
// We'll treat ALL known tools as "enabled" for validation purposes
// The tool validator will distinguish between "unknown" (error) and "disabled" (warning)
function getAllKnownTools(): Set<string> {
  // Registered tools come from the provider catalog (same source as doctor/tachi),
  // so new tools are known here without a second hand-kept list. The hard-coded
  // names are workflow-only aliases/modes that tool-mapper.ts has explicit cases
  // for. ('pingpong' used to be listed but was never a tool — steps using it
  // silently ran GPT codex-mini; tool-mapper now rejects unknown names.)
  return new Set([
    ...PROVIDER_GROUPS.flatMap((g) => g.tools),
    ...ALWAYS_ON_TOOLS,
    'think', 'focus', 'nextThought',
    'perplexity_research', 'perplexity_code_search',
    'grok', 'grok_heavy', 'gemini_query',
    'gpt5', 'gpt5_mini', 'gpt5_analyze', 'openai_analyze',
    'verifier', 'scout', 'challenger', 'auditor', 'commit_guardian', 'architect',
    'code_reviewer', 'test_architect', 'documentation_writer',
    'workflow', 'list_workflows', 'create_workflow', 'visualize_workflow',
  ]);
}

export const validateWorkflowTool = defineModelTool({
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
});

export const validateWorkflowFileTool = defineModelTool({
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
});
