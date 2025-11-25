/**
 * Unified AI Provider - Single interface for all OpenAI-compatible APIs
 * Supports: OpenAI, Groq, Mistral, Gemini, OpenRouter, Together, Ollama, LMStudio
 */

import { z } from 'zod';
import OpenAI from 'openai';
import { config } from 'dotenv';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
config({ path: path.resolve(__dirname, '../../../.env') });

// Provider configurations with their base URLs
const PROVIDER_CONFIGS = {
  openai: {
    base: 'https://api.openai.com/v1',
    key: process.env.OPENAI_API_KEY,
    models: ['gpt-5.1', 'gpt-5.1-codex-mini', 'gpt-5.1-codex']
  },
  gpt51: {
    base: 'https://api.openai.com/v1',  // Uses /responses endpoint internally
    key: process.env.OPENAI_API_KEY,
    models: ['gpt-5.1', 'gpt-5.1-codex-mini', 'gpt-5.1-codex'],
    special: true  // Needs special handling for reasoning_effort
  },
  mistral: {
    base: 'https://api.mistral.ai/v1',
    key: process.env.MISTRAL_API_KEY,
    models: ['mistral-large-latest', 'mistral-small-latest', 'codestral-latest']
  },
  gemini: {
    base: 'https://generativelanguage.googleapis.com/v1beta/',
    key: process.env.GOOGLE_API_KEY,
    models: ['gemini-3-pro-preview', 'gemini-2.5-flash', 'gemini-2.5-pro', 'gemini-2.5-flash-lite']
  },
  openrouter: {
    base: 'https://openrouter.ai/api/v1',
    key: process.env.OPENROUTER_API_KEY,
    models: ['anthropic/claude-3.5-sonnet', 'meta-llama/llama-3.1-405b', 'google/gemini-pro']
  },
  together: {
    base: 'https://api.together.xyz/v1',
    key: process.env.TOGETHER_API_KEY,
    models: ['Meta-Llama-3.1-405B-Instruct-Turbo', 'Qwen/Qwen2.5-72B-Instruct-Turbo']
  },
  ollama: {
    base: process.env.OLLAMA_BASE_URL || 'http://localhost:11434/v1',
    key: 'ollama',  // Ollama doesn't need an API key
    models: ['llama3.3', 'qwen2.5', 'mistral', 'gemma2']
  },
  lmstudio: {
    base: process.env.LMSTUDIO_BASE_URL || 'http://localhost:1234/v1',
    key: 'lmstudio',  // LMStudio doesn't need an API key
    models: ['local-model']  // Depends on what's loaded
  }
};

export type AIProvider = keyof typeof PROVIDER_CONFIGS;
export type AIMode = 'chat' | 'complete' | 'reason' | 'analyze' | 'code';

interface UnifiedAIOptions {
  provider: AIProvider;
  model?: string;
  mode?: AIMode;
  temperature?: number;
  maxTokens?: number;
  systemPrompt?: string;
  stream?: boolean;
}

/**
 * Check if a provider is available (has API key configured)
 */
export function isProviderAvailable(provider: AIProvider): boolean {
  const config = PROVIDER_CONFIGS[provider];
  if (!config) return false;

  // Local providers are always available
  if (provider === 'ollama' || provider === 'lmstudio') {
    return true;
  }

  return !!config.key;
}

/**
 * Get available providers
 */
export function getAvailableProviders(): AIProvider[] {
  return Object.keys(PROVIDER_CONFIGS)
    .filter(p => isProviderAvailable(p as AIProvider)) as AIProvider[];
}

/**
 * Unified AI query function
 */
export async function queryAI(
  prompt: string,
  options: UnifiedAIOptions
): Promise<string> {
  const config = PROVIDER_CONFIGS[options.provider];
  if (!config) {
    throw new Error(`Unknown provider: ${options.provider}`);
  }

  if (!isProviderAvailable(options.provider)) {
    throw new Error(`Provider ${options.provider} is not configured. Please set the appropriate API key.`);
  }

  // Handle GPT-5 special case
  if (options.provider === 'gpt51' && 'special' in config && config.special) {
    return await handleGPT5(prompt, options);
  }

  // Standard OpenAI-compatible handling
  const client = new OpenAI({
    apiKey: config.key,
    baseURL: config.base
  });

  const model = options.model || config.models[0];

  try {
    const response = await client.chat.completions.create({
      model,
      messages: [
        ...(options.systemPrompt ? [{ role: 'system' as const, content: options.systemPrompt }] : []),
        { role: 'user' as const, content: prompt }
      ],
      temperature: options.temperature ?? 0.7,
      max_tokens: options.maxTokens ?? 2000,
      stream: false  // Always false for now to avoid streaming complexity
    });

    return response.choices[0]?.message?.content || 'No response generated';
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`Error with ${options.provider}:`, errorMessage);
    throw new Error(`${options.provider} API error: ${errorMessage}`);
  }
}

// Type for GPT-5.1 /v1/responses API
interface GPT51ResponseOutput {
  type: string;
  content?: Array<{ text?: string }>;
}

interface GPT51Response {
  output: GPT51ResponseOutput[];
}

/**
 * Special handling for GPT-5 (uses /responses endpoint)
 */
async function handleGPT5(prompt: string, options: UnifiedAIOptions): Promise<string> {
  const config = PROVIDER_CONFIGS.gpt51;
  const endpoint = 'https://api.openai.com/v1/responses';

  const model = options.model || 'gpt-5.1-codex-mini';  // Default to cheapest

  const requestBody = {
    model,
    input: prompt,
    reasoning: {
      effort: model === 'gpt-5.1' ? 'high' : 'low'
    },
    max_output_tokens: 4000
  };

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.key}`
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`GPT-5 API error: ${error}`);
    }

    const data = await response.json() as GPT51Response;
    const messageOutput = data.output.find(item => item.type === 'message');
    return messageOutput?.content?.[0]?.text || 'No response generated';
  } catch (error) {
    console.error('GPT-5 error:', error);
    throw error;
  }
}

/**
 * Mode-specific wrappers
 */
export async function analyzeWithAI(
  content: string,
  provider: AIProvider,
  analysisType: 'code' | 'text' | 'security' | 'performance' = 'code'
): Promise<string> {
  const prompts = {
    code: `Analyze this code for quality, bugs, and improvements:\n\n${content}`,
    text: `Analyze this text for clarity, structure, and key points:\n\n${content}`,
    security: `Analyze this code for security vulnerabilities:\n\n${content}`,
    performance: `Analyze this code for performance issues:\n\n${content}`
  };

  return queryAI(prompts[analysisType], {
    provider,
    mode: 'analyze',
    temperature: 0.3  // Lower temperature for analysis
  });
}

export async function generateCode(
  requirements: string,
  provider: AIProvider,
  language?: string
): Promise<string> {
  const prompt = language
    ? `Generate ${language} code for: ${requirements}`
    : `Generate code for: ${requirements}`;

  return queryAI(prompt, {
    provider,
    mode: 'code',
    temperature: 0.5,
    systemPrompt: 'You are an expert programmer. Generate clean, efficient, well-commented code.'
  });
}

/**
 * Get all unified AI tools for MCP registration
 */
interface ToolDefinition {
  name: string;
  description: string;
  parameters: z.ZodObject<any>;
  execute: (args: any, context: any) => Promise<string>;
}

export function getUnifiedAITools(): ToolDefinition[] {
  const availableProviders = getAvailableProviders();

  if (availableProviders.length === 0) {
    console.error('⚠️ No AI providers configured. Please set API keys in .env');
    return [];
  }

  return [
    {
      name: 'ai',
      description: 'Query any AI model',
      parameters: z.object({
        prompt: z.string(),
        provider: z.enum(availableProviders as [AIProvider, ...AIProvider[]]).optional()
          ,
        model: z.string().optional(),
        mode: z.enum(['chat', 'complete', 'reason', 'analyze', 'code']).optional()
          ,
        temperature: z.number().min(0).max(2).optional(),
        maxTokens: z.number().min(1).max(100000).optional()
      }),
      execute: async (args: unknown, context: unknown) => {
        const typedArgs = args as {
          prompt: string;
          provider?: AIProvider;
          model?: string;
          mode?: AIMode;
          temperature?: number;
          maxTokens?: number;
        };
        const provider = typedArgs.provider || availableProviders[0];
        return await queryAI(typedArgs.prompt, {
          provider,
          model: typedArgs.model,
          mode: typedArgs.mode,
          temperature: typedArgs.temperature,
          maxTokens: typedArgs.maxTokens
        });
      }
    },
    {
      name: 'ai_analyze',
      description: 'Analyze code or text',
      parameters: z.object({
        content: z.string(),
        type: z.enum(['code', 'text', 'security', 'performance']),
        provider: z.enum(availableProviders as [AIProvider, ...AIProvider[]]).optional()
      }),
      execute: async (args: unknown, context: unknown) => {
        const typedArgs = args as {
          content: string;
          type: 'code' | 'text' | 'security' | 'performance';
          provider?: AIProvider;
        };
        const provider = typedArgs.provider || availableProviders[0];
        return await analyzeWithAI(typedArgs.content, provider, typedArgs.type);
      }
    },
    {
      name: 'ai_code',
      description: 'Generate code',
      parameters: z.object({
        requirements: z.string(),
        language: z.string().optional(),
        provider: z.enum(availableProviders as [AIProvider, ...AIProvider[]]).optional()
      }),
      execute: async (args: unknown, context: unknown) => {
        const typedArgs = args as {
          requirements: string;
          language?: string;
          provider?: AIProvider;
        };
        const provider = typedArgs.provider || availableProviders[0];
        return await generateCode(typedArgs.requirements, provider, typedArgs.language);
      }
    }
  ];
}

/**
 * List available models for a provider
 */
export function listModels(provider: AIProvider): string[] {
  return PROVIDER_CONFIGS[provider]?.models || [];
}

/**
 * Get provider info
 */
export function getProviderInfo(): Record<AIProvider, { available: boolean; models: string[] }> {
  const info: Record<string, { available: boolean; models: string[] }> = {};

  for (const [provider, config] of Object.entries(PROVIDER_CONFIGS)) {
    info[provider] = {
      available: isProviderAvailable(provider as AIProvider),
      models: config.models
    };
  }

  return info;
}