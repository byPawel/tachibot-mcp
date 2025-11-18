/**
 * Tool Mapper - Maps workflow tool names to actual MCP tool implementations
 * Enables workflows to call real tools instead of returning placeholders
 */

import { callGemini, GeminiModel } from "../tools/gemini-tools.js";
import { getAllPerplexityTools } from "../tools/perplexity-tools.js";
import { callOpenAI, OpenAI51Model } from "../tools/openai-tools.js";
import { callGrok, GrokModel } from "../tools/grok-tools.js";
import {
  GPT51_MODELS,
  GPT4_MODELS,
  TOOL_DEFAULTS,
} from "../config/model-constants.js";
import { validateToolInput } from "../utils/input-validator.js";

// Lazy load OpenRouter for Qwen models
let callOpenRouter: any = null;
let OpenRouterModel: any = null;
try {
  const openRouterModule = await import("../tools/openrouter-tools.js");
  callOpenRouter = openRouterModule.callOpenRouter;
  OpenRouterModel = openRouterModule.OpenRouterModel;
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
  skipValidation?: boolean; // Skip input validation for internal workflow calls
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

  // ============================================
  // UNIVERSAL INPUT NORMALIZATION
  // Support ANY parameter name for maximum DX
  // ============================================

  // Extract a universal "main content" from common parameter names
  // Priority order: most specific → most generic
  const extractMainContent = () => {
    if (typeof input === "string") return input;

    // Try all common parameter names (order matters!)
    return input.requirements ||  // qwen_coder, task-specific
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

  // Validate and sanitize input (skip for internal workflow calls)
  console.error(`🔒 Validation check: skipValidation=${options.skipValidation}, options=${JSON.stringify(options)}`);
  if (options.skipValidation === true) {
    console.error(`⏭️  ✅ SKIPPING VALIDATION (internal workflow call)`);
  } else {
    console.error(`🔍 Running validation on prompt (length: ${prompt.length})`);
    const validation = validateToolInput(prompt);
    console.error(`🔍 Validation result: valid=${validation.valid}, error=${validation.error}`);
    if (!validation.valid) {
      console.error(`❌ Validation failed: ${validation.error}`);
      console.error(`❌ Failed prompt length: ${prompt.length}`);
      console.error(`❌ Failed prompt preview: "${prompt.substring(0, 500)}..."`);
      return { result: `[Error: ${validation.error}]`, modelUsed: "error" };
    }
    prompt = validation.sanitized;
  }

  // Get defaults for this specific tool, fallback to generic defaults
  const toolDefaults = TOOL_DEFAULTS[
    toolName as keyof typeof TOOL_DEFAULTS
  ] || {
    maxTokens: 2000,
    temperature: 0.7,
  };

  const {
    model = ('model' in toolDefaults ? (toolDefaults.model as string) : GPT51_MODELS.CODEX_MINI),
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

  // Helper to build result with model metadata
  const buildResult = (result: string, actualModel: string): ToolExecutionResult => {
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
        actualModel = model === "flash" ? GeminiModel.FLASH : GeminiModel.PRO;
        return buildResult(
          await callGemini(
            prompt,
            actualModel as GeminiModel,
            systemPrompt,
            temperature,
            options.skipValidation || false, // Pass skipValidation flag to Gemini
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
      case "qwen_coder":
      case "qwq_reason":
        if (!callOpenRouter) {
          return buildResult("[Qwen tools require OpenRouter API key. Add OPENROUTER_API_KEY to .env]", "error");
        }
        const qwenModel =
          toolName === "qwq_reason"
            ? OpenRouterModel.QWQ_32B
            : OpenRouterModel.QWEN3_CODER;
        return buildResult(
          await callOpenRouter(
            toMessages(prompt, systemPrompt),
            qwenModel,
            temperature,
            maxTokens,
          ),
          qwenModel
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
        actualModel = (model || GPT51_MODELS.FULL) as OpenAI51Model;
        return buildResult(
          await callOpenAI(
            toMessages(prompt, systemPrompt),
            actualModel,
            temperature,
            maxTokens,
            "low", // reasoningEffort
            false, // requireConfirmation
            options.skipValidation || false, // skipValidation for workflow calls
          ),
          actualModel
        );

      case "gpt5_analyze":
        return buildResult(
          await callOpenAI(
            toMessages(prompt, systemPrompt),
            GPT51_MODELS.CODEX_MINI as OpenAI51Model,
            0.7,
            maxTokens,
          ),
          GPT51_MODELS.CODEX_MINI
        );

      case "openai_reason":
        return buildResult(
          await callOpenAI(
            toMessages(prompt, systemPrompt),
            GPT51_MODELS.CODEX_MINI as OpenAI51Model,
            temperature,
            maxTokens,
          ),
          GPT51_MODELS.CODEX_MINI
        );

      // ============ GPT-5 TOOLS ============
      case "gpt5":
      case "gpt5_mini":
      case "gpt5_nano":
        // Map old names to new GPT-5.1 models
        const gpt51Model = GPT51_MODELS.CODEX_MINI as OpenAI51Model; // Always use cost-efficient codex-mini
        return buildResult(
          await callOpenAI(
            toMessages(prompt, systemPrompt),
            gpt51Model,
            0.7,
            maxTokens,
            "low", // reasoning_effort
          ),
          gpt51Model
        );

      // ============ GROK TOOLS ============
      case "grok":
      case "grok_reason":
      case "grok_code":
      case "grok_debug":
      case "grok_brainstorm":
      case "grok_heavy": // Grok Heavy is just grok-4-0709 with more backend resources
      case "grok_search":
        actualModel = GrokModel.GROK_4_FAST_REASONING; // Using fast reasoning (2M context, $0.20/$0.50)
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
            GPT51_MODELS.CODEX_MINI as OpenAI51Model,
            0.7,
            500,
          ),
          GPT51_MODELS.CODEX_MINI
        );

      case "focus":
        // Deep analysis tool - uses GPT-5.1
        return buildResult(
          await callOpenAI(
            toMessages(
              `Perform deep analysis and synthesis:\n\n${prompt}`,
              "You are an advanced analytical assistant. Provide comprehensive, synthesized insights.",
            ),
            GPT51_MODELS.FULL as OpenAI51Model,
            0.8,
            maxTokens,
          ),
          GPT51_MODELS.FULL
        );

      case "code_reviewer":
        return buildResult(
          await callOpenAI(
            toMessages(
              `Perform thorough code review:\n\n${prompt}`,
              "You are an expert code reviewer. Analyze for bugs, security issues, performance, and best practices.",
            ),
            GPT51_MODELS.FULL as OpenAI51Model,
            0.5,
            maxTokens,
          ),
          GPT51_MODELS.FULL
        );

      case "test_architect":
        return buildResult(
          await callOpenAI(
            toMessages(
              `Design comprehensive tests:\n\n${prompt}`,
              "You are a testing expert. Design thorough test suites with edge cases.",
            ),
            GPT51_MODELS.FULL as OpenAI51Model,
            0.6,
            maxTokens,
          ),
          GPT51_MODELS.FULL
        );

      case "documentation_writer":
        return buildResult(
          await callOpenAI(
            toMessages(
              `Create clear documentation:\n\n${prompt}`,
              "You are a technical writer. Create clear, comprehensive documentation.",
            ),
            GPT51_MODELS.CODEX_MINI as OpenAI51Model,
            0.7,
            maxTokens,
          ),
          GPT51_MODELS.CODEX_MINI
        );

      // ============ DEFAULT ============
      default:
        console.warn(
          `⚠️ Unknown tool: ${toolName}, falling back to GPT-5.1-codex-mini`,
        );
        return buildResult(
          await callOpenAI(
            toMessages(prompt),
            GPT51_MODELS.CODEX_MINI as OpenAI51Model,
            temperature,
            maxTokens,
          ),
          GPT51_MODELS.CODEX_MINI
        );
    }
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error(`❌ Tool execution error for ${toolName}:`, errorMsg);
    return buildResult(`[Error executing ${toolName}: ${errorMsg}]`, "error");
  }
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
      "gpt5_analyze",
      "openai_reason",
      "gpt5",
      "gpt5_mini",
      "gpt5_nano",
    );
  }
  if (process.env.XAI_API_KEY) {
    tools.push(
      "grok",
      "grok_reason",
      "grok_code",
      "grok_debug",
      "grok_brainstorm",
      "grok_search",
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
