#!/usr/bin/env node

// FORCE COLORS: Must be set BEFORE any chalk imports (chalk reads env at module load)
// MCP uses stdio which is not a TTY, so chalk auto-disables colors
process.env.FORCE_COLOR = '3';  // 3 = truecolor (16M colors)

// CRITICAL FIX FOR MCPB: Redirect console.warn to console.error
// This prevents FastMCP's warnings from writing to stdout (which corrupts MCP JSON-RPC)
// FastMCP writes "[FastMCP warning] could not infer client capabilities" during init
// Must be done BEFORE any imports that use console
console.warn = function(...args: any[]) {
  // Redirect all console.warn to stderr via console.error
  console.error('[WARN]', ...args);
};

// Load environment variables FIRST, before any other imports
import { config as dotenvConfig } from 'dotenv';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// Load .env from project root (dist/src -> go up 2 levels)
// Load .env with override - API keys from .env take priority
// Theme vars (RENDER_OUTPUT, TACHIBOT_THEME) can be set in Claude Code settings
const envPath = path.resolve(__dirname, '../../.env');

// Save theme-related vars before loading .env
const savedThemeVars = {
  RENDER_OUTPUT: process.env.RENDER_OUTPUT,
  TACHIBOT_THEME: process.env.TACHIBOT_THEME,
};

const envResult = dotenvConfig({
  path: envPath,
  override: true  // API keys from .env take priority
});

// Restore theme vars if they were set
if (savedThemeVars.RENDER_OUTPUT) process.env.RENDER_OUTPUT = savedThemeVars.RENDER_OUTPUT;
if (savedThemeVars.TACHIBOT_THEME) process.env.TACHIBOT_THEME = savedThemeVars.TACHIBOT_THEME;

// Import centralized API key utilities
import { hasGrokApiKey, hasOpenAIApiKey, hasPerplexityApiKey, hasGeminiApiKey, hasOpenRouterApiKey } from "./utils/api-keys.js";

// Debug: Log API key status (for troubleshooting)
if (process.env.DEBUG === 'true') {
  console.error('[ENV] Loaded from:', envPath);
  console.error('[ENV] API Keys present:', {
    OPENROUTER: hasOpenRouterApiKey(),
    PERPLEXITY: hasPerplexityApiKey(),
    OPENAI: hasOpenAIApiKey(),
    GEMINI: hasGeminiApiKey(),
    GROK: hasGrokApiKey()
  });
}

import { FastMCP, UserError } from "fastmcp";
import { z } from "zod";
import { InstructionOrchestrator } from "./orchestrator-instructions.js";
import { validateToolInput, sanitizeForLogging } from "./utils/input-validator.js";
import { isToolEnabled, logToolConfiguration } from "./utils/tool-config.js";
import { renderOutput } from "./utils/ansi-renderer.js";
import { trackToolCall, inferModelFromTool, estimateTokens, isTrackingEnabled, getUsageSummary, getAllReposSummary, getStatsJson, resetStats } from "./utils/usage-tracker.js";
import { checkForUpdates, getUpdateStatus } from "./utils/update-checker.js";
import { renderBigText } from "./utils/ink-renderer.js";
// import { WorkflowVisualizerLite } from "./visualizer-lite.js"; // Unused - removed
import { collaborativeOrchestrator } from "./collaborative-orchestrator.js";
import { TechnicalDomain } from "./reasoning-chain.js";
import { sequentialThinking, NextThoughtSchema, formatContextWindow } from "./sequential-thinking.js";
import { getUnifiedAITools, getProviderInfo } from "./tools/unified-ai-provider.js";
import { getAllPerplexityTools, isPerplexityAvailable } from "./tools/perplexity-tools.js";
import { getAllGrokTools, isGrokAvailable } from "./tools/grok-tools.js";
import { registerWorkflowTools } from "./tools/workflow-runner.js";
import { validateWorkflowTool, validateWorkflowFileTool } from "./tools/workflow-validator-tool.js";
import { createFocusDeepPlan, generateFocusDeepVisualization, canRunFocusDeep } from "./focus-deep.js";
import { loadConfig } from "./config.js";
// import { registerSessionTools } from "./session/session-tools.js"; // Removed - not needed for minimal tool set
import { getAllAdvancedTools, areAdvancedModesAvailable } from "./tools/advanced-modes.js";
import { isOpenAIAvailable, getAllOpenAITools } from "./tools/openai-tools.js";
import { isGeminiAvailable, geminiBrainstormTool, geminiAnalyzeCodeTool } from "./tools/gemini-tools.js";
import { getAllOpenRouterTools, isOpenRouterAvailable } from "./tools/openrouter-tools.js";
// import { registerGPT5Tools, isGPT5Available } from "./tools/openai-gpt5-fixed.js"; // DISABLED - using regular openai-tools.ts
import { initializeOptimizations } from "./optimization/index.js";
import { FocusModeRegistry } from "./application/services/focus/FocusModeRegistry.js";
import { FocusToolService } from "./application/services/focus/FocusTool.service.js";
import { TachibotStatusMode } from "./application/services/focus/modes/tachibot-status.mode.js";
import { FocusDeepMode } from "./application/services/focus/modes/focus-deep.mode.js";

// Initialize optimizations (Phase 1)
// Note: Optimization system initialized but not actively used yet
// Cost limits are NOT enforced - set limits in provider dashboards instead
initializeOptimizations({
  enableCaching: process.env.TACHI_ENABLE_CACHE !== 'false',
  enableBatching: process.env.TACHI_ENABLE_BATCHING !== 'false',
});

// Create a new MCP server - TachiBot MCP v2.0
const server = new FastMCP({
  name: "tachibot-mcp",
  version: "2.0.0", // 12 consolidated tools, 2.6k tokens
});

// Load configuration
const config = loadConfig();

// Initialize Focus Tool Service with extracted modes
const focusModeRegistry = new FocusModeRegistry();
focusModeRegistry.register(new TachibotStatusMode());
focusModeRegistry.register(new FocusDeepMode());

const focusToolService = new FocusToolService(
  focusModeRegistry,
  collaborativeOrchestrator
);

// Initialize orchestrator
const orchestrator = new InstructionOrchestrator();

// Set MCP server reference for collaborative orchestrator
collaborativeOrchestrator.setMCPServer(server);

// Track registered tools to prevent duplicates
const registeredTools = new Set<string>();

// ============================================================================
// TypeScript Type Definitions for MCP Tools
// ============================================================================

/** MCP tool execution context with logging capabilities */
interface MCPContext {
  log: {
    info: (message: string, metadata?: Record<string, any>) => void;
    error: (message: string, metadata?: Record<string, any>) => void;
    warn: (message: string, metadata?: Record<string, any>) => void;
    debug: (message: string, metadata?: Record<string, any>) => void;
  };
}

/** Base MCP tool interface matching FastMCP structure */
interface MCPTool {
  name: string;
  description: string;
  parameters: z.ZodType<any>;
  execute: (args: any, context: MCPContext) => Promise<any>;
}

/** Arguments for the 'think' tool */
interface ThinkArgs {
  thought: string;
}

/** Arguments for the 'focus' tool */
interface FocusArgs {
  query: string;
  mode?: string;
  context?: string;
  domain?: string;
  tokenEfficient?: boolean;
  rounds?: number;
  executeNow?: boolean;
  models?: string[];
  temperature?: number;
  saveSession?: boolean;
  maxTokensPerRound?: number;
  pingPongStyle?: string;
}

/** Arguments for the 'nextThought' tool (enhanced with model execution) */
interface NextThoughtArgs {
  thought: string;
  nextThoughtNeeded: boolean;
  thoughtNumber?: number;
  totalThoughts?: number;
  isRevision?: boolean;
  revisesThought?: number;
  branchFromThought?: number;
  model?: string;
  executeModel?: boolean;      // Actually execute the model's tool
  contextWindow?: number | "none" | "recent" | "all";  // How many prev thoughts as context (none=0, recent=3, all=full)
  objective?: string;          // For auto-session creation
  distillContext?: "off" | "light";  // Distillation mode (default: off, auto-distills at 8000+ tokens)
  finalJudge?: string;         // Model to use as final judge when session completes
  memoryProvider?: {           // Pluggable memory MCP integration
    provider: string;
    saveToMemory?: boolean;
    loadFromMemory?: boolean;
  };
}

// ============================================================================
// Helper function to safely register tools
// ============================================================================

function safeAddTool(tool: MCPTool): void {
  // Check if tool is enabled in configuration
  if (!isToolEnabled(tool.name)) {
    return; // Skip disabled tools silently (logging handled by isToolEnabled)
  }

  if (!registeredTools.has(tool.name)) {
    // Wrap execute with usage tracking
    const originalExecute = tool.execute;
    const wrappedTool = {
      ...tool,
      execute: async (...args: Parameters<typeof originalExecute>) => {
        const result = await originalExecute(...args);

        // Track usage (fire and forget, don't block)
        if (isTrackingEnabled()) {
          try {
            const model = inferModelFromTool(tool.name);
            // Estimate tokens from result
            let tokens = 0;
            if (typeof result === 'string') {
              tokens = estimateTokens(result);
            } else if (result?.content) {
              const text = Array.isArray(result.content)
                ? result.content.map((c: any) => c.text || '').join('')
                : String(result.content);
              tokens = estimateTokens(text);
            }
            trackToolCall(tool.name, model, tokens);
          } catch {
            // Silently ignore tracking errors
          }
        }

        // Apply ANSI rendering to string results (centralized - no need to edit each tool!)
        // Just render everything - the ~50-100ms for large outputs is fine for CLI
        if (typeof result === 'string') {
          try {
            const model = inferModelFromTool(tool.name);
            // Tools returning null handle their own rendering - skip extra badge
            // (e.g., nextThought renders its own BigText header)
            if (model === null) {
              return renderOutput(result);  // No model badge
            }
            return renderOutput(result, model);
          } catch {
            return result; // Fallback to raw only on parse errors
          }
        }
        return result;
      }
    };
    server.addTool(wrappedTool);
    registeredTools.add(tool.name);
  } else {
    console.warn(`⚠️ Skipping duplicate tool registration: ${tool.name}`);
  }
}

// Add the original "think" tool (unchanged for backward compatibility)
safeAddTool({
  name: "think",
  description: "Log reasoning",
  parameters: z.object({
    thought: z.string()
  }),
  execute: async (args: ThinkArgs, context: MCPContext): Promise<string> => {
    const { log } = context;
    // Validate and sanitize input
    const validation = validateToolInput(args.thought);
    if (!validation.valid) {
      throw new UserError(validation.error || "Invalid thought input");
    }
    const thought = validation.sanitized;

    log.info("Thinking process", { thought: sanitizeForLogging(thought) });
    return thought;
  },
});

// Add the new "focus" tool with multiple reasoning strategies
safeAddTool({
  name: "focus",
  description: "Multi-model reasoning",
  parameters: z.object({
    query: z.string(),
    mode: z.enum([
      "simple", "debug", "deep-reasoning", "code-brainstorm",
      "architecture-debate", "research", "analyze",
      "focus-deep", "tachibot-status"
    ]).optional(),
    context: z.string().optional(),
    domain: z.enum([
      "architecture", "algorithms", "debugging", "security",
      "performance", "api_design", "database", "frontend",
      "backend", "devops", "testing"
    ]).optional(),
    tokenEfficient: z.boolean().optional(),
    rounds: z.number().optional(),
    executeNow: z.boolean().optional(),
    models: z.array(z.string()).optional(),
    temperature: z.number().optional(),
    saveSession: z.boolean().optional(),
    maxTokensPerRound: z.number().optional(),
    pingPongStyle: z.enum(["competitive", "collaborative", "debate", "build-upon"]).optional()
  }),
  execute: async (args: FocusArgs, mcpContext: MCPContext): Promise<string> => {
    const { log } = mcpContext;
    let {
      query,
      mode = "simple",
      context,
      domain,
      tokenEfficient = false,
      rounds = 5,
      executeNow = true,
      models,
      temperature = 0.7,
      saveSession = true,
      maxTokensPerRound = 2000,
      pingPongStyle = "collaborative"
    } = args;

    // Validate and sanitize input
    const queryValidation = validateToolInput(query);
    if (!queryValidation.valid) {
      throw new UserError(queryValidation.error || "Invalid query input");
    }
    query = queryValidation.sanitized; // Replace with sanitized version

    const contextValidation = context ? validateToolInput(context) : { valid: true, sanitized: context };
    if (!contextValidation.valid) {
      throw new UserError(contextValidation.error || "Invalid context input");
    }
    context = contextValidation.sanitized; // Replace with sanitized version

    log.info("Focus session started", {
      query: sanitizeForLogging(query),
      mode,
      context: context ? sanitizeForLogging(context) : undefined,
      tokenEfficient
    });

    // Initialize orchestrator if needed
    await orchestrator.initialize();

    // Try FocusToolService first (handles extracted modes and delegate modes)
    try {
      const result = await focusToolService.execute({
        query,
        mode,
        context,
        domain,
        tokenEfficient,
        rounds,
        models,
        temperature
      });
      return result.output;
    } catch (error) {
      // Mode not handled by service - fall through to legacy switch
      if (error instanceof Error && !error.message.includes('not handled by FocusToolService')) {
        // Real error, not just mode not found - rethrow
        throw error;
      }
    }

    // Legacy modes not yet migrated to FocusToolService
    // These modes have complex conditional logic that needs further refactoring
    switch (mode) {
      case "research":
      case "investigate":
      case "solve":
      case "analyze":
      case "synthesis":
      case "integrate":
      case "fact-check":
      case "verify":
      case "validate":
        // These modes not yet implemented - return plan for now
        try {
          const plan = orchestrator.generateOrchestrationPlan(mode, query, context);

          // Token-efficient response
          if (tokenEfficient) {
            return `TachiBot orchestrating...\n\n${plan.visualGuide}`;
          }

          // Full response
          return `${orchestrator.formatInstructions(plan)}

🎯 **Next Steps**: Execute the tools above in sequence, then call focus with mode="reflect" to synthesize results.`;
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          log.error("Orchestration error", { error: errorMessage });
          return `Error generating orchestration plan: ${errorMessage}`;
        }
        
      case "debug":
        return `🔍 DEBUG MODE ACTIVE

Debug Analysis for: "${query}"
${context ? `Context: ${context}` : ''}

• Workflow Options: creative, research, solve, synthesis, fact-check
• Available Tools: gemini_brainstorm, perplexity_research, openai_reason, think
• Token Mode: ${tokenEfficient ? 'Efficient' : 'Full'}
• Ready for orchestration

Use one of the workflow modes to generate an execution plan.`;

      case "reflect":
      case "review":
        return `🪞 REFLECTION MODE - COLLECTIVE SYNTHESIS

## 🧠 TachiBot Collective Synthesis

To synthesize results from your orchestration:

1. **Review Outputs**: Examine results from each tool in the workflow
2. **Identify Patterns**: Look for convergent themes and insights
3. **Resolve Contradictions**: Address any conflicting information
4. **Extract Key Insights**: Distill the most important findings
5. **Create Action Plan**: Develop next steps based on synthesis

### Tips for Effective Synthesis:
• Compare creative ideas with analytical validation
• Look for unexpected connections between tools
• Consider both immediate and long-term implications
• Identify knowledge gaps that need further exploration

Ready to help synthesize your collective intelligence results!`;
        
      default: // simple mode
        // BigText header (disabled via TACHIBOT_BIG_HEADERS=false)
        const focusHeader = renderBigText('FOCUS', { font: 'block', gradient: 'cristal' });
        return `${focusHeader}🎯 FOCUS MODE ACTIVE

Enhanced reasoning for: "${query}"
${context ? `Context: ${context}` : ''}

## 🧠 Collaborative Reasoning Modes:
• **deep-reasoning**: Multi-model collaboration with critique and synthesis
• **code-brainstorm**: Technical brainstorming for coding solutions
• **dynamic-debate**: Models argue different perspectives with rebuttals
• **architecture-debate**: Models debate architectural approaches
• **algorithm-optimize**: Iterative algorithm improvement
• **security-audit**: Multi-model security analysis
• **api-design**: Collaborative API design
• **debug-detective**: Collaborative debugging session
• **performance-council**: Team-based performance optimization

## 🔧 Classic Modes:
• **research/investigate**: Deep investigation with evidence
• **solve/analyze**: Systematic problem-solving
• **synthesis/integrate**: Combine multiple perspectives
• **fact-check/verify**: Validate claims with evidence

## 🚀 For Advanced Multi-Round Workflows:
Use the **workflow** tool for complex multi-step tasks with file-based outputs:
• \`workflow --name brainstorm-workflow\` - 7-step comprehensive brainstorming
• \`workflow --name pingpong-debate-3rounds\` - 3-round multi-model debate
• Workflows bypass the 25k MCP token limit by saving results to files

## 📚 Help Commands:
• \`focus --mode list-templates\` - See all available templates
• \`focus --mode examples\` - See example workflows
• \`workflow --action list\` - See all available workflows

## Example Usage:
\`\`\`
focus --mode deep-reasoning "How to scale a real-time collaboration system"
focus --mode dynamic-debate "TypeScript vs JavaScript for large codebases" --temperature 0.9
focus --mode code-brainstorm "Optimize React component performance"
focus --mode architecture-debate "Microservices vs Monolith for MVP"
focus --mode debug-detective "Memory leak in React app"

# For complex multi-round tasks, use workflows instead:
workflow --name pingpong-debate-3rounds --input '{"problem": "Revolutionary features for social media apps"}'
workflow --name brainstorm-workflow --input '{"topic": "AI-powered code review tools"}'
\`\`\`

## 💡 Advanced Ping-Pong Features:
- **Multi-model ecosystem**: Grok + Claude Code + Qwen + OpenAI + Perplexity + Gemini
- **Configurable rounds**: 1-30 rounds (with cost warnings)  
- **Custom model selection**: Pick your dream team
- **Interaction styles**: competitive, collaborative, debate, build-upon
- **Temperature control**: 0 (focused) to 1 (very creative)
- **Auto-save sessions**: Timestamped for later review

Focus session ready. Choose a mode to begin orchestration.`;
    }
  },
});

// Add Sequential Thinking tool (enhanced with multi-model execution)
safeAddTool({
  name: "nextThought",
  description: `Sequential thinking with optional multi-model execution. Auto-creates session if needed.

**Basic** (thought logging): nextThought({ thought: "Analyze X", nextThoughtNeeded: true })
**With execution**: nextThought({ thought: "...", model: "gemini", executeModel: true, nextThoughtNeeded: true })
**Light distillation**: nextThought({ thought: "...", model: "gemini", executeModel: true, distillContext: "light" })
**Judge step**: nextThought({ thought: "Final verdict", model: "gemini", executeModel: true, contextWindow: "all", nextThoughtNeeded: false })
**Auto final judge**: nextThought({ thought: "...", model: "kimi", executeModel: true, finalJudge: "gemini", nextThoughtNeeded: false })
**With memory save**: nextThought({ ..., memoryProvider: { provider: "devlog", saveToMemory: true } })

Models: grok, gemini, openai, perplexity, kimi, qwen, think
Context: "none" (fresh start), "recent" (last 3), "all" (full history), or a number
Distillation: "off" (default, auto-distills at 8000+ tokens), "light" (preserves detail)
FinalJudge: Auto-judge when session completes (uses ALL context)
MemoryProvider: Pluggable memory (devlog, mem0, custom). Set TACHIBOT_MEMORY_PROVIDER env for default`,
  parameters: NextThoughtSchema,
  execute: async (args: NextThoughtArgs, context: MCPContext): Promise<string> => {
    const { log } = context;
    try {
      // Validate and sanitize thought input
      const validation = validateToolInput(args.thought);
      if (!validation.valid) {
        throw new UserError(validation.error || "Invalid thought input");
      }

      // Resolve memory provider (explicit > env default > none)
      const defaultMemoryProvider = process.env.TACHIBOT_MEMORY_PROVIDER;
      const memoryProvider = args.memoryProvider ?? (defaultMemoryProvider ? {
        provider: defaultMemoryProvider,
        saveToMemory: true,
      } : undefined);

      // Resolve final judge (explicit > env default > none)
      const finalJudge = args.finalJudge ?? process.env.TACHIBOT_FINAL_JUDGE;

      // Use enhanced method with model execution support
      const result = await sequentialThinking.nextThoughtEnhanced({
        thought: validation.sanitized,
        nextThoughtNeeded: args.nextThoughtNeeded,
        thoughtNumber: args.thoughtNumber,
        totalThoughts: args.totalThoughts,
        isRevision: args.isRevision,
        revisesThought: args.revisesThought,
        branchFromThought: args.branchFromThought,
        model: args.model,
        executeModel: args.executeModel ?? false,
        contextWindow: args.contextWindow ?? 3,
        objective: args.objective,
        distillContext: args.distillContext ?? "off",
        finalJudge,
        memoryProvider,
      });

      // Format context window for display (show "all" instead of -1)
      const resolvedContext = typeof args.contextWindow === "string"
        ? args.contextWindow
        : formatContextWindow(args.contextWindow ?? 3);

      log.info("Sequential thought processed", {
        thoughtNumber: result.thoughtAdded.number,
        model: result.thoughtAdded.model,
        executed: args.executeModel ?? false,
        context: resolvedContext,
        distillMode: args.distillContext ?? "off",
        finalJudge,
      });

      // Build response with model output if available
      // BigText header (disabled via TACHIBOT_BIG_HEADERS=false)
      let response = renderBigText('THINK', { font: 'block', gradient: 'mind' });
      if (result.modelResponse) {
        response += `## Model Response (${args.model}):\n\n${result.modelResponse}\n\n---\n\n`;
      }

      // Add final judge response if present
      if (result.finalJudgeResponse) {
        response += `## Final Judge Response (${finalJudge}):\n\n${result.finalJudgeResponse}\n\n---\n\n`;
      }

      response += result.guidance;

      // Show distillation info if used
      if (result.distilledContext) {
        response += `\n\n**Context Distillation**: ~${result.distilledContext.tokenEstimate} tokens (${result.distilledContext.constraints.length} constraints, ${result.distilledContext.workingMemory.keyInsights.length} insights)`;
      }

      // Append available models info
      if (result.availableModels && result.availableModels.length > 0) {
        response += `\n\n**Available Models**: ${result.availableModels.join(", ")}`;
      }

      // Memory save hint suppressed - too noisy in output
      // If needed, user can explicitly call devlog_session_log

      return response;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      log.error("Sequential thinking error", { error: errorMessage });
      return `Error in sequential thinking: ${errorMessage}`;
    }
  }
});

// Usage Stats Tool - view/reset usage statistics
safeAddTool({
  name: "usage_stats",
  description: "View or reset tool usage statistics",
  parameters: z.object({
    action: z.enum(["view", "reset"]).describe("View stats or reset them"),
    scope: z.enum(["current", "all"]).default("current").describe("Current repo or all repos"),
    format: z.enum(["table", "json"]).default("table").describe("Output format"),
  }),
  execute: async (args: { action: string; scope: string; format: string }): Promise<string> => {
    const { action, scope, format } = args;

    if (action === "reset") {
      return resetStats(scope as 'current' | 'all');
    }

    // View stats
    if (format === "json") {
      return getStatsJson(scope as 'current' | 'all');
    }

    // Table format
    if (scope === "all") {
      return getAllReposSummary();
    }
    return getUsageSummary();
  },
});

// Skip registering generic unified AI tools - we have specific provider tools
// Commenting out to save ~1.5k tokens as these are redundant
// const unifiedAITools = getUnifiedAITools();
// unifiedAITools.forEach(tool => {
//   safeAddTool(tool);
// });

// Get provider info for status display
const providerInfo = getProviderInfo();
const availableProviders = Object.entries(providerInfo)
  .filter(([_, info]) => info.available)
  .map(([name]) => name);
console.error(`✅ Available AI providers: ${availableProviders.join(', ')}`);

// Register Perplexity tools separately (custom API, not OpenAI-compatible)
if (isPerplexityAvailable()) {
  const perplexityTools = getAllPerplexityTools();
  perplexityTools.forEach(tool => {
    safeAddTool(tool);
  });
  console.error(`✅ Registered ${perplexityTools.length} Perplexity tools (custom API)`);
}

// Register Grok tools separately (custom API, not OpenAI-compatible)
if (isGrokAvailable()) {
  const grokTools = getAllGrokTools();
  grokTools.forEach(tool => {
    safeAddTool(tool);
  });
  console.error(`✅ Registered ${grokTools.length} Grok tools (custom API)`);
}

// Register all OpenAI tools (includes openai_reason, openai_brainstorm, etc.)
if (isOpenAIAvailable()) {
  const openaiTools = getAllOpenAITools();
  openaiTools.forEach(tool => {
    safeAddTool(tool);
  });
  console.error(`✅ Registered ${openaiTools.length} OpenAI tools (GPT-5 suite)`);
}

// Async initialization function to handle dynamic imports and startup
async function initializeServer() {
  try {
    // Register select Gemini tools (brainstorm and analyze)
    if (isGeminiAvailable()) {
      const { geminiAnalyzeTextTool } = await import("./tools/gemini-tools.js");
      const geminiTools = [
        geminiBrainstormTool,     // Creative brainstorming
        geminiAnalyzeCodeTool,    // Code analysis
        geminiAnalyzeTextTool     // Text analysis (sentiment, summary, etc.)
      ];
      geminiTools.forEach(tool => {
        safeAddTool(tool);
      });
      console.error(`✅ Registered ${geminiTools.length} Gemini tools (brainstorm, code analysis, text analysis)`);
    }

    // Register OpenRouter tools (Qwen3 Coder, Kimi - selective based on flags)
    if (isOpenRouterAvailable()) {
      const { qwenCoderTool, qwenCompetitiveTool, kimiThinkingTool } = await import("./tools/openrouter-tools.js");

      // Always register qwen_coder
      safeAddTool(qwenCoderTool);
      let toolCount = 1;

      // Always register kimi_thinking (advanced agentic reasoning)
      safeAddTool(kimiThinkingTool);
      toolCount++;

      // Optional: Enable for competitive programming (LeetCode grinding)
      if (process.env.ENABLE_QWEN_COMPETITIVE === 'true') {
        safeAddTool(qwenCompetitiveTool);
        toolCount++;
        console.error(`🏆 Competitive programming mode enabled (qwen_competitive)`);
      }

      console.error(`✅ Registered ${toolCount} OpenRouter tools (Qwen3, Kimi)`);
    }


    // Register workflow tools
    registerWorkflowTools(server);
    console.error(`✅ Registered workflow tools (execute, list, create, visualize)`);

    // Register workflow validator tools
    safeAddTool(validateWorkflowTool);
    safeAddTool(validateWorkflowFileTool);
    console.error(`✅ Registered workflow validator tools`);

    // Session management tools removed - not needed for minimal TachiBot

    // Register advanced mode tools (Verifier, Challenger, Scout, etc.)
    if (areAdvancedModesAvailable()) {
      const advancedTools = getAllAdvancedTools();
      advancedTools.forEach(tool => {
        safeAddTool(tool);
      });
      console.error(`✅ Registered ${advancedTools.length} advanced mode tools`);
    }

    // Log startup information
    const perplexityCount = isPerplexityAvailable() ? getAllPerplexityTools().length : 0;
    const grokCount = isGrokAvailable() ? getAllGrokTools().length : 0;
    const openaiCount = isOpenAIAvailable() ? getAllOpenAITools().length : 0;
    const geminiCount = isGeminiAvailable() ? 3 : 0; // gemini_brainstorm, gemini_analyze_code, gemini_analyze_text
    const qwenCount = isOpenRouterAvailable() ? 1 : 0; // qwen_coder (plus competitive if enabled)
    const advancedCount = areAdvancedModesAvailable() ? getAllAdvancedTools().length : 0;
    const workflowCount = 4; // workflow tools
    const coreCount = 3; // think, focus, nextThought

    const totalTools = coreCount + perplexityCount + grokCount + openaiCount + geminiCount + qwenCount + advancedCount + workflowCount;
    console.error(`🚀 TachiBot MCP Server v5.0 - Minimal Tool Set Edition`);
    console.error(`Mode: ${config.isClaudeCode ? 'Claude Code' : 'Standalone'}`);
    console.error(`Tools registered: ${registeredTools.size} active (${totalTools} available)`);
    logToolConfiguration();
    if (config.isClaudeCode) {
      console.error(`Claude model: ${config.claudeModel}`);
    }
    console.error(`Focus-Deep: ${canRunFocusDeep().quality} quality`);

    // API Key Status (quick check)
    const apiStatus = {
      OpenRouter: hasOpenRouterApiKey(),
      Perplexity: hasPerplexityApiKey(),
      OpenAI: hasOpenAIApiKey(),
      Gemini: hasGeminiApiKey(),
      Grok: hasGrokApiKey()
    };
    const configured = Object.entries(apiStatus).filter(([_, v]) => v).map(([k, _]) => k);
    if (configured.length > 0) {
      console.error(`🔑 API Keys: ${configured.join(', ')}`);
    } else {
      console.error(`⚠️  No API keys configured. Add them to .env to enable external tools.`);
    }

    console.error(`Ready for orchestration!`);

    // Check for updates (non-blocking, fire and forget)
    checkForUpdates().catch(() => {}); // Silent fail

    // Start the server with stdio transport
    console.error("🚀 Starting server with stdio transport...");
    server.start({
      transportType: "stdio",
    });

    console.error("✅ Server.start() called successfully");

    // Keep the process alive with a heartbeat
    // This ensures the server doesn't exit prematurely
    const heartbeatInterval = setInterval(() => {
      // Heartbeat to keep process alive
      // Log every 30 seconds to show we're still alive
      const now = new Date().toISOString();
      console.error(`💓 Heartbeat: Server still alive at ${now}`);
    }, 30000); // Every 30 seconds

    console.error("✅ Heartbeat interval established");
    console.error("✅ Server started successfully and listening for MCP commands");
  } catch (error) {
    console.error("❌ Server initialization failed:", error);
    process.exit(1);
  }
}

// Debug: Log that the script is starting
console.error("🔧 TachiBot MCP Server starting up...");
console.error(`🔧 Node version: ${process.version}`);
console.error(`🔧 Working directory: ${process.cwd()}`);

// Keep the process alive
console.error("📌 Setting up process.stdin.resume() to keep process alive");
process.stdin.resume();

// Handle process termination gracefully
process.on('SIGINT', () => {
  console.error('Received SIGINT, shutting down gracefully...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.error('Received SIGTERM, shutting down gracefully...');
  process.exit(0);
});

// Catch unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  // Don't exit on unhandled rejection - log and continue
});

// Catch uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  // For MCP servers, we should try to continue if possible
  // Only exit if it's a critical error
  if (error.message?.includes('EADDRINUSE') || error.message?.includes('EACCES')) {
    process.exit(1);
  }
});

// Initialize and start the server
initializeServer().catch((error) => {
  console.error("❌ Fatal error during server startup:", error);
  process.exit(1);
});