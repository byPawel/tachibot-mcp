/**
 * OpenRouter Tools Implementation
 * Provides access to Qwen3, QwQ, and other models via OpenRouter
 */

import { z } from "zod";

// NOTE: dotenv is loaded in server.ts before any imports
// No need to reload here - just read from process.env
// OpenRouter API configuration
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const OPENROUTER_API_URL = "https://openrouter.ai/api/v1/chat/completions";

// Available OpenRouter models (verified names)
export enum OpenRouterModel {
  // Qwen models - Premium models with credits
  QWEN3_CODER_PLUS = "qwen/qwen3-coder-plus",            // Proprietary Qwen3 Coder Plus (480B MoE) - BEST for coding
  QWEN3_CODER = "qwen/qwen3-coder",                      // 480B MoE, 35B active - BEST for coding
  QWEN3_30B = "qwen/qwen3-30b-a3b-instruct-2507",        // 30B MoE model
  QWEN3_235B_THINKING = "qwen/qwen3-235b-a22b-thinking-2507", // 235B thinking model
  QWQ_32B = "qwen/qwq-32b",                              // Deep reasoning (QwQ is Qwen's reasoning model)

  // Moonshot AI models
  KIMI_K2_THINKING = "moonshotai/kimi-k2-thinking",     // 1T MoE, 32B active - Leading open-source agentic reasoning model (256k context)
}

/**
 * Call OpenRouter API
 */
export async function callOpenRouter(
  messages: Array<{ role: string; content: string }>,
  model: OpenRouterModel = OpenRouterModel.QWEN3_CODER,
  temperature: number = 0.7,
  maxTokens: number = 20480  // 20k for comprehensive code analysis
): Promise<string> {
  if (!OPENROUTER_API_KEY) {
    return `[OpenRouter API key not configured. Add OPENROUTER_API_KEY to .env file]`;
  }

  try {
    // Kimi K2 Thinking requires special reasoning parameters
    const isKimiThinking = model === OpenRouterModel.KIMI_K2_THINKING;
    const requestBody: any = {
      model,
      messages,
      temperature,
      max_tokens: maxTokens,
      stream: false
    };

    // Kimi K2 Thinking has built-in reasoning - no special params needed
    // OpenRouter auto-enables reasoning for this model

    const response = await fetch(OPENROUTER_API_URL, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://tachibot-mcp.local",
        "X-Title": "Tachibot MCP Server"
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`OpenRouter API error: ${response.statusText} - ${error}`);
    }

    const data = await response.json() as any;
    return data.choices?.[0]?.message?.content || "No response from OpenRouter";
  } catch (error) {
    return `[OpenRouter error: ${error instanceof Error ? error.message : String(error)}]`;
  }
}

/**
 * Qwen Coder Tool
 * Advanced code generation with 480B MoE model
 */
export const qwenCoderTool = {
  name: "qwen_coder",
  description: "Code generation",
  parameters: z.object({
    task: z.enum(["generate", "review", "optimize", "debug", "refactor", "explain"])
      ,
    code: z.string().optional(),
    requirements: z.string().optional().default(""), // Changed: Make optional with default
    language: z.string().optional(),
    useFree: z.boolean().optional().default(false)
  }),
  execute: async (args: {
    task: string;
    code?: string;
    requirements?: string; // Changed: Optional
    language?: string;
    useFree?: boolean
  }, { log }: any) => {
    const taskPrompts = {
      generate: "Generate new code according to requirements",
      review: "Review code for quality, bugs, and improvements",
      optimize: "Optimize code for performance and efficiency",
      debug: "Debug and fix issues in the code",
      refactor: "Refactor code for better structure and maintainability",
      explain: "Explain how the code works in detail"
    };
    
    const systemPrompt = `You are Qwen3-Coder, an advanced code generation model.
Task: ${taskPrompts[args.task as keyof typeof taskPrompts]}
${args.language ? `Language: ${args.language}` : ''}
Focus on: clean code, best practices, performance, and maintainability.`;
    
    const requirementsText = args.requirements || "Analyze and provide insights";
    const userPrompt = args.code
      ? `Code:\n\`\`\`${args.language || ''}\n${args.code}\n\`\`\`\n\nRequirements: ${requirementsText}`
      : requirementsText;
    
    const messages = [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt }
    ];
    
    const model = args.useFree === true ? OpenRouterModel.QWEN3_30B : OpenRouterModel.QWEN3_CODER_PLUS;
    return await callOpenRouter(messages, model, 0.2, 8000);
  }
};

/**
 * QwQ Reasoning Tool
 * Deep reasoning with QwQ-32B model
 */
export const qwqReasoningTool = {
  name: "qwq_reason",
  description: "Deep reasoning",
  parameters: z.object({
    problem: z.string(),
    context: z.string().optional(),
    approach: z.enum(["step-by-step", "mathematical", "logical", "creative"])
      .optional()
      .default("step-by-step"),
    useFree: z.boolean().optional().default(true)
  }),
  execute: async (args: { 
    problem: string; 
    context?: string; 
    approach?: string;
    useFree?: boolean 
  }, { log }: any) => {
    const approachPrompts = {
      "step-by-step": "Break down the problem and solve it step by step",
      mathematical: "Apply mathematical reasoning and proofs",
      logical: "Use formal logic and deductive reasoning",
      creative: "Think creatively and explore unconventional solutions"
    };
    
    const messages = [
      {
        role: "system",
        content: `You are QwQ, specialized in deep reasoning and problem-solving.
${approachPrompts[args.approach as keyof typeof approachPrompts || 'step-by-step']}.
Show your thinking process clearly.
${args.context ? `Context: ${args.context}` : ''}`
      },
      {
        role: "user",
        content: args.problem
      }
    ];
    
    const model = args.useFree !== false ? OpenRouterModel.QWQ_32B : OpenRouterModel.QWQ_32B;
    return await callOpenRouter(messages, model, 0.3, 6000);
  }
};

/**
 * Qwen General Tool
 * General-purpose assistance with Qwen3-32B
 */
export const qwenGeneralTool = {
  name: "qwen_general",
  description: "General-purpose assistance with Qwen3-32B",
  parameters: z.object({
    query: z.string(),
    mode: z.enum(["chat", "analysis", "creative", "technical"])
      .optional()
      .default("chat"),
    useFree: z.boolean().optional().default(true)
  }),
  execute: async (args: { query: string; mode?: string; useFree?: boolean }, { log }: any) => {
    const modePrompts = {
      chat: "Provide helpful, conversational responses",
      analysis: "Provide detailed analysis and insights",
      creative: "Be creative and innovative in your response",
      technical: "Focus on technical accuracy and detail"
    };
    
    const messages = [
      {
        role: "system",
        content: `You are Qwen3, a helpful AI assistant.
${modePrompts[args.mode as keyof typeof modePrompts || 'chat']}.`
      },
      {
        role: "user",
        content: args.query
      }
    ];
    
    const model = args.useFree === true ? OpenRouterModel.QWEN3_30B : OpenRouterModel.QWEN3_CODER;
    return await callOpenRouter(messages, model, 0.7, 3000);
  }
};

/**
 * Multi-Model Tool
 * Access various models via OpenRouter
 */
export const openRouterMultiModelTool = {
  name: "openrouter_multi",
  description: "Access Qwen and Kimi models through OpenRouter",
  parameters: z.object({
    query: z.string(),
    model: z.enum([
      "qwen-coder", "qwen-coder-plus",
      "qwq-32b", "kimi-k2-thinking"
    ]),
    temperature: z.number().optional().default(0.7)
  }),
  execute: async (args: { query: string; model: string; temperature?: number }, { log }: any) => {
    const modelMap = {
      "qwen-coder": OpenRouterModel.QWEN3_CODER,
      "qwen-coder-plus": OpenRouterModel.QWEN3_CODER_PLUS,
      "qwq-32b": OpenRouterModel.QWQ_32B,
      "kimi-k2-thinking": OpenRouterModel.KIMI_K2_THINKING
    };

    const messages = [
      {
        role: "system",
        content: "You are a helpful AI assistant. Provide clear, accurate responses."
      },
      {
        role: "user",
        content: args.query
      }
    ];

    const selectedModel = modelMap[args.model as keyof typeof modelMap];
    if (!selectedModel) {
      return `[Model ${args.model} not available]`;
    }

    return await callOpenRouter(messages, selectedModel, args.temperature || 0.7, 4000);
  }
};

/**
 * Code Competition Tool
 * Competitive programming and algorithm challenges
 */
export const qwenCompetitiveTool = {
  name: "qwen_competitive",
  description: "Competitive programming",
  parameters: z.object({
    problem: z.string(),
    constraints: z.string().optional(),
    language: z.enum(["python", "cpp", "java", "javascript", "rust"])
      .optional()
      .default("python"),
    optimize: z.boolean().optional().default(true)
  }),
  execute: async (args: {
    problem: string;
    constraints?: string;
    language?: string;
    optimize?: boolean
  }, { log }: any) => {
    const messages = [
      {
        role: "system",
        content: `You are an expert competitive programmer.
Solve the problem efficiently with clean, optimized code.
Language: ${args.language}
${args.optimize ? 'Optimize for both time and space complexity.' : ''}
${args.constraints ? `Constraints: ${args.constraints}` : ''}
Provide:
1. Approach explanation
2. Complete working code
3. Time and space complexity analysis`
      },
      {
        role: "user",
        content: args.problem
      }
    ];

    return await callOpenRouter(messages, OpenRouterModel.QWEN3_CODER, 0.1, 6000);
  }
};

/**
 * Kimi K2 Thinking Tool
 * Advanced agentic reasoning with 1T MoE model (32B active)
 * Excels at long-horizon reasoning, multi-step analysis, and complex problem-solving
 */
export const kimiThinkingTool = {
  name: "kimi_thinking",
  description: "Advanced agentic reasoning",
  parameters: z.object({
    problem: z.string(),
    context: z.string().optional(),
    approach: z.enum(["step-by-step", "analytical", "creative", "systematic"])
      .optional()
      .default("step-by-step"),
    maxSteps: z.number().optional().default(10) // For multi-step reasoning
  }),
  execute: async (args: {
    problem: string;
    context?: string;
    approach?: string;
    maxSteps?: number
  }, { log }: any) => {
    const approachPrompts = {
      "step-by-step": "Break down the problem into clear steps and solve systematically",
      analytical: "Analyze the problem deeply, considering multiple perspectives and implications",
      creative: "Think creatively and explore unconventional solutions and approaches",
      systematic: "Apply systematic reasoning with clear logic chains and verification"
    };

    const messages = [
      {
        role: "system",
        content: `You are Kimi K2 Thinking, a state-of-the-art agentic reasoning model.
${approachPrompts[args.approach as keyof typeof approachPrompts || 'step-by-step']}.
Show your complete thinking process with clear reasoning chains.
Use up to ${args.maxSteps} reasoning steps if needed for complex problems.
${args.context ? `Context: ${args.context}` : ''}
Focus on: thorough analysis, logical reasoning, and actionable insights.`
      },
      {
        role: "user",
        content: args.problem
      }
    ];

    // Higher temperature (0.7) for creative reasoning, more tokens (16k) for detailed thought chains
    return await callOpenRouter(messages, OpenRouterModel.KIMI_K2_THINKING, 0.7, 16000);
  }
};

/**
 * Check if OpenRouter is available
 */
export function isOpenRouterAvailable(): boolean {
  return !!OPENROUTER_API_KEY;
}

/**
 * Get all OpenRouter tools
 */
export function getAllOpenRouterTools() {
  if (!isOpenRouterAvailable()) {
    return [];
  }

  return [
    qwenCoderTool,
    qwqReasoningTool,
    qwenGeneralTool,
    openRouterMultiModelTool,
    qwenCompetitiveTool,
    kimiThinkingTool
  ];
}