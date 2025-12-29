/**
 * Workflow Runner Tool - Execute custom workflows via MCP
 *
 * Features:
 * - Execute workflows by name or file
 * - Per-step rendering with model badges (Ink)
 * - Comparison summary table
 * - Optional AI judge evaluation (one call at end for all steps)
 */

import { z } from 'zod';
import { FastMCP } from 'fastmcp';
import { workflowEngine } from '../workflows/custom-workflows.js';
import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'yaml';
import { isToolEnabled } from '../utils/tool-config.js';
import {
  renderWorkflowResult,
  renderSingleStep,
  renderWorkflowSummary,
  renderProgressBanner,
  renderCompactProgress,
  type WorkflowResult,
  type StepResult,
  type JudgeResult,
  type RenderWorkflowOptions,
} from '../utils/workflow-ink-renderer.js';
import { createProgressStream } from '../utils/progress-stream.js';

/**
 * MCP Context with progress reporting capability
 * FastMCP provides this to tool execute functions
 */
interface MCPToolContext {
  log: {
    info: (message: string, metadata?: Record<string, any>) => void;
    error: (message: string, metadata?: Record<string, any>) => void;
    warn: (message: string, metadata?: Record<string, any>) => void;
    debug: (message: string, metadata?: Record<string, any>) => void;
  };
  reportProgress?: (progress: { progress: number; total?: number }) => Promise<void>;
}

/**
 * Register workflow tools with the MCP server
 */
export function registerWorkflowTools(server: FastMCP) {
  const tools = [];

  // Tool to execute workflows (by name or from file)
  tools.push({
    name: 'workflow',
    description: 'Execute workflows with Ink rendering, comparison table, and optional AI judge',
    parameters: z.object({
      name: z.string().optional().describe('Workflow name to execute'),
      file: z.string().optional().describe('Workflow YAML file path'),
      query: z.string().describe('Input query for the workflow'),
      projectPath: z.string().optional(),
      truncateSteps: z.boolean().optional().describe('Truncate step outputs (default: true)'),
      maxStepTokens: z.number().optional().describe('Max tokens per step (default: 2500)'),
      compare: z.boolean().optional().describe('Show comparison summary table (default: true)'),
      judge: z.boolean().optional().describe('Enable AI judge to evaluate all steps at end'),
      judgeTool: z.string().optional().describe('Tool for judging (default: gemini_analyze_text)'),
    }),
    execute: async (args: {
      name?: string;
      file?: string;
      query: string;
      projectPath?: string;
      truncateSteps?: boolean;
      maxStepTokens?: number;
      compare?: boolean;
      judge?: boolean;
      judgeTool?: string;
    }, context?: MCPToolContext) => {
      try {
        // Validation: must specify exactly one
        if (!args.name && !args.file) {
          return "❌ Error: Must specify either 'name' or 'file' parameter\n\nExamples:\n  workflow --name code-review --query 'input'\n  workflow --file ./custom.yaml --query 'input'";
        }
        if (args.name && args.file) {
          return "❌ Error: Cannot use both 'name' and 'file' parameters\n\nUse one or the other.";
        }

        let result;

        // Get workflow for progress tracking
        const workflowDef = args.name ? workflowEngine.getWorkflow(args.name) : undefined;
        const totalSteps = workflowDef?.steps?.length || 1;
        const startTime = Date.now();

        // Report initial progress
        if (context?.reportProgress) {
          await context.reportProgress({ progress: 0, total: totalSteps });
        }

        // Beautiful Ink progress banner
        const startBanner = renderProgressBanner({
          workflowName: args.name || args.file || 'workflow',
          currentStep: 0,
          totalSteps,
          stepName: workflowDef?.steps?.[0]?.name || 'Starting...',
          status: 'starting',
          modelUsed: workflowDef?.steps?.[0]?.model,
        });
        console.error(startBanner);

        if (args.file) {
          // File-based execution (ad-hoc)
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

        const elapsed = Date.now() - startTime;

        // Report completion
        if (context?.reportProgress) {
          await context.reportProgress({ progress: totalSteps, total: totalSteps });
        }

        // Beautiful Ink completion banner
        const completeBanner = renderProgressBanner({
          workflowName: args.name || args.file || 'workflow',
          currentStep: totalSteps,
          totalSteps,
          stepName: 'Complete',
          status: 'completed',
          elapsedTime: elapsed,
        });
        console.error(completeBanner);

        // ALWAYS format as string for Claude Code display
        // Format result for readability
        if (typeof result === 'string') {
          return result;
        }

        // Format detailed workflow results using Ink renderer
        if (typeof result === 'object' && result !== null && 'steps' in result) {
          const detailed = result as any;

          // Determine settings
          const truncate = args.truncateSteps ?? true;
          const maxTokens = args.maxStepTokens ?? 2500;
          const maxChars = maxTokens * 4;
          const showComparison = args.compare ?? true;
          const enableJudge = args.judge ?? false;
          const judgeTool = args.judgeTool || 'gemini_analyze_text';

          // Convert to StepResult format for Ink renderer
          const stepResults: StepResult[] = detailed.steps.map((step: any) => {
            let stepOutput = step.output;

            // Handle FileReference objects
            if (stepOutput !== null && typeof stepOutput === 'object') {
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

            // Truncate if needed
            if (truncate && typeof stepOutput === 'string' && stepOutput.length > maxChars) {
              stepOutput = stepOutput.substring(0, maxChars) + '\n\n...(truncated)...';
            }

            return {
              step: step.step,
              tool: step.tool,
              model: step.model,
              output: stepOutput,
              duration: step.duration,
              filePath: step.filePath,
            } as StepResult;
          });

          // Build workflow result
          const workflowResult: WorkflowResult = {
            workflowName: detailed.workflow,
            workflowId: detailed.workflowId,
            duration: detailed.duration,
            steps: stepResults,
            status: 'completed',
          };

          // AI Judge evaluation (if enabled)
          let judgeResult: JudgeResult | undefined;
          if (enableJudge && stepResults.length > 1) {
            try {
              console.error(`⚖️ Running AI judge with ${judgeTool}...`);
              judgeResult = await runJudgeEvaluation(stepResults, judgeTool, args.query);
            } catch (error: any) {
              console.error(`⚠️ Judge evaluation failed: ${error.message}`);
            }
          }

          // Render with Ink
          const renderOptions: RenderWorkflowOptions = {
            includeComparison: showComparison,
            includeJudging: enableJudge,
            judgeResult,
            maxSummaryLength: maxChars,
          };

          return renderWorkflowResult(workflowResult, renderOptions);
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
    execute: async (args: { name: string; query: string; variables?: Record<string, string | number | boolean> }, context?: MCPToolContext) => {
      try {
        const workflow = workflowEngine.getWorkflow(args.name);
        const totalSteps = workflow?.steps.length || 1;
        const startTime = Date.now();

        // Report progress via MCP protocol (if available)
        if (context?.reportProgress) {
          await context.reportProgress({ progress: 0, total: totalSteps });
        }

        // Beautiful Ink progress banner to stderr
        const startBanner = renderProgressBanner({
          workflowName: args.name,
          currentStep: 0,
          totalSteps,
          stepName: workflow?.steps[0]?.name || 'Starting...',
          status: 'starting',
          modelUsed: workflow?.steps[0]?.model,
        });
        console.error(startBanner);

        const result = await workflowEngine.startWorkflowStepByStep(
          args.name,
          args.query,
          { variables: args.variables }
        );

        const r = result as any;
        const elapsed = Date.now() - startTime;

        // Report completion of first step
        if (context?.reportProgress) {
          await context.reportProgress({ progress: 1, total: totalSteps });
        }

        // Render completion progress
        const completeBanner = renderProgressBanner({
          workflowName: args.name,
          currentStep: 1,
          totalSteps,
          stepName: r.stepName,
          status: 'completed',
          elapsedTime: elapsed,
          modelUsed: workflow?.steps[0]?.model,
        });
        console.error(completeBanner);

        // Create StepResult for Ink rendering
        const stepResult: StepResult = {
          step: r.stepName,
          tool: workflow?.steps[0]?.tool || 'unknown',
          model: workflow?.steps[0]?.model,
          output: r.output,
          duration: r.duration,
        };

        // Render with React Ink
        const renderedOutput = renderSingleStep(
          stepResult,
          r.step,
          totalSteps,
          args.name,
          {
            elapsedTime: r.duration,
            maxSummaryLength: workflowEngine.getStepTokenLimit() * 4, // tokens -> chars
          }
        );

        // Add session info and next step guidance
        const sessionInfo = `\nSession: ${r.sessionId}\n`;
        const nextStep = r.hasMore
          ? `\nNext: continue_workflow --sessionId ${r.sessionId}`
          : '\nWorkflow complete!';

        return renderedOutput + sessionInfo + nextStep;
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
    execute: async (args: { sessionId: string }, context?: MCPToolContext) => {
      try {
        // Get session info before execution for progress tracking
        const sessionBefore = (workflowEngine as any).sessions?.get(args.sessionId);
        const totalSteps = sessionBefore?.workflow?.steps?.length || 1;
        const currentStep = (sessionBefore?.currentStepIndex || 0) + 1; // Next step to execute
        const workflowNameBefore = sessionBefore?.workflowName || 'workflow';
        const stepDef = sessionBefore?.workflow?.steps?.[sessionBefore?.currentStepIndex];
        const startTime = Date.now();

        // Report progress before execution
        if (context?.reportProgress) {
          await context.reportProgress({ progress: currentStep - 1, total: totalSteps });
        }

        // Beautiful Ink progress banner - starting step
        const runningBanner = renderProgressBanner({
          workflowName: workflowNameBefore,
          currentStep: currentStep - 1,
          totalSteps,
          stepName: stepDef?.name || `Step ${currentStep}`,
          status: 'running',
          modelUsed: stepDef?.model,
        });
        console.error(runningBanner);

        const result = await workflowEngine.continueWorkflow(args.sessionId);

        // Get workflow info for context
        const session = (workflowEngine as any).sessions?.get(args.sessionId);
        const workflowName = session?.workflowName || sessionBefore?.workflowName || 'unknown';
        const workflow = session?.workflow || sessionBefore?.workflow;
        const r = result as any;
        const elapsed = Date.now() - startTime;

        // Report progress after execution
        if (context?.reportProgress) {
          await context.reportProgress({ progress: r.step, total: totalSteps });
        }

        // Beautiful Ink progress banner - step completed
        const completeBanner = renderProgressBanner({
          workflowName,
          currentStep: r.step,
          totalSteps,
          stepName: r.stepName,
          status: r.hasMore ? 'completed' : 'completed',
          elapsedTime: elapsed,
          modelUsed: workflow?.steps?.[r.step - 1]?.model,
        });
        console.error(completeBanner);

        // If workflow is complete, render summary
        if (!r.hasMore) {
          // Collect all step outputs for comparison table
          const allStepResults: StepResult[] = [];
          if (session?.stepOutputs) {
            for (const [stepName, fileRef] of Object.entries(session.stepOutputs)) {
              const stepIndex = workflow?.steps?.findIndex((s: any) => s.name === stepName) || 0;
              const stepDef = workflow?.steps?.[stepIndex];
              allStepResults.push({
                step: stepName,
                tool: stepDef?.tool || 'unknown',
                model: stepDef?.model,
                output: (fileRef as any)?.summary || (fileRef as any)?.content || '[No output]',
                duration: (fileRef as any)?.duration,
              });
            }
          }

          const totalDuration = Date.now() - (session?.startTime || Date.now());

          // Render completion summary with React Ink
          const renderedOutput = renderWorkflowSummary(
            workflowName,
            totalSteps,
            totalDuration,
            r.output, // Final step output serves as summary
            {
              steps: allStepResults.length > 1 ? allStepResults : undefined,
              includeComparison: allStepResults.length > 1,
            }
          );

          return renderedOutput;
        }

        // Still in progress - render current step
        const currentStepIdx = session?.currentStepIndex || 0;
        const completedStepDef = workflow?.steps?.[currentStepIdx - 1]; // -1 because we just completed this step

        const stepResult: StepResult = {
          step: r.stepName,
          tool: completedStepDef?.tool || 'unknown',
          model: completedStepDef?.model,
          output: r.output,
          duration: r.duration,
        };

        const elapsedTime = Date.now() - (session?.startTime || Date.now());

        const renderedOutput = renderSingleStep(
          stepResult,
          r.step,
          totalSteps,
          workflowName,
          {
            elapsedTime,
            maxSummaryLength: workflowEngine.getStepTokenLimit() * 4,
          }
        );

        const sessionInfo = `\nSession: ${r.sessionId}\n`;
        const nextStep = `\nNext: continue_workflow --sessionId ${r.sessionId}`;

        return renderedOutput + sessionInfo + nextStep;
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

// ============================================================================
// AI JUDGE EVALUATION
// ============================================================================

/**
 * Run AI judge to evaluate all workflow steps at the end
 * One call that evaluates everything and returns rankings/scores
 */
async function runJudgeEvaluation(
  steps: StepResult[],
  judgeTool: string,
  originalQuery: string
): Promise<JudgeResult> {
  // Build judge prompt with all step outputs
  const stepSummaries = steps.map((s, i) => {
    const firstLines = s.output.split('\n').slice(0, 5).join('\n');
    return `### Step ${i + 1}: ${s.step} (${s.tool || 'unknown'})
${firstLines}
${s.output.length > 500 ? '...(truncated)' : ''}`;
  }).join('\n\n');

  const judgePrompt = `You are an impartial judge evaluating workflow step outputs.

## Original Query
${originalQuery}

## Step Outputs to Evaluate
${stepSummaries}

## Your Task
Evaluate ALL steps and provide:
1. **Rankings**: Order steps from best to worst based on quality, relevance, and completeness
2. **Scores**: Rate each step from 1-10
3. **Winner**: Which step provided the best response
4. **Reasoning**: Brief explanation of your evaluation

Respond in this exact JSON format:
{
  "winner": "step name",
  "rankings": ["step1", "step2", "step3"],
  "scores": {"step1": 8, "step2": 7, "step3": 6},
  "reasoning": "Brief explanation..."
}`;

  // Call the judge tool
  const toolResult = await workflowEngine.callTool(judgeTool, {
    prompt: judgePrompt,
  }, {
    maxTokens: 1000,
    skipValidation: true,
  });

  // Parse judge response
  try {
    // Try to extract JSON from response
    const jsonMatch = toolResult.result.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        winner: parsed.winner || undefined,
        rankings: parsed.rankings || [],
        scores: parsed.scores || {},
        reasoning: parsed.reasoning || toolResult.result,
      };
    }
  } catch {
    // If parsing fails, return raw reasoning
  }

  return {
    reasoning: toolResult.result,
  };
}