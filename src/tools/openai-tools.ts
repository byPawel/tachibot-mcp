/**
 * OpenAI Tools Implementation
 * Provides GPT-6 Astra (default) and GPT-5.6 tier capabilities with reasoning_effort control
 * Uses centralized model constants from model-constants.ts
 */

import { z } from "zod";
import { defineModelTool } from "./factory/define-model-tool.js";
import { filesField, reasoningContextField } from "./factory/base-schemas.js";
import { config } from "dotenv";
import * as path from 'path';
import { fileURLToPath } from 'url';
import { validateToolInput } from "../utils/input-validator.js";
import { tryOpenRouterGateway, isGatewayEnabled } from "../utils/openrouter-gateway.js";
import { OPENAI_MODELS, OPENAI_REASONING, CURRENT_MODELS, TOOL_DEFAULTS } from "../config/model-constants.js";
import { FORMAT_INSTRUCTION } from "../utils/format-constants.js";
import { stripFormatting } from "../utils/format-stripper.js";
import { withHeartbeat } from "../utils/streaming-helper.js";
import { readFilesIntoContext } from "../utils/file-reader.js";
import { modelFallbackEnabled, isBillingFailure, describeFailure, degradedBanner } from "../utils/fallback-policy.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
config({ path: path.resolve(__dirname, '../../../.env') });

// OpenAI API configuration
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_CHAT_URL = "https://api.openai.com/v1/chat/completions";
const OPENAI_RESPONSES_URL = "https://api.openai.com/v1/responses";

// Zod schemas for API responses
const ChatCompletionResponseSchema = z.object({
  id: z.string(),
  object: z.string(),
  created: z.number(),
  model: z.string(),
  choices: z.array(z.object({
    index: z.number(),
    message: z.object({
      role: z.string(),
      content: z.string()
    }),
    finish_reason: z.string().optional()
  })),
  usage: z.object({
    prompt_tokens: z.number().optional(),
    completion_tokens: z.number().optional(),
    total_tokens: z.number().optional()
  }).optional()
});

const ResponsesAPIOutputSchema = z.object({
  id: z.string(),
  type: z.string(),
  status: z.string().optional(),
  content: z.array(z.object({
    type: z.string(), // Can be "output_text", "text", etc.
    text: z.string().optional(), // Make optional to handle different content types
    annotations: z.array(z.unknown()).optional(),
    logprobs: z.array(z.unknown()).optional()
  })).optional(),
  summary: z.array(z.unknown()).optional(),
  role: z.string().optional()
});

const ResponsesAPISchema = z.object({
  id: z.string(),
  object: z.literal("response"),
  created_at: z.number(),
  status: z.string(),
  // Present when status:"incomplete" — e.g. reason:"max_output_tokens" when
  // reasoning consumed the whole output budget before any visible text.
  incomplete_details: z.object({
    reason: z.string().optional()
  }).nullable().optional(),
  model: z.string(),
  output: z.array(ResponsesAPIOutputSchema),
  reasoning: z.object({
    effort: z.string(),
    summary: z.string().nullable().optional()
  }).optional(),
  usage: z.object({
    input_tokens: z.number().optional(), // Fixed: was prompt_tokens
    input_tokens_details: z.object({
      cached_tokens: z.number().optional()
    }).optional(),
    output_tokens: z.number().optional(), // Fixed: was completion_tokens
    output_tokens_details: z.object({
      reasoning_tokens: z.number().optional()
    }).optional(),
    total_tokens: z.number().optional()
  }).optional()
});

type ChatCompletionResponse = z.infer<typeof ChatCompletionResponseSchema>;
type ResponsesAPIResponse = z.infer<typeof ResponsesAPISchema>;

// Fallback type for partial data extraction when Zod parsing fails
interface PartialChatCompletion {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
}

// Type guard for safe fallback extraction
function isPartialChatCompletion(data: unknown): data is PartialChatCompletion {
  if (typeof data !== 'object' || data === null) return false;
  const obj = data as Record<string, unknown>;
  return Array.isArray(obj.choices);
}

// Fallback type for Responses API partial data extraction
interface PartialResponsesAPI {
  output?: Array<{
    content?: Array<{
      text?: string;
    }>;
  }>;
}

// Type guard for Responses API fallback extraction
function isPartialResponsesAPI(data: unknown): data is PartialResponsesAPI {
  if (typeof data !== 'object' || data === null) return false;
  const obj = data as Record<string, unknown>;
  return Array.isArray(obj.output);
}

/**
 * Pull the human-readable message out of an OpenAI JSON error body so the
 * per-attempt log stays one line instead of an embedded JSON blob.
 * Falls back to the raw (truncated) body when it isn't the expected shape.
 */
function extractApiErrorMessage(body: string): string {
  try {
    const parsed = JSON.parse(body);
    const message = parsed?.error?.message;
    if (typeof message === 'string' && message.length > 0) return message;
  } catch {
    // Not JSON — fall through to the raw body.
  }
  const flat = body.replace(/\s+/g, ' ').trim();
  return flat.length > 200 ? `${flat.slice(0, 200)}…` : flat;
}

// GPT-6 Astra (Sep 2026) default + GPT-5.6 sol / terra / luna tiers; see OPENAI_MODELS in
// src/config/model-constants.ts for the authoritative tier list and pricing.

// Type alias for model strings
export type OpenAIModel = string;

// Re-export for backward compatibility
// "Thinking" mode = the flagship tier with reasoning.effort="high"/"xhigh"
export const OpenAIModel5 = {
  DEFAULT: OPENAI_MODELS.DEFAULT,     // gpt-6-astra (use with reasoning.effort)
  THINKING: OPENAI_MODELS.DEFAULT,    // gpt-6-astra + high effort = "thinking"
  PRO: OPENAI_MODELS.PRO,             // gpt-6-astra + xhigh effort (no separate pro API model)
  INSTANT: OPENAI_MODELS.DEFAULT,     // gpt-6-astra + low effort = fast
  // Legacy aliases
  FULL: OPENAI_MODELS.DEFAULT,
  CODEX_MINI: OPENAI_MODELS.DEFAULT,
  CODEX: OPENAI_MODELS.PRO,
} as const;

// Backward compatibility aliases
export const OpenAI52Model = OpenAIModel5;
export const OpenAI51Model = OpenAIModel5;

// Models served by the Responses API: the GPT-5.x family and GPT-6 (gpt-6-astra).
// Anything else (legacy gpt-4.x, o-series) stays on Chat Completions.
function usesResponsesAPI(model: string): boolean {
  return model.startsWith('gpt-5.') || model.startsWith('gpt-6');
}

// gpt-6-astra accepts only low|medium|high|xhigh|max — "none"/"minimal" are a 400.
// Send the cheapest accepted level instead of failing the attempt; GPT-5.6 tiers
// still receive the caller's value unchanged (they accept "none").
function effortForModel(model: string, effort: string): string {
  if (model.startsWith('gpt-6') && (effort === 'none' || effort === 'minimal')) {
    return 'low';
  }
  return effort;
}

/**
 * Call OpenAI API with model fallback support
 * GPT-5.x and GPT-6 use the /v1/responses endpoint
 */
export async function callOpenAI(
  messages: Array<{ role: string; content: string }>,
  model: OpenAIModel = OPENAI_MODELS.INSTANT,  // Default to fast/cheap model
  temperature: number = 0.7,
  maxTokens: number = 16384,  // Increased default for comprehensive responses
  reasoningEffort: string = "low",
  requireConfirmation: boolean = false,
  skipValidation: boolean = false
): Promise<string> {
  console.error(`🔍 TRACE: callOpenAI called with model: ${model}`);

  // Try OpenRouter gateway first if enabled
  if (isGatewayEnabled()) {
    const gatewayResult = await tryOpenRouterGateway(model, messages, {
      temperature,
      max_tokens: maxTokens
    });
    if (gatewayResult) {
      return gatewayResult;
    }
    // Gateway failed or returned null, fall through to direct API
    console.error(`🔍 TRACE: Gateway returned null, falling back to direct OpenAI API`);
  }

  if (!OPENAI_API_KEY) {
    console.error(`🔍 TRACE: No API key found`);
    return `[OpenAI API key not configured. Add OPENAI_API_KEY to .env file]`;
  }

  // Validate and sanitize message content (skip for internal workflow calls)
  const validatedMessages = messages.map((msg) => {
    if (skipValidation) {
      return msg; // Skip validation for internal workflow calls
    }
    const validation = validateToolInput(msg.content);
    if (!validation.valid) {
      throw new Error(validation.error || "Invalid message content");
    }
    return { ...msg, content: validation.sanitized };
  });

  // Model fallback chain
  const modelFallbacks: Record<string, string[]> = {
    // gpt-6-astra rolled out to a limited set of orgs first (Sep 2026): an org without
    // access gets 403/404, so degrade to the previous flagship, then terra.
    "gpt-6-astra": ["gpt-6.1-sol", "gpt-6-sol", "gpt-5.6-terra"],
    // gpt-6.1-sol (Sep 29, 2026) replaced gpt-6-sol at the same $2/$10
    "gpt-6.1-sol": ["gpt-6-sol", "gpt-5.6-terra"],
    // GPT-6 sol/luna (Sep 14, 2026) fall back to their 5.6 namesakes, then terra
    "gpt-6-sol": ["gpt-5.6-sol", "gpt-5.6-terra"],
    "gpt-6-luna": ["gpt-5.6-luna", "gpt-5.6-terra"],
    // gpt-5.6-sol is org-verification gated (403 "insufficient permissions" until verified);
    // terra matches gpt-5.5 quality at half price, so it's the safe runtime fallback.
    "gpt-5.6-sol": ["gpt-5.6-terra", "gpt-5.5"],
    "gpt-5.6-terra": ["gpt-5.5"],
    "gpt-5.6-luna": ["gpt-5.6-terra"],
    // Legacy 5.4 names (retired) — route to the equivalent current tier so old
    // callers/configs degrade to a live model instead of 404ing on a dead one.
    "gpt-5.4": ["gpt-5.6-terra", "gpt-5.5"],
    "gpt-5.4-mini": ["gpt-5.6-luna", "gpt-5.6-terra"],
    "gpt-5.4-pro": ["gpt-5.6-sol", "gpt-5.6-terra"]
  };

  // TACHI_MODEL_FALLBACK=off: answer with the requested model or report its error
  const modelsToTry = [model, ...(modelFallbackEnabled() ? modelFallbacks[model] || [] : [])];
  let firstFailureReason = '';
  console.error(`🔍 TRACE: Models to try: ${modelsToTry.join(', ')}`);
  // Every attempt is recorded — reporting only the LAST one hides why the
  // requested model was skipped (e.g. sol 403-gated, then terra/5.5 out of quota).
  const attemptErrors: string[] = [];
  let lastError: string = '';

  for (const currentModel of modelsToTry) {
    console.error(`🔍 TRACE: Trying model: ${currentModel}`);
    try {
      // GPT-5.x and GPT-6 use the Responses API, others use Chat Completions
      const isResponsesModel = usesResponsesAPI(currentModel);
      const endpoint = isResponsesModel ? OPENAI_RESPONSES_URL : OPENAI_CHAT_URL;

      let requestBody: any;

      if (isResponsesModel) {
        // Responses API format. No temperature: gpt-6-astra rejects anything but the default
        // Input is array of message objects [{role, content}]
        const inputMessages = validatedMessages.map(m => ({
          role: m.role,
          content: m.content
        }));

        // max_output_tokens INCLUDES reasoning tokens on the Responses API, and
        // OpenAI recommends reserving at least 25k for reasoning + visible output.
        // Smaller caps get exhausted by reasoning alone → status:"incomplete"
        // with a reasoning-only output array and zero output_text. The cap is an
        // upper bound (only generated tokens bill), so flooring it is free.
        const effort = effortForModel(currentModel, reasoningEffort || 'medium');
        const reasoningBudget = effort !== 'none'
          ? Math.max(maxTokens, 25000)
          : maxTokens;

        requestBody = {
          model: currentModel,
          input: inputMessages,
          reasoning: { effort },
          max_output_tokens: reasoningBudget
        };
      } else {
        // Chat Completions format for older models
        requestBody = {
          model: currentModel,
          messages: validatedMessages,
          max_completion_tokens: maxTokens,
          temperature: temperature,
          stream: false
        };
      }

      console.error(`🔍 TRACE: Using ${isResponsesModel ? '/v1/responses' : '/v1/chat/completions'} endpoint for ${currentModel}`);

      // High reasoning effort can take 2+ minutes; "max" is the slowest tier of all, so it
      // gets the long timeout too — omitting it here would abort max-effort calls at 90s.
      const timeoutMs = (reasoningEffort === 'high' || reasoningEffort === 'xhigh' || reasoningEffort === 'max')
        ? 180000
        : 90000;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${OPENAI_API_KEY}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(requestBody),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const error = await response.text();
        lastError = `${currentModel}: ${response.statusText} - ${error}`;
        attemptErrors.push(`${currentModel} → ${response.status} ${response.statusText}: ${extractApiErrorMessage(error)}`);
        console.error(`🔍 TRACE: ${currentModel} failed - Status: ${response.status}, Error: ${error}`);
        firstFailureReason ||= describeFailure(error, response.status);

        // Out of credits / insufficient_quota: every fallback bills the same account — stop
        if (isBillingFailure(error, response.status)) {
          return `[OpenAI request failed: ${describeFailure(error, response.status)} — ${currentModel} → ${response.status}: ${extractApiErrorMessage(error)}. Not trying other models (they bill the same account).]`;
        }

        // Check if it's a model not found / not-yet-unlocked error
        // (403 "insufficient permissions" = org-verification-gated tier, e.g. gpt-5.6-sol)
        if (response.status === 404 || response.status === 403 || error.includes('model') || error.includes('not found') || error.includes('insufficient permissions')) {
          console.error(`🔍 TRACE: Model ${currentModel} not available, trying fallback...`);
          continue; // Try next model
        }
        throw new Error(lastError);
      }

      const rawData = await response.json();

      // Parse response based on API type
      let rawContent: string | undefined;

      if (isResponsesModel) {
        // Parse Responses API response
        const parseResult = ResponsesAPISchema.safeParse(rawData);
        if (parseResult.success) {
          const responsesData: ResponsesAPIResponse = parseResult.data;
          // Extract text from output array - find first message with content
          for (const outputItem of responsesData.output) {
            if (outputItem.content) {
              for (const contentItem of outputItem.content) {
                if (contentItem.text) {
                  rawContent = contentItem.text;
                  break;
                }
              }
            }
            if (rawContent) break;
          }
        } else {
          console.error(`🔍 TRACE: Failed to parse Responses API response:`, parseResult.error);
          // Safe fallback using type guard
          if (isPartialResponsesAPI(rawData)) {
            rawContent = rawData.output?.[0]?.content?.[0]?.text;
          }
        }
      } else {
        // Parse Chat Completions response for older models
        const parseResult = ChatCompletionResponseSchema.safeParse(rawData);
        if (parseResult.success) {
          const chatData: ChatCompletionResponse = parseResult.data;
          rawContent = chatData.choices[0]?.message?.content;
        } else {
          console.error(`🔍 TRACE: Failed to parse Chat Completions response:`, parseResult.error);
          // Safe fallback using type guard
          if (isPartialChatCompletion(rawData)) {
            rawContent = rawData.choices?.[0]?.message?.content;
          }
        }
      }

      // Empty visible text is a FAILURE, not a result: the Responses API returns
      // HTTP 200 + status:"incomplete" (incomplete_details.reason:"max_output_tokens")
      // with a reasoning-only output array when the budget runs out before any
      // output_text. Masking that as success hid the error from callers.
      if (!rawContent) {
        const responseStatus = rawData?.status;
        const incompleteReason = rawData?.incomplete_details?.reason;
        const budget = requestBody.max_output_tokens ?? requestBody.max_completion_tokens ?? maxTokens;
        lastError = responseStatus === 'incomplete'
          ? `${currentModel}: incomplete response (${incompleteReason ?? 'unknown reason'}) — output budget ${budget} consumed before any visible text (lower reasoning_effort or raise max_tokens)`
          : `${currentModel}: empty response with status "${responseStatus ?? 'unknown'}"`;
        attemptErrors.push(lastError);
        firstFailureReason ||= describeFailure(lastError);
        console.error(`🔍 TRACE: ${currentModel} EMPTY - ${lastError}`);
        continue; // Try next model instead of returning a fake success
      }

      console.error(`🔍 TRACE: ${currentModel} SUCCESS - Response length: ${rawContent.length}`);

      // Never silent: a fallback model's answer says which model answered and why
      const banner = currentModel !== model ? degradedBanner(model, currentModel, firstFailureReason || 'request failed') : '';
      return banner + stripFormatting(rawContent);

    } catch (error) {
      // Handle abort/timeout specifically
      if (error instanceof Error && error.name === 'AbortError') {
        lastError = `${currentModel}: Timeout (reasoning_effort=${reasoningEffort})`;
        console.error(`🔍 TRACE: ${currentModel} TIMEOUT - reasoning_effort=${reasoningEffort}`);
      } else {
        lastError = `${currentModel}: ${error instanceof Error ? error.message : String(error)}`;
        console.error(`🔍 TRACE: ${currentModel} EXCEPTION - ${lastError}`);
      }
      attemptErrors.push(lastError);
      firstFailureReason ||= describeFailure(lastError);
      continue; // Try next model
    }
  }

  console.error(`🔍 TRACE: ALL MODELS FAILED - Last error: ${lastError}`);
  const attemptLog = attemptErrors.length
    ? attemptErrors.map((e) => `  - ${e}`).join('\n')
    : `  - ${lastError}`;
  return `[OpenAI request failed. Requested "${model}"; tried ${modelsToTry.join(' → ')}.\n${attemptLog}]`;
}


/**
 * GPT-5 Reasoning Tool - Most advanced reasoning with confirmation
 */
export const gpt5ReasonTool = defineModelTool({
  name: "gpt5_reason",
  description: "Advanced reasoning using GPT-5. Put your QUERY in the 'query' parameter.",
  parameters: z.object({
    query: z.string().describe("The question or problem to reason about (REQUIRED - put your question here)"),
    ...reasoningContextField,
    mode: z.enum(["mathematical", "scientific", "logical", "analytical"])
      .optional()
      .default("analytical")
      .describe("Reasoning mode - must be one of: mathematical, scientific, logical, analytical"),
    confirmUsage: z.boolean().optional().default(false).describe("Confirm usage of expensive GPT-5 model")
  }),
  execute: async (args: { query: string; context?: string; mode?: string; confirmUsage?: boolean }, { log }: any) => {
    // Check if user confirmed GPT-5 usage
    if (!args.confirmUsage) {
      return `⚠️ GPT-5 Usage Confirmation Required\n\nGPT-5 is the most advanced model but also the most expensive.\nTo proceed with GPT-5, please set confirmUsage: true\n\nAlternatively, use 'gpt5_mini_reason' for cost-efficient reasoning (no confirmation needed).`;
    }
    
    const modePrompts = {
      mathematical: "Focus on mathematical proofs, calculations, and formal logic",
      scientific: "Apply scientific method and empirical reasoning",
      logical: "Use formal logic and systematic deduction",
      analytical: "Break down complex problems into components"
    };
    
    const messages = [
      {
        role: "system",
        content: `You are GPT-5, the most advanced reasoning model.\n${modePrompts[args.mode as keyof typeof modePrompts] || modePrompts.analytical}.\nProvide step-by-step reasoning with clear explanations.\n${args.context ? `Context: ${args.context}` : ''}\n${FORMAT_INSTRUCTION}`
      },
      {
        role: "user",
        content: args.query
      }
    ];
    
    // Use GPT-5.2-thinking with high reasoning
    return await callOpenAI(messages, OPENAI_MODELS.DEFAULT, 0.7, 8000, "high");
  }
});

/**
 * GPT-5-mini Reasoning Tool - Cost-efficient reasoning without confirmation
 */
export const gpt5MiniReasonTool = defineModelTool({
  name: "gpt5_mini_reason",
  description: "Cost-efficient reasoning using GPT-5-mini. Put your QUERY in the 'query' parameter.",
  parameters: z.object({
    query: z.string().describe("The question or problem to reason about (REQUIRED - put your question here)"),
    ...reasoningContextField,
    mode: z.enum(["mathematical", "scientific", "logical", "analytical"])
      .optional()
      .default("analytical")
      .describe("Reasoning mode - must be one of: mathematical, scientific, logical, analytical")
  }),
  execute: async (args: { query: string; context?: string; mode?: string }, { log }: any) => {
    const modePrompts = {
      mathematical: "Focus on mathematical proofs, calculations, and formal logic",
      scientific: "Apply scientific method and empirical reasoning",
      logical: "Use formal logic and systematic deduction",
      analytical: "Break down complex problems into components"
    };
    
    const messages = [
      {
        role: "system",
        content: `You are GPT-5-mini, optimized for efficient reasoning.\n${modePrompts[args.mode as keyof typeof modePrompts] || modePrompts.analytical}.\nProvide clear, step-by-step reasoning.\n${args.context ? `Context: ${args.context}` : ''}\n${FORMAT_INSTRUCTION}`
      },
      {
        role: "user",
        content: args.query
      }
    ];
    
    // Use GPT-5.2-thinking with medium reasoning (cost-effective)
    return await callOpenAI(messages, OPENAI_MODELS.DEFAULT, 0.7, 3000, "medium");
  }
});

export const openaiGpt5ReasonTool = defineModelTool({
  name: "openai_reason",
  description: "Mathematical and formal reasoning with OpenAI's thinking tier (high reasoning effort). Use for proofs, derivations, and problems where a wrong step invalidates the answer. Put your QUERY in the 'query' parameter.",
  parameters: z.object({
    query: z.string().describe("The question or problem to reason about (REQUIRED - put your question here)"),
    ...reasoningContextField,
    ...filesField,
    mode: z.string()
      .optional()
      .default("analytical")
      .describe("Reasoning mode (e.g., mathematical, scientific, logical, analytical)")
  }),
  execute: async (args: { query: string; context?: string; files?: string[]; mode?: string }, { log, reportProgress, skipValidation }: any) => {
    const modePrompts = {
      mathematical: "Focus on mathematical proofs, calculations, and formal logic",
      scientific: "Apply scientific method and empirical reasoning",
      logical: "Use formal logic and systematic deduction",
      analytical: "Break down complex problems into components"
    };

    const fileContext = args.files?.length
      ? `\n\nSOURCE CODE:\n${readFilesIntoContext(args.files)}`
      : "";

    const messages = [
      {
        role: "system",
        content: `You are an expert reasoner using advanced analytical capabilities.
${modePrompts[args.mode as keyof typeof modePrompts] || modePrompts.analytical}.
Provide step-by-step reasoning with clear explanations.
${args.context ? `Context: ${args.context}` : ''}
${FORMAT_INSTRUCTION}`
      },
      {
        role: "user",
        content: args.query + fileContext
      }
    ];

    // Use heartbeat to prevent MCP timeout during reasoning.
    // Effort is xhigh, not high: this is the dedicated deep-reasoning tool and Astra supports
    // low|medium|high|xhigh|max. "max" is deliberately NOT the default here — OpenAI
    // recommends reserving it for the hardest quality-first work and comparing it against
    // xhigh first, and it costs latency on every call. Both land in the 180s timeout branch.
    const reportFn = reportProgress ?? (async () => {});
    return await withHeartbeat(
      () => callOpenAI(messages, OPENAI_MODELS.DEFAULT, 0.7, 8000, OPENAI_REASONING.XHIGH, false, skipValidation || false),
      reportFn
    );
  }
});


/**
 * OpenAI Brainstorm Tool
 * Creative engineering problem-solving - find the "3rd option"
 */
export const openAIBrainstormTool = defineModelTool({
  name: "openai_brainstorm",
  description: "Find alternative approaches: when stuck on a programming problem, reveals 3rd/4th/5th options you haven't considered, with cost of each. Use when you think there's only 1-2 ways to do something. Put your PROBLEM in the 'problem' parameter.",
  parameters: z.object({
    problem: z.string().describe("The engineering problem or design tradeoff to brainstorm about (REQUIRED)"),
    constraints: z.string().optional().describe("Technical constraints: language, framework, performance requirements, team size"),
    ...filesField,
    quantity: z.number().optional().describe("Number of approaches to generate (default: 5)"),
    model: z.enum(["gpt-6-astra", "gpt-6.1-sol", "gpt-6-sol", "gpt-6-luna", "gpt-5.6-sol", "gpt-5.6-terra", "gpt-5.6-luna"])
      .optional()
      .describe("Model to use - gpt-6-astra (default, flagship), gpt-6.1-sol (mid tier), gpt-6-sol (previous mid tier), gpt-6-luna (fast/cheap), gpt-5.6-sol/terra/luna (previous generation)"),
    reasoning_effort: z.enum(["none", "low", "medium", "high", "xhigh", "max"])
      .optional()
      .describe("Reasoning effort level - must be one of: none, low, medium, high, xhigh, max (gpt-6-astra runs none as low)"),
    max_tokens: z.number().optional().describe("Maximum tokens for response")
  }),
  execute: async (args: { problem: string; constraints?: string; files?: string[]; quantity?: number; model?: string; reasoning_effort?: string; max_tokens?: number }, options: any = {}) => {
    const {
      problem,
      constraints,
      quantity = 5,
      model = OPENAI_MODELS.DEFAULT,
      reasoning_effort = "medium",
      max_tokens = 6000
    } = args;

    // GPT-5.4 reasoning tokens eat into max_output_tokens — enforce minimum
    const effectiveMaxTokens = Math.max(max_tokens, 4000);

    const fileContext = args.files?.length
      ? `\n\nSOURCE CODE:\n${readFilesIntoContext(args.files)}`
      : "";

    const messages = [
      {
        role: "system",
        content: `Alternative approach finder for engineering problems. Output consumed by automated toolchain.

TASK: The user thinks there are only 1-2 ways to solve this. Find ${quantity} high-quality alternatives. Each must be production-ready (no vaporware) and include its real cost. Prioritize simplicity.

TECHNIQUE [what_if_speculation]: "What if we don't have to choose A vs B? What if the constraint itself is wrong? What if we solve a different problem that makes this one disappear?"
TECHNIQUE [innovative_solutions]: Borrow patterns from other engineering domains. Combine existing approaches into hybrids. Reframe to unlock solutions the original framing blocks.

PROCESS:
1. Identify what the user likely already considered (the obvious 1-2 approaches).
2. State why those feel like the only options (the hidden assumption).
3. Generate ${quantity} alternative approaches they haven't considered:
   - Hybrids (combine elements of obvious approaches)
   - Reframes (solve a different problem that dissolves this one)
   - Borrowed patterns (technique proven in a different domain)
   - Inversion (do the opposite of conventional wisdom)
4. For EACH approach, state the cost honestly.

${constraints ? `CONSTRAINTS: ${constraints}` : ''}

OUTPUT per approach:
- Name (2-4 words)
- How it works (2-3 sentences)
- Cost: effort (hours/days/weeks), complexity (low/med/high), risk (what could go wrong)
- Why you wouldn't have thought of it

Start with: "You're probably considering [X] and [Y]. Here are ${quantity} other ways:"
All approaches must be production-ready. No theoretical/vaporware. If you can't find ${quantity} good ones, return fewer rather than filler.
${FORMAT_INSTRUCTION}`
      },
      {
        role: "user",
        content: problem + fileContext
      }
    ];

    const modelEnum = model as OpenAIModel;
    return await callOpenAI(messages, modelEnum, 0.95, effectiveMaxTokens, reasoning_effort, false, options.skipValidation || false);
  }
});

/**
 * OpenAI Code Review Tool
 * Comprehensive code review using GPT-5.x
 */
export const openaiCodeReviewTool = defineModelTool({
  name: "openai_code_review",
  description: "Code review. Put the CODE in the 'code' parameter, NOT in 'focusAreas'.",
  parameters: z.object({
    code: z.string().describe("The actual source code to review (REQUIRED - put your code here)"),
    language: z.string().optional().describe("Programming language (e.g., 'typescript', 'python')"),
    ...filesField,
    focusAreas: z.array(z.enum(["security", "performance", "readability", "bugs", "best-practices"]))
      .optional()
      .describe("Focus areas - array of: security, performance, readability, bugs, best-practices")
  }),
  execute: async (args: { code: string; language?: string; files?: string[]; focusAreas?: string[] }, { log, reportProgress, skipValidation }: any) => {
    const focusText = args.focusAreas
      ? `Focus especially on: ${args.focusAreas.join(', ')}`
      : "Review all aspects: security, performance, readability, bugs, and best practices";

    const fileContext = args.files?.length
      ? `\n\nSOURCE CODE:\n${readFilesIntoContext(args.files)}`
      : "";

    const messages = [
      {
        role: "system",
        content: `You are an expert code reviewer.
Provide a thorough code review with specific, actionable feedback.
${focusText}
${args.language ? `Language: ${args.language}` : ''}
Format: Use sections for different aspects, be specific about line numbers or functions.
${FORMAT_INSTRUCTION}`
      },
      {
        role: "user",
        content: `Review this code:\n\`\`\`${args.language || ''}\n${args.code}\n\`\`\`` + fileContext
      }
    ];

    // Use heartbeat to prevent MCP timeout
    const reportFn = reportProgress ?? (async () => {});
    return await withHeartbeat(
      () => callOpenAI(messages, OPENAI_MODELS.DEFAULT, 0.3, 6000, "medium", false, skipValidation || false),
      reportFn
    );
  }
});

/**
 * OpenAI Explain Tool
 * Clear explanations for complex topics using GPT-5.1-codex-mini
 */
export const openaiExplainTool = defineModelTool({
  name: "openai_explain",
  description: "Explain concepts. Put the TOPIC in the 'topic' parameter.",
  parameters: z.object({
    topic: z.string().describe("The topic or concept to explain (REQUIRED - put your question here)"),
    level: z.enum(["beginner", "intermediate", "expert"])
      .optional()
      .default("intermediate")
      .describe("Explanation level - must be one of: beginner, intermediate, expert"),
    style: z.enum(["technical", "simple", "analogy", "visual"])
      .optional()
      .default("simple")
      .describe("Explanation style - must be one of: technical, simple, analogy, visual"),
    ...filesField,
  }),
  execute: async (args: { topic: string; level?: string; style?: string; files?: string[] }, { log, skipValidation }: any) => {
    const levelPrompts = {
      beginner: "Explain for someone with no prior knowledge",
      intermediate: "Explain for someone with basic understanding",
      expert: "Provide detailed, technical explanation"
    };

    const stylePrompts = {
      technical: "Use precise technical terminology",
      simple: "Use simple, everyday language",
      analogy: "Use analogies and metaphors",
      visual: "Describe with visual concepts and diagrams"
    };

    const fileContext = args.files?.length
      ? `\n\nSOURCE CODE:\n${readFilesIntoContext(args.files)}`
      : "";

    const messages = [
      {
        role: "system",
        content: `You are an expert educator.
${levelPrompts[args.level as keyof typeof levelPrompts] || levelPrompts.intermediate}.
${stylePrompts[args.style as keyof typeof stylePrompts] || stylePrompts.simple}.
Make the explanation clear, engaging, and memorable.
${FORMAT_INSTRUCTION}`
      },
      {
        role: "user",
        content: `Explain: ${args.topic}` + fileContext
      }
    ];

    // Low-effort explanations don't need the $10/$50 flagship: pinned to sol (the pre-Astra
    // default) so the GPT-6 Astra bump doesn't double this tool's per-call cost.
    return await callOpenAI(messages, OPENAI_MODELS.SOL, 0.7, 2500, "low", false, skipValidation || false);
  }
});

/**
 * Call OpenAI Responses API with web_search tool enabled
 * Uses GPT-6.1 Sol with real-time web search capability
 */
async function callOpenAIWithSearch(
  query: string,
  options: {
    searchContextSize?: "low" | "medium" | "high";
    userLocation?: { country?: string; city?: string; region?: string };
    maxTokens?: number;
  } = {}
): Promise<string> {
  const { searchContextSize = "medium", userLocation, maxTokens = 6000 } = options;

  if (!OPENAI_API_KEY) {
    return `[OpenAI API key not configured. Add OPENAI_API_KEY to .env file]`;
  }

  const currentDate = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  // Build web_search tool configuration
  const webSearchTool: any = {
    type: "web_search",
    search_context_size: searchContextSize,
  };

  if (userLocation) {
    webSearchTool.user_location = userLocation;
  }

  const requestBody = {
    // Web search bills a FLAT $10/1k calls regardless of model, so the model is the only
    // cost lever here — and this was set to the $5/$30 flagship for what is mostly grounded
    // lookup. gpt-6.1-sol ($2/$10) is cheaper than terra ($2/$12) and keeps the long-context
    // recall that luna trades away — which matters because search results are large inputs.
    // Verified 2026-10-14: same "what did Google release Oct 13" query — terra answered with
    // a minor Ads update, 6.1-sol found Gemini 4 Argon. Effort stays at the API default
    // (medium) so multi-step queries still get agentic search.
    model: OPENAI_MODELS.SOL,
    input: [
      {
        role: "system",
        content: `You are a helpful research assistant with real-time web search capability. Today is ${currentDate}. Search the web to provide accurate, up-to-date information with citations. Always include sources.`,
      },
      {
        role: "user",
        content: query,
      },
    ],
    tools: [webSearchTool],
    max_output_tokens: maxTokens,
  };

  console.error(`🔍 TRACE: callOpenAIWithSearch - query: ${query.substring(0, 50)}...`);

  try {
    const response = await fetch(OPENAI_RESPONSES_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error(`🔍 TRACE: OpenAI search failed - ${response.status}: ${error}`);
      return `[OpenAI search error: ${response.statusText}]`;
    }

    const data = await response.json() as any;

    // Extract text content from response
    let textContent = "";
    let citations: string[] = [];

    if (data.output && Array.isArray(data.output)) {
      for (const outputItem of data.output) {
        if (outputItem.content && Array.isArray(outputItem.content)) {
          for (const contentItem of outputItem.content) {
            if (contentItem.type === "output_text" || contentItem.type === "text") {
              textContent += contentItem.text || "";
              // Extract annotations/citations if present
              if (contentItem.annotations && Array.isArray(contentItem.annotations)) {
                for (const annotation of contentItem.annotations) {
                  if (annotation.type === "url_citation" && annotation.url) {
                    citations.push(`- [${annotation.title || annotation.url}](${annotation.url})`);
                  }
                }
              }
            }
          }
        }
      }
    }

    // Append citations if found
    if (citations.length > 0) {
      textContent += "\n\nSources:\n" + [...new Set(citations)].join("\n");
    }

    return stripFormatting(textContent || "No search results found");
  } catch (error) {
    console.error(`🔍 TRACE: OpenAI search exception:`, error);
    return `[OpenAI search error: ${error instanceof Error ? error.message : String(error)}]`;
  }
}

/**
 * OpenAI Search Tool
 * Web search using GPT-5.2 with real-time web search capability
 */
export const openaiSearchTool = defineModelTool({
  name: "openai_search",
  description: "Web search with OpenAI's real-time web access. Use when you want search results reasoned over and synthesized rather than listed. Put your QUERY in the 'query' parameter.",
  parameters: z.object({
    query: z.string().describe("The search query (REQUIRED - put your question here)"),
    searchContextSize: z
      .enum(["low", "medium", "high"])
      .optional()
      .default("medium")
      .describe("Search depth - low (fast), medium (balanced), high (comprehensive)"),
    country: z.string().optional().describe("Country for location-aware results (e.g., 'US', 'UK')"),
    city: z.string().optional().describe("City for location-aware results"),
  }),
  execute: async (
    args: { query: string; searchContextSize?: "low" | "medium" | "high"; country?: string; city?: string },
    { log }: any
  ) => {
    const userLocation =
      args.country || args.city ? { country: args.country, city: args.city } : undefined;

    return await callOpenAIWithSearch(args.query, {
      searchContextSize: args.searchContextSize,
      userLocation,
      maxTokens: 6000,
    });
  },
});

/**
 * Check if OpenAI is available
 */
export function isOpenAIAvailable(): boolean {
  return !!OPENAI_API_KEY;
}

/**
 * Get all OpenAI tools
 */
export function getAllOpenAITools() {
  if (!isOpenAIAvailable()) {
    return [];
  }

  return [
    openaiGpt5ReasonTool,  // GPT-5.2-thinking reasoning (high effort)
    openAIBrainstormTool,  // GPT-5.2-thinking brainstorming (medium effort)
    openaiCodeReviewTool,  // GPT-5.2-thinking code review (medium effort)
    openaiExplainTool,     // GPT-5.2-thinking explanations (low effort)
    openaiSearchTool       // GPT-5.2 web search (via web_search tool)
  ];
}