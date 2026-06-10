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

dotenvConfig({
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
import { getToolAnnotations } from "./utils/tool-annotations.js";
import { truncateSmart } from "./utils/stream-distill.js";
import { trackToolCall, inferModelFromTool, estimateTokens, isTrackingEnabled, getUsageSummary, getAllReposSummary, getStatsJson, resetStats } from "./utils/usage-tracker.js";
import { checkForUpdates } from "./utils/update-checker.js";
// import { renderBigText, renderToolBadge } from "./utils/ink-renderer.js";  // Disabled - plain text only
// import { WorkflowVisualizerLite } from "./visualizer-lite.js"; // Unused - removed
import { collaborativeOrchestrator } from "./collaborative-orchestrator.js";
import { sequentialThinking, NextThoughtSchema, formatContextWindow } from "./sequential-thinking.js";
import { getProviderInfo } from "./tools/unified-ai-provider.js";
import { getAllPerplexityTools, isPerplexityAvailable } from "./tools/perplexity-tools.js";
import { getAllGrokTools, isGrokAvailable } from "./tools/grok-tools.js";
import { registerWorkflowTools } from "./tools/workflow-runner.js";
import { getAllTools } from "./tools/registry.js";
import { canRunFocusDeep } from "./focus-deep.js";
import { loadConfig } from "./config.js";
// import { registerSessionTools } from "./session/session-tools.js"; // Removed - not needed for minimal tool set
import { getAllAdvancedTools, areAdvancedModesAvailable } from "./tools/advanced-modes.js";
import { isOpenAIAvailable, getAllOpenAITools } from "./tools/openai-tools.js";
import { isGeminiAvailable } from "./tools/gemini-tools.js";
import { isOpenRouterAvailable } from "./tools/openrouter-tools.js";
import { withParamAliases } from "./utils/param-aliases.js";
// import { registerGPT5Tools, isGPT5Available } from "./tools/openai-gpt5-fixed.js"; // DISABLED - using regular openai-tools.ts
import { initializeOptimizations } from "./optimization/index.js";
import { FocusModeRegistry } from "./application/services/focus/FocusModeRegistry.js";
import { FocusToolService } from "./application/services/focus/FocusTool.service.js";
import { FocusExecutionService } from "./application/services/focus/FocusExecutionService.js";
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

// Initialize FocusExecutionService for executeNow mode
const focusExecutionService = new FocusExecutionService();

const focusToolService = new FocusToolService(
  focusModeRegistry,
  collaborativeOrchestrator,
  focusExecutionService
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

/** MCP tool execution context with logging and streaming capabilities
 * Note: This is a partial type - actual FastMCP Context has more properties.
 * Tools receive the full FastMCP Context which includes reportProgress and streamContent.
 */
interface MCPContext {
  log: {
    info: (message: string, metadata?: Record<string, any>) => void;
    error: (message: string, metadata?: Record<string, any>) => void;
    warn: (message: string, metadata?: Record<string, any>) => void;
    debug: (message: string, metadata?: Record<string, any>) => void;
  };
  /** Report progress to keep connection alive during long operations (provided by FastMCP) */
  reportProgress?: (progress: { progress: number; total: number }) => Promise<void>;
  /** Stream partial content - FastMCP extension (provided by FastMCP) */
  streamContent?: (content: any) => Promise<void>;
  /** Allow additional FastMCP context properties */
  [key: string]: any;
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

  // Auto-alias common param names (query/problem/prompt/question/topic)
  // so LLMs can use any synonym and the tool still works
  tool = withParamAliases(tool);

  if (!registeredTools.has(tool.name)) {
    // Wrap execute with usage tracking
    const originalExecute = tool.execute;

    // Merge MCP tool annotations (title, readOnlyHint, etc.)
    const toolAnnotations = getToolAnnotations(tool.name);
    const annotations = toolAnnotations
      ? {
          title: toolAnnotations.title,
          readOnlyHint: toolAnnotations.readOnlyHint,
          openWorldHint: toolAnnotations.openWorldHint,
          streamingHint: toolAnnotations.streamingHint,
          ...(toolAnnotations.destructiveHint !== undefined && { destructiveHint: toolAnnotations.destructiveHint }),
          ...(toolAnnotations.idempotentHint !== undefined && { idempotentHint: toolAnnotations.idempotentHint }),
        }
      : undefined;

    const wrappedTool = {
      ...tool,
      ...(annotations && { annotations }),
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

        // Apply render mode (sparse = badge + bold headers + stripped, etc.)
        if (typeof result === 'string') {
          const model = inferModelFromTool(tool.name) || undefined;
          // Truncate raw content BEFORE ANSI rendering — prevents mid-escape corruption
          let raw = result;
          const MAX_RAW_CHARS = 24000;
          if (raw.length > MAX_RAW_CHARS) {
            raw = truncateSmart(raw, MAX_RAW_CHARS);
          }
          const rendered = renderOutput(raw, { model, summary: tool.name });
          return { type: "text" as const, text: rendered };
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
      executeNow: _executeNow = true,
      models,
      temperature = 0.7,
      saveSession: _saveSession = true,
      maxTokensPerRound: _maxTokensPerRound = 2000,
      pingPongStyle: _pingPongStyle = "collaborative"
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

🎯 NEXT STEPS: Execute the tools above in sequence, then call focus with mode="reflect" to synthesize results.`;
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
${'═'.repeat(40)}

🧠 TachiBot Collective Synthesis

To synthesize results from your orchestration:

1. Review Outputs - Examine results from each tool in the workflow
2. Identify Patterns - Look for convergent themes and insights
3. Resolve Contradictions - Address any conflicting information
4. Extract Key Insights - Distill the most important findings
5. Create Action Plan - Develop next steps based on synthesis

TIPS FOR EFFECTIVE SYNTHESIS:
• Compare creative ideas with analytical validation
• Look for unexpected connections between tools
• Consider both immediate and long-term implications
• Identify knowledge gaps that need further exploration

Ready to help synthesize your collective intelligence results!`;
        
      default: // simple mode
        // BigText header disabled - plain text only
        // BigText header/badge removed — plain text only
        return `Enhanced reasoning for: "${query}"
${context ? `Context: ${context}` : ''}

COLLABORATIVE REASONING MODES
${'─'.repeat(30)}
• deep-reasoning - Multi-model collaboration with critique and synthesis
• code-brainstorm - Technical brainstorming for coding solutions
• dynamic-debate - Models argue different perspectives with rebuttals
• architecture-debate - Models debate architectural approaches
• algorithm-optimize - Iterative algorithm improvement
• security-audit - Multi-model security analysis
• api-design - Collaborative API design
• debug-detective - Collaborative debugging session
• performance-council - Team-based performance optimization

CLASSIC MODES
${'─'.repeat(30)}
• research/investigate - Deep investigation with evidence
• solve/analyze - Systematic problem-solving
• synthesis/integrate - Combine multiple perspectives
• fact-check/verify - Validate claims with evidence

FOR ADVANCED MULTI-ROUND WORKFLOWS
${'─'.repeat(30)}
Use the workflow tool for complex multi-step tasks with file-based outputs:
• \`workflow --name brainstorm-workflow\` - 7-step comprehensive brainstorming
• \`workflow --name pingpong-debate-3rounds\` - 3-round multi-model debate
• Workflows bypass the 25k MCP token limit by saving results to files

HELP COMMANDS
• \`focus --mode list-templates\` - See all available templates
• \`focus --mode examples\` - See example workflows
• \`workflow --action list\` - See all available workflows

EXAMPLE USAGE
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

▊ Advanced Ping-Pong Features:
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
**With memory save**: nextThought({ ..., memoryProvider: { provider: "dokoro", saveToMemory: true } })

Models: grok, gemini, openai, perplexity, kimi, qwen, think
Context: "none" (fresh start), "recent" (last 3), "all" (full history), or a number
Distillation: "off" (default, auto-distills at 8000+ tokens), "light" (preserves detail)
FinalJudge: Auto-judge when session completes (uses ALL context)
MemoryProvider: Pluggable memory (dokoro, mem0, custom). Set TACHIBOT_MEMORY_PROVIDER env for default`,
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
      // BigText header disabled - plain text only
      // BigText header/badge removed — plain text only
      let response = '';
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
      // If needed, user can explicitly call dokoro_session_summary_add

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
  description: "View or reset tool usage statistics. Put your REQUEST in the 'query' parameter.",
  parameters: z.object({
    query: z.string().optional().default("view").describe("What to do: 'view' (default), 'reset', or any question about usage"),
    action: z.enum(["view", "reset"]).optional().default("view").describe("Action (default: view)"),
    scope: z.enum(["current", "all"]).optional().default("current").describe("Current repo or all repos"),
    format: z.enum(["table", "json"]).optional().default("table").describe("Output format"),
  }),
  execute: async (args: { query?: string; action?: string; scope?: string; format?: string }): Promise<string> => {
    const action = args.action || (args.query?.includes("reset") ? "reset" : "view");
    const scope = args.scope || "current";
    const format = args.format || "table";

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

// Continue Focus Tool - continue a focus session
safeAddTool({
  name: "continue_focus",
  description: "Continue a focus session",
  parameters: z.object({
    sessionId: z.string().describe("The session ID returned from a previous focus call"),
  }),
  execute: async (args: { sessionId: string }, context: MCPContext): Promise<string> => {
    const { log } = context;
    const { sessionId } = args;

    log.info("Continuing focus session", { sessionId });

    try {
      const result = await focusExecutionService.continueFocus(sessionId);
      return result.output;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      log.error("Continue focus error", { error: errorMessage, sessionId });
      return `Error continuing focus session: ${errorMessage}`;
    }
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

// Async initialization function to handle dynamic imports and startup
async function initializeServer() {
  try {
    // Register ALL provider tools via the central scan registry. getAllTools()
    // evaluates the SAME is*Available() guards, in the SAME order, with the SAME
    // async dynamic-import timing the per-provider blocks used to use inline here
    // — so the registered set is byte-identical across every API-key scenario.
    // This single loop replaces the former Perplexity/Grok/OpenAI sync blocks and
    // the Gemini+jury / OpenRouter+planner / local / workflow-validator /
    // advanced / tachi / prompt-technique async blocks. The 5 inline tools
    // (think/focus/nextThought/usage_stats/continue_focus) are registered above
    // and are intentionally NOT returned by the registry, so there is no overlap.
    for (const t of await getAllTools()) {
      safeAddTool(t);
    }
    console.error(`✅ Registered provider tools via central registry`);

    // Register workflow tools (registers directly onto FastMCP, not via
    // safeAddTool — intentionally OUT of the registry, kept in its original spot).
    registerWorkflowTools(server);
    console.error(`✅ Registered workflow tools (execute, list, create, visualize)`);

    // Session management tools removed - not needed for minimal TachiBot

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
    setInterval(() => {
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

// ============================================================================
// Process lifecycle — stdio MCP transport considerations
//
// This server communicates with the MCP client (e.g. Claude Desktop) exclusively
// over stdio: the client reads JSON-RPC responses from our stdout and sends
// requests to our stdin. stderr is used for diagnostic logging only.
//
// Because all three file descriptors are pipes (not TTYs), the server's entire
// I/O depends on the client process staying alive. When the client exits:
//   • stdin reaches EOF — no more requests will arrive
//   • stdout/stderr become broken pipes — any write immediately fails with EPIPE
//
// The handlers below ensure the server responds to these conditions correctly
// instead of spinning in a crash loop or accumulating zombie processes.
// ============================================================================

// Keep the event loop alive so the server does not exit between MCP requests.
// Without this, Node would drain the queue and exit once startup completes.
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

// ── SIGPIPE (macOS / Linux only) ─────────────────────────────────────────────
// The OS sends SIGPIPE to a process that writes to a pipe whose read end has
// been closed (i.e. the MCP client exited). Default disposition is termination,
// but Node.js ignores SIGPIPE by default — so we register an explicit handler
// that exits cleanly with code 0. Windows does not have this signal; EPIPE is
// handled via stream 'error' events below instead.
if (process.platform !== 'win32') {
  process.on('SIGPIPE', () => {
    process.exit(0);
  });
}


// ── Stream-level EPIPE handlers (all platforms, primary path on Windows) ─────
// When the MCP client closes its end of the pipe, the next write to stdout or
// stderr emits an 'error' event with code 'EPIPE' on the underlying stream.
// Catching it here is the earliest possible interception point — the error never
// propagates to uncaughtException — and is the *only* mechanism available on
// Windows (which has no SIGPIPE signal).
//
// Why exit(0) and not just swallow the error?
// A stdio MCP server is meaningless without a connected client: no client means
// no requests to serve and no way to deliver responses. Exiting immediately frees
// all resources and lets the process manager (launchd, systemd, etc.) decide
// whether to restart.
(process.stdout as NodeJS.WriteStream).on('error', (err: NodeJS.ErrnoException) => {
  if (err.code === 'EPIPE') process.exit(0);
});
(process.stderr as NodeJS.WriteStream).on('error', (err: NodeJS.ErrnoException) => {
  if (err.code === 'EPIPE') process.exit(0);
});


// ── Unhandled promise rejections ─────────────────────────────────────────────
// Catches promises that were rejected without a .catch() handler. We log and
// continue rather than exit, because a single failed async tool call should not
// bring down the whole server.
//
// IMPORTANT: uses process.stderr.write() directly, NOT console.error().
// If stderr is a broken pipe at the point this fires, console.error() would
// itself throw EPIPE, which would re-enter uncaughtException below. Writing
// directly to the stream lets the stream's own 'error' handler (above) deal
// with a broken pipe without creating a re-entrant exception.
process.on('unhandledRejection', (reason, _promise) => {
  try {
    const reasonText = reason instanceof Error
      ? (reason.stack ?? reason.message)
      : String(reason);
    process.stderr.write(`Unhandled Rejection: ${reasonText}\n`);
  } catch {
    // stderr broken — the stream error handler above will exit; nothing to do here
  }
});


// ── Uncaught exceptions — last-resort handler ────────────────────────────────
// Catches any synchronous exception or async error that escaped all other
// handlers. Two failure modes need special treatment:
//
// 1. EPIPE — the MCP client disconnected and a write to stdout/stderr failed.
//    The stream-level handlers above are the *primary* EPIPE defence; this
//    branch is a safety net for the case where an EPIPE somehow bypasses them
//    (e.g. a write performed outside the stream abstraction).
//
//    Critically, we must NOT call console.error() here for EPIPE errors.
//    console.error() writes to process.stderr — the same broken pipe — which
//    throws another EPIPE, re-enters this handler, throws again, and so on.
//    The result is an infinite loop that pegs a CPU core at ~100% indefinitely
//    while V8 serialises a full stack trace on every iteration.
//
// 2. EADDRINUSE / EACCES — a port or socket is already in use or access is
//    denied. These are unrecoverable; exit with code 1.
//
// For all other exceptions we log (via process.stderr.write, not console.error,
// for the same re-entrance reason) and continue — the server stays up so that
// unrelated tools can still handle future requests.
process.on('uncaughtException', (error: NodeJS.ErrnoException) => {
  if (error.code === 'EPIPE') {
    process.exit(0);
  }
  try {
    process.stderr.write(`Uncaught Exception: ${error.stack ?? error.message}\n`);
  } catch {
    // stderr also broken — exit rather than spin
    process.exit(1);
  }
  if (error.message?.includes('EADDRINUSE') || error.message?.includes('EACCES')) {
    process.exit(1);
  }
});

// Initialize and start the server
initializeServer().catch((error) => {
  console.error("❌ Fatal error during server startup:", error);
  process.exit(1);
});