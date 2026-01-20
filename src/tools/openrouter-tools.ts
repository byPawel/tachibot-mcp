/**
 * OpenRouter Tools Implementation
 * Provides access to Qwen3, QwQ, and other models via OpenRouter
 */

import { z } from "zod";
import { FORMAT_INSTRUCTION } from "../utils/format-constants.js";
import { stripFormatting } from "../utils/format-stripper.js";

// NOTE: dotenv is loaded in server.ts before any imports
// No need to reload here - just read from process.env
// OpenRouter API configuration
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const OPENROUTER_API_URL = "https://openrouter.ai/api/v1/chat/completions";

// Available OpenRouter models (verified names)
export enum OpenRouterModel {
  // Qwen models - Use QWEN3_CODER (routes via Google, not broken Alibaba)
  QWEN3_CODER = "qwen/qwen3-coder",                      // 480B MoE - PRIMARY (routes via Google)
  QWEN3_CODER_PLUS = "qwen/qwen3-coder-plus",           // Alibaba-only, BROKEN free tier issues
  QWEN3_CODER_FLASH = "qwen/qwen3-coder-flash",          // Fast/cheap alternative
  QWEN3_30B = "qwen/qwen3-30b-a3b-instruct-2507",        // 30B MoE model
  QWEN3_235B_THINKING = "qwen/qwen3-235b-a22b-thinking-2507", // 235B thinking model
  QWQ_32B = "qwen/qwq-32b",                              // Deep reasoning

  // Moonshot AI models
  KIMI_K2_THINKING = "moonshotai/kimi-k2-thinking",     // 1T MoE, 32B active - agentic reasoning (256k context)
}

// Fallback map for when providers hit quota limits
const MODEL_FALLBACKS: Partial<Record<OpenRouterModel, OpenRouterModel>> = {
  [OpenRouterModel.QWEN3_CODER]: OpenRouterModel.QWEN3_CODER,
};

/**
 * Call OpenRouter API with auto-fallback on provider quota errors
 */
export async function callOpenRouter(
  messages: Array<{ role: string; content: string }>,
  model: OpenRouterModel = OpenRouterModel.QWEN3_CODER,
  temperature: number = 0.7,
  maxTokens: number = 20480,
  _isRetry: boolean = false
): Promise<string> {
  if (!OPENROUTER_API_KEY) {
    return `[OpenRouter API key not configured. Add OPENROUTER_API_KEY to .env file]`;
  }

  try {
    const requestBody: any = {
      model,
      messages,
      temperature,
      max_tokens: maxTokens,
      stream: false
    };

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
      const errorText = await response.text();

      // Check for Alibaba free tier quota error - auto-fallback
      if (!_isRetry && errorText.includes("FreeTierOnly") && MODEL_FALLBACKS[model]) {
        const fallback = MODEL_FALLBACKS[model]!;
        console.error(`[OpenRouter] ${model} hit provider quota, falling back to ${fallback}`);
        return callOpenRouter(messages, fallback, temperature, maxTokens, true);
      }

      throw new Error(`OpenRouter API error: ${response.statusText} - ${errorText}`);
    }

    const data = await response.json() as any;
    const content = data.choices?.[0]?.message?.content || "No response from OpenRouter";
    return stripFormatting(content);
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);

    // Also catch quota errors from thrown exceptions
    if (!_isRetry && errorMsg.includes("FreeTierOnly") && MODEL_FALLBACKS[model]) {
      const fallback = MODEL_FALLBACKS[model]!;
      console.error(`[OpenRouter] ${model} hit provider quota, falling back to ${fallback}`);
      return callOpenRouter(messages, fallback, temperature, maxTokens, true);
    }

    return `[OpenRouter error: ${errorMsg}]`;
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
    task: z.enum(["generate", "review", "optimize", "debug", "refactor", "explain", "analyze"])
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
      explain: "Explain how the code works in detail",
      analyze: "Analyze code for patterns, complexity, architecture, and provide insights"
    };
    
    const systemPrompt = `You are Qwen3-Coder, an advanced code generation model.
Task: ${taskPrompts[args.task as keyof typeof taskPrompts]}
${args.language ? `Language: ${args.language}` : ''}
Focus on: clean code, best practices, performance, and maintainability.
${FORMAT_INSTRUCTION}`;
    
    const requirementsText = args.requirements || "Analyze and provide insights";
    const userPrompt = args.code
      ? `Code:\n\`\`\`${args.language || ''}\n${args.code}\n\`\`\`\n\nRequirements: ${requirementsText}`
      : requirementsText;
    
    const messages = [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt }
    ];
    
    const model = args.useFree === true ? OpenRouterModel.QWEN3_30B : OpenRouterModel.QWEN3_CODER;
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
${args.context ? `Context: ${args.context}` : ''}
${FORMAT_INSTRUCTION}`
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
${modePrompts[args.mode as keyof typeof modePrompts || 'chat']}.
${FORMAT_INSTRUCTION}`
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
      "qwen-coder-plus": OpenRouterModel.QWEN3_CODER,
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
 * Algorithm Optimization Tool
 * Deep algorithmic reasoning with QwQ-32B
 */
export const qwenAlgoTool = {
  name: "qwen_algo",
  description: "Algorithm optimization and complexity analysis using QwQ-32B reasoning model",
  parameters: z.object({
    problem: z.string().describe("The algorithm problem or code to analyze"),
    context: z.string().optional().describe("Additional context: current performance, constraints"),
    focus: z.enum(["optimize", "complexity", "data-structure", "memory", "general"])
      .optional()
      .default("general")
      .describe("Focus area for analysis")
  }),
  execute: async (args: {
    problem: string;
    context?: string;
    focus?: string;
  }, { log }: any) => {
    const focusPrompts: Record<string, string> = {
      optimize: "Focus on performance optimization, bottlenecks, and algorithmic improvements.",
      complexity: "Focus on time/space complexity analysis (best, average, worst case).",
      "data-structure": "Focus on data structure selection and tradeoffs.",
      memory: "Focus on memory optimization and GC pressure reduction.",
      general: "Provide comprehensive algorithmic analysis."
    };

    const messages = [
      {
        role: "system",
        content: `You are an expert algorithm analyst. ${focusPrompts[args.focus || 'general']}
Provide clear analysis with Big-O notation and concrete improvement suggestions.
${FORMAT_INSTRUCTION}`
      },
      {
        role: "user",
        content: args.context
          ? `Context: ${args.context}\n\nProblem:\n${args.problem}`
          : args.problem
      }
    ];

    return await callOpenRouter(messages, OpenRouterModel.QWQ_32B, 0.3, 8000);
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
3. Time and space complexity analysis
${FORMAT_INSTRUCTION}`
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
Focus on: thorough analysis, logical reasoning, and actionable insights.
${FORMAT_INSTRUCTION}`
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
    qwenAlgoTool,
    qwenCompetitiveTool,
    kimiThinkingTool
  ];
}