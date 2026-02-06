/**
 * Gemini Tools Implementation
 * Provides all Gemini capabilities directly in tachibot-mcp
 * No need for separate gemini-mcp server
 */

import { z } from "zod";
import { validateToolInput, ValidationContext } from "../utils/input-validator.js";
import { GEMINI_MODELS } from "../config/model-constants.js";
import { tryOpenRouterGateway, isGatewayEnabled } from "../utils/openrouter-gateway.js";
import { stripFormatting } from "../utils/format-stripper.js";
import { FORMAT_INSTRUCTION } from "../utils/format-constants.js";
import { withHeartbeat } from "../utils/streaming-helper.js";
// Note: renderOutput is applied centrally in server.ts safeAddTool() - no need to import here

// NOTE: dotenv is loaded in server.ts before any imports
// No need to reload here - just read from process.env

// Gemini API configuration
const GEMINI_API_KEY = process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY;
const GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta";

/**
 * Call Gemini API directly
 * @param validationContext - Context for input validation (default: 'llm-orchestration')
 *   - 'user-input': Strict validation for direct user input
 *   - 'code-analysis': Relaxed for code analysis tools
 *   - 'llm-orchestration': Medium for LLM-to-LLM calls
 */
export async function callGemini(
  prompt: string,
  model: string = GEMINI_MODELS.GEMINI_3_PRO,
  systemPrompt?: string,
  temperature: number = 0.7,
  validationContext: ValidationContext = 'llm-orchestration',
  maxTokens: number = 18000
): Promise<string> {
  // Try OpenRouter gateway first if enabled
  if (isGatewayEnabled()) {
    const messages = [
      ...(systemPrompt ? [{ role: 'system', content: systemPrompt }] : []),
      { role: 'user', content: prompt }
    ];
    const gatewayResult = await tryOpenRouterGateway(model, messages, {
      temperature,
      max_tokens: maxTokens
    });
    if (gatewayResult) {
      return gatewayResult;
    }
    // Gateway failed, fall through to direct API
    console.error(`🔀 [Gemini] Gateway returned null, falling back to direct API`);
  }

  if (!GEMINI_API_KEY) {
    return `[Gemini API key not configured. Add GOOGLE_API_KEY to .env file]`;
  }

  // Validate and sanitize prompt with context-aware rules
  const promptValidation = validateToolInput(prompt, validationContext);
  if (!promptValidation.valid) {
    return `[Error: ${promptValidation.error}]`;
  }
  const sanitizedPrompt = promptValidation.sanitized;

  // Validate and sanitize system prompt if provided
  let sanitizedSystemPrompt = systemPrompt;
  if (systemPrompt) {
    const systemValidation = validateToolInput(systemPrompt, validationContext);
    if (!systemValidation.valid) {
      return `[Error: ${systemValidation.error}]`;
    }
    sanitizedSystemPrompt = systemValidation.sanitized;
  }

  try {
    const url = `${GEMINI_API_URL}/models/${model}:generateContent?key=${GEMINI_API_KEY}`;

    const requestBody = {
      contents: [
        {
          parts: [
            {
              text: sanitizedSystemPrompt
                ? `${sanitizedSystemPrompt}\n\nUser request: ${sanitizedPrompt}\n\nProvide your complete response as visible text:`
                : `${sanitizedPrompt}\n\nProvide a complete, detailed response as visible text:`
            }
          ]
        }
      ],
      generationConfig: {
        temperature,
        maxOutputTokens: maxTokens,  // Default 6k, can be overridden per-call
        candidateCount: 1,
        topK: 40,
        topP: 0.95,
        stopSequences: []
      },
      // Configure safety settings to prevent false positives on technical content
      // BLOCK_ONLY_HIGH allows code blocks, technical terms, and LLM-to-LLM content
      safetySettings: [
        {
          category: "HARM_CATEGORY_HARASSMENT",
          threshold: "BLOCK_ONLY_HIGH"
        },
        {
          category: "HARM_CATEGORY_HATE_SPEECH",
          threshold: "BLOCK_ONLY_HIGH"
        },
        {
          category: "HARM_CATEGORY_SEXUALLY_EXPLICIT",
          threshold: "BLOCK_ONLY_HIGH"
        },
        {
          category: "HARM_CATEGORY_DANGEROUS_CONTENT",
          threshold: "BLOCK_ONLY_HIGH"
        }
      ]
    };

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      throw new Error(`Gemini API error: ${response.statusText}`);
    }

    const data = await response.json() as any;

    // Debug logging for response structure
    if (!data.candidates?.[0]?.content?.parts?.[0]?.text) {
      console.warn('Gemini response missing text:', JSON.stringify(data, null, 2).substring(0, 500));
    }

    // Check for safety blocking BEFORE trying to extract text
    const candidate = data.candidates?.[0];
    if (candidate?.finishReason === 'SAFETY') {
      const safetyRatings = candidate.safetyRatings || [];
      const blockedCategories = safetyRatings
        .filter((r: any) => r.probability === 'HIGH' || r.probability === 'MEDIUM')
        .map((r: any) => r.category.replace('HARM_CATEGORY_', ''))
        .join(', ');

      return `[Gemini blocked response due to safety filters: ${blockedCategories || 'SAFETY'}. This is likely a false positive with technical content. The safety settings have been configured to BLOCK_ONLY_HIGH, but Gemini may still flag certain patterns. Try rephrasing the prompt or removing potentially sensitive keywords.]`;
    }

    // Handle different response structures
    const text = candidate?.content?.parts?.[0]?.text;

    // Extract and log token usage for cost tracking
    const usage = data.usageMetadata;
    if (usage) {
      const promptTokens = usage.promptTokenCount || 0;
      const outputTokens = usage.candidatesTokenCount || 0;
      const totalTokens = usage.totalTokenCount || 0;
      const thinkingTokens = usage.thoughtsTokenCount || 0;

      console.error(`📊 Gemini tokens: ${promptTokens} input, ${outputTokens} output${thinkingTokens > 0 ? `, ${thinkingTokens} thinking` : ''}, ${totalTokens} total`);
    }

    if (!text) {
      // Check if Gemini used only thinking tokens
      if (data.usageMetadata?.thoughtsTokenCount > 0 && !text) {
        return "[Gemini used thinking tokens but produced no output. Try a more specific prompt.]";
      }
      return "No response from Gemini";
    }

    return text;
  } catch (error) {
    return `[Gemini error: ${error instanceof Error ? error.message : String(error)}]`;
  }
}

/**
 * Gemini Query Tool
 * Direct querying of Gemini models for general information
 */
export const geminiQueryTool = {
  name: "gemini_query",
  description: "Query Gemini. Put your PROMPT in the 'prompt' parameter.",
  parameters: z.object({
    prompt: z.string().describe("Your question or request (REQUIRED - put your question here)"),
    model: z.enum(["gemini-3", "pro", "flash"])
      .optional()
      .default("gemini-3")
      .describe("Model variant - must be one of: gemini-3 (default), pro, flash")
  }),
  execute: async (args: { prompt: string; model?: string }, { log, reportProgress }: any) => {
    let model: string = GEMINI_MODELS.GEMINI_3_PRO; // Default to Gemini 3
    if (args.model === "flash") {
      model = GEMINI_MODELS.FLASH;
    } else if (args.model === "pro") {
      model = GEMINI_MODELS.PRO;
    }
    // Skip validation - queries may contain code or LLM-generated content
    const reportFn = reportProgress ?? (async () => {});
    const result = await withHeartbeat(
      () => callGemini(args.prompt, model, undefined, 0.7, 'llm-orchestration'),
      reportFn
    );
    return stripFormatting(result);
  }
};

/**
 * Gemini Brainstorm Tool
 * Collaborative problem-solving and ideation
 *
 * Note: skipValidation is used for internal LLM-to-LLM calls where input
 * has already been validated at the MCP entry point (server.ts).
 */
export const geminiBrainstormTool = {
  name: "gemini_brainstorm",
  description: "Brainstorming. Put your PROMPT in the 'prompt' parameter.",
  parameters: z.object({
    prompt: z.string().describe("The topic or problem to brainstorm about (REQUIRED - put your topic here)"),
    claudeThoughts: z.string().optional().describe("Claude's initial thoughts to build upon"),
    maxRounds: z.number().optional().default(1).describe("Number of brainstorming rounds (default: 1)")
  }),
  execute: async (args: { prompt: string; claudeThoughts?: string; maxRounds?: number }, { log, reportProgress }: any) => {
    const systemPrompt = `Creative brainstorming partner.
${args.claudeThoughts ? `Building on: ${args.claudeThoughts}` : ''}
Generate: multiple approaches, unconventional ideas, challenges, feasibility.
${FORMAT_INSTRUCTION}`;

    // Skip validation for internal calls - input validated at MCP layer
    const reportFn = reportProgress ?? (async () => {});
    const response = await withHeartbeat(
      () => callGemini(args.prompt, GEMINI_MODELS.GEMINI_3_PRO, systemPrompt, 0.9, 'llm-orchestration'),
      reportFn
    );

    // If multiple rounds requested, we could iterate here
    // For now, return the single response
    return stripFormatting(response);
  }
};

/**
 * Gemini Analyze Code Tool
 * Code quality and performance analysis
 */
export const geminiAnalyzeCodeTool = {
  name: "gemini_analyze_code",
  description: "Analyze code for bugs, quality, security, or performance issues. Put the CODE in the 'code' parameter, NOT in 'focus'.",
  parameters: z.object({
    code: z.string().describe("The actual source code to analyze (REQUIRED - put your code here)"),
    language: z.string().optional().describe("Programming language (e.g., 'typescript', 'python')"),
    focus: z.string().optional().default("general").describe("Analysis focus (e.g., quality, security, performance, bugs, general)")
  }),
  execute: async (args: { code: string; language?: string; focus?: string }, { log, reportProgress }: any) => {
    const focusPrompts: Record<string, string> = {
      quality: "Focus on code quality, readability, and best practices",
      security: "Focus on security vulnerabilities and potential exploits",
      performance: "Focus on performance bottlenecks and optimization opportunities",
      bugs: "Focus on finding bugs, logic errors, and edge cases",
      general: "Provide a comprehensive analysis covering all aspects"
    };

    const focusText = focusPrompts[args.focus || 'general'] || `Focus on: ${args.focus}`;
    const systemPrompt = `Expert code reviewer. ${args.language || ''} code.
${focusText}.
${FORMAT_INSTRUCTION}`;

    // Skip validation - code analysis naturally contains patterns that trigger false positives
    const reportFn = reportProgress ?? (async () => {});
    const result = await withHeartbeat(
      () => callGemini(
        `Analyze this code:\n\n\`\`\`${args.language || ''}\n${args.code}\n\`\`\``,
        GEMINI_MODELS.GEMINI_3_PRO,
        systemPrompt,
        0.3,
        'llm-orchestration'
      ),
      reportFn
    );
    return stripFormatting(result);
  }
};

/**
 * Gemini Analyze Text Tool
 * Text analysis and sentiment detection
 */
export const geminiAnalyzeTextTool = {
  name: "gemini_analyze_text",
  description: "Text analysis. Put the TEXT in the 'text' parameter, NOT in 'type'.",
  parameters: z.object({
    text: z.string().describe("The text to analyze (REQUIRED - put your text here)"),
    type: z.string()
      .optional()
      .default("general")
      .describe("Analysis type (e.g., sentiment, summary, entities, key-points, general)")
  }),
  execute: async (args: { text: string; type?: string }, { log, reportProgress }: any) => {
    const analysisPrompts: Record<string, string> = {
      sentiment: "Analyze the sentiment (positive, negative, neutral) with confidence scores",
      summary: "Provide a concise summary of the main points",
      entities: "Extract all named entities (people, places, organizations, etc.)",
      "key-points": "Identify and list the key points and main arguments",
      general: "Provide comprehensive text analysis including sentiment, key points, and entities"
    };

    const analysisText = analysisPrompts[args.type || 'general'] || `Perform ${args.type} analysis`;
    const systemPrompt = `Text analysis expert. ${analysisText}.
${FORMAT_INSTRUCTION}`;

    // Skip validation - text analysis may contain patterns from LLM discussions
    const reportFn = reportProgress ?? (async () => {});
    const result = await withHeartbeat(
      () => callGemini(
        `Analyze this text:\n\n${args.text}`,
        GEMINI_MODELS.GEMINI_3_PRO,
        systemPrompt,
        0.3,
        'llm-orchestration'
      ),
      reportFn
    );
    return stripFormatting(result);
  }
};

/**
 * Gemini Summarize Tool
 * Content summarization at different levels
 */
export const geminiSummarizeTool = {
  name: "gemini_summarize",
  description: "Summarization. Put the CONTENT in the 'content' parameter.",
  parameters: z.object({
    content: z.string().describe("The content to summarize (REQUIRED - put your text here)"),
    length: z.enum(["brief", "moderate", "detailed"])
      .optional()
      .default("moderate")
      .describe("Summary length - must be one of: brief, moderate, detailed"),
    format: z.enum(["paragraph", "bullet-points", "outline"])
      .optional()
      .default("paragraph")
      .describe("Output format - must be one of: paragraph, bullet-points, outline")
  }),
  execute: async (args: { content: string; length?: string; format?: string }, { log, reportProgress }: any) => {
    const lengthGuides = {
      brief: "1-2 sentences capturing the essence",
      moderate: "1-2 paragraphs with main points",
      detailed: "Comprehensive summary preserving important details"
    };

    const formatGuides = {
      paragraph: "Write in paragraph form",
      "bullet-points": "Use bullet points for each main idea",
      outline: "Create a hierarchical outline structure"
    };

    const systemPrompt = `Create a ${args.length} summary. ${lengthGuides[(args.length as keyof typeof lengthGuides) || 'moderate']}.
${formatGuides[(args.format as keyof typeof formatGuides) || 'paragraph']}.

Focus on:
- Main ideas and key arguments
- Important facts and figures
- Conclusions and implications
${FORMAT_INSTRUCTION}`;

    // Skip validation for internal summarization calls
    const reportFn = reportProgress ?? (async () => {});
    const result = await withHeartbeat(
      () => callGemini(
        `Summarize this content:\n\n${args.content}`,
        GEMINI_MODELS.GEMINI_3_PRO,
        systemPrompt,
        0.3,
        'llm-orchestration'
      ),
      reportFn
    );
    return stripFormatting(result);
  }
};

/**
 * Gemini Image Prompt Tool
 * Create detailed prompts for image generation
 */
export const geminiImagePromptTool = {
  name: "gemini_image_prompt",
  description: "Image prompt generation. Put the DESCRIPTION in the 'description' parameter.",
  parameters: z.object({
    description: z.string().describe("What you want in the image (REQUIRED - describe the image)"),
    style: z.string().optional().describe("Artistic style (e.g., 'watercolor', 'photorealistic')"),
    mood: z.string().optional().describe("Mood or atmosphere (e.g., 'serene', 'dramatic')"),
    details: z.string().optional().describe("Additional details to include")
  }),
  execute: async (args: { description: string; style?: string; mood?: string; details?: string }, { log, reportProgress }: any) => {
    const systemPrompt = `You are an expert at creating detailed image generation prompts.
Transform the user's description into a detailed, effective prompt for image generation.

Include:
1. Clear subject description
2. Artistic style and technique
3. Lighting and atmosphere
4. Composition and perspective
5. Color palette
6. Additional details for richness

Make it specific and visually descriptive.
${FORMAT_INSTRUCTION}`;

    const userPrompt = `Create an image prompt for: ${args.description}
${args.style ? `Style: ${args.style}` : ''}
${args.mood ? `Mood: ${args.mood}` : ''}
${args.details ? `Additional details: ${args.details}` : ''}`;

    // Skip validation for creative content generation
    const reportFn = reportProgress ?? (async () => {});
    const result = await withHeartbeat(
      () => callGemini(userPrompt, GEMINI_MODELS.GEMINI_3_PRO, systemPrompt, 0.7, 'llm-orchestration'),
      reportFn
    );
    return stripFormatting(result);
  }
};

/**
 * Gemini Judge Tool
 * Multi-perspective evaluation and synthesis (LLM-as-a-Judge)
 * Based on: Gu et al. "A Survey on LLM-as-a-Judge" (arXiv:2411.15594)
 * - CoT reasoning for evaluation quality
 * - Multi-trait decomposition across dimensions
 * - Position bias mitigation (don't favor first/last)
 * - Extract-then-synthesize (not pick-a-winner)
 */
export const geminiJudgeTool = {
  name: "gemini_judge",
  description: "Evaluate and synthesize multiple AI perspectives into a unified verdict. Put PERSPECTIVES in 'perspectives' parameter.",
  parameters: z.object({
    perspectives: z.string().describe("The multiple AI perspectives/analyses to evaluate and synthesize (REQUIRED)"),
    question: z.string().optional().describe("The original question being judged"),
    mode: z.enum(["synthesize", "evaluate", "rank", "resolve"])
      .optional()
      .default("synthesize")
      .describe("Judge mode: synthesize (merge best), evaluate (score each), rank (order by quality), resolve (settle conflicts)")
  }),
  execute: async (args: {
    perspectives: string;
    question?: string;
    mode?: string;
  }, { log, reportProgress }: any) => {
    const modeInstructions: Record<string, string> = {
      synthesize: `SYNTHESIS MODE: Extract the best elements from each perspective and merge into one cohesive answer.
Do NOT pick a winner. Find what is uniquely valuable in EACH perspective.
The final answer must be BETTER than any single input.`,

      evaluate: `EVALUATION MODE: Score each perspective on these dimensions (1-10):
- Accuracy: Factual correctness
- Completeness: Coverage of the problem
- Reasoning: Quality of logic and argumentation
- Actionability: How useful/implementable the advice is
- Novelty: Unique insights others missed
Provide per-perspective scores and brief justification.`,

      rank: `RANKING MODE: Order perspectives from strongest to weakest.
For each, state: rank, key strength, key weakness.
Use pairwise comparison (compare each pair) to avoid position bias.`,

      resolve: `CONFLICT RESOLUTION MODE: Identify where perspectives disagree.
For each conflict:
1. State the disagreement clearly
2. Evaluate evidence on both sides
3. Render a verdict with reasoning
4. Note confidence level (high/medium/low)`
    };

    const systemPrompt = `You are Gemini 3 Pro, acting as an expert judge and synthesizer.

ROLE: Evaluate multiple AI perspectives with intellectual rigor and fairness.

${modeInstructions[args.mode || 'synthesize']}

METHODOLOGY (based on LLM-as-a-Judge research — Gu et al. arXiv:2411.15594):
1. READ all perspectives completely before forming any opinion
2. DECOMPOSE evaluation across traits: accuracy, reasoning, completeness, novelty, actionability
3. MITIGATE BIAS: Don't favor the first, longest, or most verbose response — evaluate on substance
4. CHAIN-OF-THOUGHT: Show your reasoning step-by-step before concluding (chain_of_thought technique)
5. FIRST PRINCIPLES: Strip away assumptions, identify ground truths, rebuild from fundamentals
6. TREE OF THOUGHTS: Consider multiple synthesis paths, evaluate each, prune weak branches
7. ADVERSARIAL CHECK: For each conclusion, argue the counterpoint — does it survive scrutiny?
8. SELF-CONSISTENCY: If you arrived at this verdict 3 different ways, would you get the same answer?
9. EXTRACT before synthesizing: identify what each perspective contributes uniquely

OUTPUT STRUCTURE:
## Per-Perspective Analysis
For each input, note: key contribution, strength, weakness, unique insight

## Consensus Points
What all perspectives agree on (high confidence)

## Conflicts & Resolution
Where they disagree — evidence on each side, verdict, confidence level

## Final Synthesis
The unified answer combining the best elements — must be better than any single input

${FORMAT_INSTRUCTION}`;

    const userPrompt = args.question
      ? `QUESTION: ${args.question}\n\nPERSPECTIVES TO JUDGE:\n${args.perspectives}`
      : args.perspectives;

    const reportFn = reportProgress ?? (async () => {});
    const result = await withHeartbeat(
      () => callGemini(userPrompt, GEMINI_MODELS.GEMINI_3_PRO, systemPrompt, 0.3, 'llm-orchestration'),
      reportFn
    );
    return stripFormatting(result);
  }
};

/**
 * Gemini Search Tool
 * Web search using Google Search grounding
 * Uses google_search_retrieval with dynamic retrieval config
 */
export const geminiSearchTool = {
  name: "gemini_search",
  description: "Web search via Gemini with Google Search grounding",
  parameters: z.object({
    query: z.string().describe("Search query"),
    recency: z.enum(["hour", "day", "week", "month", "year", "any"]).optional().default("any")
      .describe("Prefer results from this time range (enforced via prompt)"),
    mode: z.enum(["dynamic", "on", "off"]).optional().default("on")
      .describe("Search mode: 'on' always searches, 'dynamic' lets model decide, 'off' disables"),
    dynamicThreshold: z.number().min(0).max(1).optional().default(0.7)
      .describe("Confidence threshold for dynamic mode (0-1)")
  }),
  execute: async (args: {
    query: string;
    recency?: string;
    mode?: string;
    dynamicThreshold?: number;
  }, { log, reportProgress }: any) => {
    if (!GEMINI_API_KEY) {
      return `[Gemini API key not configured. Add GOOGLE_API_KEY to .env file]`;
    }

    // Build recency instruction for prompt
    const recencyInstructions: Record<string, string> = {
      hour: "Only use sources from the last hour. Reject older information.",
      day: "Prefer sources from the last 24 hours. Prioritize very recent information.",
      week: "Prefer sources from the last 7 days. Recent information is preferred.",
      month: "Prefer sources from the last 30 days.",
      year: "Prefer sources from 2025 or later.",
      any: ""
    };

    const recencyPrompt = recencyInstructions[args.recency || "any"];

    // Map mode to API values
    const modeMap: Record<string, string> = {
      dynamic: "MODE_DYNAMIC",
      on: "MODE_UNSPECIFIED",  // Default behavior = always search when relevant
      off: "MODE_OFF"
    };

    try {
      const url = `${GEMINI_API_URL}/models/${GEMINI_MODELS.GEMINI_3_PRO}:generateContent?key=${GEMINI_API_KEY}`;

      const systemInstruction = `You are a research assistant with access to Google Search.
Search the web to answer the user's query with accurate, up-to-date information.
${recencyPrompt}

IMPORTANT:
- Always cite your sources with URLs
- Include publication dates when available
- If information seems outdated, note it
- Synthesize information from multiple sources when possible`;

      const requestBody: any = {
        contents: [
          {
            role: "user",
            parts: [{ text: args.query }]
          }
        ],
        systemInstruction: {
          parts: [{ text: systemInstruction }]
        },
        tools: [
          {
            google_search: {}  // Enable Google Search grounding
          }
        ],
        generationConfig: {
          temperature: 0.3,
          maxOutputTokens: 8000,
          candidateCount: 1
        }
      };

      // Add dynamic retrieval config if using dynamic mode
      if (args.mode === "dynamic") {
        requestBody.tools = [
          {
            google_search_retrieval: {
              dynamic_retrieval_config: {
                mode: modeMap[args.mode],
                dynamic_threshold: args.dynamicThreshold || 0.7
              }
            }
          }
        ];
      }

      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Gemini Search API error: ${response.status} - ${errorText}`);
      }

      const data = await response.json() as any;

      // Extract response text
      const candidate = data.candidates?.[0];
      const text = candidate?.content?.parts?.[0]?.text;

      // Extract grounding metadata for sources
      const groundingMetadata = candidate?.groundingMetadata;
      let sources = "";

      if (groundingMetadata?.webSearchQueries) {
        sources += `\n\nSearch queries used: ${groundingMetadata.webSearchQueries.join(", ")}`;
      }

      if (groundingMetadata?.groundingChunks) {
        sources += "\n\nSOURCES:";
        for (const chunk of groundingMetadata.groundingChunks) {
          if (chunk.web) {
            sources += `\n- [${chunk.web.title || "Source"}](${chunk.web.uri})`;
          }
        }
      }

      // Log token usage
      const usage = data.usageMetadata;
      if (usage) {
        console.error(`📊 Gemini Search tokens: ${usage.promptTokenCount || 0} input, ${usage.candidatesTokenCount || 0} output, ${usage.totalTokenCount || 0} total`);
      }

      if (!text) {
        return "[No search results from Gemini]";
      }

      return text + sources;
    } catch (error) {
      return `[Gemini Search error: ${error instanceof Error ? error.message : String(error)}]`;
    }
  }
};

/**
 * Check if Gemini is available
 */
export function isGeminiAvailable(): boolean {
  return !!GEMINI_API_KEY;
}

/**
 * Get all Gemini tools
 */
export function getAllGeminiTools() {
  if (!isGeminiAvailable()) {
    return [];
  }

  return [
    geminiQueryTool,
    geminiBrainstormTool,
    geminiAnalyzeCodeTool,
    geminiAnalyzeTextTool,
    geminiSummarizeTool,
    geminiImagePromptTool,
    geminiJudgeTool,
    geminiSearchTool
  ];
}