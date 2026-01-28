/**
 * Enhanced Grok Tools with Live Search and Heavy Mode Support
 * Implements Grok-4 with proper model names and live search capability
 */

import { z } from "zod";
import { config } from "dotenv";
import * as path from 'path';
import { fileURLToPath } from 'url';
import { getGrokApiKey, hasGrokApiKey } from "../utils/api-keys.js";
import { tryOpenRouterGateway, isGatewayEnabled } from "../utils/openrouter-gateway.js";
import { link } from "../utils/ansi-renderer.js";
import { stripFormatting } from "../utils/format-stripper.js";
import { FORMAT_INSTRUCTION } from "../utils/format-constants.js";
// Note: renderOutput is applied centrally in server.ts safeAddTool() - no need to call it here

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
config({ path: path.resolve(__dirname, '../../../.env') });

// Grok API configuration
const GROK_API_KEY = getGrokApiKey();
const GROK_API_URL = "https://api.x.ai/v1/chat/completions";
const GROK_RESPONSES_URL = "https://api.x.ai/v1/responses"; // New Agent Tools API endpoint (Jan 2025)

// Grok models - Updated 2025-11-22 with correct API model names
export enum GrokModel {
  // Grok 4.1 models (Nov 2025) - LATEST & BEST (verified working)
  GROK_4_1_FAST_REASONING = "grok-4-1-fast-reasoning",     // Latest: 2M context, $0.20/$0.50, enhanced reasoning
  GROK_4_1_FAST = "grok-4-1-fast-non-reasoning",           // Tool-calling optimized: 2M context, $0.20/$0.50, no reasoning tokens

  // Grok 4 fast models (2025) - Still good
  CODE_FAST = "grok-code-fast-1",              // Coding specialist: 256K→2M, $0.20/$1.50, 92 tok/sec
  GROK_4_FAST_REASONING = "grok-4-fast-reasoning", // Cheap reasoning: 2M→4M, $0.20/$0.50
  GROK_4_FAST = "grok-4-fast-non-reasoning",   // Fast general: 2M→4M, $0.20/$0.50

  // Expensive/specialized (use sparingly)
  GROK_4_HEAVY = "grok-4-0709",                // Multi-agent: 256K→2M, $3/$15 (EXPENSIVE!)
  GROK_3 = "grok-3",                           // Legacy with search capability

  // Beta/experimental (deprecated)
  GROK_BETA = "grok-beta",
  GROK_VISION_BETA = "grok-vision-beta"
}

export interface GrokOptions {
  model?: GrokModel;
  temperature?: number;
  maxTokens?: number;
  useHeavy?: boolean;      // Request Heavy compute (requires subscription)
  enableLiveSearch?: boolean;  // Enable live web search
  searchSources?: number;   // Limit number of search sources (cost control)
  searchDomains?: string[]; // Restrict search to specific domains
  structuredOutput?: boolean; // Enable structured JSON output
}

/**
 * Enhanced Grok API call with live search support
 */
export async function callGrokEnhanced(
  messages: Array<{ role: string; content: string }>,
  options: GrokOptions = {}
): Promise<{ content: string; sources?: any[]; usage?: any }> {
  if (!GROK_API_KEY) {
    return { 
      content: `[Grok API key not configured. Add GROK_API_KEY or XAI_API_KEY to .env file]` 
    };
  }

  const {
    model = GrokModel.GROK_4_1_FAST_REASONING, // Updated 2025-11-22: Use latest Grok 4.1 by default
    temperature = 0.7,
    maxTokens = options.useHeavy ? 100000 : 4000,
    enableLiveSearch = false,
    searchSources = 100, // Default to 100 sources for cost control
    searchDomains = [],
    structuredOutput = false
  } = options;

  try {
    // Use different endpoint and format for search vs non-search
    if (enableLiveSearch) {
      // NEW Agent Tools API (Jan 2025) - uses /v1/responses endpoint
      // with 'input' instead of 'messages' and tools array
      const searchRequestBody = {
        model: GrokModel.GROK_4_1_FAST, // Tool-calling optimized model for agentic search
        input: messages.map(m => ({ role: m.role, content: m.content })),
        tools: [
          { type: "web_search" },
          { type: "x_search" }
        ],
        temperature,
        max_output_tokens: maxTokens
      };

      console.error('[Grok Search Debug] Using Responses API:', GROK_RESPONSES_URL);
      console.error('[Grok Search Debug] Request:', JSON.stringify(searchRequestBody, null, 2));

      const response = await fetch(GROK_RESPONSES_URL, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${GROK_API_KEY}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(searchRequestBody)
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Grok API error: ${response.statusText} - ${error}`);
      }

      const data = await response.json() as any;

      // Responses API format: output[] contains web_search_call entries and a message entry
      // Structure: { output: [{ type: "web_search_call", ... }, { type: "message", content: [{ type: "output_text", text: "...", annotations: [...] }] }] }
      let content = "No response from Grok";
      let sources: any[] = [];

      if (data.output && Array.isArray(data.output)) {
        // Find the message output (skip web_search_call entries)
        const messageOutput = data.output.find((o: any) => o.type === "message");

        if (messageOutput?.content && Array.isArray(messageOutput.content)) {
          // Extract text from output_text content
          content = messageOutput.content
            .filter((c: any) => c.type === "output_text")
            .map((c: any) => c.text)
            .join("\n");

          // Extract citations from annotations (NOT from top-level data.citations!)
          for (const contentItem of messageOutput.content) {
            if (contentItem.annotations && Array.isArray(contentItem.annotations)) {
              for (const annotation of contentItem.annotations) {
                if (annotation.type === "url_citation") {
                  sources.push({
                    url: annotation.url,
                    title: annotation.title || annotation.url
                  });
                }
              }
            }
          }
        }
      }

      return {
        content,
        sources,
        usage: data.usage
      };
    }

    // Standard chat completions for non-search requests
    const requestBody: any = {
      model,
      messages,
      temperature,
      max_tokens: maxTokens,
      stream: false
    };

    // Enable structured output if requested
    if (structuredOutput) {
      requestBody.response_format = { type: "json_object" };
    }

    const response = await fetch(GROK_API_URL, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${GROK_API_KEY}`,
        "Content-Type": "application/json",
        ...(options.useHeavy ? { 'X-Grok-Mode': 'heavy' } : {})
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Grok API error: ${response.statusText} - ${error}`);
    }

    const data = await response.json() as any;
    const content = data.choices?.[0]?.message?.content || "No response from Grok";

    return {
      content,
      sources: [],
      usage: data.usage
    };
  } catch (error) {
    return {
      content: `[Grok error: ${error instanceof Error ? error.message : String(error)}]`
    };
  }
}

/**
 * Enhanced Scout Tool with Grok-4 Live Search
 * Quick research with real-time web data
 */
export const grokScoutTool = {
  name: "grok_scout",
  description: "Quick research",
  parameters: z.object({
    query: z.string(),
    enableLiveSearch: z.boolean().optional(),
    searchSources: z.number().optional(),
    searchDomains: z.array(z.string()).optional(),
    variant: z.enum(["quick", "deep", "technical", "academic"]).optional()
  }),
  execute: async (args: any, { log }: any) => {
    const { query, enableLiveSearch = true, searchSources = 50, searchDomains, variant = "quick" } = args;
    const variantPrompts = {
      quick: "Provide a quick, concise overview with key facts",
      deep: "Conduct thorough research with multiple perspectives",
      technical: "Focus on technical details and implementation aspects",
      academic: "Provide scholarly analysis with citations"
    };

    const messages = [
      {
        role: "system",
        content: `You are Grok in research mode with live search capability.
${variantPrompts[variant as keyof typeof variantPrompts]}.
Use live search to find the most current and relevant information.
Cite your sources when using web data.
${FORMAT_INSTRUCTION}`
      },
      {
        role: "user",
        content: query
      }
    ];

    log?.info(`Grok Scout: ${variant} research with ${enableLiveSearch ? 'live search' : 'knowledge base'} (using grok-4-1-fast-reasoning with enhanced reasoning)`);

    const result = await callGrokEnhanced(messages, {
      model: GrokModel.GROK_4_1_FAST_REASONING, // Updated 2025-11-21: Use latest Grok 4.1
      enableLiveSearch,
      searchSources,
      searchDomains,
      temperature: 0.5, // Lower temperature for factual research
      maxTokens: 5000
    });

    // Format response with sources using ANSI
    if (result.sources && result.sources.length > 0) {
      const sourcesText = result.sources
        .slice(0, 5) // Limit to top 5 sources
        .map((s: any, i: number) => {
          const title = s.title || 'Source';
          const url = s.url || '';
          return `  ${link(url, `[${i + 1}] ${title}`)}`;
        })
        .join('\n');

      return stripFormatting(`${result.content}\n\nSources:\n${sourcesText}`);
    }

    return stripFormatting(result.content);
  }
};

/**
 * Enhanced Reasoning Tool with configurable Heavy mode
 */
export const grokReasonEnhanced = {
  name: "grok_reason_v4",
  description: "Deep reasoning",
  parameters: z.object({
    problem: z.string(),
    approach: z.enum(["analytical", "creative", "systematic", "first-principles", "multi-agent"]).optional(),
    context: z.string().optional(),
    useHeavy: z.boolean().optional(),
    enableLiveSearch: z.boolean().optional(),
    maxSteps: z.number().optional()
  }),
  execute: async (args: any, { log }: any) => {
    const {
      problem,
      approach = "first-principles",
      context,
      useHeavy = false,
      enableLiveSearch = false,
      maxSteps = 5
    } = args;
    const approachPrompts = {
      analytical: "Break down the problem systematically and analyze each component",
      creative: "Think outside the box and consider unconventional solutions",
      systematic: "Follow a step-by-step logical process",
      "first-principles": "Break down to fundamental truths and build up from there",
      "multi-agent": "Consider multiple perspectives and synthesize them"
    };
    
    const messages = [
      {
        role: "system",
        content: `You are Grok-4 in ${useHeavy ? 'Heavy' : 'Standard'} reasoning mode.
${approachPrompts[approach as keyof typeof approachPrompts]}.
${context ? `Context: ${context}` : ''}
Maximum reasoning steps: ${maxSteps}
${enableLiveSearch ? 'Use live search for current information when needed.' : ''}
${FORMAT_INSTRUCTION}`
      },
      {
        role: "user",
        content: problem
      }
    ];

    const modelName = useHeavy ? 'Grok-4-Heavy' : 'Grok-4.1';
    const costInfo = useHeavy ? '$3/$15 (expensive!)' : '$0.20/$0.50 (latest!)';
    log?.info(`Using ${modelName} (${approach}) with ${enableLiveSearch ? 'live search' : 'knowledge base'} - Cost: ${costInfo}`);

    const result = await callGrokEnhanced(messages, {
      model: useHeavy ? GrokModel.GROK_4_HEAVY : GrokModel.GROK_4_1_FAST_REASONING, // Updated 2025-11-21: Use latest Grok 4.1
      useHeavy,
      enableLiveSearch,
      searchSources: 50,
      temperature: 0.7,
      maxTokens: useHeavy ? 100000 : 10000
    });

    // Add usage info if Heavy mode
    if (useHeavy && result.usage) {
      const costEstimate = (result.usage.total_tokens / 1000) * 0.015; // Rough estimate
      return stripFormatting(`${result.content}\n\n---\nHeavy mode used: ${result.usage.total_tokens} tokens (~$${costEstimate.toFixed(3)})`);
    }

    return stripFormatting(result.content);
  }
};

/**
 * Function Calling Tool - demonstrates Grok-4's function calling capability
 */
export const grokFunctionTool = {
  name: "grok_function",
  description: "Use Grok-4's function calling to integrate with external tools",
  parameters: z.object({
    task: z.string(),
    availableFunctions: z.array(z.object({
      name: z.string(),
      description: z.string(),
      parameters: z.any()
    })),
    useHeavy: z.boolean().optional().default(false)
  }),
  execute: async (args: any, { log }: any) => {
    // Convert to OpenAI-compatible tool format
    const tools = args.availableFunctions.map((fn: any) => ({
      type: "function",
      function: {
        name: fn.name,
        description: fn.description,
        parameters: fn.parameters
      }
    }));

    const messages = [
      {
        role: "system",
        content: "You are Grok-4 with function calling capability. Use the provided functions to complete the task."
      },
      {
        role: "user",
        content: args.task
      }
    ];

    // Make request with tools
    const requestBody = {
      model: args.useHeavy ? GrokModel.GROK_4_HEAVY : GrokModel.GROK_4_1_FAST, // Updated 2025-11-22: Use tool-calling optimized Grok 4.1 Fast Non-Reasoning
      messages,
      tools,
      tool_choice: "auto", // Let Grok decide when to call functions
      max_tokens: args.useHeavy ? 50000 : 5000,
      temperature: 0.3 // Lower for function calling
    };

    log?.info(`Function calling with ${args.useHeavy ? 'Grok-4-Heavy ($3/$15)' : 'Grok-4.1-Fast ($0.20/$0.50, tool-calling optimized)'}`);

    try {
      const response = await fetch(GROK_API_URL, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${GROK_API_KEY}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(requestBody)
      });

      const data = await response.json() as any;
      
      // Check if Grok made tool calls
      const toolCalls = data.choices?.[0]?.message?.tool_calls || [];

      if (toolCalls.length > 0) {
        const callsDesc = toolCalls.map((tc: any) =>
          `- ${tc.function.name}(${tc.function.arguments})`
        ).join('\n');

        return stripFormatting(`Grok-4 would call these functions:\n${callsDesc}\n\n${data.choices?.[0]?.message?.content || ''}`);
      }

      return stripFormatting(data.choices?.[0]?.message?.content || "No function calls made");
    } catch (error) {
      return stripFormatting(`Function calling error: ${error}`);
    }
  }
};

/**
 * Cost-optimized Live Search Tool
 */
export const grokSearchTool = {
  name: "grok_search",
  description: "Web search",
  parameters: z.object({
    query: z.string(),
    sources: z.array(z.object({
      type: z.enum(["web", "news", "x", "rss"]),
      country: z.string().optional(),
      allowed_websites: z.array(z.string()).optional()
    })).optional(),
    max_search_results: z.number().optional(),
    recency: z.enum(["all", "day", "week", "month", "year"]).optional()
  }),
  execute: async (args: any, { log }: any) => {
    const { query, sources = [{ type: "web" }], max_search_results = 20, recency = "all" } = args;
    const recencyPrompt = recency !== "all"
      ? `Focus on information from the last ${recency}.`
      : "";

    const messages = [
      {
        role: "system",
        content: `You are Grok-3 with live search. Search for: "${query}".
${recencyPrompt}
Provide concise, factual results with sources.
Limit search to ${max_search_results} sources for cost control.
${FORMAT_INSTRUCTION}`
      },
      {
        role: "user",
        content: `Search for: ${query}`
      }
    ];

    log?.info(`Grok Search: ${max_search_results} sources, recency: ${recency} (using grok-4-1-fast-reasoning with enhanced reasoning)`);

    // Extract domains from sources if specified
    const domains = sources
      ?.filter((s: any) => s.allowed_websites)
      ?.flatMap((s: any) => s.allowed_websites) || [];

    const result = await callGrokEnhanced(messages, {
      model: GrokModel.GROK_4_1_FAST_REASONING,  // Updated 2025-11-21: Use latest Grok 4.1 with search
      enableLiveSearch: true,
      searchSources: max_search_results,
      searchDomains: domains,
      temperature: 0.3, // Low temperature for factual search
      maxTokens: 3000
    });

    // Format sources with ANSI links
    let output = result.content;
    if (result.sources && result.sources.length > 0) {
      const sourcesText = result.sources
        .slice(0, 10)
        .map((s: any, i: number) => {
          const title = s.title || 'Source';
          const url = s.url || '';
          return `  ${link(url, `[${i + 1}] ${title}`)}`;
        })
        .join('\n');
      output += `\n\nSources:\n${sourcesText}`;
    }

    // Add cost info
    const estimatedCost = (max_search_results / 1000) * 0.025;
    output += `\n\nSearch used up to ${max_search_results} sources (~$${estimatedCost.toFixed(4)})`;

    return stripFormatting(output);
  }
};

/**
 * Check if Grok is available
 */
export function isGrokAvailable(): boolean {
  return hasGrokApiKey();
}

/**
 * Get Grok configuration status
 */
export function getGrokStatus(): {
  available: boolean;
  model: string;
  features: string[];
} {
  return {
    available: isGrokAvailable(),
    model: GrokModel.GROK_4_1_FAST_REASONING,
    features: [
      'Grok 4.1 Fast Reasoning (Nov 2025): Enhanced reasoning, creativity & emotional intelligence ($0.20/$0.50, 2M context)',
      'Grok 4.1 Fast Non-Reasoning: Tool-calling optimized, agentic workflows ($0.20/$0.50, 2M context)',
      'Heavy mode available (grok-4-0709: $3/$15, use sparingly)',
      'Live web search with citations',
      'Function calling',
      'Structured outputs',
      'Multi-modal (text, image)'
    ]
  };
}

/**
 * Get all enhanced Grok tools
 */
export function getEnhancedGrokTools() {
  if (!isGrokAvailable()) {
    return [];
  }
  
  return [
    grokScoutTool,
    grokReasonEnhanced,
    grokFunctionTool,
    grokSearchTool
  ];
}