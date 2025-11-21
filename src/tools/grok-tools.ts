/**
 * Grok Tools Implementation
 * Provides Grok 4 reasoning and code analysis capabilities
 */

import { z } from "zod";
import { config } from "dotenv";
import * as path from 'path';
import { fileURLToPath } from 'url';
import { grokSearchTool } from './grok-enhanced.js';
import { validateToolInput } from "../utils/input-validator.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
config({ path: path.resolve(__dirname, '../../../.env') });

// Grok API configuration
const GROK_API_KEY = process.env.GROK_API_KEY;
const GROK_API_URL = "https://api.x.ai/v1/chat/completions";

// Available Grok models - Updated 2025-11-21 with Grok 4.1
export enum GrokModel {
  // Grok 4.1 models (Nov 2025) - LATEST & BEST
  GROK_4_1 = "grok-4.1",                       // Latest: 2M context, $0.20/$0.50, enhanced reasoning & creativity
  GROK_4_1_FAST = "grok-4.1-fast",             // Tool-calling optimized: 2M context, $0.20/$0.50, agentic workflows

  // Previous fast models (2025) - Still good
  CODE_FAST = "grok-code-fast-1",              // Coding specialist: 256K→2M, $0.20/$1.50, 92 tok/sec
  GROK_4_FAST_REASONING = "grok-4-fast-reasoning", // Cheap reasoning: 2M→4M, $0.20/$0.50
  GROK_4_FAST = "grok-4-fast-non-reasoning",   // Fast general: 2M→4M, $0.20/$0.50

  // Expensive/specialized (use sparingly)
  GROK_4_HEAVY = "grok-4-0709",                // Multi-agent: 256K→2M, $3/$15 (EXPENSIVE!)
  GROK_3 = "grok-3",                           // Legacy with search capability
}

/**
 * Call Grok API
 */
export async function callGrok(
  messages: Array<{ role: string; content: string }>,
  model: GrokModel = GrokModel.GROK_4_1, // Updated 2025-11-21: Use latest Grok 4.1 by default
  temperature: number = 0.7,
  maxTokens: number = 16384,  // Increased default for comprehensive responses
  forceVisibleOutput: boolean = true
): Promise<string> {
  if (!GROK_API_KEY) {
    return `[Grok API key not configured. Add GROK_API_KEY to .env file]`;
  }

  // Validate and sanitize message content
  const validatedMessages = messages.map((msg) => {
    const validation = validateToolInput(msg.content);
    if (!validation.valid) {
      throw new Error(validation.error || "Invalid message content");
    }
    return { ...msg, content: validation.sanitized };
  });

  try {
    // For Grok 4 models, we need to handle reasoning tokens specially
    const isGrok4 = model === GrokModel.GROK_4_1 ||
                    model === GrokModel.GROK_4_1_FAST ||
                    model === GrokModel.GROK_4_FAST_REASONING ||
                    model === GrokModel.GROK_4_FAST ||
                    model === GrokModel.GROK_4_HEAVY;

    // Adjust prompt for Grok 4 to ensure visible output
    if (isGrok4 && forceVisibleOutput) {
      const lastMessage = validatedMessages[validatedMessages.length - 1];
      if (lastMessage.role === 'user') {
        lastMessage.content += '\n\nProvide a detailed response with your reasoning and conclusion.';
      }
    }

    const response = await fetch(GROK_API_URL, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${GROK_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model,
        messages: validatedMessages,
        temperature,
        max_tokens: maxTokens,
        stream: false
      })
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Grok API error: ${response.statusText} - ${error}`);
    }

    const data = await response.json() as any;
    const content = data.choices?.[0]?.message?.content;
    
    // Handle Grok 4's reasoning tokens
    if (!content && data.usage?.completion_tokens_details?.reasoning_tokens > 0) {
      // If Grok 4 returns no visible content, retry with Grok 3 for visible output
      if (isGrok4 && forceVisibleOutput) {
        console.error(`Grok 4 used ${data.usage.completion_tokens_details.reasoning_tokens} reasoning tokens with no output. Retrying with Grok 3...`);
        return callGrok(validatedMessages, GrokModel.GROK_3, temperature, maxTokens, false);
      }
      return `[Grok ${model} performed deep reasoning with ${data.usage.completion_tokens_details.reasoning_tokens} tokens]`;
    }
    
    return content || "No response from Grok";
  } catch (error) {
    return `[Grok error: ${error instanceof Error ? error.message : String(error)}]`;
  }
}

/**
 * Grok Reasoning Tool
 * Deep logical reasoning with first principles thinking
 */
export const grokReasonTool = {
  name: "grok_reason",
  description: "Deep reasoning",
  parameters: z.object({
    problem: z.string(),
    approach: z.enum(["analytical", "creative", "systematic", "first-principles"]).optional(),
    context: z.string().optional(),
    useHeavy: z.boolean().optional()
  }),
  execute: async (args: { problem: string; approach?: string; context?: string; useHeavy?: boolean }, { log }: any) => {
    const { problem, approach = "first-principles", context, useHeavy } = args;
    const approachPrompts = {
      analytical: "Break down the problem systematically and analyze each component",
      creative: "Think outside the box and consider unconventional solutions",
      systematic: "Follow a step-by-step logical process",
      "first-principles": "Break down to fundamental truths and build up from there"
    };
    
    const messages = [
      {
        role: "system",
        content: `You are Grok 4.1, an expert at logical reasoning and problem-solving with enhanced emotional intelligence.
${approachPrompts[approach as keyof typeof approachPrompts]}.
${context ? `Context: ${context}` : ''}`
      },
      {
        role: "user",
        content: problem
      }
    ];

    // Use GROK_4_1 by default (latest with enhanced reasoning!), GROK_4_HEAVY only if explicitly requested
    const model = useHeavy ? GrokModel.GROK_4_HEAVY : GrokModel.GROK_4_1;
    const maxTokens = useHeavy ? 100000 : 16384; // 100k for heavy, 16k for normal reasoning
    log?.info(`Using Grok model: ${model} for deep reasoning (max tokens: ${maxTokens}, cost: ${useHeavy ? 'expensive $3/$15' : 'cheap $0.20/$0.50'})`);

    return await callGrok(messages, model, 0.7, maxTokens, true);
  }
};

/**
 * Grok Code Tool
 * Code analysis, optimization, and debugging
 */
export const grokCodeTool = {
  name: "grok_code",
  description: "Code analysis",
  parameters: z.object({
    task: z.enum(["analyze", "optimize", "debug", "review", "refactor"]),
    code: z.string(),
    language: z.string().optional(),
    requirements: z.string().optional()
  }),
  execute: async (args: { task: string; code: string; language?: string; requirements?: string }, { log }: any) => {
    const { task, code, language, requirements } = args;
    const taskPrompts = {
      analyze: "Analyze this code for logic, structure, and potential issues",
      optimize: "Optimize this code for performance and efficiency",
      debug: "Debug this code and identify issues or bugs",
      review: "Review this code for best practices and improvements",
      refactor: "Refactor this code for better maintainability and clarity"
    };

    const messages = [
      {
        role: "system",
        content: `You are Grok 4.1 Fast, an expert programmer and code analyst with advanced tool-calling capabilities.
Task: ${taskPrompts[task as keyof typeof taskPrompts]}
${language ? `Language: ${language}` : ''}
${requirements ? `Requirements: ${requirements}` : ''}`
      },
      {
        role: "user",
        content: `Code:\n\`\`\`${language || ''}\n${code}\n\`\`\``
      }
    ];

    log?.info(`Using Grok 4.1 Fast (2M context, enhanced reasoning, $0.20/$0.50)`);
    return await callGrok(messages, GrokModel.GROK_4_1_FAST, 0.2, 4000, true);
  }
};

/**
 * Grok Debug Tool
 * Specialized debugging assistance
 */
export const grokDebugTool = {
  name: "grok_debug",
  description: "Debug assistance",
  parameters: z.object({
    issue: z.string(),
    code: z.string().optional(),
    error: z.string().optional(),
    context: z.string().optional()
  }),
  execute: async (args: { issue: string; code?: string; error?: string; context?: string }, { log }: any) => {
    const { issue, code, error, context } = args;
    let prompt = `Debug this issue: ${issue}\n`;

    if (error) {
      prompt += `\nError:\n${error}\n`;
    }

    if (code) {
      prompt += `\nRelevant code:\n\`\`\`\n${code}\n\`\`\`\n`;
    }

    if (context) {
      prompt += `\nContext: ${context}\n`;
    }
    
    const messages = [
      {
        role: "system",
        content: `You are Grok Code Fast, an expert debugger.
Analyze the issue systematically:
1. Identify the root cause
2. Explain why it's happening
3. Provide a clear solution
4. Suggest preventive measures`
      },
      {
        role: "user",
        content: prompt
      }
    ];

    log?.info(`Using Grok Code Fast for debugging (specialized code model)`);
    return await callGrok(messages, GrokModel.CODE_FAST, 0.3, 3000, true);
  }
};

/**
 * Grok Architect Tool
 * System architecture and design
 */
export const grokArchitectTool = {
  name: "grok_architect",
  description: "Architecture design",
  parameters: z.object({
    requirements: z.string(),
    constraints: z.string().optional(),
    scale: z.enum(["small", "medium", "large", "enterprise"]).optional()
  }),
  execute: async (args: { requirements: string; constraints?: string; scale?: string }, { log }: any) => {
    const { requirements, constraints, scale } = args;
    const messages = [
      {
        role: "system",
        content: `You are Grok, an expert system architect.
Design a robust, scalable architecture using first principles.
Consider: reliability, scalability, maintainability, security, and cost.
${scale ? `Target scale: ${scale}` : ''}
${constraints ? `Constraints: ${constraints}` : ''}`
      },
      {
        role: "user",
        content: requirements
      }
    ];

    log?.info(`Using Grok 4 Fast Reasoning for architecture (cheap reasoning model)`);
    return await callGrok(messages, GrokModel.GROK_4_FAST_REASONING, 0.6, 4000, true);
  }
};

/**
 * Grok Brainstorm Tool
 * Creative brainstorming with Grok 4 Heavy
 */
export const grokBrainstormTool = {
  name: "grok_brainstorm",
  description: "Creative brainstorming",
  parameters: z.object({
    topic: z.string(),
    constraints: z.string().optional(),
    numIdeas: z.number().optional(),
    forceHeavy: z.boolean().optional()
  }),
  execute: async (args: { topic: string; constraints?: string; numIdeas?: number; forceHeavy?: boolean }, { log }: any) => {
    const { topic, constraints, numIdeas = 5, forceHeavy = false } = args; // Changed: Default to cheap model
    const messages = [
      {
        role: "system",
        content: `You are Grok in maximum creative mode. Generate ${numIdeas} innovative, unconventional ideas.
Think beyond normal boundaries. Challenge assumptions. Propose radical solutions.
${constraints ? `Constraints: ${constraints}` : 'No constraints - think freely!'}`
      },
      {
        role: "user",
        content: `Brainstorm creative solutions for: ${topic}`
      }
    ];

    // Use GROK_4_FAST for creative brainstorming (cheap, fast), GROK_4_HEAVY only if explicitly requested
    const model = forceHeavy ? GrokModel.GROK_4_HEAVY : GrokModel.GROK_4_FAST;
    log?.info(`Brainstorming with Grok model: ${model} (Heavy: ${forceHeavy}, cost: ${forceHeavy ? 'expensive $3/$15' : 'cheap $0.20/$0.50'})`);

    return await callGrok(messages, model, 0.95, 4000); // High temperature for creativity
  }
};

/**
 * Check if Grok is available
 */
export function isGrokAvailable(): boolean {
  return !!GROK_API_KEY;
}

/**
 * Get all Grok tools
 */
interface GrokToolDefinition {
  name: string;
  description: string;
  parameters: z.ZodObject<any>;
  execute: (args: any, context: any) => Promise<string>;
}

export function getAllGrokTools(): GrokToolDefinition[] {
  if (!isGrokAvailable()) {
    return [];
  }

  // Minimized tool set - keeping all essential Grok tools
  return [
    grokReasonTool as GrokToolDefinition,       // Deep reasoning
    grokCodeTool as GrokToolDefinition,         // Code analysis
    grokDebugTool as GrokToolDefinition,        // Deep debugging
    grokArchitectTool as GrokToolDefinition,    // System architecture
    grokBrainstormTool as GrokToolDefinition,   // Creative brainstorming
    grokSearchTool as GrokToolDefinition        // Web search with Grok
  ];
}