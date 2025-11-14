/**
 * Gemini Tools Implementation
 * Provides all Gemini capabilities directly in tachibot-mcp
 * No need for separate gemini-mcp server
 */

import { z } from "zod";
import { validateToolInput } from "../utils/input-validator.js";

// NOTE: dotenv is loaded in server.ts before any imports
// No need to reload here - just read from process.env

// Gemini API configuration
const GEMINI_API_KEY = process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY;
const GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta";

// Available Gemini models (2025 - Latest)
export enum GeminiModel {
  // Primary models (Gemini 2.5 - preferred)
  FLASH = "gemini-2.5-flash",  // Latest fast model, best price-performance
  PRO = "gemini-2.5-pro",  // Most advanced reasoning capabilities
  FLASH_LITE = "gemini-2.5-flash-lite",  // Cost-effective variant
}

/**
 * Call Gemini API directly
 */
export async function callGemini(
  prompt: string,
  model: GeminiModel = GeminiModel.PRO,
  systemPrompt?: string,
  temperature: number = 0.7,
  skipValidation: boolean = false
): Promise<string> {
  if (!GEMINI_API_KEY) {
    return `[Gemini API key not configured. Add GOOGLE_API_KEY to .env file]`;
  }

  // Validate and sanitize prompt (skip for internal workflow calls)
  let sanitizedPrompt = prompt;
  if (!skipValidation) {
    const promptValidation = validateToolInput(prompt);
    if (!promptValidation.valid) {
      return `[Error: ${promptValidation.error}]`;
    }
    sanitizedPrompt = promptValidation.sanitized;
  }

  // Validate and sanitize system prompt if provided
  let sanitizedSystemPrompt = systemPrompt;
  if (systemPrompt && !skipValidation) {
    const systemValidation = validateToolInput(systemPrompt);
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
        maxOutputTokens: 49152,  // 48k - compromise between quality and cost (max is 65k)
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
  description: "Query Gemini",
  parameters: z.object({
    prompt: z.string(),
    model: z.enum(["pro", "flash"]).optional().default("pro")
  }),
  execute: async (args: { prompt: string; model?: string }, { log }: any) => {
    const model = args.model === "flash" ? GeminiModel.FLASH : GeminiModel.PRO;
    return await callGemini(args.prompt, model);
  }
};

/**
 * Gemini Brainstorm Tool
 * Collaborative problem-solving and ideation
 */
export const geminiBrainstormTool = {
  name: "gemini_brainstorm",
  description: "Brainstorming",
  parameters: z.object({
    prompt: z.string(),
    claudeThoughts: z.string().optional(),
    maxRounds: z.number().optional().default(1)
  }),
  execute: async (args: { prompt: string; claudeThoughts?: string; maxRounds?: number }, { log }: any) => {
    const systemPrompt = `You are a creative brainstorming partner. Generate innovative ideas and solutions.
${args.claudeThoughts ? `\nBuilding on these initial thoughts: ${args.claudeThoughts}` : ''}

IMPORTANT: Output a detailed written response with:
1. Multiple creative approaches (at least 3)
2. Unconventional or "out of the box" ideas
3. Potential challenges for each approach
4. Quick feasibility assessment

Provide your complete analysis as visible text output.`;

    const response = await callGemini(args.prompt, GeminiModel.PRO, systemPrompt, 0.9);
    
    // If multiple rounds requested, we could iterate here
    // For now, return the single response
    return response;
  }
};

/**
 * Gemini Analyze Code Tool
 * Code quality and performance analysis
 */
export const geminiAnalyzeCodeTool = {
  name: "gemini_analyze_code",
  description: "Code analysis",
  parameters: z.object({
    code: z.string(),
    language: z.string().optional(),
    focus: z.enum(["quality", "security", "performance", "bugs", "general"]).optional().default("general")
  }),
  execute: async (args: { code: string; language?: string; focus?: string }, { log }: any) => {
    const focusPrompts = {
      quality: "Focus on code quality, readability, and best practices",
      security: "Focus on security vulnerabilities and potential exploits",
      performance: "Focus on performance bottlenecks and optimization opportunities",
      bugs: "Focus on finding bugs, logic errors, and edge cases",
      general: "Provide a comprehensive analysis covering all aspects"
    };

    const systemPrompt = `You are an expert code reviewer. Analyze the following ${args.language || ''} code.
${focusPrompts[(args.focus as keyof typeof focusPrompts) || 'general']}.

Provide:
1. Summary of what the code does
2. ${args.focus === 'security' ? 'Security vulnerabilities' : 'Issues found'}
3. Specific recommendations for improvement
4. Code quality score (1-10) with justification`;

    return await callGemini(
      `Analyze this code:\n\n\`\`\`${args.language || ''}\n${args.code}\n\`\`\``,
      GeminiModel.PRO,
      systemPrompt,
      0.3
    );
  }
};

/**
 * Gemini Analyze Text Tool
 * Text analysis and sentiment detection
 */
export const geminiAnalyzeTextTool = {
  name: "gemini_analyze_text",
  description: "Text analysis",
  parameters: z.object({
    text: z.string(),
    type: z.enum(["sentiment", "summary", "entities", "key-points", "general"]).optional().default("general")
  }),
  execute: async (args: { text: string; type?: string }, { log }: any) => {
    const analysisPrompts = {
      sentiment: "Analyze the sentiment (positive, negative, neutral) with confidence scores",
      summary: "Provide a concise summary of the main points",
      entities: "Extract all named entities (people, places, organizations, etc.)",
      "key-points": "Identify and list the key points and main arguments",
      general: "Provide comprehensive text analysis including sentiment, key points, and entities"
    };

    const systemPrompt = `You are a text analysis expert. ${analysisPrompts[(args.type as keyof typeof analysisPrompts) || 'general']}.

Format your response clearly with:
${args.type === 'sentiment' ? '- Overall sentiment\n- Confidence score\n- Emotional indicators' : ''}
${args.type === 'entities' ? '- People\n- Organizations\n- Locations\n- Other entities' : ''}
${args.type === 'key-points' ? '- Main arguments\n- Supporting points\n- Conclusions' : ''}`;

    return await callGemini(
      `Analyze this text:\n\n${args.text}`,
      GeminiModel.PRO,
      systemPrompt,
      0.3
    );
  }
};

/**
 * Gemini Summarize Tool
 * Content summarization at different levels
 */
export const geminiSummarizeTool = {
  name: "gemini_summarize",
  description: "Summarization",
  parameters: z.object({
    content: z.string(),
    length: z.enum(["brief", "moderate", "detailed"]).optional().default("moderate"),
    format: z.enum(["paragraph", "bullet-points", "outline"]).optional().default("paragraph")
  }),
  execute: async (args: { content: string; length?: string; format?: string }, { log }: any) => {
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
- Conclusions and implications`;

    return await callGemini(
      `Summarize this content:\n\n${args.content}`,
      GeminiModel.PRO,
      systemPrompt,
      0.3
    );
  }
};

/**
 * Gemini Image Prompt Tool
 * Create detailed prompts for image generation
 */
export const geminiImagePromptTool = {
  name: "gemini_image_prompt",
  description: "Image prompt generation",
  parameters: z.object({
    description: z.string(),
    style: z.string().optional(),
    mood: z.string().optional(),
    details: z.string().optional()
  }),
  execute: async (args: { description: string; style?: string; mood?: string; details?: string }, { log }: any) => {
    const systemPrompt = `You are an expert at creating detailed image generation prompts.
Transform the user's description into a detailed, effective prompt for image generation.

Include:
1. Clear subject description
2. Artistic style and technique
3. Lighting and atmosphere
4. Composition and perspective
5. Color palette
6. Additional details for richness

Make it specific and visually descriptive.`;

    const userPrompt = `Create an image prompt for: ${args.description}
${args.style ? `Style: ${args.style}` : ''}
${args.mood ? `Mood: ${args.mood}` : ''}
${args.details ? `Additional details: ${args.details}` : ''}`;

    return await callGemini(userPrompt, GeminiModel.PRO, systemPrompt, 0.7);
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
    geminiImagePromptTool
  ];
}