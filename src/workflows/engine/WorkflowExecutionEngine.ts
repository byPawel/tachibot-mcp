/**
 * Workflow Execution Engine
 * Contains executeWorkflow implementation (615 lines extracted)
 */

import * as path from 'path';
import { promises as fsPromises } from 'fs';
import { generateWorkflowId } from '../../utils/timestamp-formatter.js';
import { loadConfig } from '../../config.js';
import { modelRouter } from '../../optimization/model-router.js';
import { tokenOptimizer } from '../../optimization/token-optimizer.js';
import type { Workflow, WorkflowStep, ExecutionRecord, FileReference, WorkflowManifest } from '../workflow-types.js';

export { executeWorkflowImpl };

async function executeWorkflowImpl(
  parent: any,
  workflowName: string,
  input: string,
  options?: {
    variables?: Record<string, string | number | boolean>;
    dryRun?: boolean;
    truncateSteps?: boolean;
    maxStepTokens?: number;
  }
): Promise<string | Record<string, unknown>> {
    const workflow = parent.workflows.get(workflowName);
    if (!workflow) {
      throw new Error(`Workflow '${workflowName}' not found`);
    }

    // Generate unique workflow ID: YYYY-MM-DD-DayName-HH-MM-shortid
    // Example: 2025-11-23-Sunday-22-44-a1b2c3d4
    const workflowId = generateWorkflowId();

    // Setup output directory for file-based workflows
    // Uses WORKFLOW_OUTPUT_DIR env var (default: ./workflow-output)
    const config = loadConfig();
    const baseOutputDir = config.workflow.outputDir;
    const outputDir = path.join(process.cwd(), baseOutputDir, workflowName, workflowId);

    // Initialize execution tracking
    const execution: ExecutionRecord = {
      workflowName,
      workflowId,
      outputDir,
      startTime: new Date(),
      status: "running",
      cost: 0,
      outputs: [],
    };
    parent.executionHistory.push(execution);

    console.error(`\n📝 Workflow manifest: ${path.join(outputDir, 'manifest.json')}`);
    console.error(`   To monitor progress: tail -f ${path.join(outputDir, 'manifest.json')}\n`);

    // Merge variables
    const variables: Record<string, any> = {
      ...workflow.variables,
      ...options?.variables,
      input,
      query: input,  // Also provide 'query' alias for backwards compatibility with workflows that use ${query}
    };
    console.error(`🔍 Workflow variables initialized:`, JSON.stringify(variables, null, 2));

    // Calculate step numbers for sequential/parallel execution display
    const stepNumbers = parent.calculateStepNumbers(workflow);
    const stepNumberEntries: Array<[string, string]> = Array.from(stepNumbers.entries());
    console.error(`📊 Step numbering calculated:`, stepNumberEntries.map(([name, num]) => `${num}: ${name}`).join(', '));

    // Execute steps
    const stepOutputs: Record<string, FileReference> = {};
    let previousOutput: string = input;

    // Initialize output directory if ANY step has saveToFile
    const needsFileOutput = workflow.steps.some((s: WorkflowStep) => s.saveToFile);
    if (needsFileOutput) {
      try {
        await fsPromises.mkdir(outputDir, { recursive: true });

        // Create initial manifest
        const manifest: WorkflowManifest = {
          workflowId,
          workflowName,
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
        // Continue without file output
      }
    }

    try {
      for (let i = 0; i < workflow.steps.length; i++) {
        const step = workflow.steps[i];

        // Check condition
        if (step.condition?.if) {
          const shouldRun = parent.evaluateCondition(
            step.condition.if,
            variables,
            stepOutputs,
          );
          if (!shouldRun && step.condition.skip) {
            console.error(`⏭️ Skipping step: ${step.name}`);
            continue;
          }
        }

        // 🔥 LIVE PROGRESS - Show what's starting
        const stepNumber = i + 1;
        const totalSteps = workflow.steps.length;
        console.error(`\n${"⏳".repeat(40)}`);
        console.error(`🚀 STARTING STEP ${stepNumber}/${totalSteps}: ${step.name} (${step.tool})`);
        console.error(`${"⏳".repeat(40)}\n`);

        // Load saved step files if requested (hybrid: summary + lazy loader)
        if (step.loadFiles && step.loadFiles.length > 0 && outputDir) {
          for (const stepId of step.loadFiles) {
            const existingRef = stepOutputs[stepId];

            if (existingRef) {
              // Already have FileReference - reuse it directly
              variables[stepId] = existingRef;
              console.error(`📂 Loaded existing FileReference for '${stepId}' (${existingRef.summary.length} char summary)`);

              // Also set output variable if defined
              const previousStep = workflow.steps.find((s: WorkflowStep) => s.name === stepId);
              if (previousStep?.output?.variable) {
                variables[previousStep.output.variable] = existingRef;
              }
            } else {
              // Fallback: Try to load from file (for external files)
              const filename = `${stepId}.md`;
              const filepath = path.join(outputDir, filename);

              try {
                const fileContent = await fsPromises.readFile(filepath, 'utf-8');
                const outputMatch = fileContent.match(/## Output\s*\n\n([\s\S]*)/);
                const content = outputMatch ? outputMatch[1].trim() : fileContent;

                // Create FileReference from loaded file
                const fileRef = await parent.createFileReference(
                  stepId,
                  content,
                  workflowId,
                  workflowName,
                  true,
                  outputDir,
                  stepNumbers.get(stepId),  // Pass step number for filename
                  undefined  // Model unknown for loaded files
                );

                variables[stepId] = fileRef;
                stepOutputs[stepId] = fileRef;
                console.error(`📂 Loaded external file for '${stepId}' (${fileRef.sizeBytes} bytes)`);

                // Also set output variable
                const previousStep = workflow.steps.find((s: WorkflowStep) => s.name === stepId);
                if (previousStep?.output?.variable) {
                  variables[previousStep.output.variable] = fileRef;
                }
              } catch (error) {
                console.error(`⚠️  Could not load file for step '${stepId}':`, error);
                // Continue without this file
              }
            }
          }
        }

        // Prepare input
        console.error(`\n🔍 [${step.name}] Preparing input...`);
        console.error(`🔍 Available variables: [${Object.keys(variables).join(', ')}]`);
        console.error(`🔍 Available stepOutputs: [${Object.keys(stepOutputs).join(', ')}]`);

        // Extract variables that this step wants to use
        const inputStr = step.input ? JSON.stringify(step.input) : '';
        const usedVars = [...inputStr.matchAll(/\$\{([^}]+)\}/g)].map(m => m[1]);
        if (usedVars.length > 0) {
          console.error(`🔍 Variables needed by this step: [${usedVars.join(', ')}]`);
          // Check if all needed variables exist
          for (const varName of usedVars) {
            const exists = variables.hasOwnProperty(varName) || stepOutputs.hasOwnProperty(varName);
            if (!exists) {
              console.error(`❌ MISSING: Variable '${varName}' is not available!`);
            } else {
              const value = variables[varName] || stepOutputs[varName];
              console.error(`✓ FOUND: '${varName}' (${typeof value}, ${String(value).length} chars)`);
            }
          }
        }

        let stepInput:
          | string
          | { prompt?: string; context?: string; previousStep?: string } =
          input;
        if (step.input) {
          if (typeof step.input === "string") {
            stepInput = await parent.interpolateVariables(
              step.input,
              variables,
              stepOutputs,
            );
          } else {
            // Handle any object structure - interpolate all string values
            stepInput = {};
            const debugLines = [
              `🔍 Interpolating step input for ${step.name}:`,
              `   Available variables: ${Object.keys(variables).join(', ')}`,
              `   Available step outputs: ${Object.keys(stepOutputs).join(', ')}`,
            ];
            for (const [key, value] of Object.entries(step.input)) {
              debugLines.push(`   Processing ${step.name}.${key}: type=${typeof value}, value="${String(value).substring(0, 100)}"`);
              if (typeof value === 'string') {
                const interpolated = await parent.interpolateVariables(
                  value,
                  variables,
                  stepOutputs,
                );
                if (value !== interpolated) {
                  debugLines.push(`🔄 Variable substitution in ${step.name}.${key}:`);
                  debugLines.push(`   Before: ${value.substring(0, 100)}...`);
                  debugLines.push(`   After:  ${interpolated.substring(0, 100)}...`);
                } else {
                  debugLines.push(`⚠️  No substitution for ${step.name}.${key} - value: "${value.substring(0, 50)}..."`);
                }
                (stepInput as any)[key] = interpolated;
              } else {
                (stepInput as any)[key] = value;
              }
            }
            // Log to file and console
            const debugMsg = debugLines.join('\n');
            console.error(debugMsg);
            await fsPromises.appendFile('/tmp/workflow-debug.log', debugMsg + '\n\n').catch(() => {});
            // Special handling for previousStep reference
            if ((stepInput as any).previousStep && typeof (stepInput as any).previousStep === 'string') {
              const prevStepRef = stepOutputs[(stepInput as any).previousStep];
              (stepInput as any).previousStep = prevStepRef ? prevStepRef.summary : previousOutput;
            }
          }
        }

        // RUNTIME PARAMETER RESOLUTION
        // Resolve ${step_output} references and convert string numbers to actual numbers
        const resolvedParams = parent.resolveStepParameters(
          step,
          variables,
          stepOutputs,
        );

        // Select optimal model if using smart routing
        let model = resolvedParams.model;
        if (workflow.settings?.optimization?.smartRouting && !model) {
          const context = modelRouter.buildContext(
            typeof stepInput === "string" ? stepInput : stepInput?.prompt || "",
          );
          const selection = modelRouter.selectModel(context);
          model = selection.primary;
          console.error(`🧠 Smart routing selected: ${model} for ${step.name}`);
        }

        // Apply optimizations (only for string inputs)
        if (workflow.settings?.optimization?.enabled && typeof stepInput === "string") {
          const optimized = await tokenOptimizer.optimize({
            prompt: stepInput,
            model: model || "gpt-5.1-codex-mini",
            maxTokens: resolvedParams.maxTokens,
          });

          if (optimized.fromCache) {
            // NOTE: When fromCache=true, optimized.prompt contains the cached RESPONSE (not the input)
            // This is intentional - see token-optimizer.ts:175 where cached.response overwrites request.prompt
            console.error(`✅ Using cached result for ${step.name}`);
            console.error(`📦 Cached output length: ${optimized.prompt.length} chars`);

            const cachedResult = optimized.prompt;

            // Convert cached result to FileReference
            const cachedFileRef = await parent.createFileReference(
              step.name,
              cachedResult,
              workflowId,
              workflowName,
              step.saveToFile || false,
              outputDir,
              stepNumbers.get(step.name),  // Pass step number for filename
              model || resolvedParams.model  // Pass model name
            );

            stepOutputs[step.name] = cachedFileRef;

            // Store in variables if output.variable is specified
            if (step.output?.variable) {
              variables[step.output.variable] = cachedFileRef;
              console.error(`✅ Stored cached FileReference in variables['${step.output.variable}']`);
              console.error(`✅ Available variables now: [${Object.keys(variables).join(', ')}]`);
            }

            previousOutput = cachedFileRef.summary;
            execution.outputs.push({
              step: step.name,
              input: '[cached]',
              output: cachedFileRef.summary,
              filePath: cachedFileRef.filePath || undefined
            });
            continue;  // Skip tool execution
          }

          // When not cached, optimized.prompt contains the compressed INPUT
          stepInput = optimized.prompt;
        }

        // Execute step (with retry logic)
        let attempts = 0;
        const maxAttempts = step.retry?.attempts || 1;
        let result: string = "";
        let actualModelUsed: string = model || resolvedParams.model || "unknown";

        while (attempts < maxAttempts) {
          try {
            console.error(`🔧 Executing step: ${step.name} (${step.tool})`);

            if (options?.dryRun) {
              result = `[DRY RUN] Would execute ${step.tool} with model ${model}`;
            } else {
              // Emit before_invoke event for PromptEnhancementHandler (Phase 3: Enhanced context)
              await parent.eventBus.publish('workflow.tool.before_invoke', {
                stepName: step.name,
                tool: step.tool,
                input: stepInput,
                context: {
                  step,
                  variables,
                  accumulatedResults: execution.outputs,
                  // NEW: Phase 3 context for smart prompt enhancement
                  stepIndex: i,
                  totalSteps: workflow.steps.length,
                  workflowName: workflowName
                }
              });

              // Call the actual tool with RESOLVED parameters
              console.error(`🔧 About to call ${step.tool} with stepInput:`, JSON.stringify(stepInput, null, 2).substring(0, 500));
              const toolResult = await parent.callTool(step.tool, stepInput, {
                model: model || resolvedParams.model,
                maxTokens: resolvedParams.maxTokens,
                temperature: resolvedParams.temperature,
                skipValidation: true, // Skip validation for internal workflow calls
              });
              result = toolResult.result;
              actualModelUsed = toolResult.modelUsed;
              console.error(`✅ Tool executed with model: ${actualModelUsed}`);
            }

            break; // Success
          } catch (error) {
            attempts++;
            if (attempts >= maxAttempts) {
              if (step.condition?.failOnError) {
                throw error;
              }
              console.error(
                `❌ Step ${step.name} failed after ${maxAttempts} attempts`,
              );
              result = "";
            } else {
              const backoff = (step.retry?.backoff || 1000) * attempts;
              console.warn(`⚠️ Retrying ${step.name} in ${backoff}ms...`);
              await new Promise((resolve) => setTimeout(resolve, backoff));
            }
          }
        }

        // Store output with validation
        console.error(`📦 Step "${step.name}" completed - Output type: ${typeof result}`);

        // VALIDATION: Ensure result is not undefined/null
        if (result === undefined || result === null) {
          const errorMsg = `Step '${step.name}' returned ${result}. This indicates tool '${step.tool}' execution failed silently.`;
          console.error(`❌ ${errorMsg}`);
          throw new Error(errorMsg);
        }

        // VALIDATION: Warn if result is empty
        if (result.trim().length === 0) {
          console.error(`⚠️  WARNING: Step '${step.name}' returned empty string. Tool may have failed.`);
        }

        console.error(`📦 Output length: ${result.length} chars, Preview: ${result.substring(0, 150)}...`);

        // Convert result to string if it's an object
        if (typeof result !== 'string') {
          result = JSON.stringify(result, null, 2);
          console.error(`📦 Converted object result to JSON string (${result.length} chars)`);
        }

        // Create FileReference for result (replaces full content storage)
        const fileRef = await parent.createFileReference(
          step.name,
          result,
          workflowId,
          workflowName,
          step.saveToFile || false,
          outputDir,
          stepNumbers.get(step.name),  // Pass step number for filename
          actualModelUsed  // Pass ACTUAL model used (not requested model)
        );

        // Store FileReference (replaces full content)
        stepOutputs[step.name] = fileRef;

        if (step.output?.variable) {
          variables[step.output.variable] = fileRef;
          console.error(`✅ Stored FileReference in variables['${step.output.variable}']`);
          console.error(`✅ Available variables now: [${Object.keys(variables).join(', ')}]`);
        }

        // Update previous output with summary for chaining
        previousOutput = fileRef.summary;

        // Store summary in execution history (not full content)
        execution.outputs.push({
          step: step.name,
          input: parent.extractInputSummary(stepInput),
          output: fileRef.summary,
          filePath: fileRef.filePath || undefined
        });

        console.error(`📦 Created FileReference: ${fileRef.sizeBytes} bytes → ${fileRef.summary.length} char summary`);

        // 🔥 LIVE OUTPUT - Show summary for each step
        console.error(`\n${"=".repeat(80)}`);
        console.error(`✅ STEP ${stepNumber}/${totalSteps} COMPLETE: ${step.name}`);
        console.error(`${"=".repeat(80)}`);
        console.error(`\n${fileRef.summary}\n`);
        if (fileRef.filePath) {
          console.error(`📄 Full output saved to: ${fileRef.filePath}`);
        }
        console.error(`${"=".repeat(80)}\n`);

        // Progress tracking is handled by manifest.json updates
        const logOutput = fileRef.filePath
          ? `${fileRef.summary}\n\n📄 Full output: ${fileRef.filePath}`
          : fileRef.summary;

        // Update manifest with step completion (manifest.json tracks all progress)
        console.error(`✅ Step ${stepNumber}/${totalSteps} completed: ${step.name}`);

        // (Session logging removed - manifest.json provides full tracking)
        const _metadata = {
            stepNumber,
            stepName: step.name,
            totalSteps,
            workflowName,
            filePath: fileRef.filePath,
            sizeBytes: fileRef.sizeBytes
          };

        // Check if we should run next step in parallel
        if (step.parallel && i < workflow.steps.length - 1) {
          // In a real implementation, you'd use Promise.all or similar
          console.error(`🔀 Next step will run in parallel`);
        }

        // Progressive checkpointing during workflow execution
        const autoSynthesis = workflow.settings?.autoSynthesis;
        if (autoSynthesis?.enabled && outputDir) {
          const checkpointInterval = autoSynthesis.checkpointInterval ?? 10000;
          const accumulatedResults = Object.values(stepOutputs);
          const totalTokens = parent.estimateTotalTokens(accumulatedResults);
          const logLevel = autoSynthesis.logLevel ?? 'info';

          if (totalTokens > 0 && totalTokens % checkpointInterval < 5000) {
            await parent.createCheckpoint(workflowName, outputDir, variables, i);
            if (logLevel !== 'silent' && logLevel !== 'error') {
              console.error(`💾 Checkpoint created at step ${i + 1}/${workflow.steps.length}`);
              console.error(`   Total tokens: ${totalTokens}`);
              console.error(`   Variables saved: ${Object.keys(variables).length}`);
            }
          }
        }
      }

      // Auto-synthesis: Check if we should generate a summary AFTER all steps complete
      const autoSynthesis = workflow.settings?.autoSynthesis;
      if (autoSynthesis?.enabled) {
        // Collect all results
        const accumulatedResults = Object.values(stepOutputs);

        // Check if we should trigger synthesis
        if (parent.shouldAutoSynthesize(workflow, accumulatedResults, workflow.steps.length - 1)) {
          const totalTokens = parent.estimateTotalTokens(accumulatedResults);
          const logLevel = autoSynthesis.logLevel ?? 'info';

          if (logLevel !== 'silent') {
            console.error(`\n🤖 Auto-synthesis triggered (${totalTokens} tokens accumulated)`);
            console.error(`   Threshold: ${autoSynthesis.tokenThreshold ?? 20000} tokens`);
            console.error(`   Tool: ${autoSynthesis.synthesisTool ?? 'gemini_analyze_text'}`);
            console.error(`📊 Generating executive summary...`);
            console.error(`   Steps to synthesize: ${workflow.steps.length}`);
            console.error(`   Variables available: ${Object.keys(variables).length}`);
          }

          const synthesisStep = parent.createSynthesisStep(
            workflow,
            variables,
            outputDir
          );

          try {
            // Execute synthesis step with retry logic
            const maxRetries = autoSynthesis.maxRetries ?? 3;
            let synthesisResult: string = '';
            let attempt = 0;

            while (attempt < maxRetries) {
              try {
                const toolResult = await parent.callTool(
                  synthesisStep.tool,
                  synthesisStep.input ?? {},
                  {
                    maxTokens: typeof synthesisStep.maxTokens === 'number'
                      ? synthesisStep.maxTokens
                      : undefined,
                    skipValidation: true,
                  }
                );
                synthesisResult = toolResult.result;
                console.error(`✅ Auto-synthesis executed with model: ${toolResult.modelUsed}`);
                break; // Success
              } catch (error) {
                attempt++;
                if (attempt >= maxRetries) {
                  console.error(`❌ Auto-synthesis failed after ${maxRetries} attempts`);
                  throw error;
                }
                const backoff = 1000 * Math.pow(2, attempt - 1); // Exponential backoff
                console.warn(`⚠️  Retrying synthesis in ${backoff}ms...`);
                await new Promise(resolve => setTimeout(resolve, backoff));
              }
            }

            // Convert synthesis result to FileReference
            const synthesisFileRef = await parent.createFileReference(
              synthesisStep.name,
              synthesisResult,
              workflowId,
              workflowName,
              synthesisStep.saveToFile || false,
              outputDir,
              stepNumbers.get(synthesisStep.name),  // Pass step number for filename
              undefined  // Model unknown for synthesis
            );

            // Store synthesis result
            if (synthesisStep.output?.variable) {
              variables[synthesisStep.output.variable] = synthesisFileRef;
              stepOutputs[synthesisStep.name] = synthesisFileRef;
              if (logLevel !== 'silent') {
                console.error(`✅ Auto-synthesis complete! Stored FileReference in variables['${synthesisStep.output.variable}']`);
              }
            }

            execution.outputs.push({
              step: synthesisStep.name,
              input: '[auto-synthesis]',
              output: synthesisFileRef.summary,
              filePath: synthesisFileRef.filePath || undefined
            });

            // Show synthesis result
            if (logLevel !== 'silent') {
              console.error(`\n${"=".repeat(80)}`);
              console.error(`✅ AUTO-SYNTHESIS COMPLETE`);
              console.error(`${"=".repeat(80)}`);
              console.error(`\n${synthesisResult}\n`);
              console.error(`${"=".repeat(80)}\n`);
            }
          } catch (error) {
            console.error(`⚠️  Auto-synthesis failed, continuing with full outputs:`, error);
            // Don't throw - synthesis failure should not stop workflow
          }
        }
      }

      // Mark as completed
      execution.status = "completed";
      execution.endTime = new Date();

      // Delete checkpoint on successful completion
      if (workflow.settings?.autoSynthesis?.enabled && outputDir) {
        await parent.deleteCheckpoint(outputDir);
      }

      // Workflow complete - manifest.json contains full execution details
      console.error(`\n✅ Workflow complete! Manifest: ${path.join(outputDir, 'manifest.json')}\n`);

      // Format output - prioritize runtime options over workflow YAML settings
      return parent.formatOutput(
        execution,
        workflow.output?.format || "summary",
        options?.truncateSteps ?? workflow.output?.truncateSteps ?? true,
        options?.maxStepTokens ?? workflow.output?.maxStepTokens ?? 2500
      );
    } catch (error) {
      execution.status = "failed";
      execution.endTime = new Date();

      // Manifest will reflect failed status
      console.error(`\n❌ Workflow failed. Check manifest: ${path.join(outputDir, 'manifest.json')}\n`);

      throw error;
    }
}
