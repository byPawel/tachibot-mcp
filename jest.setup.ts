/**
 * Jest setup file for mocking AI API calls
 * Allows tests to run without real API keys in CI/CD
 */

import { jest } from '@jest/globals';

// Mock responses for each AI provider
const mockResponses = {
  openai: {
    choices: [
      {
        message: {
          content: "Mocked GPT-5 response: This is a test response.",
          role: "assistant"
        },
        finish_reason: "stop",
        index: 0
      }
    ],
    model: "gpt-5-mini",
    usage: { prompt_tokens: 10, completion_tokens: 20, total_tokens: 30 }
  },

  perplexity: {
    choices: [
      {
        message: {
          content: "Mocked Perplexity response with research data.",
          role: "assistant"
        },
        finish_reason: "stop"
      }
    ],
    citations: ["https://example.com/source1"],
    usage: { prompt_tokens: 15, completion_tokens: 25, total_tokens: 40 }
  },

  gemini: {
    candidates: [
      {
        content: {
          parts: [{ text: "Mocked Gemini response from Google AI." }],
          role: "model"
        },
        finishReason: "STOP"
      }
    ],
    usageMetadata: { promptTokenCount: 12, candidatesTokenCount: 18, totalTokenCount: 30 }
  },

  grok: {
    choices: [
      {
        message: {
          content: "Mocked Grok response with reasoning.",
          role: "assistant"
        },
        finish_reason: "stop"
      }
    ],
    usage: { prompt_tokens: 20, completion_tokens: 30, total_tokens: 50 }
  },

  qwen: {
    choices: [
      {
        message: {
          content: "Mocked Qwen Coder response with code analysis.",
          role: "assistant"
        },
        finish_reason: "stop"
      }
    ],
    usage: { prompt_tokens: 10, completion_tokens: 15, total_tokens: 25 }
  }
};

// Setup mock implementation before each test
beforeEach(() => {
  // Initialize fetch mock
  global.fetch = jest.fn() as any;

  (global.fetch as jest.Mock).mockImplementation((url: string, options?: any) => {
    const urlStr = url.toString().toLowerCase();

    // OpenAI API
    if (urlStr.includes('api.openai.com')) {
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve(mockResponses.openai),
        headers: new Headers({ 'content-type': 'application/json' })
      } as Response);
    }

    // Perplexity API
    if (urlStr.includes('api.perplexity.ai')) {
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve(mockResponses.perplexity),
        headers: new Headers({ 'content-type': 'application/json' })
      } as Response);
    }

    // Google Gemini API
    if (urlStr.includes('generativelanguage.googleapis.com')) {
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve(mockResponses.gemini),
        headers: new Headers({ 'content-type': 'application/json' })
      } as Response);
    }

    // Grok/xAI API
    if (urlStr.includes('api.x.ai') || urlStr.includes('grok')) {
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve(mockResponses.grok),
        headers: new Headers({ 'content-type': 'application/json' })
      } as Response);
    }

    // Qwen/OpenRouter API
    if (urlStr.includes('openrouter.ai')) {
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve(mockResponses.qwen),
        headers: new Headers({ 'content-type': 'application/json' })
      } as Response);
    }

    // Unknown API - return generic error
    return Promise.reject(new Error(`Unmocked API call to: ${url}`));
  });
});

// Clean up after each test
afterEach(() => {
  jest.clearAllMocks();
});
