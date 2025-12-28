/**
 * Perplexity Tools Implementation
 * Provides web search and reasoning capabilities
 * No need for separate perplexity-mcp server
 */

import { z } from "zod";
import { getPerplexityApiKey, hasPerplexityApiKey } from "../utils/api-keys.js";

// Perplexity API configuration
const PERPLEXITY_API_URL = "https://api.perplexity.ai";

// Available Perplexity models (2025 latest)
export enum PerplexityModel {
  // Models from Perplexity API docs
  SONAR_PRO = "sonar",  // Changed from "sonar-pro" to "sonar"
  SONAR_REASONING_PRO = "sonar-reasoning",  // Changed to match API
  SONAR_DEEP_RESEARCH = "sonar-deep-research",
  SONAR = "sonar",
  SONAR_SMALL = "sonar-small"
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
  console.error(`[PERPLEXITY DEBUG] API Key present: ${!!apiKey}, length: ${apiKey?.length || 0}`);
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

    // Add sources if available (Perplexity API changed from citations to search_results in 2025)
    // Format with ANSI colors: cyan bullet, bold title, blue URL, dim date
    // Use \x00RAWANSI\x00 markers to skip markdown processing in ansi-renderer
    if (data.search_results && data.search_results.length > 0) {
      const cyan = '\x1b[36m';
      const bold = '\x1b[1m';
      const blue = '\x1b[34m';
      const underline = '\x1b[4m';
      const dim = '\x1b[2m';
      const gray = '\x1b[90m';
      const reset = '\x1b[0m';

      // Start raw ANSI section (skip markdown processing)
      result += `\n\n\x00RAWANSI\x00`;
      result += `${bold}Sources:${reset}\n\n`;
      data.search_results.forEach((source: any) => {
        const title = source.title || 'Untitled';
        const url = source.url || '';
        const date = source.date ? ` ${dim}(${source.date})${reset}` : '';

        // Format: ● Title
        //         └─ URL (date)
        result += `${cyan}●${reset} ${bold}${title}${reset}\n`;
        result += `  ${gray}└─${reset} ${blue}${underline}${url}${reset}${date}\n`;
      });
      result += `\x00/RAWANSI\x00`;
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
  description: "Web search",
  parameters: z.object({
    query: z.string(),
    searchDomain: z.enum(["general", "academic", "news", "social"]).optional(),
    searchRecency: z.enum(["hour", "day", "week", "month", "year"]).optional()
  }),
  execute: async (args: { query: string; searchDomain?: string; searchRecency?: string }, { log }: any) => {
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
        content: `You are a helpful research assistant. Today is ${currentDate}. Provide accurate, up-to-date information with sources. When searching for recent information, use the current date as reference.`
      },
      {
        role: "user",
        content: args.query
      }
    ];

    return await callPerplexity(
      messages,
      PerplexityModel.SONAR_PRO,
      args.searchDomain,
      args.searchRecency
    );
  }
};

/**
 * Perplexity Research Tool
 * Deep research with multiple queries and synthesis
 */
export const perplexityResearchTool = {
  name: "perplexity_research",
  description: "Deep research",
  parameters: z.object({
    topic: z.string(),
    questions: z.array(z.string()).optional(),
    depth: z.enum(["quick", "standard", "deep"]).optional()
  }),
  execute: async (args: { topic: string; questions?: string[]; depth?: string }, { log }: any) => {
    const { topic, questions, depth = "standard" } = args;

    // Get current date for accurate research context
    const now = new Date();
    const currentDate = now.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    // Generate research questions if not provided
    const researchQuestions = questions || [
      `What is the current state of ${topic}?`,
      `What are the latest developments in ${topic}?`,
      `What are the key challenges and opportunities in ${topic}?`,
      `What do experts say about ${topic}?`
    ];

    // Adjust based on depth
    const questionsToAsk = depth === "quick" ?
      researchQuestions.slice(0, 2) :
      depth === "deep" ?
        [...researchQuestions,
         `What are the future predictions for ${topic}?`,
         `What are the best practices and recommendations for ${topic}?`] :
        researchQuestions;

    let research = `# Research Report: ${topic}\n\n`;
    
    // Conduct research for each question
    for (const question of questionsToAsk) {
      const messages = [
        {
          role: "system",
          content: `You are a research expert. Today is ${currentDate}. Provide detailed, factual information with sources. Use the current date as reference for any time-sensitive queries.`
        },
        {
          role: "user",
          content: question
        }
      ];
      
      const answer = await callPerplexity(messages, PerplexityModel.SONAR_PRO);
      research += `## ${question}\n\n${answer}\n\n`;
    }
    
    // Add synthesis
    const synthesisMessages = [
      {
        role: "system",
        content: "You are a research synthesizer. Create a concise summary of the key findings."
      },
      {
        role: "user",
        content: `Synthesize these research findings into key insights:\n\n${research}`
      }
    ];
    
    const synthesis = await callPerplexity(synthesisMessages, PerplexityModel.SONAR_PRO);
    research += `## Synthesis\n\n${synthesis}`;
    
    return research;
  }
};

/**
 * Perplexity Reason Tool
 * Perform complex reasoning tasks
 */
export const perplexityReasonTool = {
  name: "perplexity_reason",
  description: "Reasoning with search",
  parameters: z.object({
    problem: z.string(),
    context: z.string().optional(),
    approach: z.enum(["analytical", "creative", "systematic", "comparative"]).optional()
  }),
  execute: async (args: { problem: string; context?: string; approach?: string }, { log }: any) => {
    const { problem, context, approach = "analytical" } = args;

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
        content: `You are an expert reasoning system. Today is ${currentDate}. ${approachPrompts[approach as keyof typeof approachPrompts]}.
Provide clear, logical reasoning with evidence and examples. Use the current date as reference for any time-sensitive information.
${context ? `Context: ${context}` : ''}`
      },
      {
        role: "user",
        content: problem
      }
    ];
    
    return await callPerplexity(messages, PerplexityModel.SONAR_REASONING_PRO);
  }
};

/**
 * Perplexity Fact Check Tool
 * Verify claims with evidence
 */
export const perplexityFactCheckTool = {
  name: "perplexity_fact_check",
  description: `Fact-check claims`,
  parameters: z.object({
    claim: z.string(),
    context: z.string().optional()
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
    
    return await callPerplexity(messages, PerplexityModel.SONAR_PRO, "general", "month");
  }
};

/**
 * Perplexity Code Search Tool
 * Search for code examples and documentation
 */
export const perplexityCodeSearchTool = {
  name: "perplexity_code_search",
  description: `Code search`,
  parameters: z.object({
    query: z.string(),
    language: z.string().optional(),
    framework: z.string().optional()
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
    
    return await callPerplexity(messages, PerplexityModel.SONAR_PRO);
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