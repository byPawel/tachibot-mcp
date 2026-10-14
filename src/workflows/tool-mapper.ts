/**
 * Tool Mapper - Maps workflow tool names to actual MCP tool implementations
 * Enables workflows to call real tools instead of returning placeholders
 */

import { callGemini } from "../tools/gemini-tools.js";
import { getAllPerplexityTools } from "../tools/perplexity-tools.js";
import {
  callOpenAI,
  OpenAIModel,
  openaiGpt5ReasonTool,
  openaiCodeReviewTool,
  openaiExplainTool,
} from "../tools/openai-tools.js";
import { callGrok, GrokModel } from "../tools/grok-tools.js";
import {
  OPENAI_MODELS,
  TOOL_DEFAULTS,
  GEMINI_MODELS,
} from "../config/model-constants.js";
import { validateToolInput, ValidationContext } from "../utils/input-validator.js";
import { hasGrokApiKey } from "../utils/api-keys.js";
import { trackToolCall, estimateTokens, isTrackingEnabled } from "../utils/usage-tracker.js";
import { jevDecideTool, JEV_DEFAULT_MODEL } from "../tools/jev-tool.js";

// Lazy load OpenRouter for Qwen models
let callOpenRouter: any = null;
let OpenRouterModel: any = null;
let qwenAlgoTool: any = null;
let qwqReasoningTool: any = null;
try {
  const openRouterModule = await import("../tools/openrouter-tools.js");
  callOpenRouter = openRouterModule.callOpenRouter;
  OpenRouterModel = openRouterModule.OpenRouterModel;
  qwenAlgoTool = openRouterModule.qwenAlgoTool;
  qwqReasoningTool = openRouterModule.qwqReasoningTool;
} catch {
  // OpenRouter not available
}

// Import modes if available
let Verifier: any = null,
  Challenger: any = null,
  Scout: any = null,
  Auditor: any = null,
  CommitGuardian: any = null,
  Architect: any = null;

// Hunter removed - was non-functional stub implementation
try {
  ({ Verifier } = await import("../modes/verifier.js"));
} catch {}
try {
  ({ Challenger } = await import("../modes/challenger.js"));
} catch {}
try {
  ({ Scout } = await import("../modes/scout.js"));
} catch {}
try {
  ({ Auditor } = await import("../modes/auditor.js"));
} catch {}
try {
  ({ CommitGuardian } = await import("../modes/commit-guardian.js"));
} catch {}
try {
  ({ Architect } = await import("../modes/architect.js"));
} catch {}

export interface ToolCallOptions {
  model?: string;
  maxTokens?: number;
  temperature?: number;
  systemPrompt?: string;
  skipValidation?: boolean; // Deprecated - use validationContext instead
  validationContext?: ValidationContext; // Context for input validation (default: 'llm-orchestration' for workflows)
}

export type ToolInput =
  | string
  | Record<string, any>;

export interface ToolExecutionResult {
  result: string;
  modelUsed: string;
}

/**
 * Main tool execution function - routes to appropriate implementation
 * Returns both the result and the actual model used
 */
export async function executeWorkflowTool(
  toolName: string,
  input: ToolInput,
  options: ToolCallOptions = {},
): Promise<ToolExecutionResult> {
  console.error(`\n📥 [tool-mapper] Executing tool: ${toolName}`);
  console.error(`📥 Input type: ${typeof input}`);
  if (typeof input === 'object') {
    console.error(`📥 Input keys: ${Object.keys(input).join(', ')}`);
    console.error(`📥 Input values preview:`);
    for (const [key, value] of Object.entries(input)) {
      const preview = typeof value === 'string' ? value.substring(0, 100) : JSON.stringify(value);
      console.error(`   - ${key}: ${preview}...`);
    }
  } else {
    console.error(`📥 Input value: ${String(input).substring(0, 100)}...`);
  }

  // jev_decide takes a structured {state, questions} input, not a prompt, so it
  // is routed before prompt extraction. Without this case a Jev step fell
  // through to `default` and silently ran GPT codex-mini as free text.
  if (toolName === "jev_decide") {
    return executeJevStep(input);
  }

  // ============================================
  // UNIVERSAL INPUT NORMALIZATION
  // Support ANY parameter name for maximum DX
  // ============================================

  // Extract a universal "main content" from common parameter names
  // Priority order: most specific → most generic
  const extractMainContent = () => {
    if (typeof input === "string") return input;

    // Try all common parameter names (order matters!)
    return input.thought ||       // think tool reflection
           input.requirements ||  // qwen_coder, task-specific
           input.problem ||        // brainstorm, reasoning tools
           input.query ||          // search/ask tools
           input.topic ||          // research tools
           input.prompt ||         // generic prompt
           input.text ||           // text analysis
           input.code ||           // code analysis
           input.context ||        // context-based tools
           input.content ||        // generic content
           input.message ||        // generic message
           input.instruction ||    // generic instruction
           input.previousStep ||   // workflow chaining
           // Registry-delegated tools name their main field anything
           // (question, perspectives, diff, plan...) — take the first string.
           (Object.values(input).find((v) => typeof v === "string" && v.trim()) as string | undefined) ||
           "";
  };

  let prompt = extractMainContent();

  console.error(`📥 Extracted main content: ${prompt.length} chars`);
  if (prompt.length > 0) {
    console.error(`📥 Preview: "${prompt.substring(0, 200)}..."`);
  } else {
    console.error(`⚠️  WARNING: No content extracted from input!`);
    if (typeof input === 'object') {
      console.error(`   Available input keys: ${Object.keys(input).join(', ')}`);
    }
  }

  // Validate and sanitize input with context-aware rules
  // Workflows default to 'llm-orchestration' context (allows code patterns)
  const validationContext: ValidationContext = options.validationContext ??
    (options.skipValidation ? 'llm-orchestration' : 'llm-orchestration'); // Workflow calls use llm-orchestration
  console.error(`🔒 Validation context: ${validationContext}`);
  console.error(`🔍 Running validation on prompt (length: ${prompt.length})`);
  const validation = validateToolInput(prompt, validationContext);
  console.error(`🔍 Validation result: valid=${validation.valid}, error=${validation.error}`);
  if (!validation.valid) {
    console.error(`❌ Validation failed: ${validation.error}`);
    console.error(`❌ Failed prompt length: ${prompt.length}`);
    console.error(`❌ Failed prompt preview: "${prompt.substring(0, 500)}..."`);
    return { result: `[Error: ${validation.error}]`, modelUsed: "error" };
  }
  prompt = validation.sanitized;

  // Get defaults for this specific tool, fallback to generic defaults
  const toolDefaults = TOOL_DEFAULTS[
    toolName as keyof typeof TOOL_DEFAULTS
  ] || {
    maxTokens: 2000,
    temperature: 0.7,
  };

  const {
    model = ('model' in toolDefaults ? (toolDefaults.model as string) : OPENAI_MODELS.CODEX_MINI),
    maxTokens = options.maxTokens ?? toolDefaults.maxTokens ?? 2000,
    temperature = options.temperature ?? toolDefaults.temperature ?? 0.7,
    systemPrompt,
  } = options;

  // Helper to convert to messages array format
  const toMessages = (text: string, system?: string) => {
    const messages: Array<{ role: string; content: string }> = [];
    if (system) {
      messages.push({ role: "system", content: system });
    }
    messages.push({ role: "user", content: text });
    return messages;
  };

  // Helper to build result with model metadata + tracking
  const buildResult = (result: string, actualModel: string): ToolExecutionResult => {
    // Track workflow tool usage
    if (isTrackingEnabled()) {
      try {
        const tokens = estimateTokens(result);
        trackToolCall(`workflow:${toolName}`, actualModel, tokens);
      } catch {
        // Silently ignore tracking errors
      }
    }
    return { result, modelUsed: actualModel };
  };

  try {
    let actualModel: any = model; // Track the actual model used (can be OpenAI51Model, GrokModel, or string)
    // Route to appropriate tool based on name
    switch (toolName) {
      // ============ GEMINI TOOLS ============
      case "gemini_query":
      case "gemini_brainstorm":
      case "gemini_analyze_code":
      case "gemini_analyze_text":
        actualModel = model === "flash" ? GEMINI_MODELS.FLASH : GEMINI_MODELS.GEMINI_3_PRO;
        return buildResult(
          await callGemini(
            prompt,
            actualModel,
            systemPrompt,
            temperature,
            validationContext, // Pass validation context to Gemini
          ),
          actualModel
        );

      // ============ PERPLEXITY TOOLS ============
      case "perplexity_ask":
      case "perplexity_code_search":
      case "perplexity_reason":
      case "perplexity_research":
        // Delegate to registered MCP tool implementations to ensure consistent behavior
        const perplexityTools = getAllPerplexityTools();
        const perplexityTool = perplexityTools.find(t => t.name === toolName);

        if (!perplexityTool) {
          return buildResult(`[Perplexity tool ${toolName} not available. Check PERPLEXITY_API_KEY]`, "error");
        }

        // Build args based on tool type
        let perplexityArgs: any;
        if (toolName === "perplexity_ask") {
          perplexityArgs = { query: prompt, searchRecency: "month" };
        } else if (toolName === "perplexity_code_search") {
          perplexityArgs = { query: prompt };
        } else if (toolName === "perplexity_reason") {
          perplexityArgs = { problem: prompt };
        } else if (toolName === "perplexity_research") {
          // Handle structured input for perplexity_research
          let topic: string;
          let questions: string[] | undefined;
          let depth: "quick" | "standard" | "deep" = "standard";

          if (typeof input === 'object' && input.topic) {
            topic = input.topic as string;
            questions = input.questions as string[] | undefined;
            depth = (input.depth as "quick" | "standard" | "deep") || "standard";
          } else {
            topic = prompt || "General research";
          }

          perplexityArgs = { topic, questions, depth };
        }

        const perplexityResult = await perplexityTool.execute(perplexityArgs, { log: console.error });
        return buildResult(perplexityResult, "perplexity-sonar-pro");

      // ============ QWEN TOOLS (via OpenRouter) ============
      // ROOT CAUSE NOTE: most cases in this switch are a PARALLEL
      // REIMPLEMENTATION — they call provider functions with hand-written
      // prompts instead of delegating to the registered tool objects, so
      // model and prompt can silently drift from the real MCP tool
      // (qwen_algo ran QWQ-32B with a generic prompt while the real tool ran
      // Qwen3.8-Max with the Principal Algorithm Engineer protocol). When
      // touching a case, prefer delegating to the real tool object — see the
      // perplexity_*, qwq_reason, qwen_algo, openai_reason, openai_code_review
      // and openai_explain cases.
      case "qwen_coder":
        if (!callOpenRouter) {
          return buildResult("[Qwen tools require OpenRouter API key. Add OPENROUTER_API_KEY to .env]", "error");
        }
        return buildResult(
          await callOpenRouter(
            toMessages(prompt, systemPrompt),
            OpenRouterModel.QWEN3_CODER,
            temperature,
            maxTokens,
          ),
          OpenRouterModel.QWEN3_CODER
        );

      case "qwq_reason":
        if (!qwqReasoningTool) {
          return buildResult("[Qwen tools require OpenRouter API key. Add OPENROUTER_API_KEY to .env]", "error");
        }
        // Delegate to the real tool so workflows get the same 4-persona
        // multi-perspective protocol as the qwq_reason MCP tool
        return buildResult(
          await qwqReasoningTool.execute(
            {
              problem: prompt,
              ...(typeof input === 'object' && input.context ? { context: input.context } : {}),
              ...(typeof input === 'object' && input.approach ? { approach: input.approach } : {}),
            },
            { log: console.error },
          ),
          OpenRouterModel.QWEN3_8_27B
        );

      case "qwen_algo":
        if (!qwenAlgoTool) {
          return buildResult("[Qwen algo tool requires OpenRouter API key. Add OPENROUTER_API_KEY to .env]", "error");
        }
        // Delegate to the real tool: Qwen3.8-Max with reasoning_effort=medium
        // and the full algorithm-analysis prompt (this case previously ran
        // QWQ-32B with a generic prompt — a silently weaker model)
        return buildResult(
          await qwenAlgoTool.execute(
            {
              problem: prompt,
              focus: typeof input === 'object' && input.focus ? input.focus : 'general',
              ...(typeof input === 'object' && input.constraints ? { constraints: input.constraints } : {}),
              ...(typeof input === 'object' && input.context ? { context: input.context } : {}),
            },
            { log: console.error },
          ),
          OpenRouterModel.QWEN3_8_MAX
        );

      // ============ KIMI TOOLS (via OpenRouter) ============
      case "kimi_thinking":
        if (!callOpenRouter) {
          return buildResult("[Kimi tools require OpenRouter API key. Add OPENROUTER_API_KEY to .env]", "error");
        }
        const kimiModel = OpenRouterModel.KIMI_K2_THINKING;
        return buildResult(
          await callOpenRouter(
            toMessages(prompt, systemPrompt),
            kimiModel,
            temperature,
            maxTokens,
          ),
          kimiModel
        );

      // ============ OPENAI TOOLS ============
      case "openai_brainstorm":
      case "openai_analyze":
        actualModel = (model || OPENAI_MODELS.FULL) as OpenAIModel;
        // OpenAI still uses boolean - convert from context (llm-orchestration = skip validation)
        const skipValidationAnalyze = validationContext !== 'user-input';
        return buildResult(
          await callOpenAI(
            toMessages(prompt, systemPrompt),
            actualModel,
            temperature,
            maxTokens,
            "low", // reasoningEffort
            false, // requireConfirmation
            skipValidationAnalyze,
          ),
          actualModel
        );

      // openai_reason / openai_code_review / openai_explain delegate to the real
      // tools so a workflow step runs the same model, effort and prompt as the MCP
      // tool of the same name (code_review/explain ran gpt-5.6-luna here while the
      // tools ran the flagship / sol; openai_reason sent "high" with a generic prompt).
      case "openai_reason":
        return buildResult(
          await openaiGpt5ReasonTool.execute(
            {
              query: prompt,
              ...(typeof input === 'object' && input.context ? { context: input.context } : {}),
              ...(typeof input === 'object' && input.mode ? { mode: input.mode } : {}),
            },
            { log: console.error, skipValidation: validationContext !== 'user-input' },
          ),
          OPENAI_MODELS.DEFAULT
        );

      case "openai_code_review":
        return buildResult(
          await openaiCodeReviewTool.execute(
            {
              code: prompt,
              ...(typeof input === 'object' && input.language ? { language: input.language } : {}),
              ...(typeof input === 'object' && Array.isArray(input.focusAreas) ? { focusAreas: input.focusAreas } : {}),
            },
            { log: console.error, skipValidation: validationContext !== 'user-input' },
          ),
          OPENAI_MODELS.DEFAULT
        );

      case "openai_explain":
        return buildResult(
          await openaiExplainTool.execute(
            {
              topic: prompt,
              ...(typeof input === 'object' && input.level ? { level: input.level } : {}),
              ...(typeof input === 'object' && input.style ? { style: input.style } : {}),
            },
            { log: console.error, skipValidation: validationContext !== 'user-input' },
          ),
          OPENAI_MODELS.SOL
        );

      case "gpt5_analyze":
        return buildResult(
          await callOpenAI(
            toMessages(prompt, systemPrompt),
            OPENAI_MODELS.CODEX_MINI as OpenAIModel,
            0.7,
            maxTokens,
          ),
          OPENAI_MODELS.CODEX_MINI
        );

      // ============ GPT-5 TOOLS ============
      case "gpt5":
        // Map to flagship gpt-5.1
        const gpt5Full = OPENAI_MODELS.FULL as OpenAIModel; // gpt-5.1 flagship
        return buildResult(
          await callOpenAI(
            toMessages(prompt, systemPrompt),
            gpt5Full,
            0.7,
            maxTokens,
            "medium", // reasoning_effort
          ),
          gpt5Full
        );

      case "gpt5_mini":
        // Map to gpt-5.1-codex-mini for code tasks (most workflows use for code)
        const gpt5CodexMini = OPENAI_MODELS.CODEX_MINI as OpenAIModel; // gpt-5.1-codex-mini
        return buildResult(
          await callOpenAI(
            toMessages(prompt, systemPrompt),
            gpt5CodexMini,
            0.7,
            maxTokens,
            "low", // reasoning_effort
          ),
          gpt5CodexMini
        );

      // ============ GROK TOOLS ============
      case "grok":
      case "grok_reason":
      case "grok_brainstorm":
      case "grok_search":
        // Use reasoning model for reasoning/creative tasks
        actualModel = GrokModel.GROK_4_20_REASONING; // Grok 4.20 flagship (low hallucination, 2M context, $2/$6)
        return buildResult(
          await callGrok(
            toMessages(prompt, systemPrompt),
            actualModel,
            temperature,
            maxTokens,
          ),
          actualModel
        );

      case "grok_code":
      case "grok_debug":
        // Use non-reasoning model for code/debug (tool-calling optimized)
        actualModel = GrokModel.GROK_4_20_NON_REASONING; // Grok 4.20 non-reasoning (flagship quality)
        return buildResult(
          await callGrok(
            toMessages(prompt, systemPrompt),
            actualModel,
            temperature,
            maxTokens,
          ),
          actualModel
        );

      case "grok_heavy": // Grok Heavy is grok-4-0709 with extended context
        actualModel = GrokModel.GROK_4_20_MULTI_AGENT; // Grok 4.20 multi-agent (4-16 agents, $2/$6)
        return buildResult(
          await callGrok(
            toMessages(prompt, systemPrompt),
            actualModel,
            temperature,
            maxTokens,
          ),
          actualModel
        );

      // ============ ADVANCED MODES ============
      case "verifier":
        if (Verifier) {
          const verifier = new Verifier();
          // Pass model, variant, and other options from workflow input
          const verifyOptions: any = { maxTokens };
          if (typeof input === 'object') {
            if (input.model) verifyOptions.model = input.model;
            if (input.variant) verifyOptions.variant = input.variant;
            if (input.timeout) verifyOptions.timeout = input.timeout;
          }
          const result = await verifier.verify(prompt, verifyOptions);
          // Return synthesis property instead of JSON.stringify
          return buildResult(result.synthesis || JSON.stringify(result, null, 2), "verifier-multi-model");
        }
        return buildResult(`[Verifier mode not available]`, "error");

      case "challenger":
        if (Challenger) {
          const challenger = new Challenger();
          // Pass model and other options from workflow input
          const challengeOptions: any = { maxTokens };
          if (typeof input === 'object') {
            if (input.model) challengeOptions.model = input.model;
            if (input.thoroughness) challengeOptions.thoroughness = input.thoroughness;
            if (input.temperature) challengeOptions.temperature = input.temperature;
          }
          const result = await challenger.challenge(prompt, challengeOptions);
          // Return synthesis property instead of JSON.stringify
          return buildResult(result.synthesis || JSON.stringify(result, null, 2), "challenger-multi-model");
        }
        return buildResult(`[Challenger mode not available]`, "error");

      case "scout":
        if (Scout) {
          const scout = new Scout();
          // Pass model and other options from workflow input
          const scoutOptions: any = { maxTokens };
          if (typeof input === 'object') {
            if (input.model) scoutOptions.model = input.model;
            if (input.depth) scoutOptions.depth = input.depth;
            if (input.includeSources) scoutOptions.includeSources = input.includeSources;
          }
          const result = await scout.scout(prompt, scoutOptions);
          // Return synthesis property instead of JSON.stringify
          return buildResult(result.synthesis || JSON.stringify(result, null, 2), "scout-perplexity");
        }
        return buildResult(`[Scout mode not available]`, "error");

      case "auditor":
        if (Auditor) {
          const auditor = new Auditor();
          // Pass options from workflow input
          const auditOptions: any = { maxTokens };
          if (typeof input === 'object') {
            if (input.evidenceRequired !== undefined) auditOptions.evidenceRequired = input.evidenceRequired;
          }
          const result = await auditor.audit(prompt, auditOptions);
          // Return synthesis property instead of JSON.stringify
          return buildResult(result.synthesis || JSON.stringify(result, null, 2), "auditor-multi-model");
        }
        return buildResult(`[Auditor mode not available]`, "error");

      case "commit_guardian":
        if (CommitGuardian) {
          const guardian = new CommitGuardian();
          // Pass options from workflow input
          const guardianOptions: any = { maxTokens };
          if (typeof input === 'object') {
            if (input.strict !== undefined) guardianOptions.strict = input.strict;
            if (input.checkSecurity !== undefined) guardianOptions.checkSecurity = input.checkSecurity;
            if (input.checkQuality !== undefined) guardianOptions.checkQuality = input.checkQuality;
            if (input.checkTests !== undefined) guardianOptions.checkTests = input.checkTests;
          }
          const result = await guardian.validate(prompt, guardianOptions);
          // Return summary property instead of JSON.stringify
          return buildResult(result.summary || JSON.stringify(result, null, 2), "commit-guardian");
        }
        return buildResult(`[CommitGuardian mode not available]`, "error");

      case "architect":
        if (Architect) {
          const architect = new Architect();
          // Pass options from workflow input
          const architectOptions: any = { maxTokens };
          if (typeof input === 'object') {
            if (input.path) architectOptions.path = input.path;
            if (input.depth) architectOptions.depth = input.depth;
            if (input.focusAreas) architectOptions.focusAreas = input.focusAreas;
          }
          const result = await architect.analyze(prompt, architectOptions);
          // Return synthesis property instead of JSON.stringify
          return buildResult(result.synthesis || JSON.stringify(result, null, 2), "architect-multi-model");
        }
        return buildResult(`[Architect mode not available]`, "error");

      // ============ META TOOLS ============
      case "think":
        // Simple reflection tool - uses GPT-5.1-codex-mini for cost efficiency
        return buildResult(
          await callOpenAI(
            toMessages(
              `Reflect on the following and provide brief insights:\n\n${prompt}`,
              "You are a reflective thinking assistant. Provide concise, insightful analysis.",
            ),
            OPENAI_MODELS.CODEX_MINI as OpenAIModel,
            0.7,
            500,
          ),
          OPENAI_MODELS.CODEX_MINI
        );

      case "focus":
        // Deep analysis tool - uses GPT-5.1
        return buildResult(
          await callOpenAI(
            toMessages(
              `Perform deep analysis and synthesis:\n\n${prompt}`,
              "You are an advanced analytical assistant. Provide comprehensive, synthesized insights.",
            ),
            OPENAI_MODELS.FULL as OpenAIModel,
            0.8,
            maxTokens,
          ),
          OPENAI_MODELS.FULL
        );

      case "code_reviewer":
        return buildResult(
          await callOpenAI(
            toMessages(
              `Perform thorough code review:\n\n${prompt}`,
              "You are an expert code reviewer. Analyze for bugs, security issues, performance, and best practices.",
            ),
            OPENAI_MODELS.FULL as OpenAIModel,
            0.5,
            maxTokens,
          ),
          OPENAI_MODELS.FULL
        );

      case "test_architect":
        return buildResult(
          await callOpenAI(
            toMessages(
              `Design comprehensive tests:\n\n${prompt}`,
              "You are a testing expert. Design thorough test suites with edge cases.",
            ),
            OPENAI_MODELS.FULL as OpenAIModel,
            0.6,
            maxTokens,
          ),
          OPENAI_MODELS.FULL
        );

      case "documentation_writer":
        return buildResult(
          await callOpenAI(
            toMessages(
              `Create clear documentation:\n\n${prompt}`,
              "You are a technical writer. Create clear, comprehensive documentation.",
            ),
            OPENAI_MODELS.CODEX_MINI as OpenAIModel,
            0.7,
            maxTokens,
          ),
          OPENAI_MODELS.CODEX_MINI
        );

      // ============ DEFAULT ============
      // Anything without a hand-written case is delegated to the REAL registered
      // tool object (same model, prompt and params as the MCP tool). This used to
      // fall back to GPT codex-mini for every unknown name — 46 registered tools
      // (deepseek_*, glm_reason, jury, gemini_judge, minimax_*, ...) silently ran
      // the wrong model and returned its prose. Unknown names now fail loudly.
      default: {
        const delegated = await executeRegisteredTool(toolName, input, prompt);
        if (delegated) return buildResult(delegated.result, delegated.modelUsed);
        return buildResult(
          `[Error: unknown workflow tool '${toolName}' — not a mapped tool and not registered (missing API key or disabled in the active profile?)]`,
          "error",
        );
      }
    }
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error(`❌ Tool execution error for ${toolName}:`, errorMsg);
    return buildResult(`[Error executing ${toolName}: ${errorMsg}]`, "error");
  }
}

// Tools that must not run as a workflow step (recursion / session control).
const NON_STEP_TOOLS = new Set([
  "workflow", "workflow_start", "continue_workflow", "workflow_status",
  "create_workflow", "visualize_workflow", "list_workflows",
]);

let registeredToolsPromise: Promise<Array<{ name: string; parameters: any; execute: (...args: any[]) => Promise<any> }>> | null = null;

/** Registered provider tools, loaded once. Dynamic import avoids a registry ↔ mapper cycle. */
function getRegisteredTools() {
  if (!registeredToolsPromise) {
    registeredToolsPromise = import("../tools/registry.js")
      .then((m) => m.getAllTools())
      .catch((error) => {
        registeredToolsPromise = null;
        throw error;
      });
  }
  return registeredToolsPromise;
}

const stepToolContext = {
  log: Object.assign((...a: unknown[]) => console.error(...a), {
    info: (...a: unknown[]) => console.error(...a),
    warn: (...a: unknown[]) => console.error(...a),
    error: (...a: unknown[]) => console.error(...a),
    debug: () => {},
  }),
  reportProgress: async () => {},
};

/**
 * Run a workflow step through the registered MCP tool of the same name.
 * Object input is validated against the tool's zod schema; required fields the
 * step left out are filled with the step's main text (so `input: { query }`
 * still reaches a tool whose field is `problem`). Returns null when no
 * registered tool has that name.
 */
export async function executeRegisteredTool(
  toolName: string,
  input: ToolInput,
  prompt: string,
): Promise<ToolExecutionResult | null> {
  if (NON_STEP_TOOLS.has(toolName)) {
    return { result: `[Error: '${toolName}' cannot run as a workflow step]`, modelUsed: "error" };
  }
  const tool = (await getRegisteredTools()).find((t) => t.name === toolName);
  if (!tool) return null;

  const args: Record<string, any> = typeof input === "object" && input ? { ...input } : {};
  let parsed = tool.parameters.safeParse(args);
  if (!parsed.success && prompt) {
    for (const issue of parsed.error.issues) {
      if (issue.code === "invalid_type" && issue.received === "undefined" && issue.path.length === 1) {
        args[issue.path[0] as string] = prompt;
      }
    }
    parsed = tool.parameters.safeParse(args);
  }
  if (!parsed.success) {
    const problems = parsed.error.issues
      .map((i: any) => `${i.path.join(".") || "(input)"}: ${i.message}`)
      .join("; ");
    return { result: `[Error: invalid input for ${toolName} — ${problems}]`, modelUsed: "error" };
  }

  const output = await tool.execute(parsed.data, stepToolContext);
  const result = typeof output === "string" ? output : JSON.stringify(output, null, 2);
  return { result, modelUsed: toolName };
}

/**
 * Workflow adapter for jev_decide. Accepts `questions` as an object or a JSON
 * string (YAML block scalars), and falls back to the step's text content for
 * `state` so `state: "${previous.output}"` and `previousStep` both work.
 * The result is Jev's JSON, which `condition.if` can read into, e.g.
 * `gate.answers.grounded.noul >= 0.7`.
 */
export async function executeJevStep(input: ToolInput): Promise<ToolExecutionResult> {
  const fail = (msg: string): ToolExecutionResult => ({ result: `[Jev error: ${msg}]`, modelUsed: "error" });
  if (typeof input === "string" || !input) {
    return fail("jev_decide needs an object input: { state, questions: { name: { type, instructions, criteria? } } }");
  }

  let questions: any = input.questions;
  if (typeof questions === "string") {
    try {
      questions = JSON.parse(questions);
    } catch {
      return fail("'questions' is a string but not valid JSON");
    }
  }
  if (!questions || typeof questions !== "object" || Array.isArray(questions)) {
    return fail("'questions' must be a map of named questions");
  }

  const state = input.state ?? input.context ?? input.previousStep ?? input.query ?? input.text ?? input.content;
  if (state === undefined || state === null || state === "") {
    return fail("'state' is empty — pass the text or object Jev should judge");
  }

  const model = typeof input.model === "string" && input.model ? input.model : JEV_DEFAULT_MODEL;
  const result = String(
    await jevDecideTool.execute({ state, questions, model } as any),
  );
  const modelUsed = result.startsWith("[Jev") || result.startsWith("Error:") ? "error" : model;
  if (isTrackingEnabled()) {
    try {
      trackToolCall("workflow:jev_decide", modelUsed, estimateTokens(result));
    } catch {
      // Silently ignore tracking errors
    }
  }
  return { result, modelUsed };
}

/**
 * Get list of available tools based on API keys
 */
export function getAvailableTools(): string[] {
  const tools: string[] = [
    "think",
    "focus",
    "code_reviewer",
    "test_architect",
    "documentation_writer",
  ];

  // Check API keys
  if (process.env.GOOGLE_API_KEY) {
    tools.push("gemini_query", "gemini_brainstorm", "gemini_analyze_code");
  }
  if (process.env.PERPLEXITY_API_KEY) {
    tools.push(
      "perplexity_ask",
      "perplexity_research",
      "perplexity_reason",
      "perplexity_code_search",
    );
  }
  if (process.env.OPENAI_API_KEY) {
    tools.push(
      "openai_brainstorm",
      "openai_reason",
      "openai_code_review",
      "openai_explain",
      "gpt5_analyze",
      "openai_reason",
      "gpt5",
      "gpt5_mini",
    );
  }
  if (hasGrokApiKey()) {
    tools.push(
      "grok",
      "grok_reason",
      "grok_code",
      "grok_debug",
      "grok_brainstorm",
      "grok_search",
    );
  }
  if (process.env.OPENROUTER_API_KEY) {
    tools.push(
      "qwen_coder",
      "qwen_algo",
      "qwq_reason",
      "kimi_thinking",
      "jev_decide",
    );
  }

  // Add modes if available
  if (Verifier) tools.push("verifier");
  if (Challenger) tools.push("challenger");
  if (Scout) tools.push("scout");
  if (Auditor) tools.push("auditor");
  if (CommitGuardian) tools.push("commit_guardian");
  if (Architect) tools.push("architect");

  return tools;
}
