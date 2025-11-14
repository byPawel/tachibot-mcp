/**
 * Shared Model Router Utility
 *
 * Centralizes AI provider routing logic to eliminate duplication across
 * Challenger, Verifier, Scout, and other tools.
 */

export interface ModelCallOptions {
  model: string;
  prompt: string;
  maxTokens?: number;
  temperature?: number;
  messages?: Array<{ role: string; content: string }>;
}

export interface ModelResponse {
  content: string;
  tokens?: number;
  provider: string;
}

/**
 * Routes model requests to appropriate AI provider based on model name
 */
export class SharedModelRouter {
  /**
   * Call any AI model with automatic provider routing
   */
  async callModel(options: ModelCallOptions): Promise<ModelResponse> {
    const { model, prompt, maxTokens = 2000, temperature = 0.7, messages } = options;

    const requestMessages = messages || [{ role: 'user', content: prompt }];

    try {
      let content: string;
      let provider: string;

      // Route to appropriate provider based on model name
      if (model.includes('gemini')) {
        const { callGemini } = await import('../tools/gemini-tools.js');
        content = await callGemini(prompt, model as any, undefined, temperature);
        provider = 'Google Gemini';
      } else if (model.includes('grok')) {
        const { callGrok } = await import('../tools/grok-tools.js');
        content = await callGrok(requestMessages, model as any, temperature, maxTokens);
        provider = 'xAI Grok';
      } else if (model.includes('qwen') || model.includes('qwq')) {
        // Qwen models go through OpenRouter
        const { callOpenRouter } = await import('../tools/openrouter-tools.js');
        content = await callOpenRouter(requestMessages, model as any, temperature, maxTokens);
        provider = 'OpenRouter';
      } else if (model.includes('gpt')) {
        const { callOpenAI } = await import('../tools/openai-tools.js');
        content = await callOpenAI(requestMessages, model as any, temperature, maxTokens);
        provider = 'OpenAI';
      } else if (model.includes('perplexity') || model.includes('sonar')) {
        const { callPerplexity } = await import('../tools/perplexity-tools.js');
        content = await callPerplexity(requestMessages, model as any);
        provider = 'Perplexity';
      } else {
        throw new Error(`Unknown model: ${model}. Supported providers: Gemini, Grok, OpenRouter (qwen/qwq), OpenAI (gpt), Perplexity (sonar)`);
      }

      return {
        content,
        tokens: Math.floor(content.length / 4),
        provider
      };
    } catch (error: any) {
      console.error(`Error calling model ${model}:`, error);
      throw new Error(`Failed to call ${model}: ${error.message}`);
    }
  }

  /**
   * Get provider name for a model (useful for logging)
   */
  getProviderName(model: string): string {
    if (model.includes('gemini')) return 'Google Gemini';
    if (model.includes('grok')) return 'xAI Grok';
    if (model.includes('qwen') || model.includes('qwq')) return 'OpenRouter';
    if (model.includes('gpt')) return 'OpenAI';
    if (model.includes('perplexity') || model.includes('sonar')) return 'Perplexity';
    return 'Unknown';
  }

  /**
   * Check if a model is supported
   */
  isModelSupported(model: string): boolean {
    return (
      model.includes('gemini') ||
      model.includes('grok') ||
      model.includes('gpt') ||
      model.includes('qwen') ||
      model.includes('qwq') ||
      model.includes('perplexity') ||
      model.includes('sonar')
    );
  }
}

// Singleton instance
export const modelRouter = new SharedModelRouter();
