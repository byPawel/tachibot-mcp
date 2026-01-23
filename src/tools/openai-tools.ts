/**
 * OpenAI Tools Implementation
 * Provides GPT-5.2 model capabilities with reasoning_effort control
 * Uses centralized model constants from model-constants.ts
 */

import { z } from "zod";
import { config } from "dotenv";
import * as path from 'path';
import { fileURLToPath } from 'url';
import { validateToolInput } from "../utils/input-validator.js";
import { tryOpenRouterGateway, isGatewayEnabled } from "../utils/openrouter-gateway.js";
import { OPENAI_MODELS, OPENAI_REASONING, CURRENT_MODELS, TOOL_DEFAULTS } from "../config/model-constants.js";
import { FORMAT_INSTRUCTION } from "../utils/format-constants.js";
import { stripFormatting } from "../utils/format-stripper.js";
import { withHeartbeat } from "../utils/streaming-helper.js";

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

// GPT-5.2 Models (Dec 2025) - Uses centralized constants
// THINKING: gpt-5.2-thinking - SOTA reasoning (293% accuracy boost, $1.75/$14, 400K)
// PRO: gpt-5.2-pro - Expert programming/science (88.4% GPQA, $21/$168, 400K)
// INSTANT: gpt-5.2-instant - Fast conversations ($1.75/$14, 400K)

// Type alias for model strings
export type OpenAIModel = string;

// Re-export for backward compatibility (maps to gpt-5.2 models)
// "Thinking" mode = gpt-5.2 with reasoning.effort="high"/"xhigh"
export const OpenAI52Model = {
  DEFAULT: OPENAI_MODELS.DEFAULT,     // gpt-5.2 (use with reasoning.effort)
  THINKING: OPENAI_MODELS.DEFAULT,    // gpt-5.2 + high effort = "thinking"
  PRO: OPENAI_MODELS.PRO,             // gpt-5.2-pro (expert mode)
  INSTANT: OPENAI_MODELS.DEFAULT,     // gpt-5.2 + low effort = fast
  // Legacy aliases
  FULL: OPENAI_MODELS.DEFAULT,
  CODEX_MINI: OPENAI_MODELS.DEFAULT,
  CODEX: OPENAI_MODELS.PRO,
} as const;

// Backward compatibility alias
export const OpenAI51Model = OpenAI52Model;

/**
 * Call OpenAI API with model fallback support
 * GPT-5.2 uses /v1/responses endpoint for all models
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

  // Model fallback chain - GPT-5.2 models have no fallbacks to test actual availability
  const modelFallbacks: Record<string, string[]> = {
    "gpt-5.2": [],      // No fallback - test actual gpt-5.2
    "gpt-5.2-pro": []   // No fallback - test actual gpt-5.2-pro
  };

  const modelsToTry = [model, ...(modelFallbacks[model] || [])];
  console.error(`🔍 TRACE: Models to try: ${modelsToTry.join(', ')}`);
  let lastError: string = '';

  for (const currentModel of modelsToTry) {
    console.error(`🔍 TRACE: Trying model: ${currentModel}`);
    try {
      // GPT-5.2 uses Responses API, others use Chat Completions
      const isGPT52 = currentModel.startsWith('gpt-5.2');
      const endpoint = isGPT52 ? OPENAI_RESPONSES_URL : OPENAI_CHAT_URL;

      let requestBody: any;

      if (isGPT52) {
        // Responses API format for GPT-5.2
        // Input is array of message objects [{role, content}]
        const inputMessages = validatedMessages.map(m => ({
          role: m.role,
          content: m.content
        }));

        requestBody = {
          model: currentModel,
          input: inputMessages,
          reasoning: {
            effort: reasoningEffort || 'medium'
          },
          max_output_tokens: maxTokens
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

      console.error(`🔍 TRACE: Using ${isGPT52 ? '/v1/responses' : '/v1/chat/completions'} endpoint for ${currentModel}`);

      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${OPENAI_API_KEY}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        const error = await response.text();
        lastError = `${currentModel}: ${response.statusText} - ${error}`;
        console.error(`🔍 TRACE: ${currentModel} failed - Status: ${response.status}, Error: ${error}`);

        // Check if it's a model not found error
        if (response.status === 404 || error.includes('model') || error.includes('not found')) {
          console.error(`🔍 TRACE: Model ${currentModel} not available, trying fallback...`);
          continue; // Try next model
        }
        throw new Error(lastError);
      }

      const rawData = await response.json();

      // Parse response based on API type
      let rawContent: string | undefined;

      if (isGPT52) {
        // Parse Responses API response for GPT-5.2
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

      // Ensure result is always a string
      const result = rawContent || "No response from OpenAI";

      console.error(`🔍 TRACE: ${currentModel} SUCCESS - Response length: ${result.length}`);

      return stripFormatting(result);

    } catch (error) {
      lastError = `${currentModel}: ${error instanceof Error ? error.message : String(error)}`;
      console.error(`🔍 TRACE: ${currentModel} EXCEPTION - ${lastError}`);
      continue; // Try next model
    }
  }

  console.error(`🔍 TRACE: ALL MODELS FAILED - Last error: ${lastError}`);
  return `[GPT-5.2 model "${model}" not available. Error: ${lastError}]`;
}

/**
 * Call OpenAI API with custom parameters for specific models
 * GPT-5.2 models use /v1/responses endpoint
 */
async function callOpenAIWithCustomParams(
  messages: Array<{ role: string; content: string }>,
  model: OpenAIModel = OPENAI_MODELS.DEFAULT,
  temperature: number = 0.7,
  maxTokens: number = 16384,  // Increased for detailed brainstorming
  reasoningEffort: string = "low",
  skipValidation: boolean = false
): Promise<string> {
  console.error(`🔍 TRACE: callOpenAIWithCustomParams called with model: ${model}, reasoning_effort: ${reasoningEffort}`);

  // Try OpenRouter gateway first if enabled
  if (isGatewayEnabled()) {
    const gatewayResult = await tryOpenRouterGateway(model, messages, {
      temperature,
      max_tokens: maxTokens
    });
    if (gatewayResult) {
      return gatewayResult;
    }
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

  try {
    // GPT-5.2 uses Responses API, others use Chat Completions
    const isGPT52 = model.startsWith('gpt-5.2');
    const endpoint = isGPT52 ? OPENAI_RESPONSES_URL : OPENAI_CHAT_URL;

    let requestBody: any;

    if (isGPT52) {
      // Responses API format for GPT-5.2
      // Input is array of message objects [{role, content}]
      const inputMessages = validatedMessages.map(m => ({
        role: m.role,
        content: m.content
      }));

      requestBody = {
        model: model,
        input: inputMessages,
        reasoning: {
          effort: reasoningEffort || 'medium'
        },
        max_output_tokens: maxTokens
      };
    } else {
      // Chat Completions format for older models
      requestBody = {
        model: model,
        messages: validatedMessages,
        max_completion_tokens: maxTokens,
        temperature: temperature,
        stream: false
      };
    }

    console.error(`🔍 TRACE: Using ${isGPT52 ? '/v1/responses' : '/v1/chat/completions'} endpoint for ${model}`);
    console.error(`🔍 TRACE: Model params: max_tokens=${maxTokens}, reasoning_effort=${reasoningEffort}`);

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const error = await response.text();
      console.error(`🔍 TRACE: ${model} failed - Status: ${response.status}, Error: ${error}`);
      return `[${model} failed: ${response.status} - ${error}]`;
    }

    const rawData = await response.json();

    // Parse response based on API type
    let rawContent: string | undefined;

    if (isGPT52) {
      // Parse Responses API response for GPT-5.2
      const parseResult = ResponsesAPISchema.safeParse(rawData);
      if (parseResult.success) {
        const responsesData: ResponsesAPIResponse = parseResult.data;
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
        if (isPartialChatCompletion(rawData)) {
          rawContent = rawData.choices?.[0]?.message?.content;
        }
      }
    }

    // Ensure result is always a string
    const result = rawContent || "No response from OpenAI";

    console.error(`🔍 TRACE: ${model} SUCCESS - Response length: ${result.length}`);

    return stripFormatting(result);

  } catch (error) {
    const errorMsg = `${model}: ${error instanceof Error ? error.message : String(error)}`;
    console.error(`🔍 TRACE: ${model} EXCEPTION - ${errorMsg}`);
    return `[${model} error: ${errorMsg}]`;
  }
}

/**
 * GPT-5 Reasoning Tool - Most advanced reasoning with confirmation
 */
export const gpt5ReasonTool = {
  name: "gpt5_reason",
  description: "Advanced reasoning using GPT-5. Put your QUERY in the 'query' parameter.",
  parameters: z.object({
    query: z.string().describe("The question or problem to reason about (REQUIRED - put your question here)"),
    context: z.string().optional().describe("Additional context for the reasoning task"),
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
        content: `You are GPT-5, the most advanced reasoning model.\n${modePrompts[args.mode as keyof typeof modePrompts || 'analytical']}.\nProvide step-by-step reasoning with clear explanations.\n${args.context ? `Context: ${args.context}` : ''}\n${FORMAT_INSTRUCTION}`
      },
      {
        role: "user",
        content: args.query
      }
    ];
    
    // Use GPT-5.2-thinking with high reasoning
    return await callOpenAI(messages, OPENAI_MODELS.DEFAULT, 0.7, 4000, "high");
  }
};

/**
 * GPT-5-mini Reasoning Tool - Cost-efficient reasoning without confirmation
 */
export const gpt5MiniReasonTool = {
  name: "gpt5_mini_reason",
  description: "Cost-efficient reasoning using GPT-5-mini. Put your QUERY in the 'query' parameter.",
  parameters: z.object({
    query: z.string().describe("The question or problem to reason about (REQUIRED - put your question here)"),
    context: z.string().optional().describe("Additional context for the reasoning task"),
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
        content: `You are GPT-5-mini, optimized for efficient reasoning.\n${modePrompts[args.mode as keyof typeof modePrompts || 'analytical']}.\nProvide clear, step-by-step reasoning.\n${args.context ? `Context: ${args.context}` : ''}\n${FORMAT_INSTRUCTION}`
      },
      {
        role: "user",
        content: args.query
      }
    ];
    
    // Use GPT-5.2-thinking with medium reasoning (cost-effective)
    return await callOpenAI(messages, OPENAI_MODELS.DEFAULT, 0.7, 3000, "medium");
  }
};

export const openaiGpt5ReasonTool = {
  name: "openai_reason",
  description: "Mathematical reasoning using GPT-5.2-thinking. Put your QUERY in the 'query' parameter.",
  parameters: z.object({
    query: z.string().describe("The question or problem to reason about (REQUIRED - put your question here)"),
    context: z.string().optional().describe("Additional context for the reasoning task"),
    mode: z.enum(["mathematical", "scientific", "logical", "analytical"])
      .optional()
      .default("analytical")
      .describe("Reasoning mode - must be one of: mathematical, scientific, logical, analytical")
  }),
  execute: async (args: { query: string; context?: string; mode?: string }, { log, reportProgress }: any) => {
    const modePrompts = {
      mathematical: "Focus on mathematical proofs, calculations, and formal logic",
      scientific: "Apply scientific method and empirical reasoning",
      logical: "Use formal logic and systematic deduction",
      analytical: "Break down complex problems into components"
    };

    const messages = [
      {
        role: "system",
        content: `You are an expert reasoner using advanced analytical capabilities.
${modePrompts[args.mode as keyof typeof modePrompts || 'analytical']}.
Provide step-by-step reasoning with clear explanations.
${args.context ? `Context: ${args.context}` : ''}
${FORMAT_INSTRUCTION}`
      },
      {
        role: "user",
        content: args.query
      }
    ];

    // Use heartbeat to prevent MCP timeout during reasoning
    const reportFn = reportProgress ?? (async () => {});
    return await withHeartbeat(
      () => callOpenAI(messages, OPENAI_MODELS.DEFAULT, 0.7, 4000, "high"),
      reportFn
    );
  }
};


/**
 * OpenAI Brainstorm Tool
 * Creative ideation and brainstorming
 */
export const openAIBrainstormTool = {
  name: "openai_brainstorm",
  description: "Creative brainstorming. Put your PROBLEM in the 'problem' parameter.",
  parameters: z.object({
    problem: z.string().describe("The problem or topic to brainstorm about (REQUIRED - put your question here)"),
    constraints: z.string().optional().describe("Any constraints to consider in brainstorming"),
    quantity: z.number().optional().describe("Number of ideas to generate (default: 5)"),
    style: z.enum(["innovative", "practical", "wild", "systematic"])
      .optional()
      .describe("Brainstorming style - must be one of: innovative, practical, wild, systematic"),
    model: z.enum(["gpt-5.2", "gpt-5.2-pro"])
      .optional()
      .describe("Model to use - gpt-5.2 (default) or gpt-5.2-pro (more expensive)"),
    reasoning_effort: z.enum(["none", "low", "medium", "high", "xhigh"])
      .optional()
      .describe("Reasoning effort level - must be one of: none, low, medium, high, xhigh"),
    max_tokens: z.number().optional().describe("Maximum tokens for response")
  }),
  execute: async (args: { problem: string; constraints?: string; quantity?: number; style?: string; model?: string; reasoning_effort?: string; max_tokens?: number }, options: { log?: any; skipValidation?: boolean } = {}) => {
    const {
      problem,
      constraints,
      quantity = 5,
      style = "innovative",
      model = OPENAI_MODELS.DEFAULT,  // Default to gpt-5.2 (use reasoning.effort for "thinking")
      reasoning_effort = "medium",
      max_tokens = 4000
    } = args;
    const stylePrompts = {
      innovative: "Focus on novel, cutting-edge solutions",
      practical: "Emphasize feasible, implementable ideas",
      wild: "Think outside the box with unconventional approaches",
      systematic: "Generate methodical, well-structured solutions"
    };

    const messages = [
      {
        role: "system",
        content: `You are a creative problem-solver and ideation expert.
Generate ${quantity} distinct ideas.
Style: ${stylePrompts[style as keyof typeof stylePrompts]}
${constraints ? `Constraints: ${constraints}` : ''}
Format: Number each idea and provide a brief explanation.
${FORMAT_INSTRUCTION}`
      },
      {
        role: "user",
        content: `Brainstorm solutions for: ${problem}`
      }
    ];

    const modelEnum = model as OpenAIModel;
    return await callOpenAIWithCustomParams(messages, modelEnum, 0.9, max_tokens, reasoning_effort, options.skipValidation || false);
  }
};

/**
 * OpenAI Code Review Tool
 * Comprehensive code review using GPT-5.1-codex-mini
 */
export const openaiCodeReviewTool = {
  name: "openai_code_review",
  description: "Code review. Put the CODE in the 'code' parameter, NOT in 'focusAreas'.",
  parameters: z.object({
    code: z.string().describe("The actual source code to review (REQUIRED - put your code here)"),
    language: z.string().optional().describe("Programming language (e.g., 'typescript', 'python')"),
    focusAreas: z.array(z.enum(["security", "performance", "readability", "bugs", "best-practices"]))
      .optional()
      .describe("Focus areas - array of: security, performance, readability, bugs, best-practices")
  }),
  execute: async (args: { code: string; language?: string; focusAreas?: string[] }, { log, reportProgress }: any) => {
    const focusText = args.focusAreas
      ? `Focus especially on: ${args.focusAreas.join(', ')}`
      : "Review all aspects: security, performance, readability, bugs, and best practices";

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
        content: `Review this code:\n\`\`\`${args.language || ''}\n${args.code}\n\`\`\``
      }
    ];

    // Use heartbeat to prevent MCP timeout
    const reportFn = reportProgress ?? (async () => {});
    return await withHeartbeat(
      () => callOpenAI(messages, OPENAI_MODELS.DEFAULT, 0.3, 4000, "medium"),
      reportFn
    );
  }
};

/**
 * OpenAI Explain Tool
 * Clear explanations for complex topics using GPT-5.1-codex-mini
 */
export const openaiExplainTool = {
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
      .describe("Explanation style - must be one of: technical, simple, analogy, visual")
  }),
  execute: async (args: { topic: string; level?: string; style?: string }, { log }: any) => {
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

    const messages = [
      {
        role: "system",
        content: `You are an expert educator.
${levelPrompts[args.level as keyof typeof levelPrompts || 'intermediate']}.
${stylePrompts[args.style as keyof typeof stylePrompts || 'simple']}.
Make the explanation clear, engaging, and memorable.
${FORMAT_INSTRUCTION}`
      },
      {
        role: "user",
        content: `Explain: ${args.topic}`
      }
    ];

    return await callOpenAI(messages, OPENAI_MODELS.DEFAULT, 0.7, 2500, "low");
  }
};

/**
 * Call OpenAI Responses API with web_search tool enabled
 * Uses GPT-5.2 with real-time web search capability
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
    model: OPENAI_MODELS.DEFAULT, // gpt-5.2
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
export const openaiSearchTool = {
  name: "openai_search",
  description: "Web search using GPT-5.2 with real-time web access. Put your QUERY in the 'query' parameter.",
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
};

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