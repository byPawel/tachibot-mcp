/**
 * Perplexity Tools Implementation
 * Provides web search and reasoning capabilities
 * No need for separate perplexity-mcp server
 */

import { z } from "zod";
import { getPerplexityApiKey, hasPerplexityApiKey } from "../utils/api-keys.js";
import { stripFormatting } from "../utils/format-stripper.js";
import { FORMAT_INSTRUCTION } from "../utils/format-constants.js";
import { withHeartbeat } from "../utils/streaming-helper.js";

// Perplexity API configuration
const PERPLEXITY_API_URL = "https://api.perplexity.ai";

// Available Perplexity models (2026)
export enum PerplexityModel {
  SONAR = "sonar",                                // Lightweight search (128k ctx)
  SONAR_PRO = "sonar-pro",                        // Advanced search (200k ctx)
  SONAR_REASONING = "sonar-reasoning",             // Fast reasoning w/ CoT (128k ctx)
  SONAR_REASONING_PRO = "sonar-reasoning-pro",     // Advanced reasoning / DeepSeek R1 (128k ctx)
  SONAR_DEEP_RESEARCH = "sonar-deep-research",     // Exhaustive research reports (128k ctx)
}

/**
 * Call Perplexity API
 */
export async function callPerplexity(
  messages: Array<{ role: string; content: string }>,
  model: PerplexityModel = PerplexityModel.SONAR_PRO,
  searchDomain?: string,
  searchRecency?: string
): Promise<string> {
  const apiKey = getPerplexityApiKey();
  if (!apiKey) {
    return `[Perplexity API key not configured. Add PERPLEXITY_API_KEY to .env file]`;
  }

  try {
    const url = `${PERPLEXITY_API_URL}/chat/completions`;

    const requestBody: any = {
      model,
      messages,
      temperature: 0.2,
      max_tokens: 16384,  // Increased for comprehensive research responses
      return_citations: true,
      return_images: false
    };

    // Add search filters if provided
    if (searchDomain) {
      requestBody.search_domain = searchDomain;
    }
    if (searchRecency) {
      requestBody.search_recency = searchRecency;
    }

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      throw new Error(`Perplexity API error: ${response.statusText}`);
    }

    const data: any = await response.json();

    // Extract the response and citations
    let result = data.choices?.[0]?.message?.content || "No response from Perplexity";

    // Add sources if available (plain text - no ANSI)
    if (data.search_results && data.search_results.length > 0) {
      result += `\n\nSources:\n`;
      data.search_results.forEach((source: any) => {
        const title = source.title || 'Untitled';
        const url = source.url || '';
        const date = source.date ? ` (${source.date})` : '';
        result += `- ${title}\n  ${url}${date}\n`;
      });
    }
    
    return result;
  } catch (error) {
    return `[Perplexity error: ${error instanceof Error ? error.message : String(error)}]`;
  }
}

/**
 * Perplexity Ask Tool
 * Search the web and retrieve up-to-date information
 */
export const perplexityAskTool = {
  name: "perplexity_ask",
  description: "Web search. Put your QUERY in the 'query' parameter.",
  parameters: z.object({
    query: z.string().describe("The search query or question (REQUIRED - put your question here)"),
    searchDomain: z.enum(["general", "academic", "news", "social"])
      .optional()
      .describe("Search domain - must be one of: general, academic, news, social"),
    searchRecency: z.enum(["hour", "day", "week", "month", "year"])
      .optional()
      .describe("How recent the results should be - must be one of: hour, day, week, month, year")
  }),
  execute: async (args: { query: string; searchDomain?: string; searchRecency?: string }, { log, reportProgress }: any) => {
    // Get current date for accurate recency context
    const now = new Date();
    const currentDate = now.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    const messages = [
      {
        role: "system",
        content: `Research assistant. Today: ${currentDate}. Provide accurate info with sources.${FORMAT_INSTRUCTION}`
      },
      {
        role: "user",
        content: args.query
      }
    ];

    const reportFn = reportProgress ?? (async () => {});
    const result = await withHeartbeat(
      () => callPerplexity(messages, PerplexityModel.SONAR_PRO, args.searchDomain, args.searchRecency),
      reportFn
    );
    return stripFormatting(result);
  }
};

/**
 * Perplexity Research Tool
 * Deep research with multiple queries and synthesis
 */
export const perplexityResearchTool = {
  name: "perplexity_research",
  description: "Deep research using sonar-deep-research. Synthesizes hundreds of sources into a comprehensive report. Put your TOPIC in the 'topic' parameter.",
  parameters: z.object({
    topic: z.string().describe("The research topic (REQUIRED - put your topic here)"),
    questions: z.array(z.string()).optional().describe("Specific angles or questions to cover in the research"),
  }),
  execute: async (args: { topic: string; questions?: string[] }, { log, reportProgress }: any) => {
    const { topic, questions } = args;
    const reportFn = reportProgress ?? (async () => {});

    const now = new Date();
    const currentDate = now.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    const questionContext = questions?.length
      ? `\n\nSpecific angles to cover:\n${questions.map(q => `- ${q}`).join('\n')}`
      : '';

    const messages = [
      {
        role: "system",
        content: `You are a research expert. Today: ${currentDate}. Produce a comprehensive research report with sources, key findings, challenges, expert opinions, and actionable insights.${FORMAT_INSTRUCTION}`
      },
      {
        role: "user",
        content: `Research this topic thoroughly: ${topic}${questionContext}`
      }
    ];

    // sonar-deep-research can take minutes — use long heartbeat timeout
    const result = await withHeartbeat(
      () => callPerplexity(messages, PerplexityModel.SONAR_DEEP_RESEARCH),
      reportFn,
      600000  // 10 min timeout for deep research
    );

    return stripFormatting(result);
  }
};

/**
 * Perplexity Reason Tool
 * Perform complex reasoning tasks
 */
export const perplexityReasonTool = {
  name: "perplexity_reason",
  description: "Reasoning with search. Put your PROBLEM in the 'problem' parameter.",
  parameters: z.object({
    problem: z.string().describe("The problem to reason about (REQUIRED - put your question here)"),
    context: z.string().optional().describe("Additional context for the reasoning task"),
    approach: z.string()
      .optional()
      .describe("Reasoning approach (e.g., analytical, creative, systematic, comparative)")
  }),
  execute: async (args: { problem: string; context?: string; approach?: string }, { log, reportProgress }: any) => {
    const { problem, context, approach = "analytical" } = args;
    const reportFn = reportProgress ?? (async () => {});

    // Get current date for accurate reasoning context
    const now = new Date();
    const currentDate = now.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    const approachPrompts = {
      analytical: "Break down the problem systematically and analyze each component",
      creative: "Think outside the box and consider unconventional solutions",
      systematic: "Follow a step-by-step logical process",
      comparative: "Compare different approaches and evaluate trade-offs"
    };

    const messages = [
      {
        role: "system",
        content: `Expert reasoning. Today: ${currentDate}. ${approachPrompts[approach as keyof typeof approachPrompts]}.
${context ? `Context: ${context}` : ''}${FORMAT_INSTRUCTION}`
      },
      {
        role: "user",
        content: problem
      }
    ];
    
    const result = await withHeartbeat(
      () => callPerplexity(messages, PerplexityModel.SONAR_REASONING_PRO),
      reportFn
    );
    return stripFormatting(result);
  }
};

/**
 * Perplexity Fact Check Tool
 * Verify claims with evidence
 */
export const perplexityFactCheckTool = {
  name: "perplexity_fact_check",
  description: "Fact-check claims. Put the CLAIM in the 'claim' parameter.",
  parameters: z.object({
    claim: z.string().describe("The claim to fact-check (REQUIRED - put the statement to verify here)"),
    context: z.string().optional().describe("Additional context about the claim")
  }),
  execute: async (args: { claim: string; context?: string }, { log }: any) => {
    const messages = [
      {
        role: "system",
        content: `You are a fact-checking expert. Verify the following claim with evidence.
Provide:
1. Verdict: TRUE, FALSE, PARTIALLY TRUE, or UNVERIFIABLE
2. Evidence supporting or refuting the claim
3. Sources for verification
4. Any important context or nuance
${args.context ? `Additional context: ${args.context}` : ''}`
      },
      {
        role: "user",
        content: `Fact-check this claim: "${args.claim}"`
      }
    ];
    
    return stripFormatting(await callPerplexity(messages, PerplexityModel.SONAR_PRO, "general", "month"));
  }
};

/**
 * Perplexity Code Search Tool
 * Search for code examples and documentation
 */
export const perplexityCodeSearchTool = {
  name: "perplexity_code_search",
  description: "Code search. Put your QUERY in the 'query' parameter.",
  parameters: z.object({
    query: z.string().describe("What code/implementation to search for (REQUIRED - put your question here)"),
    language: z.string().optional().describe("Programming language to focus on"),
    framework: z.string().optional().describe("Framework to focus on")
  }),
  execute: async (args: { query: string; language?: string; framework?: string }, { log }: any) => {
    const searchQuery = `${args.language || ''} ${args.framework || ''} ${args.query} code example implementation`.trim();
    
    const messages = [
      {
        role: "system",
        content: `You are a programming expert. Find and explain code solutions.
Focus on:
1. Working code examples
2. Best practices
3. Common pitfalls to avoid
4. Links to documentation`
      },
      {
        role: "user",
        content: searchQuery
      }
    ];
    
    return stripFormatting(await callPerplexity(messages, PerplexityModel.SONAR_PRO));
  }
};

/**
 * Check if Perplexity is available
 */
export function isPerplexityAvailable(): boolean {
  return !!getPerplexityApiKey();
}

/**
 * Get all Perplexity tools
 */
interface PerplexityToolDefinition {
  name: string;
  description: string;
  parameters: z.ZodObject<any>;
  execute: (args: any, context: any) => Promise<string>;
}

export function getAllPerplexityTools(): PerplexityToolDefinition[] {
  if (!isPerplexityAvailable()) {
    return [];
  }

  // Minimized tool set - keeping only essential Perplexity tools
  return [
    perplexityAskTool as PerplexityToolDefinition,      // Web search
    perplexityReasonTool as PerplexityToolDefinition,   // Complex reasoning
    perplexityResearchTool as PerplexityToolDefinition,  // Deep research - needed by workflows
    // Removed: perplexityFactCheckTool (can use verifier instead)
    // Removed: perplexityCodeSearchTool (can use perplexity_ask)
  ];
}