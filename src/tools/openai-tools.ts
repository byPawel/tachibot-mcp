/**
 * OpenAI Tools Implementation
 * Provides GPT-5, GPT-5-mini, and GPT-5-nano model capabilities
 */

import { z } from "zod";
import { config } from "dotenv";
import * as path from 'path';
import { fileURLToPath } from 'url';
import { validateToolInput } from "../utils/input-validator.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
config({ path: path.resolve(__dirname, '../../../.env') });

// OpenAI API configuration
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_API_URL = "https://api.openai.com/v1/chat/completions";

// Available OpenAI models (GPT-5 family only)
export enum OpenAIModel {
  GPT5 = "gpt-5",                      // Most advanced reasoning model
  GPT5_MINI = "gpt-5-mini",            // Cost-efficient GPT-5 ($0.25/$2 per million tokens)
  GPT5_NANO = "gpt-5-nano",            // Fastest, most cost-efficient ($0.05/$0.40 per million tokens)
}

/**
 * Call OpenAI API with model fallback support
 * Automatically detects GPT-5 models and uses correct endpoint + format
 */
export async function callOpenAI(
  messages: Array<{ role: string; content: string }>,
  model: OpenAIModel = OpenAIModel.GPT5_MINI,
  temperature: number = 1,
  maxTokens: number = 16384,  // Increased default for comprehensive responses
  requireConfirmation: boolean = false,
  skipValidation: boolean = false
): Promise<string> {
  console.error(`🔍 TRACE: callOpenAI called with model: ${model}`);

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

  // Model fallback chain - GPT-5 models have no fallbacks to test actual availability
  const modelFallbacks: Record<string, string[]> = {
    [OpenAIModel.GPT5]: [],  // No fallback - test actual GPT-5
    [OpenAIModel.GPT5_MINI]: [],  // No fallback - test actual GPT-5-mini
    [OpenAIModel.GPT5_NANO]: []  // No fallback - test actual GPT-5-nano
  };

  const modelsToTry = [model, ...(modelFallbacks[model] || [])];
  console.error(`🔍 TRACE: Models to try: ${modelsToTry.join(', ')}`);
  let lastError: string = '';

  for (const currentModel of modelsToTry) {
    console.error(`🔍 TRACE: Trying model: ${currentModel}`);
    try {
      // Detect if this is a GPT-5 model (uses /v1/responses endpoint)
      const isGPT5 = currentModel.startsWith('gpt-5');
      const endpoint = isGPT5
        ? "https://api.openai.com/v1/responses"
        : OPENAI_API_URL;

      // For GPT-5: convert messages to input string
      const input = isGPT5
        ? validatedMessages.map(m => m.role === 'system' ? `System: ${m.content}` : m.content).join('\n\n')
        : undefined;

      const requestBody: any = isGPT5 ? {
        model: currentModel,
        input: input,
        reasoning: {
          effort: "minimal"  // minimal/low/medium/high
        },
        text: {
          verbosity: "medium"  // silent/minimal/concise/balanced/medium/detailed/exhaustive
        }
      } : {
        model: currentModel,
        messages: validatedMessages,
        temperature,
        max_tokens: maxTokens,
        stream: false
      };

      console.error(`🔍 TRACE: Using ${isGPT5 ? '/v1/responses' : '/v1/chat/completions'} endpoint`);

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

      const data = await response.json() as any;

      // Parse response based on endpoint type
      let result: string;
      if (isGPT5) {
        // GPT-5 /v1/responses format: output array with message objects
        const messageOutput = data.output?.find((o: any) => o.type === 'message');
        const textContent = messageOutput?.content?.find((c: any) => c.type === 'output_text');
        result = textContent?.text || "No response from OpenAI";
      } else {
        // GPT-4 /v1/chat/completions format
        result = data.choices?.[0]?.message?.content || "No response from OpenAI";
      }

      console.error(`🔍 TRACE: ${currentModel} SUCCESS - Response length: ${result.length}`);

      return result;

    } catch (error) {
      lastError = `${currentModel}: ${error instanceof Error ? error.message : String(error)}`;
      console.error(`🔍 TRACE: ${currentModel} EXCEPTION - ${lastError}`);
      continue; // Try next model
    }
  }

  console.error(`🔍 TRACE: ALL MODELS FAILED - Last error: ${lastError}`);
  return `[GPT-5 model "${model}" not available. Error: ${lastError}]`;
}

/**
 * Call OpenAI API with custom parameters for specific models
 * Automatically detects GPT-5 models and uses correct endpoint + format
 */
async function callOpenAIWithCustomParams(
  messages: Array<{ role: string; content: string }>,
  model: OpenAIModel,
  temperature: number = 0.8,
  maxTokens: number = 16384,  // Increased for detailed brainstorming
  reasoningEffort: string = "low",
  skipValidation: boolean = false
): Promise<string> {
  console.error(`🔍 TRACE: callOpenAIWithCustomParams called with model: ${model}, reasoning_effort: ${reasoningEffort}`);

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
    const isGPT5 = model.startsWith('gpt-5');
    const endpoint = isGPT5
      ? "https://api.openai.com/v1/responses"
      : OPENAI_API_URL;

    // For GPT-5: convert messages to input string
    const input = isGPT5
      ? validatedMessages.map(m => m.role === 'system' ? `System: ${m.content}` : m.content).join('\n\n')
      : undefined;

    const requestBody: any = isGPT5 ? {
      model: model,
      input: input,
      reasoning: {
        effort: reasoningEffort  // minimal/low/medium/high
      },
      text: {
        verbosity: "medium"
      }
    } : {
      model: model,
      messages: validatedMessages,
      temperature,
      max_tokens: maxTokens,
      stream: false
    };

    console.error(`🔍 TRACE: Using ${isGPT5 ? '/v1/responses' : '/v1/chat/completions'} endpoint`);
    if (isGPT5) {
      console.error(`🔍 TRACE: GPT-5 params: reasoning_effort=${reasoningEffort}`);
    } else {
      console.error(`🔍 TRACE: GPT-4 params: max_tokens=${maxTokens}, temperature=${temperature}`);
    }

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

    const data = await response.json() as any;

    // Parse response based on endpoint type
    let result: string;
    if (isGPT5) {
      // GPT-5 /v1/responses format
      const messageOutput = data.output?.find((o: any) => o.type === 'message');
      const textContent = messageOutput?.content?.find((c: any) => c.type === 'output_text');
      result = textContent?.text || "No response from OpenAI";
    } else {
      // GPT-4 /v1/chat/completions format
      result = data.choices?.[0]?.message?.content || "No response from OpenAI";
    }

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
    
    // Use GPT-5; callOpenAI has fallback to 5-mini and 4o if unavailable
    return await callOpenAI(messages, OpenAIModel.GPT5, 0.7, 4000);
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
    
    // Use GPT-5-mini directly; fallback chain will handle unavailability
    return await callOpenAI(messages, OpenAIModel.GPT5_MINI, 0.7, 3000);
  }
};

export const openaiGpt5ReasonTool = {
  name: "openai_gpt5_reason",
  description: "Mathematical reasoning using GPT-5-mini",
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

    // Use GPT-5-mini for reasoning
    return await callOpenAI(messages, OpenAIModel.GPT5_MINI, 0.7, 4000);
  }
};


/**
 * OpenAI Compare Tool
 * Multi-option comparison and consensus building using GPT-5-mini
 */
export const openaiCompareTool = {
  name: "openai_compare",
  description: "Multi-model consensus",
  parameters: z.object({
    topic: z.string(),
    options: z.array(z.string()),
    criteria: z.string().optional(),
    includeRecommendation: z.boolean().optional().default(true)
  }),
  execute: async (args: { topic: string; options: string[]; criteria?: string; includeRecommendation?: boolean }, { log }: any) => {
    const optionsList = args.options.map((opt, i) => `${i + 1}. ${opt}`).join('\n');

    const messages = [
      {
        role: "system",
        content: `You are an expert at comparative analysis and decision-making.
Compare the given options systematically.
${args.criteria ? `Criteria: ${args.criteria}` : 'Consider: pros, cons, trade-offs, and suitability'}
${args.includeRecommendation ? 'Provide a clear recommendation with justification.' : ''}`
      },
      {
        role: "user",
        content: `Topic: ${args.topic}\n\nOptions:\n${optionsList}`
      }
    ];

    return await callOpenAI(messages, OpenAIModel.GPT5_MINI, 0.7, 3000);
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
    model: z.enum(["gpt-5", "gpt-5-mini", "gpt-5-nano"]).optional(),
    reasoning_effort: z.enum(["minimal", "low", "medium", "high"]).optional(),
    verbosity: z.enum(["silent", "minimal", "concise", "balanced", "detailed", "exhaustive"]).optional(),
    max_tokens: z.number().optional()
  }),
  execute: async (args: { problem: string; constraints?: string; quantity?: number; style?: string; model?: string; reasoning_effort?: string; verbosity?: string; max_tokens?: number }, options: { log?: any; skipValidation?: boolean } = {}) => {
    const {
      problem,
      constraints,
      quantity = 5,
      style = "innovative",
      model = "gpt-5-mini",
      reasoning_effort = "low",
      verbosity = "balanced",
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
    // Use temperature=1 (default) for GPT-5, 0.8 for others
    const temperature = model.startsWith('gpt-5') ? 1.0 : 0.8;
    const result = await callOpenAIWithCustomParams(messages, modelEnum, temperature, maxTokens, reasoningEffort, options.skipValidation || false);
    console.error('🔍 DEBUG: Got result from callOpenAI:', result.substring(0, 100));
    console.error('✅ TOOL COMPLETE: openai_brainstorm');
    return result;
  }
};

/**
 * OpenAI Code Review Tool
 * Comprehensive code review
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
    
    return await callOpenAI(messages, OpenAIModel.GPT5_MINI, 0.7, 4000);
  }
};

/**
 * OpenAI Explain Tool
 * Clear explanations for complex topics
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
    
    return await callOpenAI(messages, OpenAIModel.GPT5_MINI, 0.7, 2500);
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
    openaiGpt5ReasonTool,  // GPT-5-mini reasoning
    openaiCompareTool,     // GPT-5-mini comparison
    openAIBrainstormTool,  // GPT-5-mini/GPT-5 brainstorming
    openaiCodeReviewTool,  // GPT-5-mini code review
    openaiExplainTool      // GPT-5-mini explanations
  ];
}