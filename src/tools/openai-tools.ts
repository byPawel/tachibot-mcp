/**
 * OpenAI Tools Implementation
 * Provides GPT-5.1 model capabilities with reasoning_effort control
 */

import { z } from "zod";
import { config } from "dotenv";
import * as path from 'path';
import { fileURLToPath } from 'url';
import { validateToolInput } from "../utils/input-validator.js";
import { tryOpenRouterGateway, isGatewayEnabled } from "../utils/openrouter-gateway.js";

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

// Available OpenAI GPT-5 models (optimized for Claude Code)
export enum OpenAI51Model {
  FULL = "gpt-5.1",                         // Flagship reasoning ($10/$30 per million tokens)
  PRO = "gpt-5-pro",                        // Premium orchestration ($20/$60 per million tokens, 2x)
  CODEX_MINI = "gpt-5.1-codex-mini",        // Code workhorse ($2/$6 per million tokens) - CHEAP!
  CODEX = "gpt-5.1-codex",                  // Code power ($15/$45 per million tokens)
  CODEX_MAX = "gpt-5.1-codex-max",          // Code frontier - BEST for complex analysis
}

// Type alias for backward compatibility
export type OpenAIModel = OpenAI51Model;

/**
 * Call OpenAI API with model fallback support
 * Automatically detects GPT-5.1 models and uses correct endpoint + format
 */
export async function callOpenAI(
  messages: Array<{ role: string; content: string }>,
  model: OpenAIModel = OpenAI51Model.CODEX_MINI,
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

  // Model fallback chain - GPT-5.1 models have no fallbacks to test actual availability
  const modelFallbacks: Record<string, string[]> = {
    [OpenAI51Model.FULL]: [],  // No fallback - test actual GPT-5.1
    [OpenAI51Model.CODEX_MINI]: [],  // No fallback - test actual GPT-5.1-codex-mini
    [OpenAI51Model.CODEX]: []  // No fallback - test actual GPT-5.1-codex
  };

  const modelsToTry = [model, ...(modelFallbacks[model] || [])];
  console.error(`🔍 TRACE: Models to try: ${modelsToTry.join(', ')}`);
  let lastError: string = '';

  for (const currentModel of modelsToTry) {
    console.error(`🔍 TRACE: Trying model: ${currentModel}`);
    try {
      // Codex models use /v1/responses, non-codex use /v1/chat/completions
      const isCodex = currentModel.includes('codex');
      const endpoint = isCodex ? OPENAI_RESPONSES_URL : OPENAI_CHAT_URL;

      let requestBody: any;

      if (isCodex) {
        // Responses API format for codex models
        requestBody = {
          model: currentModel,
          input: validatedMessages,
          max_output_tokens: maxTokens,
          stream: false,
          reasoning: {
            effort: reasoningEffort
          }
        };
      } else {
        // Chat Completions format for non-codex GPT-5 models (gpt-5.1, gpt-5-pro)
        requestBody = {
          model: currentModel,
          messages: validatedMessages,
          temperature,
          max_completion_tokens: maxTokens,  // GPT-5 requires max_completion_tokens (not max_tokens)
          stream: false
        };
      }

      console.error(`🔍 TRACE: Using ${isCodex ? '/v1/responses' : '/v1/chat/completions'} endpoint`);

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

      // Parse based on API type
      let rawContent: string | undefined;

      if (isCodex) {
        // Responses API format
        const parseResult = ResponsesAPISchema.safeParse(rawData);
        if (parseResult.success) {
          const data: ResponsesAPIResponse = parseResult.data;
          const messageOutput = data.output.find(item => item.type === 'message');
          rawContent = messageOutput?.content?.[0]?.text;

          if (data.reasoning) {
            console.error(`🔍 TRACE: Reasoning effort: ${data.reasoning.effort}`);
          }
        } else {
          console.error(`🔍 TRACE: Failed to parse Responses API response:`, parseResult.error);
        }
      } else {
        // Chat Completions format
        const parseResult = ChatCompletionResponseSchema.safeParse(rawData);
        if (parseResult.success) {
          const chatData: ChatCompletionResponse = parseResult.data;
          rawContent = chatData.choices[0]?.message?.content;
        } else {
          console.error(`🔍 TRACE: Failed to parse Chat Completions response:`, parseResult.error);
        }
      }

      // Ensure result is always a string
      const result = rawContent || "No response from OpenAI";

      console.error(`🔍 TRACE: ${currentModel} SUCCESS - Response length: ${result.length}`);

      return result;

    } catch (error) {
      lastError = `${currentModel}: ${error instanceof Error ? error.message : String(error)}`;
      console.error(`🔍 TRACE: ${currentModel} EXCEPTION - ${lastError}`);
      continue; // Try next model
    }
  }

  console.error(`🔍 TRACE: ALL MODELS FAILED - Last error: ${lastError}`);
  return `[GPT-5.1 model "${model}" not available. Error: ${lastError}]`;
}

/**
 * Call OpenAI API with custom parameters for specific models
 * Automatically detects GPT-5.1 models and uses correct endpoint + format
 */
async function callOpenAIWithCustomParams(
  messages: Array<{ role: string; content: string }>,
  model: OpenAIModel,
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
    // Codex models use /v1/responses, non-codex use /v1/chat/completions
    const isCodex = model.includes('codex');
    const endpoint = isCodex ? OPENAI_RESPONSES_URL : OPENAI_CHAT_URL;

    let requestBody: any;

    if (isCodex) {
      // Responses API format for codex models
      requestBody = {
        model: model,
        input: validatedMessages,
        max_output_tokens: maxTokens, // NOT max_completion_tokens or max_tokens!
        stream: false,
        reasoning: {
          effort: reasoningEffort // "none", "low", "medium", "high"
        }
      };
    } else {
      // Chat Completions format for non-codex GPT-5 models (gpt-5.1, gpt-5-pro)
      requestBody = {
        model: model,
        messages: validatedMessages,
        temperature,
        max_completion_tokens: maxTokens,  // GPT-5 requires max_completion_tokens (not max_tokens)
        stream: false
      };
    }

    console.error(`🔍 TRACE: Using ${isCodex ? '/v1/responses' : '/v1/chat/completions'} endpoint`);
    console.error(`🔍 TRACE: Model params: ${isCodex ? `max_output_tokens=${maxTokens}, reasoning_effort=${reasoningEffort}` : `max_completion_tokens=${maxTokens}, temperature=${temperature}`}`);

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

    // Parse based on API type - they have DIFFERENT response formats!
    let rawContent: string | undefined;

    if (isCodex) {
      // Validate and parse Responses API format
      const parseResult = ResponsesAPISchema.safeParse(rawData);
      if (parseResult.success) {
        const data: ResponsesAPIResponse = parseResult.data;
        const messageOutput = data.output.find(item => item.type === 'message');
        rawContent = messageOutput?.content?.[0]?.text;

        // Capture reasoning info
        if (data.reasoning) {
          console.error(`🔍 TRACE: Reasoning effort: ${data.reasoning.effort}`);
        }
      } else {
        console.error(`🔍 TRACE: Failed to parse Responses API response:`, parseResult.error);
      }
    } else {
      // Validate and parse Chat Completions API format
      const parseResult = ChatCompletionResponseSchema.safeParse(rawData);
      if (parseResult.success) {
        const chatData: ChatCompletionResponse = parseResult.data;
        rawContent = chatData.choices[0]?.message?.content;
      } else {
        console.error(`🔍 TRACE: Failed to parse Chat Completions response:`, parseResult.error);
      }
    }

    // Ensure result is always a string
    const result = rawContent || "No response from OpenAI";

    console.error(`🔍 TRACE: ${model} SUCCESS - Response length: ${result.length}`);

    return result;

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
  description: "Advanced reasoning using GPT-5",
  parameters: z.object({
    query: z.string(),
    context: z.string().optional(),
    mode: z.enum(["mathematical", "scientific", "logical", "analytical"]).optional().default("analytical"),
    confirmUsage: z.boolean().optional().default(false)
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
        content: `You are GPT-5, the most advanced reasoning model.\n${modePrompts[args.mode as keyof typeof modePrompts || 'analytical']}.\nProvide step-by-step reasoning with clear explanations.\n${args.context ? `Context: ${args.context}` : ''}`
      },
      {
        role: "user",
        content: args.query
      }
    ];
    
    // Use GPT-5.1 with high reasoning
    return await callOpenAI(messages, OpenAI51Model.FULL, 0.7, 4000, "high");
  }
};

/**
 * GPT-5-mini Reasoning Tool - Cost-efficient reasoning without confirmation
 */
export const gpt5MiniReasonTool = {
  name: "gpt5_mini_reason",
  description: "Cost-efficient reasoning using GPT-5-mini",
  parameters: z.object({
    query: z.string(),
    context: z.string().optional(),
    mode: z.enum(["mathematical", "scientific", "logical", "analytical"]).optional().default("analytical")
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
        content: `You are GPT-5-mini, optimized for efficient reasoning.\n${modePrompts[args.mode as keyof typeof modePrompts || 'analytical']}.\nProvide clear, step-by-step reasoning.\n${args.context ? `Context: ${args.context}` : ''}`
      },
      {
        role: "user",
        content: args.query
      }
    ];
    
    // Use GPT-5.1-codex-mini with medium reasoning
    return await callOpenAI(messages, OpenAI51Model.CODEX_MINI, 0.7, 3000, "medium");
  }
};

export const openaiGpt5ReasonTool = {
  name: "openai_reason",
  description: "Mathematical reasoning using GPT-5.1 with high reasoning effort",
  parameters: z.object({
    query: z.string(),
    context: z.string().optional(),
    mode: z.enum(["mathematical", "scientific", "logical", "analytical"]).optional().default("analytical")
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
        content: `You are an expert reasoner using advanced analytical capabilities.
${modePrompts[args.mode as keyof typeof modePrompts || 'analytical']}.
Provide step-by-step reasoning with clear explanations.
${args.context ? `Context: ${args.context}` : ''}`
      },
      {
        role: "user",
        content: args.query
      }
    ];

    // Use GPT-5.1 with high reasoning effort for complex reasoning
    return await callOpenAI(messages, OpenAI51Model.FULL, 0.7, 4000, "high");
  }
};


/**
 * OpenAI Brainstorm Tool
 * Creative ideation and brainstorming
 */
export const openAIBrainstormTool = {
  name: "openai_brainstorm",
  description: "Creative brainstorming",
  parameters: z.object({
    problem: z.string(),
    constraints: z.string().optional(),
    quantity: z.number().optional(),
    style: z.enum(["innovative", "practical", "wild", "systematic"]).optional(),
    model: z.enum(["gpt-5.1", "gpt-5.1-codex-mini", "gpt-5.1-codex"]).optional(),
    reasoning_effort: z.enum(["none", "low", "medium", "high"]).optional(),
    max_tokens: z.number().optional()
  }),
  execute: async (args: { problem: string; constraints?: string; quantity?: number; style?: string; model?: string; reasoning_effort?: string; max_tokens?: number }, options: { log?: any; skipValidation?: boolean } = {}) => {
    const {
      problem,
      constraints,
      quantity = 5,
      style = "innovative",
      model = "gpt-5.1-codex-mini",
      reasoning_effort = "medium",
      max_tokens = 4000
    } = args;
    console.error('🚀 TOOL CALLED: openai_brainstorm');
    console.error('📥 ARGS RECEIVED:', JSON.stringify(args, null, 2));
    console.error('📥 OPTIONS RECEIVED:', JSON.stringify(options, null, 2));
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
Format: Number each idea and provide a brief explanation.`
      },
      {
        role: "user",
        content: `Brainstorm solutions for: ${problem}`
      }
    ];

    // Use specified model with proper parameters
    const maxTokens = max_tokens;
    const reasoningEffort = reasoning_effort;

    console.error(`🔍 DEBUG: Using model: ${model}, reasoning_effort: ${reasoningEffort}, max_tokens: ${maxTokens}`);

    // Convert string model to OpenAIModel enum
    const modelEnum = model as OpenAIModel;
    console.error(`🔍 CALLING: callOpenAIWithCustomParams with ${modelEnum}, skipValidation: ${options.skipValidation || false}`);
    const result = await callOpenAIWithCustomParams(messages, modelEnum, 0.9, maxTokens, reasoningEffort, options.skipValidation || false);
    console.error('🔍 DEBUG: Got result from callOpenAI:', result.substring(0, 100));
    console.error('✅ TOOL COMPLETE: openai_brainstorm');
    return result;
  }
};

/**
 * OpenAI Code Review Tool
 * Comprehensive code review using GPT-5.1-codex-mini
 */
export const openaiCodeReviewTool = {
  name: "openai_code_review",
  description: "Code review",
  parameters: z.object({
    code: z.string(),
    language: z.string().optional(),
    focusAreas: z.array(z.enum(["security", "performance", "readability", "bugs", "best-practices"])).optional()
  }),
  execute: async (args: { code: string; language?: string; focusAreas?: string[] }, { log }: any) => {
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
Format: Use sections for different aspects, be specific about line numbers or functions.`
      },
      {
        role: "user",
        content: `Review this code:\n\`\`\`${args.language || ''}\n${args.code}\n\`\`\``
      }
    ];

    return await callOpenAI(messages, OpenAI51Model.CODEX_MINI, 0.3, 4000, "medium");
  }
};

/**
 * OpenAI Explain Tool
 * Clear explanations for complex topics using GPT-5.1-codex-mini
 */
export const openaiExplainTool = {
  name: "openai_explain",
  description: "Explain concepts",
  parameters: z.object({
    topic: z.string(),
    level: z.enum(["beginner", "intermediate", "expert"]).optional().default("intermediate"),
    style: z.enum(["technical", "simple", "analogy", "visual"]).optional().default("simple")
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
Make the explanation clear, engaging, and memorable.`
      },
      {
        role: "user",
        content: `Explain: ${args.topic}`
      }
    ];

    return await callOpenAI(messages, OpenAI51Model.CODEX_MINI, 0.7, 2500, "low");
  }
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
    openaiGpt5ReasonTool,  // GPT-5.1 reasoning (high effort)
    openAIBrainstormTool,  // GPT-5.1-codex-mini brainstorming (medium effort)
    openaiCodeReviewTool,  // GPT-5.1-codex-mini code review (medium effort)
    openaiExplainTool      // GPT-5.1-codex-mini explanations (low effort)
  ];
}