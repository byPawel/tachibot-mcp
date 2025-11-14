/**
 * Perplexity Tools Implementation
 * Provides web search and reasoning capabilities
 * No need for separate perplexity-mcp server
 */

import { z } from "zod";

// Perplexity API configuration
const PERPLEXITY_API_URL = "https://api.perplexity.ai";

// Function to get the API key (deferred reading)
function getPerplexityApiKey(): string | undefined {
  return process.env.PERPLEXITY_API_KEY;
}

// Debug logging function - call when needed
function debugApiKey(): void {
  const apiKey = getPerplexityApiKey();
  console.error('[PERPLEXITY DEBUG] API Key present:', !!apiKey);
  if (apiKey) {
    console.error('[PERPLEXITY DEBUG] Key length:', apiKey.length);
    console.error('[PERPLEXITY DEBUG] Key prefix:', apiKey.substring(0, 8) + '...');
  } else {
    console.error('[PERPLEXITY DEBUG] process.env keys:', Object.keys(process.env).filter(k => k.includes('PERP') || k.includes('API')));
  }
}

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
  if (!apiKey) {
    debugApiKey(); // Log debug info when key is missing
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
    if (data.search_results && data.search_results.length > 0) {
      result += "\n\n**Sources:**\n";
      data.search_results.forEach((source: any, idx: number) => {
        result += `${idx + 1}. ${source.title || 'Untitled'} - ${source.url}`;
        if (source.date) result += ` (${source.date})`;
        result += '\n';
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
  description: "Web search",
  parameters: z.object({
    query: z.string(),
    searchDomain: z.enum(["general", "academic", "news", "social"]).optional(),
    searchRecency: z.enum(["hour", "day", "week", "month", "year"]).optional()
  }),
  execute: async (args: { query: string; searchDomain?: string; searchRecency?: string }, { log }: any) => {
    const messages = [
      {
        role: "system",
        content: "You are a helpful research assistant. Provide accurate, up-to-date information with sources."
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
          content: "You are a research expert. Provide detailed, factual information with sources."
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
    const approachPrompts = {
      analytical: "Break down the problem systematically and analyze each component",
      creative: "Think outside the box and consider unconventional solutions",
      systematic: "Follow a step-by-step logical process",
      comparative: "Compare different approaches and evaluate trade-offs"
    };
    
    const messages = [
      {
        role: "system",
        content: `You are an expert reasoning system. ${approachPrompts[approach as keyof typeof approachPrompts]}.
Provide clear, logical reasoning with evidence and examples.
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