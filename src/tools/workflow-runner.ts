/**
 * Workflow Runner Tool - Execute custom workflows via MCP
 */

import { z } from 'zod';
import { FastMCP } from 'fastmcp';
import { workflowEngine } from '../workflows/custom-workflows.js';
import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'yaml';
import { isToolEnabled } from '../utils/tool-config.js';

/**
 * Register workflow tools with the MCP server
 */
export function registerWorkflowTools(server: FastMCP) {
  const tools = [];

  // Tool to execute workflows (by name or from file)
  tools.push({
    name: 'workflow',
    description: 'Execute workflows',
    parameters: z.object({
      name: z.string().optional(),
      file: z.string().optional(),
      query: z.string(),
      projectPath: z.string().optional(),
      truncateSteps: z.boolean().optional(),
      maxStepTokens: z.number().optional(),
    }),
    execute: async (args: { name?: string; file?: string; query: string; projectPath?: string; truncateSteps?: boolean; maxStepTokens?: number }) => {
      try {
        // Validation: must specify exactly one
        if (!args.name && !args.file) {
          return "❌ Error: Must specify either 'name' or 'file' parameter\n\nExamples:\n  workflow --name code-review --query 'input'\n  workflow --file ./custom.yaml --query 'input'";
        }
        if (args.name && args.file) {
          return "❌ Error: Cannot use both 'name' and 'file' parameters\n\nUse one or the other.";
        }

        let result;

        if (args.file) {
          // File-based execution (ad-hoc)
          console.error(`🚀 Executing workflow from file: ${args.file}`);
          result = await workflowEngine.loadAndExecuteWorkflowFile(
            args.file,
            args.query,
            {
              variables: { query: args.query },
              truncateSteps: args.truncateSteps,
              maxStepTokens: args.maxStepTokens,
            }
          );
        } else {
          // Named workflow execution (discovery-based)
          console.error(`🚀 Executing named workflow: ${args.name}`);
          result = await workflowEngine.executeWorkflow(
            args.name!,
            args.query,
            {
              variables: { query: args.query },
              truncateSteps: args.truncateSteps,
              maxStepTokens: args.maxStepTokens,
            }
          );
        }

        // ALWAYS format as string for Claude Code display
        // Format result for readability
        if (typeof result === 'string') {
          return result;
        }

        // Format detailed workflow results
        if (typeof result === 'object' && result !== null && 'steps' in result) {
          const detailed = result as any;

          // Determine truncation settings
          // Default: truncate enabled, 2500 tokens (~10k chars)
          const truncate = args.truncateSteps ?? true;
          const maxTokens = args.maxStepTokens ?? 2500;
          const maxChars = maxTokens * 4; // 1 token ≈ 4 chars

          let output = `# Workflow: ${detailed.workflow}\n\n`;
          output += `**Duration:** ${(detailed.duration / 1000).toFixed(1)}s\n`;
          output += `**Steps Completed:** ${detailed.steps.length}\n\n`;
          output += `---\n\n`;

          // Format each step's output
          for (let i = 0; i < detailed.steps.length; i++) {
            const step = detailed.steps[i];
            output += `## Step ${i + 1}: ${step.step}\n\n`;

            // Format the step output - keep it clean and readable
            let stepOutput = step.output;

            // DEFENSIVE: Ensure stepOutput is a string (fix [object Object] issue)
            if (stepOutput !== null && typeof stepOutput === 'object') {
              // Handle FileReference objects - extract summary or stringify
              if ('summary' in stepOutput && typeof stepOutput.summary === 'string') {
                stepOutput = stepOutput.summary;
              } else if ('content' in stepOutput && typeof stepOutput.content === 'string') {
                stepOutput = stepOutput.content;
              } else {
                stepOutput = JSON.stringify(stepOutput, null, 2);
              }
            } else if (stepOutput === undefined || stepOutput === null) {
              stepOutput = '[No output]';
            }

            // Truncate based on settings
            if (truncate && typeof stepOutput === 'string' && stepOutput.length > maxChars) {
              const approxTokens = Math.floor(stepOutput.length / 4);
              output += stepOutput.substring(0, maxChars) +
                '\n\n...(output truncated: ~' + approxTokens + ' tokens, limit: ' + maxTokens + ' tokens. Use truncateSteps=false for full output)...\n\n';
            } else {
              output += `${stepOutput}\n\n`;
            }

            output += `---\n\n`;
          }

          // Add final summary footer
          output += `\n**Workflow Complete** ✓\n`;

          return output;
        }

        // Fallback for any other object type
        return JSON.stringify(result, null, 2);
      } catch (error: any) {
        return `Workflow execution failed: ${error.message}`;
      }
    },
  });

  // Tool to list all workflows
  tools.push({
    name: 'list_workflows',
    description: 'List workflows',
    parameters: z.object({
      projectPath: z.string().optional(),
    }),
    execute: async (args: { projectPath?: string }) => {
      const workflows = workflowEngine.listWorkflows();
      const errors = workflowEngine.getValidationErrors();

      let output = '';

      // Show successful workflows
      if (workflows.length > 0) {
        const formatted = workflows.map(w =>
          `• ${w.name}: ${w.description || 'No description'} (${w.steps} steps)`
        ).join('\n');
        output += `Available Workflows:\n\n${formatted}\n\nUse 'workflow' tool to execute any of these.\n`;
      } else {
        output += `No workflows available.\n`;
      }

      // Show validation errors if any
      if (errors.length > 0) {
        output += `\n⚠️  Validation Errors (${errors.length} files failed to load):\n\n`;
        errors.forEach(err => {
          output += `❌ [${err.source}] ${err.file}\n`;
          output += `   Error: ${err.error}\n\n`;
        });
        output += `Fix these files to make them available.\n`;
      }

      return output;
    },
  });

  // Tool to create a new workflow
  tools.push({
    name: 'create_workflow',
    description: 'Create workflow',
    parameters: z.object({
      name: z.string(),
      type: z.enum(['code-review', 'brainstorm', 'debug', 'research', 'custom'])
        ,
      steps: z.string().optional(),
    }),
    execute: async (args: { name: string; type: 'code-review' | 'brainstorm' | 'debug' | 'research' | 'custom'; steps?: string }) => {
      try {
        let workflow;

        // Create based on template
        switch (args.type) {
          case 'code-review':
            workflow = {
              name: args.name,
              description: 'Custom code review workflow',
              version: '1.0',
              settings: {
                optimization: {
                  enabled: true,
                  cacheResults: true,
                  compressPrompts: true,
                  smartRouting: true,
                },
              },
              steps: [
                { name: 'analyze', tool: 'gemini_analyze_code', input: { prompt: 'Analyze code' } },
                { name: 'review', tool: 'grok_code', input: { prompt: 'Review for best practices' } },
                { name: 'suggest', tool: 'ai', input: { prompt: 'Suggest improvements' }, model: 'openai' },
              ],
            };
            break;

          case 'brainstorm':
            workflow = {
              name: args.name,
              description: 'Custom brainstorming workflow',
              version: '1.0',
              settings: {},
              steps: [
                { name: 'ideate', tool: 'gemini_brainstorm', input: { prompt: 'Generate ideas' } },
                { name: 'expand', tool: 'openai_brainstorm', input: { prompt: 'Expand on ideas' } },
                { name: 'research', tool: 'scout', input: { prompt: 'Find evidence' } },
              ],
            };
            break;

          case 'debug':
            workflow = {
              name: args.name,
              description: 'Custom debugging workflow',
              version: '1.0',
              settings: {},
              steps: [
                { name: 'analyze', tool: 'grok_debug', input: { prompt: 'Analyze error' } },
                { name: 'trace', tool: 'grok_code', input: { prompt: 'Analyze code path' } },
                { name: 'fix', tool: 'ai_code', input: { prompt: 'Suggest fix' } },
              ],
            };
            break;

          case 'research':
            workflow = {
              name: args.name,
              description: 'Custom research workflow',
              version: '1.0',
              settings: {},
              steps: [
                { name: 'search', tool: 'perplexity_ask', input: { prompt: 'Initial research' } },
                { name: 'analyze', tool: 'ai_analyze', input: { prompt: 'Analyze findings' } },
                { name: 'verify', tool: 'verifier', input: { prompt: 'Verify facts' } },
                { name: 'synthesize', tool: 'focus', input: { prompt: 'Synthesize results' } },
              ],
            };
            break;

          case 'custom':
            if (!args.steps) {
              return 'Custom workflow requires steps in YAML or JSON format';
            }
            try {
              const stepsData = args.steps.trim().startsWith('{')
                ? JSON.parse(args.steps)
                : yaml.parse(args.steps);

              workflow = {
                name: args.name,
                description: 'Custom workflow',
                version: '1.0',
                settings: {},
                steps: stepsData.steps || stepsData,
              };
            } catch (error) {
              return `Failed to parse custom steps: ${error}`;
            }
            break;

          default:
            return `Unknown workflow type: ${args.type}`;
        }

        // Save the workflow
        await workflowEngine.saveWorkflow(workflow, 'yaml');

        return `✅ Created workflow '${args.name}' successfully!

To use it: workflow --name ${args.name} --query "your input"

Workflow saved to: .tachi/workflows/${args.name}.yaml`;
      } catch (error: any) {
        return `Failed to create workflow: ${error.message}`;
      }
    },
  });

  // Tool to visualize workflow
  tools.push({
    name: 'visualize_workflow',
    description: 'Visualize workflow',
    parameters: z.object({
      name: z.string(),
    }),
    execute: async (args: { name: string }) => {
      const workflow = workflowEngine.getWorkflow(args.name);
      if (!workflow) {
        return `Workflow '${args.name}' not found`;
      }

      // Create ASCII visualization
      let viz = `
┌─────────────────────────────────────┐
│  Workflow: ${workflow.name.padEnd(25)}│
└─────────────────────────────────────┘

${workflow.description || 'No description'}

Settings:
  • Optimization: ${workflow.settings?.optimization?.enabled ? '✅' : '❌'}
  • Smart Routing: ${workflow.settings?.optimization?.smartRouting ? '✅' : '❌'}

Steps:
`;

      for (let i = 0; i < workflow.steps.length; i++) {
        const step = workflow.steps[i];
        const isLast = i === workflow.steps.length - 1;
        const prefix = isLast ? '└──' : '├──';
        const connector = isLast ? '   ' : '│  ';

        viz += `${prefix} ${i + 1}. ${step.name}\n`;
        viz += `${connector}    Tool: ${step.tool}\n`;
        if (step.model) viz += `${connector}    Model: ${step.model}\n`;
        if (step.parallel) viz += `${connector}    ⚡ Runs in parallel\n`;
        if (step.condition) viz += `${connector}    ⚠️ Conditional\n`;
        viz += '\n';
      }

      return viz;
    },
  });

  // Tool to start workflow step-by-step (streaming mode)
  tools.push({
    name: 'workflow_start',
    description: 'Start workflow session',
    parameters: z.object({
      name: z.string(),
      query: z.string(),
      variables: z.record(z.union([z.string(), z.number(), z.boolean()])).optional(),
    }),
    execute: async (args: { name: string; query: string; variables?: Record<string, string | number | boolean> }) => {
      try {
        console.error(`🚀 Starting streaming workflow: ${args.name}`);

        const result = await workflowEngine.startWorkflowStepByStep(
          args.name,
          args.query,
          { variables: args.variables }
        );

        const totalSteps = workflowEngine.getWorkflow(args.name)?.steps.length || '?';

        const r = result as any;
        return `# Workflow Started: ${args.name}

**Session ID:** \`${r.sessionId}\`

✅ Step ${r.step}/${totalSteps}: **${r.stepName}**

${r.output}

---

${r.hasMore ? `⏭️  **Next:** Use \`continue_workflow\` with session ID \`${r.sessionId}\` to execute step ${r.step + 1}` : '✓ Workflow complete!'}`;
      } catch (error: any) {
        return `Failed to start workflow: ${error.message}`;
      }
    },
  });

  // Tool to continue workflow execution
  tools.push({
    name: 'continue_workflow',
    description: 'Continue workflow',
    parameters: z.object({
      sessionId: z.string(),
    }),
    execute: async (args: { sessionId: string }) => {
      try {
        const result = await workflowEngine.continueWorkflow(args.sessionId);

        // Get workflow info for context
        const session = (workflowEngine as any).sessions?.get(args.sessionId);
        const workflowName = session?.workflowName || 'unknown';
        const totalSteps = session?.workflow?.steps.length || '?';
        const r = result as any;

        if (!r.hasMore) {
          return `# Workflow Complete: ${workflowName}

**Session ID:** \`${r.sessionId}\`

✅ All steps completed!

Final output from step ${r.step}:

${r.output}

---

✓ Workflow finished successfully`;
        }

        return `# Workflow Progress: ${workflowName}

**Session ID:** \`${r.sessionId}\`

✅ Step ${r.step}/${totalSteps}: **${r.stepName}**

${r.output}

---

⏭️  **Next:** Call \`continue_workflow\` with session ID \`${r.sessionId}\` to execute step ${r.step + 1}`;
      } catch (error: any) {
        return `Failed to continue workflow: ${error.message}`;
      }
    },
  });

  // Tool to check workflow session status
  tools.push({
    name: 'workflow_status',
    description: 'Workflow status',
    parameters: z.object({
      sessionId: z.string(),
    }),
    execute: async (args: { sessionId: string }) => {
      try {
        // Access internal session state (type assertion to access private members)
        const session = (workflowEngine as any).sessions?.get(args.sessionId);

        if (!session) {
          return `❌ Session '${args.sessionId}' not found. It may have completed or expired.`;
        }

        const totalSteps = session.workflow.steps.length;
        const currentStep = session.currentStepIndex + 1;
        const completed = session.currentStepIndex;
        const remaining = totalSteps - completed;

        const duration = ((Date.now() - session.startTime) / 1000).toFixed(1);

        return `# Workflow Session Status

**Workflow:** ${session.workflowName}
**Session ID:** \`${args.sessionId}\`
**Status:** Running

**Progress:** ${completed}/${totalSteps} steps completed
**Current Step:** ${currentStep} - ${session.workflow.steps[session.currentStepIndex]?.name || 'N/A'}
**Remaining:** ${remaining} steps
**Duration:** ${duration}s

**Latest Output:**
${session.previousOutput?.substring(0, 500) || 'No output yet'}${session.previousOutput?.length > 500 ? '...' : ''}

Use \`continue_workflow\` to execute the next step.`;
      } catch (error: any) {
        return `Failed to get workflow status: ${error.message}`;
      }
    },
  });

  // Register tools with server (with profile filtering)
  tools.forEach(tool => {
    try {
      // Check if tool is enabled in profile
      if (!isToolEnabled(tool.name)) {
        return; // Skip disabled tools
      }
      server.addTool(tool as any);
    } catch (error) {
      console.error(`Failed to register tool ${tool.name}:`, error);
    }
  });

  console.error('✅ Registered workflow tools:');
  console.error('   - workflow: Execute complete workflows (all steps at once)');
  console.error('   - workflow_start: Start streaming workflow (step-by-step mode)');
  console.error('   - continue_workflow: Execute next step in streaming workflow');
  console.error('   - workflow_status: Check progress of streaming workflow');
  console.error('   - list_workflows: List available workflows');
  console.error('   - create_workflow: Create new workflow from template');
  console.error('   - visualize_workflow: Show workflow structure');

  return tools;
}