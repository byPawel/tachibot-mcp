/**
 * OpenRouter Gateway Utility
 * Routes API calls through OpenRouter when USE_OPENROUTER_GATEWAY=true
 */

import { config } from 'dotenv';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
config({ path: path.resolve(__dirname, '../../../.env') });

// Gateway configuration - NOT cached, read fresh each time
const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';

// Models that should NEVER use gateway (direct API only)
const NO_GATEWAY_MODELS = new Set([
  'sonar-pro',
  'sonar-reasoning-pro',
  'sonar',
]);

// Grok model mapping - our names → OpenRouter names
const GROK_MODEL_MAP: Record<string, string> = {
  'grok-4-1-fast-reasoning': 'x-ai/grok-4.1-fast',
  'grok-4-1-fast-non-reasoning': 'x-ai/grok-4.1-fast',
  'grok-4-fast-reasoning': 'x-ai/grok-4-fast',
  'grok-4-fast-non-reasoning': 'x-ai/grok-4-fast',
  'grok-code-fast-1': 'x-ai/grok-4-fast',
  'grok-4-0709': 'x-ai/grok-4',
  'grok-3': 'x-ai/grok-3',
};

interface ChatMessage {
  role: string;
  content: string;
}

interface GatewayOptions {
  temperature?: number;
  max_tokens?: number;
  stream?: boolean;
}

/**
 * Check if gateway mode is enabled
 * Reads env vars fresh each time (not cached at module load)
 */
export function isGatewayEnabled(): boolean {
  const enabled = process.env.USE_OPENROUTER_GATEWAY === 'true';
  const hasKey = !!process.env.OPENROUTER_API_KEY;
  return enabled && hasKey;
}

/**
 * Map model name to OpenRouter format
 * Returns null if model should skip gateway (use direct API)
 */
export function mapModelToOpenRouter(model: string): string | null {
  // Perplexity models - NEVER use gateway, direct API only
  if (model.startsWith('sonar') || NO_GATEWAY_MODELS.has(model)) {
    return null;
  }

  // Already has provider prefix (qwen/, moonshotai/, etc.) - pass through
  if (model.includes('/')) {
    return model;
  }

  // Grok models need explicit mapping (names differ from OpenRouter)
  if (GROK_MODEL_MAP[model]) {
    return GROK_MODEL_MAP[model];
  }

  // Add provider prefix based on model name
  if (model.startsWith('gpt-')) {
    return `openai/${model}`;
  }
  if (model.startsWith('gemini-')) {
    return `google/${model}`;
  }
  if (model.startsWith('grok-')) {
    return `x-ai/${model}`; // Fallback for unmapped grok models
  }

  // Unknown model - pass through as-is
  return model;
}

/**
 * Try to route request through OpenRouter gateway
 * Returns response string if gateway used, null if gateway disabled/failed
 */
export async function tryOpenRouterGateway(
  model: string,
  messages: ChatMessage[],
  options: GatewayOptions = {}
): Promise<string | null> {
  // Check if gateway is enabled
  if (!isGatewayEnabled()) {
    return null;
  }

  // Map model - returns null if model should skip gateway
  const mappedModel = mapModelToOpenRouter(model);
  if (!mappedModel) {
    return null; // Skip gateway, use direct API
  }

  console.error(`🔀 [OpenRouter Gateway] Routing ${model} → ${mappedModel}`);

  try {
    const response = await fetch(OPENROUTER_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
        'HTTP-Referer': 'https://tachibot-mcp.local',
        'X-Title': 'TachiBot MCP Server'
      },
      body: JSON.stringify({
        model: mappedModel,
        messages,
        temperature: options.temperature ?? 0.7,
        max_tokens: options.max_tokens ?? 4000,
        stream: false
      })
    });

    if (!response.ok) {
      const error = await response.text();
      console.error(`🔀 [OpenRouter Gateway] Error: ${error}`);
      return null; // Fall back to direct API
    }

    const data = await response.json() as {
      choices?: Array<{ message?: { content?: string } }>;
    };

    const content = data.choices?.[0]?.message?.content;
    if (typeof content !== 'string') {
      console.error('🔀 [OpenRouter Gateway] Invalid response format');
      return null;
    }

    return content;
  } catch (error) {
    console.error('🔀 [OpenRouter Gateway] Error:', error instanceof Error ? error.message : String(error));
    return null; // Fall back to direct API
  }
}
