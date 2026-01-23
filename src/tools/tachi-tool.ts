/**
 * Tachi Tool - Smart Auto-Routing AI Assistant
 *
 * Just describe what you need, tachi figures out the rest.
 *
 * Usage:
 *   tachi "debug this null pointer error"     → auto-routes to Solve
 *   tachi "how does React useEffect work"     → auto-routes to Research
 *   tachi "is this SQL query safe"            → auto-routes to Verify
 *   tachi "brainstorm startup names"          → auto-routes to Creative
 *   tachi "anything" --mode=solve             → force specific mode
 */

import { z } from "zod";
// import { renderBigText, icon } from "../utils/ink-renderer.js";

// Import tool executors
import { callGemini, isGeminiAvailable } from "./gemini-tools.js";
import { callGrok } from "./grok-tools.js";
import { callGrokEnhanced, GrokModel } from "./grok-enhanced.js";
import { callPerplexity } from "./perplexity-tools.js";
import { callOpenRouter, OpenRouterModel } from "./openrouter-tools.js";
import { callOpenAI, isOpenAIAvailable } from "./openai-tools.js";
import { OPENAI_MODELS } from "../config/model-constants.js";
import { FORMAT_INSTRUCTION } from "../utils/format-constants.js";
import { stripFormatting } from "../utils/format-stripper.js";

// ============================================================================
// TYPES
// ============================================================================

type Mode = "research" | "solve" | "verify" | "creative" | "architect" | "judge";

interface RouteResult {
  mode: Mode;
  confidence: number;
  matchedKeywords: string[];
}

// ============================================================================
// SMART ROUTER (Keyword-based)
// ============================================================================

const ROUTE_PATTERNS: Record<Mode, RegExp[]> = {
  solve: [
    /\b(fix|debug|error|bug|crash|exception|issue|broken|failing)\b/i,
    /\b(implement|code|function|class|method|refactor)\b/i,
    /\b(typescript|javascript|python|rust|go|java|sql)\b/i,
    /\b(npm|yarn|pip|cargo|maven|gradle)\b/i,
  ],
  research: [
    /\b(what is|what are|how does|how do|explain|why|when)\b/i,
    /\b(search|find|look up|google|documentation)\b/i,
    /\b(difference between|compare|versus|vs)\b/i,
    /\b(best practices|recommended|should i)\b/i,
  ],
  verify: [
    /\b(check|validate|verify|correct|accurate|true|false)\b/i,
    /\b(review|audit|assess|evaluate|safe|secure)\b/i,
    /\b(is this|is it|does this|will this)\b/i,
    /\b(confirm|test|proof|evidence)\b/i,
  ],
  creative: [
    /\b(brainstorm|ideas|suggest|creative|innovative)\b/i,
    /\b(name|title|tagline|slogan|brand)\b/i,
    /\b(alternatives|options|possibilities|ways to)\b/i,
  ],
  architect: [
    /\b(architect|architecture|design|system design)\b/i,
    /\b(decision|choose|which|should i use)\b/i,
    /\b(tradeoff|trade-off|pros and cons|compare)\b/i,
    /\b(scale|scalability|microservice|monolith)\b/i,
  ],
  judge: [
    /\b(judge|verdict|evaluate|assess)\b/i,
    /\b(best|winner|better|worse|rank)\b/i,
    /\b(score|rate|rating|comparison)\b/i,
    /\b(final decision|conclude|conclusion)\b/i,
  ],
};

// Priority order: judge > architect > solve > research > verify > creative (default)
const MODE_PRIORITY: Mode[] = ["judge", "architect", "solve", "research", "verify", "creative"];

/**
 * Route query to best mode based on keyword matching
 */
function routeIntent(query: string): RouteResult {
  const results: Map<Mode, string[]> = new Map();

  // Check each mode's patterns
  for (const mode of MODE_PRIORITY) {
    const patterns = ROUTE_PATTERNS[mode];
    const matches: string[] = [];

    for (const pattern of patterns) {
      const match = query.match(pattern);
      if (match) {
        matches.push(match[0]);
      }
    }

    if (matches.length > 0) {
      results.set(mode, matches);
    }
  }

  // Find mode with most matches (respecting priority for ties)
  let bestMode: Mode = "creative"; // Default
  let bestCount = 0;
  let bestMatches: string[] = [];

  for (const mode of MODE_PRIORITY) {
    const matches = results.get(mode) || [];
    if (matches.length > bestCount) {
      bestMode = mode;
      bestCount = matches.length;
      bestMatches = matches;
    }
  }

  // Calculate confidence (0-1)
  const confidence = Math.min(bestCount / 3, 1);

  return {
    mode: bestMode,
    confidence,
    matchedKeywords: bestMatches,
  };
}

// ============================================================================
// MODE HANDLERS
// ============================================================================

// Clean emoji icons for each mode
const getModeIcon = (mode: Mode): string => ({
  research: '🔍',
  solve: '🔧',
  verify: '⚖️',
  creative: '💡',
  architect: '🏗',
  judge: '🎯',
}[mode]);


/**
 * Research Mode: Web search + synthesis
 * Uses Grok search (live web) → Perplexity fallback
 */
async function researchHandler(query: string): Promise<string> {
  try {
    // Use Grok search with live web access (recency: week for fresh results)
    const messages = [
      {
        role: "system",
        content: `You are a research assistant with live web search. Search for: "${query}".
Focus on recent, accurate information. Provide sources.${FORMAT_INSTRUCTION}`
      },
      { role: "user", content: query }
    ];

    const result = await callGrokEnhanced(messages, {
      model: GrokModel.GROK_4_1_FAST_REASONING,
      enableLiveSearch: true,
      searchSources: 20,
      temperature: 0.3,
      maxTokens: 4000
    });

    return result.content;
  } catch (error) {
    // Fallback to Perplexity
    try {
      const messages = [{ role: "user", content: query }];
      return await callPerplexity(messages);
    } catch {
      // Final fallback to Gemini
      return await callGemini(
        query,
        undefined,
        `You are a research assistant. Provide comprehensive, well-sourced information.${FORMAT_INSTRUCTION}`
      );
    }
  }
}

/**
 * Solve Mode: Code-focused reasoning
 * Uses Qwen for code debug + Grok search for context
 */
async function solveHandler(query: string): Promise<string> {
  const results: string[] = [];

  // Step 1: Qwen for code analysis/debug
  try {
    const qwenResult = await callOpenRouter(
      [
        { role: "system", content: `You are Qwen3-Coder. Debug and solve the code problem. Provide working code.${FORMAT_INSTRUCTION}` },
        { role: "user", content: query }
      ],
      OpenRouterModel.QWEN3_CODER,
      0.2,
      6000
    );
    results.push(`🔧 QWEN ANALYSIS\n${'─'.repeat(30)}\n${qwenResult}`);
  } catch {
    // Qwen failed, continue with Grok
  }

  // Step 2: Grok search for additional context (if code-related keywords found)
  const needsSearch = /error|exception|bug|issue|not working|fails/i.test(query);
  if (needsSearch) {
    try {
      const searchResult = await callGrokEnhanced(
        [
          { role: "system", content: `Search for solutions to this coding problem. Find relevant Stack Overflow, docs, or GitHub issues.${FORMAT_INSTRUCTION}` },
          { role: "user", content: query }
        ],
        {
          model: GrokModel.GROK_4_1_FAST_REASONING,
          enableLiveSearch: true,
          searchSources: 10,
          temperature: 0.3,
          maxTokens: 2000
        }
      );
      results.push(`\n🔍 RELATED SOLUTIONS\n${'─'.repeat(30)}\n${searchResult.content}`);
    } catch {
      // Search failed, continue
    }
  }

  // Fallback if nothing worked
  if (results.length === 0) {
    return await callGemini(
      query,
      undefined,
      `You are a senior software engineer. Solve this problem step by step with code.${FORMAT_INSTRUCTION}`
    );
  }

  return results.join("\n\n");
}

/**
 * Verify Mode: Multi-model judge
 * Uses Gemini (preferred) or GPT for verification
 */
async function verifyHandler(query: string): Promise<string> {
  const judgePrompt = `You are a critical analyst and judge. For the given question or statement:
1. Analyze for correctness, accuracy, and potential issues
2. Provide a clear verdict: VALID, INVALID, or NEEDS MORE CONTEXT
3. Support your verdict with evidence and reasoning
4. List any caveats or edge cases
5. Confidence score (0-100%)${FORMAT_INSTRUCTION}`;

  // Try Gemini first (preferred judge)
  if (isGeminiAvailable()) {
    try {
      const result = await callGemini(query, undefined, judgePrompt);
      return `⚖️ GEMINI JUDGE\n${'─'.repeat(30)}\n${result}`;
    } catch {
      // Fall through to GPT
    }
  }

  // Try GPT as fallback judge
  if (isOpenAIAvailable()) {
    try {
      const result = await callOpenAI(
        [
          { role: "system", content: judgePrompt },
          { role: "user", content: query }
        ],
        OPENAI_MODELS.DEFAULT,
        0.3,
        4000
      );
      return `⚖️ GPT JUDGE\n${'─'.repeat(30)}\n${result}`;
    } catch {
      // Fall through to Grok
    }
  }

  // Final fallback: Grok
  try {
    const result = await callGrok([
      { role: "system", content: judgePrompt },
      { role: "user", content: query }
    ]);
    return `⚖️ GROK JUDGE\n${'─'.repeat(30)}\n${result}`;
  } catch (error) {
    return `[Verification failed: ${error instanceof Error ? error.message : "Unknown error"}]`;
  }
}

/**
 * Creative Mode: Brainstorming and ideation
 * Uses Gemini brainstorm
 */
async function creativeHandler(query: string): Promise<string> {
  try {
    const result = await callGemini(
      query,
      undefined,
      `You are a creative strategist. Generate innovative ideas:
1. Provide at least 5 distinct approaches or ideas
2. For each, explain the concept and potential benefits
3. Include one "wild card" unconventional idea
4. End with a recommended starting point${FORMAT_INSTRUCTION}`
    );
    return result;
  } catch (error) {
    return `[Creative generation failed: ${error instanceof Error ? error.message : "Unknown error"}]`;
  }
}

/**
 * Architect Mode: Multi-model architecture decisions
 * Pipeline: Grok search → GPT/Qwen/Kimi reasoning → Gemini judge
 */
async function architectHandler(query: string): Promise<string> {
  const results: string[] = [];

  // Step 1: Grok search for context and existing patterns
  try {
    const searchResult = await callGrokEnhanced(
      [
        { role: "system", content: `Search for architecture patterns, best practices, and real-world examples for this design decision.${FORMAT_INSTRUCTION}` },
        { role: "user", content: query }
      ],
      {
        model: GrokModel.GROK_4_1_FAST_REASONING,
        enableLiveSearch: true,
        searchSources: 15,
        temperature: 0.3,
        maxTokens: 2500
      }
    );
    results.push(`🔍 CONTEXT & PATTERNS\n${'─'.repeat(30)}\n${searchResult.content}`);
  } catch {
    // Search failed, continue
  }

  // Step 2: Multi-model reasoning (parallel would be better but sequential for now)
  const reasoningPrompt = `You are a senior software architect. Analyze this architecture decision:
${query}

Provide:
1. Key tradeoffs (pros/cons)
2. Scalability considerations
3. Your recommendation with reasoning${FORMAT_INSTRUCTION}`;

  // Try Qwen for technical analysis
  try {
    const qwenResult = await callOpenRouter(
      [
        { role: "system", content: reasoningPrompt },
        { role: "user", content: query }
      ],
      OpenRouterModel.QWEN3_CODER,
      0.3,
      3000
    );
    results.push(`\n🤖 QWEN ANALYSIS\n${'─'.repeat(30)}\n${qwenResult}`);
  } catch {
    // Continue
  }

  // Try GPT for additional perspective
  if (isOpenAIAvailable()) {
    try {
      const gptResult = await callOpenAI(
        [
          { role: "system", content: reasoningPrompt },
          { role: "user", content: query }
        ],
        OPENAI_MODELS.DEFAULT,
        0.3,
        3000
      );
      results.push(`\n🧠 GPT ANALYSIS\n${'─'.repeat(30)}\n${gptResult}`);
    } catch {
      // Continue
    }
  }

  // Step 3: Gemini as final judge
  if (isGeminiAvailable() && results.length > 0) {
    try {
      const judgeResult = await callGemini(
        `Based on these analyses, provide a FINAL RECOMMENDATION for: ${query}\n\n${results.join('\n\n')}`,
        undefined,
        `You are the final judge. Synthesize the analyses above and provide:
1. VERDICT: Clear recommendation
2. KEY REASONS: Top 3 reasons for this choice
3. RISKS: Main risks to watch for
4. NEXT STEPS: Concrete action items${FORMAT_INSTRUCTION}`
      );
      results.push(`\n⚖️ FINAL VERDICT (GEMINI)\n${'═'.repeat(30)}\n${judgeResult}`);
    } catch {
      // Judge failed
    }
  }

  if (results.length === 0) {
    return await callGemini(query, undefined, `You are a software architect. Provide architecture guidance.${FORMAT_INSTRUCTION}`);
  }

  return results.join("\n\n---\n");
}

/**
 * Judge Mode: Multi-model evaluation with final verdict
 * Uses all available models then Gemini as judge
 */
async function judgeHandler(query: string): Promise<string> {
  const results: string[] = [];
  const judgePrompt = `Evaluate and judge: ${query}

Provide:
1. Your assessment
2. Strengths and weaknesses
3. Score (1-10) with reasoning${FORMAT_INSTRUCTION}`;

  // Collect opinions from multiple models in parallel
  const modelPromises: Promise<void>[] = [];

  // Grok opinion
  modelPromises.push(
    callGrok([
      { role: "system", content: judgePrompt },
      { role: "user", content: query }
    ]).then(r => { results.push(`🦖 GROK\n${'─'.repeat(30)}\n${r}`); }).catch(() => {})
  );

  // Qwen opinion
  modelPromises.push(
    callOpenRouter(
      [{ role: "system", content: judgePrompt }, { role: "user", content: query }],
      OpenRouterModel.QWEN3_CODER, 0.3, 2000
    ).then(r => { results.push(`🤖 QWEN\n${'─'.repeat(30)}\n${r}`); }).catch(() => {})
  );

  // GPT opinion
  if (isOpenAIAvailable()) {
    modelPromises.push(
      callOpenAI(
        [{ role: "system", content: judgePrompt }, { role: "user", content: query }],
        OPENAI_MODELS.DEFAULT, 0.3, 2000
      ).then(r => { results.push(`🧠 GPT\n${'─'.repeat(30)}\n${r}`); }).catch(() => {})
    );
  }

  // Wait for all opinions
  await Promise.all(modelPromises);

  // Final judge: Gemini synthesizes all opinions
  if (isGeminiAvailable() && results.length > 0) {
    try {
      const finalVerdict = await callGemini(
        `You are the FINAL JUDGE. Based on these evaluations, provide the definitive verdict:\n\n${results.join('\n\n---\n')}\n\nOriginal question: ${query}`,
        undefined,
        `Synthesize all opinions above and deliver:
1. FINAL VERDICT: Clear winner/decision
2. CONSENSUS: Where models agreed
3. DISAGREEMENTS: Where they differed and why
4. CONFIDENCE: Your confidence level (0-100%)${FORMAT_INSTRUCTION}`
      );
      results.push(`\n⚖️ FINAL VERDICT (GEMINI JUDGE)\n${'═'.repeat(30)}\n${finalVerdict}`);
    } catch {
      // Judge failed
    }
  }

  if (results.length === 0) {
    return `[Judge mode failed: No model responses received]`;
  }

  return results.join("\n\n---\n");
}

/**
 * Execute the appropriate mode handler
 */
async function executeMode(mode: Mode, query: string): Promise<string> {
  switch (mode) {
    case "research":
      return await researchHandler(query);
    case "solve":
      return await solveHandler(query);
    case "verify":
      return await verifyHandler(query);
    case "creative":
      return await creativeHandler(query);
    case "architect":
      return await architectHandler(query);
    case "judge":
      return await judgeHandler(query);
  }
}

// ============================================================================
// TOOL DEFINITION
// ============================================================================

export const tachiTool = {
  name: "tachi",
  description: `Smart AI assistant - just describe what you need. Put your QUERY in the 'query' parameter.

Auto-routes to the best mode based on your query:
• Research: "what is...", "how does...", "explain..."
• Solve: "fix...", "debug...", "implement...", "error..."
• Verify: "check...", "is this correct...", "review..."
• Creative: "brainstorm...", "ideas for...", "name..."
• Architect: "design...", "which should I use...", "tradeoffs..."
• Judge: "which is best...", "evaluate...", "compare..."

Examples:
  tachi "debug this null pointer error"
  tachi "how does React useEffect work"
  tachi "microservices vs monolith for 10M users"
  tachi "judge: React vs Vue vs Svelte"`,
  parameters: z.object({
    query: z.string().describe("What you need help with (REQUIRED - put your question here)"),
    mode: z
      .enum(["auto", "research", "solve", "verify", "creative", "architect", "judge"])
      .default("auto")
      .optional()
      .describe("Force specific mode - must be one of: auto, research, solve, verify, creative, architect, judge"),
  }),
  execute: async (
    { query, mode = "auto" }: { query: string; mode?: string },
    context: { log: { info: (message: string, metadata?: Record<string, any>) => void; error: (message: string, metadata?: Record<string, any>) => void } }
  ): Promise<string> => {
    const { log } = context;
    // Route query to mode
    let resolvedMode: Mode;
    let routeInfo = "";

    if (mode === "auto") {
      const route = routeIntent(query);
      resolvedMode = route.mode;
      routeInfo = route.matchedKeywords.length > 0
        ? ` (matched: ${route.matchedKeywords.slice(0, 3).join(", ")})`
        : " (default)";
    } else {
      resolvedMode = mode as Mode;
    }

    log.info(`Tachi routing to ${resolvedMode}${routeInfo}`);

    // Build response with header
    const modeIcon = getModeIcon(resolvedMode);

    // Plain text header with structure
    let response = '';
    response += `\n${'━'.repeat(35)}\n`;
    response += `${modeIcon}  ${resolvedMode.toUpperCase()} MODE${routeInfo}\n`;
    response += `${'━'.repeat(35)}\n\n`;

    // Execute mode handler
    try {
      const result = await executeMode(resolvedMode, query);
      response += result;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      log.error(`Tachi ${resolvedMode} mode failed`, { error: errorMsg });
      response += `[Error in ${resolvedMode} mode: ${errorMsg}]`;
    }

    return stripFormatting(response);
  },
};

// Export for registration (removed focus alias - was wasting tokens)
export function getTachiTools() {
  return [tachiTool];
}
