/**
 * Grok Tools Implementation
 * Provides Grok 4 reasoning and code analysis capabilities
 */

import { z } from "zod";
import { config } from "dotenv";
import * as path from 'path';
import { fileURLToPath } from 'url';
import { grokSearchTool } from './grok-enhanced.js';
import { validateToolInput, ValidationContext } from "../utils/input-validator.js";
import { getGrokApiKey, hasGrokApiKey } from "../utils/api-keys.js";
import { stripFormatting } from "../utils/format-stripper.js";
import { FORMAT_INSTRUCTION } from "../utils/format-constants.js";
import { tryOpenRouterGateway, isGatewayEnabled } from "../utils/openrouter-gateway.js";
import { withHeartbeat } from "../utils/streaming-helper.js";
import { readFilesIntoContext } from "../utils/file-reader.js";
// Note: renderOutput is applied centrally in server.ts safeAddTool() - no need to import here

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
config({ path: path.resolve(__dirname, '../../../.env') });

// Grok API configuration
const GROK_API_KEY = getGrokApiKey();
const GROK_API_URL = "https://api.x.ai/v1/chat/completions";

// Available Grok models - Updated 2026-04-10 with Grok 4.20 (Mar 2026)
export enum GrokModel {
  // Grok 4.20 models (Mar 10, 2026) - FLAGSHIP
  GROK_4_20_REASONING = "grok-4.20-0309-reasoning",           // Flagship: 2M context, $2/$6, low hallucination
  GROK_4_20_NON_REASONING = "grok-4.20-0309-non-reasoning",   // Standard: 2M context, $2/$6
  GROK_4_20_MULTI_AGENT = "grok-4.20-multi-agent-0309",       // Multi-agent: 4-16 agents, $2/$6

  // Grok 4.1 fast models (Nov 2025) - BEST VALUE (10x cheaper)
  GROK_4_1_FAST_REASONING = "grok-4-1-fast-reasoning",     // Fast reasoning: 2M context, $0.20/$0.50
  GROK_4_1_FAST = "grok-4-1-fast-non-reasoning",           // Tool-calling optimized: 2M context, $0.20/$0.50

  // Grok 4 fast models (2025) - Still good
  CODE_FAST = "grok-code-fast-1",              // Coding specialist: 256K→2M, $0.20/$1.50, 92 tok/sec
  GROK_4_FAST_REASONING = "grok-4-fast-reasoning", // Cheap reasoning: 2M→4M, $0.20/$0.50
  GROK_4_FAST = "grok-4-fast-non-reasoning",   // Fast general: 2M→4M, $0.20/$0.50

  // Expensive/specialized (use sparingly)
  GROK_4_HEAVY = "grok-4-0709",                // Multi-agent: 256K→2M, $3/$15 (EXPENSIVE!)
  GROK_3 = "grok-3",                           // Legacy with search capability
}

/**
 * Call Grok API
 * @param validationContext - Context for input validation (default: 'llm-orchestration')
 *   - 'user-input': Strict validation for direct user input
 *   - 'code-analysis': Relaxed for code analysis tools
 *   - 'llm-orchestration': Medium for LLM-to-LLM calls
 */
export async function callGrok(
  messages: Array<{ role: string; content: string }>,
  model: GrokModel = GrokModel.GROK_4_20_REASONING,
  temperature: number = 0.7,
  maxTokens: number = 16384,  // Increased default for comprehensive responses
  forceVisibleOutput: boolean = true,
  validationContext: ValidationContext = 'llm-orchestration',
  reasoningEffort?: 'low' | 'medium' | 'high' | 'xhigh'
): Promise<string> {
  // Try OpenRouter gateway first if enabled
  if (isGatewayEnabled()) {
    const gatewayResult = await tryOpenRouterGateway(model, messages, {
      temperature,
      max_tokens: maxTokens
    });
    if (gatewayResult) {
      return gatewayResult;
    }
    // Gateway failed, fall through to direct API
    console.error(`🔀 [Grok] Gateway returned null, falling back to direct API`);
  }

  if (!GROK_API_KEY) {
    return `[Grok API key not configured. Add XAI_API_KEY to .env file]`;
  }

  // Validate and sanitize message content with context-aware rules
  const validatedMessages = messages.map((msg) => {
    const validation = validateToolInput(msg.content, validationContext);
    if (!validation.valid) {
      throw new Error(validation.error || "Invalid message content");
    }
    return { ...msg, content: validation.sanitized };
  });

  // Grok 4.x reasoning can take 60-90s; 4.20 and multi-agent can take longer
  const isReasoning = model.includes('reasoning') || model.includes('multi-agent');
  const is420 = model.includes('4.20');
  const timeoutMs = is420 ? 180000 : (isReasoning ? 120000 : 60000);

  try {
    // For Grok 4+ models, we need to handle reasoning tokens specially
    const isGrok4Plus = model.includes('grok-4');

    // Adjust prompt for Grok 4+ to ensure visible output
    if (isGrok4Plus && forceVisibleOutput) {
      const lastMessage = validatedMessages[validatedMessages.length - 1];
      if (lastMessage.role === 'user') {
        lastMessage.content += '\n\nProvide a detailed response with your reasoning and conclusion.';
      }
    }
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    const isMultiAgent = model.includes('multi-agent');
    const requestBody: any = {
      model,
      messages: validatedMessages,
      temperature,
      max_tokens: maxTokens,
      stream: false
    };
    if (isMultiAgent && reasoningEffort) {
      requestBody.reasoning = { effort: reasoningEffort };
    }

    const response = await fetch(GROK_API_URL, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${GROK_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(requestBody),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Grok API error: ${response.statusText} - ${error}`);
    }

    const data = await response.json() as any;
    const content = data.choices?.[0]?.message?.content;
    
    // Handle Grok 4's reasoning tokens
    if (!content && data.usage?.completion_tokens_details?.reasoning_tokens > 0) {
      // If Grok 4 returns no visible content, retry with Grok 3 for visible output
      if (isGrok4Plus && forceVisibleOutput) {
        console.error(`Grok 4 used ${data.usage.completion_tokens_details.reasoning_tokens} reasoning tokens with no output. Retrying with Grok 3...`);
        // Messages already validated - use same context for retry
        return callGrok(validatedMessages, GrokModel.GROK_3, temperature, maxTokens, false, validationContext);
      }
      return `[Grok ${model} performed deep reasoning with ${data.usage.completion_tokens_details.reasoning_tokens} tokens]`;
    }
    
    return content || "No response from Grok";
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      return `[Grok timeout: ${model} exceeded ${isReasoning ? '120' : '60'}s limit]`;
    }
    return `[Grok error: ${error instanceof Error ? error.message : String(error)}]`;
  }
}

/**
 * Grok Reasoning Tool
 * Deep logical reasoning with first principles thinking
 */
export const grokReasonTool = {
  name: "grok_reason",
  description: "Deep reasoning. Put your PROBLEM or QUESTION in the 'problem' parameter.",
  parameters: z.object({
    problem: z.string().describe("The problem or question to reason about (REQUIRED - put your question here)"),
    approach: z.string()
      .optional()
      .describe("Reasoning approach (e.g., analytical, creative, systematic, first-principles)"),
    context: z.string().optional().describe("Additional context for the problem"),
    files: z.array(z.string()).optional().describe("File paths to read as code context. Supports line ranges: 'src/foo.ts:100-200'. Model sees ACTUAL CODE."),
    useHeavy: z.boolean().optional().describe("Use expensive Grok 4 Heavy model ($3/$15) for complex tasks")
  }),
  execute: async (args: { problem: string; approach?: string; context?: string; files?: string[]; useHeavy?: boolean }, { log, reportProgress }: any) => {
    const { problem, approach = "first-principles", context, useHeavy } = args;
    const approachPrompts = {
      analytical: "Break down the problem systematically and analyze each component",
      creative: "Think outside the box and consider unconventional solutions",
      systematic: "Follow a step-by-step logical process",
      "first-principles": "Break down to fundamental truths and build up from there"
    };

    const fileContext = args.files?.length
      ? `\n\nSOURCE CODE:\n${readFilesIntoContext(args.files)}`
      : "";

    const messages = [
      {
        role: "system",
        content: `You are Grok 4.1, an expert at logical reasoning and problem-solving.
${approachPrompts[approach as keyof typeof approachPrompts]}.
${context ? `Context: ${context}` : ''}
${FORMAT_INSTRUCTION}`
      },
      {
        role: "user",
        content: problem + fileContext
      }
    ];

    // Use 4.20 flagship by default, multi-agent for heavy tasks
    const model = useHeavy ? GrokModel.GROK_4_20_MULTI_AGENT : GrokModel.GROK_4_20_REASONING;
    const maxTokens = useHeavy ? 100000 : 16384;
    log?.info(`Using Grok model: ${model} for deep reasoning (max tokens: ${maxTokens})`);

    // Use heartbeat to prevent MCP timeout during long reasoning operations
    const reportFn = reportProgress ?? (async () => {});
    const result = await withHeartbeat(
      () => callGrok(messages, model, 0.7, maxTokens, true, 'llm-orchestration'),
      reportFn
    );
    return stripFormatting(result);
  }
};

/**
 * Grok Code Tool
 * Code analysis, optimization, and debugging
 */
export const grokCodeTool = {
  name: "grok_code",
  description: "Code analysis. Put the CODE in the 'code' parameter, NOT in 'task'.",
  parameters: z.object({
    task: z.string()
      .describe("Code task (e.g., analyze, optimize, debug, review, refactor)"),
    code: z.string().describe("The actual source code to analyze (REQUIRED - put your code here)"),
    language: z.string().optional().describe("Programming language (e.g., 'typescript', 'python')"),
    files: z.array(z.string()).optional().describe("File paths to read as code context. Supports line ranges: 'src/foo.ts:100-200'. Model sees ACTUAL CODE."),
    requirements: z.string().optional().describe("Specific requirements or focus areas")
  }),
  execute: async (args: { task: string; code: string; language?: string; files?: string[]; requirements?: string }, { log, reportProgress }: any) => {
    const { task, code, language, requirements } = args;
    const taskPrompts = {
      analyze: "Analyze this code for logic, structure, and potential issues",
      optimize: "Optimize this code for performance and efficiency",
      debug: "Debug this code and identify issues or bugs",
      review: "Review this code for best practices and improvements",
      refactor: "Refactor this code for better maintainability and clarity"
    };

    const fileContext = args.files?.length
      ? `\n\nSOURCE CODE:\n${readFilesIntoContext(args.files)}`
      : "";

    const messages = [
      {
        role: "system",
        content: `You are Grok 4.1 Fast, expert programmer and code analyst.
Task: ${taskPrompts[task as keyof typeof taskPrompts]}
${language ? `Language: ${language}` : ''}
${requirements ? `Requirements: ${requirements}` : ''}
${FORMAT_INSTRUCTION}`
      },
      {
        role: "user",
        content: `Code:\n\`\`\`${language || ''}\n${code}\n\`\`\`` + fileContext
      }
    ];

    log?.info(`Using Grok 4.1 Fast Non-Reasoning (2M context, tool-calling optimized, $0.20/$0.50)`);
    // Use heartbeat to prevent MCP timeout
    const reportFn = reportProgress ?? (async () => {});
    const result = await withHeartbeat(
      () => callGrok(messages, GrokModel.GROK_4_20_NON_REASONING, 0.2, 4000, true, 'code-analysis'),
      reportFn
    );
    return stripFormatting(result);
  }
};

/**
 * Grok Debug Tool
 * Specialized debugging assistance
 */
export const grokDebugTool = {
  name: "grok_debug",
  description: "Debug assistance. Describe the ISSUE in the 'issue' parameter.",
  parameters: z.object({
    issue: z.string().describe("Description of the issue or bug (REQUIRED - put your problem here)"),
    code: z.string().optional().describe("Relevant code that has the issue"),
    error: z.string().optional().describe("Error message or stack trace"),
    files: z.array(z.string()).optional().describe("File paths to read as code context. Supports line ranges: 'src/foo.ts:100-200'. Model sees ACTUAL CODE."),
    context: z.string().optional().describe("Additional context about the environment or conditions")
  }),
  execute: async (args: { issue: string; code?: string; error?: string; files?: string[]; context?: string }, { log, reportProgress }: any) => {
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

    const fileContext = args.files?.length
      ? `\n\nSOURCE CODE:\n${readFilesIntoContext(args.files)}`
      : "";

    const messages = [
      {
        role: "system",
        content: `You are Grok, expert debugger.
Analyze systematically:
1. Root cause
2. Why it happens
3. Solution
4. Prevention
${FORMAT_INSTRUCTION}`
      },
      {
        role: "user",
        content: prompt + fileContext
      }
    ];

    log?.info(`Using Grok 4.1 Fast Non-Reasoning for debugging (tool-calling optimized, $0.20/$0.50)`);
    // Use heartbeat to prevent MCP timeout
    const reportFn = reportProgress ?? (async () => {});
    const result = await withHeartbeat(
      () => callGrok(messages, GrokModel.GROK_4_20_NON_REASONING, 0.3, 3000, true, 'code-analysis'),
      reportFn
    );
    return stripFormatting(result);
  }
};

/**
 * Grok Architect Tool
 * System architecture and design
 */
export const grokArchitectTool = {
  name: "grok_architect",
  description: "Architecture design. Put your REQUIREMENTS in the 'requirements' parameter.",
  parameters: z.object({
    requirements: z.string().describe("The architecture requirements or design question (REQUIRED - put your question here)"),
    constraints: z.string().optional().describe("Technical or business constraints to consider"),
    scale: z.string()
      .optional()
      .describe("Expected scale (e.g., small, medium, large, enterprise)"),
    files: z.array(z.string()).optional().describe("File paths to read as code context. Supports line ranges: 'src/foo.ts:100-200'. Model sees ACTUAL CODE."),
  }),
  execute: async (args: { requirements: string; constraints?: string; scale?: string; files?: string[] }, { log, reportProgress }: any) => {
    const { requirements, constraints, scale } = args;

    const fileContext = args.files?.length
      ? `\n\nSOURCE CODE:\n${readFilesIntoContext(args.files)}`
      : "";

    const messages = [
      {
        role: "system",
        content: `You are Grok, expert system architect.
Design robust, scalable architecture.
${scale ? `Scale: ${scale}` : ''}
${constraints ? `Constraints: ${constraints}` : ''}
${FORMAT_INSTRUCTION}`
      },
      {
        role: "user",
        content: requirements + fileContext
      }
    ];

    log?.info(`Using Grok 4.20 multi-agent for architecture (16-agent swarm)`);
    // Use heartbeat to prevent MCP timeout
    const reportFn = reportProgress ?? (async () => {});
    const result = await withHeartbeat(
      () => callGrok(messages, GrokModel.GROK_4_20_MULTI_AGENT, 0.6, 4000, true, 'llm-orchestration', 'high'),
      reportFn
    );
    return stripFormatting(result);
  }
};

/**
 * Grok Brainstorm Tool
 * Creative brainstorming with Grok 4 Heavy
 */
export const grokBrainstormTool = {
  name: "grok_brainstorm",
  description: "Contrarian first-principles brainstorming: deconstruct a topic to atomic truths, challenge every assumption, then rebuild radical alternatives. Use when conventional thinking has stalled. Put your TOPIC in the 'topic' parameter.",
  parameters: z.object({
    topic: z.string().describe("The topic to brainstorm about (REQUIRED - put your idea/topic here)"),
    constraints: z.string().optional().describe("Any constraints or requirements to consider"),
    numIdeas: z.number().optional().describe("Number of radical rebuilds to generate (default: 5)"),
    forceHeavy: z.boolean().optional().describe("Use expensive Grok 4 Heavy model ($3/$15) for deeper creativity"),
    files: z.array(z.string()).optional().describe("File paths to read as code context. Supports line ranges: 'src/foo.ts:100-200'. Model sees ACTUAL CODE."),
  }),
  execute: async (args: { topic: string; constraints?: string; numIdeas?: number; forceHeavy?: boolean; files?: string[] }, { log, reportProgress }: any) => {
    const { topic, constraints, numIdeas = 5, forceHeavy = false } = args;

    const fileContext = args.files?.length
      ? `\n\nSOURCE CODE:\n${readFilesIntoContext(args.files)}`
      : "";

    const messages = [
      {
        role: "system",
        content: `Contrarian first-principles brainstormer. Output consumed by automated toolchain.

TECHNIQUE [first_principles]: Identify fundamental truths. Strip away every assumption. What are the atomic, irreducible units? Rebuild solutions from scratch using ONLY these atoms.
TECHNIQUE [what_if_speculation]: For each assumption challenged, ask: "What if the opposite were true? What becomes possible?"

PROCESS:
1. DECOMPOSE: Break the topic into 3-5 atomic truths (things that are undeniably true).
2. CHALLENGE: List 3-5 assumptions everyone makes about this topic. For each, apply what_if_speculation: what if it's wrong?
3. REBUILD: Generate ${numIdeas} radical alternatives built ONLY from atomic truths + challenged assumptions.
4. Each rebuild must be fundamentally different from conventional thinking.

${constraints ? `CONSTRAINTS: ${constraints}` : ''}

OUTPUT:
ATOMS: 3-5 fundamental truths (one sentence each)
CHALLENGED: 3-5 assumptions + what happens if each is wrong
REBUILDS: ${numIdeas} radical ideas, each with: title, one-sentence description, which assumption it breaks
No preamble. No hedging. Be opinionated.
${FORMAT_INSTRUCTION}`
      },
      {
        role: "user",
        content: topic + fileContext
      }
    ];

    const model = forceHeavy ? GrokModel.GROK_4_20_MULTI_AGENT : GrokModel.GROK_4_20_NON_REASONING;
    log?.info(`Brainstorming with Grok model: ${model} (Heavy: ${forceHeavy})`);

    const reportFn = reportProgress ?? (async () => {});
    const result = await withHeartbeat(
      () => callGrok(messages, model, 0.95, 4000, true, 'llm-orchestration'),
      reportFn
    );
    return stripFormatting(result);
  }
};

/**
 * Check if Grok is available
 */
export function isGrokAvailable(): boolean {
  return hasGrokApiKey();
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