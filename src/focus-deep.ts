/**
 * Focus-Deep - Ultimate reasoning combining Sequential Thinking + Multi-Model Orchestration
 * The most powerful reasoning mode in tachibot-mcp
 */

import { sequentialThinking } from "./sequential-thinking.js";
import { isGeminiAvailable } from "./tools/gemini-tools.js";
import { isPerplexityAvailable } from "./tools/perplexity-tools.js";
import { loadConfig } from "./config.js";

export interface FocusDeepStep {
  model: string;
  action: string;
  prompt: string;
  reasoning?: string;
}

export interface FocusDeepPlan {
  sessionId: string;
  objective: string;
  steps: FocusDeepStep[];
  estimatedThoughts: number;
  availableModels: string[];
}

/**
 * Create a Focus-Deep plan based on available models
 */
export function createFocusDeepPlan(
  objective: string,
  domain?: string
): FocusDeepPlan {
  const config = loadConfig();
  const availableModels: string[] = [];
  const steps: FocusDeepStep[] = [];
  
  // Check what's available
  if (config.isClaudeCode) {
    availableModels.push(`claude-${config.claudeModel}`);
  }
  if (isGeminiAvailable()) {
    availableModels.push("gemini");
  }
  if (isPerplexityAvailable()) {
    availableModels.push("perplexity");
  }
  
  // Always have think tool
  availableModels.push("think");
  
  // Create optimal plan based on available models
  if (availableModels.length >= 4) {
    // Full multi-model Focus-Deep
    steps.push({
      model: availableModels.includes("gemini") ? "gemini" : availableModels[0],
      action: "brainstorm",
      prompt: "Generate innovative approaches and identify key challenges",
      reasoning: "Starting with creative exploration to map the solution space"
    });
    
    steps.push({
      model: availableModels.includes("claude") ? availableModels[0] : "think",
      action: "analyze",
      prompt: "Critically analyze the proposed approaches, identify gaps",
      reasoning: "Claude excels at systematic analysis and finding edge cases"
    });
    
    steps.push({
      model: availableModels.includes("perplexity") ? "perplexity" : "think",
      action: "research",
      prompt: "Research evidence, best practices, and similar implementations",
      reasoning: "Grounding our solution in real-world evidence"
    });
    
    steps.push({
      model: availableModels[0],
      action: "refine",
      prompt: "Refine the approach based on research findings",
      reasoning: "Incorporating evidence to improve the solution"
    });
    
    steps.push({
      model: "think",
      action: "synthesize",
      prompt: "Synthesize all insights into a final, actionable solution",
      reasoning: "Using think tool for cost-effective synthesis"
    });
  } else if (availableModels.length >= 2) {
    // Limited model Focus-Deep
    steps.push({
      model: availableModels[0],
      action: "explore",
      prompt: "Explore the problem space and generate initial solutions",
      reasoning: "Initial exploration with primary model"
    });
    
    steps.push({
      model: availableModels[1] !== "think" ? availableModels[1] : availableModels[0],
      action: "critique",
      prompt: "Critique and improve the initial solutions",
      reasoning: "Getting a second perspective or self-critique"
    });
    
    steps.push({
      model: availableModels[0],
      action: "refine",
      prompt: "Refine based on critique and develop final approach",
      reasoning: "Iterative improvement"
    });
    
    steps.push({
      model: "think",
      action: "synthesize",
      prompt: "Synthesize the final solution",
      reasoning: "Final synthesis"
    });
  } else {
    // Single model Focus-Deep (Claude Code only)
    steps.push({
      model: availableModels[0],
      action: "decompose",
      prompt: "Break down the problem into components",
      reasoning: "Problem decomposition"
    });
    
    steps.push({
      model: availableModels[0],
      action: "explore",
      prompt: "Explore solutions for each component",
      reasoning: "Solution exploration"
    });
    
    steps.push({
      model: availableModels[0],
      action: "integrate",
      prompt: "Integrate component solutions",
      reasoning: "Solution integration"
    });
    
    steps.push({
      model: "think",
      action: "finalize",
      prompt: "Finalize and validate the solution",
      reasoning: "Final validation"
    });
  }
  
  // Start sequential thinking session
  const sessionId = sequentialThinking.startSession(objective, steps.length);
  
  return {
    sessionId,
    objective,
    steps,
    estimatedThoughts: steps.length,
    availableModels
  };
}

/**
 * Generate Focus-Deep visualization
 */
export function generateFocusDeepVisualization(plan: FocusDeepPlan): string {
  let viz = `# 🧠⚡ FOCUS-DEEP SESSION\n\n`;
  viz += `**Objective**: ${plan.objective}\n`;
  viz += `**Available Models**: ${plan.availableModels.join(", ")}\n`;
  viz += `**Thoughts Planned**: ${plan.estimatedThoughts}\n\n`;
  
  // ASCII art for Focus-Deep
  viz += "```\n";
  viz += "@@@@@@@@@@@@@@@@@@@@@\n";
  viz += "@   ◉       ◉   @ 🧠⚡ ULTRATHINKING...\n";
  viz += "@       ≈       @    Maximum reasoning power\n";
  viz += "@   =========   @    Sequential + Multi-Model\n";
  viz += "@@@@@@@@@@@@@@@@@@@@@\n";
  viz += "```\n\n";
  
  // Model flow diagram
  viz += "## Reasoning Flow\n\n";
  viz += "```\n";
  plan.steps.forEach((step, idx) => {
    const arrow = idx < plan.steps.length - 1 ? " ──► " : "";
    viz += `[${step.model}:${step.action}]${arrow}`;
    if ((idx + 1) % 3 === 0 && idx < plan.steps.length - 1) {
      viz += "\n         ⬇\n";
    }
  });
  viz += "\n```\n\n";
  
  // Detailed steps
  viz += "## Execution Plan\n\n";
  plan.steps.forEach((step, idx) => {
    viz += `### Thought ${idx + 1}: ${step.action.toUpperCase()}\n`;
    viz += `**Model**: ${step.model}\n`;
    viz += `**Task**: ${step.prompt}\n`;
    if (step.reasoning) {
      viz += `**Reasoning**: ${step.reasoning}\n`;
    }
    viz += "\n";
  });
  
  // Instructions
  viz += "## How Focus-Deep Works\n\n";
  viz += "1. **Sequential Thinking**: Each thought builds on previous insights\n";
  viz += "2. **Multi-Model Orchestration**: Different models handle different aspects\n";
  viz += "3. **Dynamic Adaptation**: Can revise or branch based on discoveries\n";
  viz += "4. **Synthesis**: Final thought combines all insights\n\n";
  
  viz += "### Unique Features:\n";
  viz += "- 🔄 **Revision**: Can go back and revise earlier thoughts\n";
  viz += "- 🌿 **Branching**: Explore alternative reasoning paths\n";
  viz += "- 🎯 **Focused**: Each model used for its strengths\n";
  viz += "- 💰 **Efficient**: Think tool for synthesis (no API cost)\n\n";
  
  viz += "**Note**: This is the most powerful reasoning mode in tachibot-mcp, ";
  viz += "combining the best of sequential thinking and multi-model collaboration.\n";
  
  return viz;
}

/**
 * Execute a single Focus-Deep step
 */
export async function executeFocusDeepStep(
  sessionId: string,
  stepIndex: number,
  plan: FocusDeepPlan,
  previousResponse?: string
): Promise<{
  instruction: string;
  tool: string;
  parameters: any;
}> {
  const step = plan.steps[stepIndex];
  if (!step) {
    throw new Error(`Invalid step index: ${stepIndex}`);
  }
  
  // Build context from previous responses
  let context = `Objective: ${plan.objective}\n`;
  if (previousResponse) {
    context += `Previous insight: ${previousResponse.substring(0, 500)}...\n`;
  }
  context += `Current task: ${step.prompt}`;
  
  // Map to actual tool based on model and action
  let tool = "think"; // Default
  let parameters: any = { thought: context };
  
  if (step.model === "gemini" && step.action === "brainstorm") {
    tool = "gemini_brainstorm";
    parameters = { 
      prompt: plan.objective,
      claudeThoughts: previousResponse
    };
  } else if (step.model === "perplexity" && step.action === "research") {
    tool = "perplexity_research";
    parameters = {
      topic: plan.objective,
      depth: "standard"
    };
  } else if (step.model.includes("claude")) {
    // Use current Claude session
    tool = "think";
    parameters = { thought: `${step.action}: ${context}` };
  }
  
  return {
    instruction: `Step ${stepIndex + 1}/${plan.steps.length}: ${step.action}`,
    tool,
    parameters
  };
}

/**
 * Check if Focus-Deep can run optimally
 */
export function canRunFocusDeep(): {
  available: boolean;
  models: string[];
  quality: "optimal" | "good" | "basic";
} {
  const config = loadConfig();
  const models: string[] = [];

  if (config.isClaudeCode) {
    models.push("claude");
  }
  if (isGeminiAvailable()) {
    models.push("gemini");
  }
  if (isPerplexityAvailable()) {
    models.push("perplexity");
  }
  models.push("think"); // Always available

  const quality = models.length >= 4 ? "optimal" :
                   models.length >= 3 ? "good" :
                   "basic";

  return {
    available: true, // Always available, just varies in quality
    models,
    quality
  };
}

/**
 * Execute a Focus-Deep step with actual tool execution
 * Uses ToolExecutionService for model calls
 */
export async function executeFocusDeepStepWithTools(
  step: FocusDeepStep,
  context: string,
  toolService: { executeRealTool: (model: string, prompt: string, mode: any) => Promise<string> }
): Promise<{ output: string; model: string; duration: number }> {
  const startTime = Date.now();

  // Build the full prompt with context
  let fullPrompt = context;
  if (step.reasoning) {
    fullPrompt += `\n\n**Why this step**: ${step.reasoning}`;
  }
  fullPrompt += `\n\n**Task**: ${step.prompt}`;

  try {
    // Execute using the tool service
    // Import ReasoningMode dynamically to avoid circular dependency
    const { ReasoningMode } = await import("./reasoning-chain.js");
    const output = await toolService.executeRealTool(
      step.model,
      fullPrompt,
      ReasoningMode.DEEP_REASONING
    );

    const duration = Date.now() - startTime;

    return {
      output,
      model: step.model,
      duration
    };
  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMsg = error instanceof Error ? error.message : String(error);

    return {
      output: `[Error executing ${step.model}: ${errorMsg}]`,
      model: step.model,
      duration
    };
  }
}