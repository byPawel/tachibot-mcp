/**
 * LM Studio Tools Implementation
 * Provides local open-weight model capabilities
 * Works with any model loaded in LM Studio
 */

import { z } from "zod";
import { config } from "dotenv";
import * as path from 'path';
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
config({ path: path.resolve(__dirname, '../../../.env') });

// LM Studio configuration
const LMSTUDIO_BASE_URL = process.env.LMSTUDIO_BASE_URL || "http://localhost:1234/v1";
const LMSTUDIO_MODEL = process.env.LMSTUDIO_MODEL || "local-model";

/**
 * Call LM Studio API (OpenAI compatible)
 */
async function callLMStudio(
  prompt: string,
  systemPrompt?: string,
  temperature: number = 0.7,
  maxTokens: number = 2048
): Promise<string> {
  try {
    const url = `${LMSTUDIO_BASE_URL}/chat/completions`;
    
    const messages = [];
    if (systemPrompt) {
      messages.push({ role: "system", content: systemPrompt });
    }
    messages.push({ role: "user", content: prompt });
    
    const requestBody = {
      model: LMSTUDIO_MODEL,
      messages,
      temperature,
      max_tokens: maxTokens,
      stream: false
    };

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      throw new Error(`LM Studio API error: ${response.statusText}`);
    }

    const data = await response.json() as any;
    return data.choices?.[0]?.message?.content || "No response from LM Studio";
  } catch (error) {
    // Check if LM Studio is running
    if (error instanceof Error && error.message.includes("ECONNREFUSED")) {
      return `[LM Studio not running. Start LM Studio and load a model at ${LMSTUDIO_BASE_URL}]`;
    }
    return `[LM Studio error: ${error instanceof Error ? error.message : String(error)}]`;
  }
}

/**
 * LM Studio Query Tool
 * Direct querying of local models
 */
export const lmstudioQueryTool = {
  name: "lmstudio_query",
  description: "Query local open-weight models via LM Studio",
  parameters: z.object({
    prompt: z.string().describe("The prompt to send to the local model"),
    temperature: z.number().optional().default(0.7).describe("Temperature for response generation"),
    maxTokens: z.number().optional().default(2048).describe("Maximum tokens to generate")
  }),
  execute: async (args: { prompt: string; temperature?: number; maxTokens?: number }, { log }: any) => {
    log?.info?.("LM Studio query", { model: LMSTUDIO_MODEL });
    return await callLMStudio(args.prompt, undefined, args.temperature, args.maxTokens);
  }
};

/**
 * LM Studio Code Tool
 * Code generation and analysis with local models
 */
export const lmstudioCodeTool = {
  name: "lmstudio_code",
  description: "Generate or analyze code using local models",
  parameters: z.object({
    task: z.enum(["generate", "explain", "review", "fix", "optimize"]).describe("The code task to perform"),
    code: z.string().optional().describe("Code to analyze (for explain/review/fix/optimize)"),
    requirements: z.string().describe("Requirements or description for the task"),
    language: z.string().optional().describe("Programming language")
  }),
  execute: async (args: { task: string; code?: string; requirements: string; language?: string }, { log }: any) => {
    const systemPrompts = {
      generate: `You are an expert programmer. Generate clean, efficient code based on requirements.`,
      explain: `You are a code teacher. Explain the code clearly and concisely.`,
      review: `You are a code reviewer. Analyze for bugs, performance, and best practices.`,
      fix: `You are a debugging expert. Identify and fix issues in the code.`,
      optimize: `You are a performance expert. Optimize the code for efficiency.`
    };
    
    const systemPrompt = systemPrompts[args.task as keyof typeof systemPrompts];
    
    let prompt = args.requirements;
    if (args.code) {
      prompt = `${args.requirements}\n\nCode:\n\`\`\`${args.language || ''}\n${args.code}\n\`\`\``;
    }
    
    return await callLMStudio(prompt, systemPrompt, 0.3, 4096);
  }
};

/**
 * LM Studio Reasoning Tool
 * Complex reasoning with local models
 */
export const lmstudioReasoningTool = {
  name: "lmstudio_reason",
  description: "Perform step-by-step reasoning using local models",
  parameters: z.object({
    problem: z.string().describe("The problem to solve"),
    approach: z.enum(["analytical", "creative", "systematic", "exploratory"])
      .optional()
      .default("systematic")
      .describe("Reasoning approach"),
    steps: z.number().optional().default(5).describe("Number of reasoning steps")
  }),
  execute: async (args: { problem: string; approach?: string; steps?: number }, { log }: any) => {
    const systemPrompt = `You are a logical reasoning system. Use ${args.approach} thinking.
Break down the problem into ${args.steps} clear steps.
For each step:
1. State what you're analyzing
2. Explain your reasoning
3. Draw conclusions
4. Connect to next step

Be thorough but concise.`;
    
    return await callLMStudio(args.problem, systemPrompt, 0.5, 3000);
  }
};

/**
 * LM Studio Creative Tool
 * Creative tasks with local models
 */
export const lmstudioCreativeTool = {
  name: "lmstudio_creative",
  description: "Creative writing and ideation with local models",
  parameters: z.object({
    task: z.enum(["story", "brainstorm", "names", "concepts", "scenarios"]).describe("Creative task type"),
    prompt: z.string().describe("The creative prompt"),
    style: z.string().optional().describe("Style or tone guidelines"),
    count: z.number().optional().default(3).describe("Number of variations to generate")
  }),
  execute: async (args: { task: string; prompt: string; style?: string; count?: number }, { log }: any) => {
    const taskPrompts = {
      story: "Write a creative story",
      brainstorm: "Generate creative ideas",
      names: "Create unique names",
      concepts: "Develop innovative concepts",
      scenarios: "Imagine possible scenarios"
    };
    
    const systemPrompt = `You are a creative assistant. ${taskPrompts[args.task as keyof typeof taskPrompts]}.
${args.style ? `Style: ${args.style}` : ''}
Generate ${args.count} unique variations.
Be imaginative and original.`;
    
    return await callLMStudio(args.prompt, systemPrompt, 0.9, 2048);
  }
};

/**
 * LM Studio Chat Tool
 * Conversational interaction with local models
 */
export const lmstudioChatTool = {
  name: "lmstudio_chat",
  description: "Have a conversation with local models",
  parameters: z.object({
    message: z.string().describe("Your message to the model"),
    persona: z.enum(["assistant", "expert", "tutor", "friend", "advisor"])
      .optional()
      .default("assistant")
      .describe("The persona for the model to adopt")
  }),
  execute: async (args: { message: string; persona?: string }, { log }: any) => {
    const personas = {
      assistant: "You are a helpful AI assistant. Be professional and informative.",
      expert: "You are a subject matter expert. Provide detailed, authoritative answers.",
      tutor: "You are a patient tutor. Explain concepts clearly with examples.",
      friend: "You are a friendly companion. Be casual and engaging.",
      advisor: "You are a wise advisor. Offer thoughtful guidance and perspectives."
    };
    
    const systemPrompt = personas[args.persona as keyof typeof personas];
    return await callLMStudio(args.message, systemPrompt, 0.7, 2048);
  }
};

/**
 * Check if LM Studio is available
 */
export async function isLMStudioAvailable(): Promise<boolean> {
  try {
    const response = await fetch(`${LMSTUDIO_BASE_URL}/models`, {
      method: "GET",
      signal: AbortSignal.timeout(2000) // 2 second timeout
    });
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Get current loaded model in LM Studio
 */
export async function getLMStudioModel(): Promise<string> {
  try {
    const response = await fetch(`${LMSTUDIO_BASE_URL}/models`);
    if (response.ok) {
      const data = await response.json() as any;
      return data.data?.[0]?.id || "No model loaded";
    }
  } catch {}
  return "LM Studio not connected";
}

/**
 * Get all LM Studio tools
 */
export function getAllLMStudioTools() {
  return [
    lmstudioQueryTool,
    lmstudioCodeTool,
    lmstudioReasoningTool,
    lmstudioCreativeTool,
    lmstudioChatTool
  ];
}