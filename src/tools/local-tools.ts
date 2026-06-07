/**
 * Local LLM Tools — OpenAI-compatible endpoint (Ollama, LM Studio, llama.cpp, vLLM)
 *
 * Free, offline, private jurors/agents at ZERO token cost. This is a structural
 * advantage no token-selling vendor (Anthropic/OpenAI/Google) can match inside
 * their own harness — they have no incentive to route to a model they don't bill.
 *
 * Enable by running a local server and (optionally) setting:
 *   LOCAL_LLM_BASE_URL  default http://localhost:11434/v1  (Ollama; LM Studio = :1234/v1)
 *   LOCAL_LLM_MODEL     default hermes3                     (Nous Hermes)
 *   LOCAL_LLM_API_KEY   optional; most local servers ignore it
 *   LOCAL_LLM_NUM_CTX   default 8192  (Ollama only — see note)
 *
 * num_ctx note: Ollama's OpenAI-compat /v1 path SILENTLY DROPS num_ctx (context
 * truncates to 2048). So when the endpoint is Ollama we call its NATIVE /api/chat
 * endpoint instead, where num_ctx is actually honored.
 *
 * Errors throw a typed LocalLLMError (never a sentinel string) so consumers like
 * the jury can DROP an offline juror instead of leaking an error blob into synthesis.
 *
 * NOTE: dotenv is loaded in server.ts before any imports — just read process.env.
 */

import { z } from "zod";
import { getLocalLLMBaseUrl, getLocalLLMModel, getLocalLLMApiKey } from "../utils/api-keys.js";

/** Typed failure — consumers check `instanceof`, never regex a magic string. */
export class LocalLLMError extends Error {
  constructor(detail: string) {
    super(detail);
    this.name = "LocalLLMError";
  }
}

const defaultNumCtx = (): number => Number(process.env.LOCAL_LLM_NUM_CTX) || 8192;

/** An Ollama endpoint exposes the native /api/chat route that honors num_ctx. */
function isOllama(baseUrl: string): boolean {
  return baseUrl.includes(":11434") || /\bollama\b/i.test(baseUrl);
}

export interface LocalMessage {
  role: string;
  content: string;
}

interface CallLocalOpts {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  timeoutMs?: number;
  numCtx?: number;
}

/**
 * Call a local chat endpoint. Throws LocalLLMError on any failure (offline,
 * timeout, HTTP error, bad shape). For Ollama, uses native /api/chat so num_ctx
 * applies; for other OpenAI-compatible servers, uses /chat/completions.
 */
export async function callLocal(messages: LocalMessage[], opts: CallLocalOpts = {}): Promise<string> {
  const baseUrl = getLocalLLMBaseUrl().replace(/\/$/, "");
  const resolvedModel = opts.model || getLocalLLMModel();
  const temperature = opts.temperature ?? 0.4;
  const maxTokens = opts.maxTokens ?? 4000;
  const timeoutMs = opts.timeoutMs ?? 120000;
  const numCtx = opts.numCtx ?? defaultNumCtx();
  const ollama = isOllama(baseUrl);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    // Ollama → native /api/chat (num_ctx honored). Others → OpenAI-compat /chat/completions.
    const url = ollama
      ? `${baseUrl.replace(/\/v1$/, "")}/api/chat`
      : `${baseUrl}/chat/completions`;

    const body = ollama
      ? {
          model: resolvedModel.replace(/:latest$/, ""),
          messages,
          stream: false,
          options: { num_ctx: numCtx, temperature, num_predict: maxTokens },
        }
      : {
          model: resolvedModel,
          messages,
          temperature,
          max_tokens: maxTokens,
          stream: false,
        };

    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${getLocalLLMApiKey()}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => "");
      throw new LocalLLMError(
        `Local LLM HTTP ${response.status} at ${baseUrl} (model "${resolvedModel}"): ${errorText.slice(0, 200)}`,
      );
    }

    const data: any = await response.json();
    // Native /api/chat → data.message.content ; OpenAI-compat → data.choices[0].message.content
    const content = ollama ? data?.message?.content : data?.choices?.[0]?.message?.content;
    if (typeof content !== "string") {
      throw new LocalLLMError(`Local LLM returned an invalid response shape from ${baseUrl}`);
    }
    return content;
  } catch (error) {
    if (error instanceof LocalLLMError) throw error;
    const msg = error instanceof Error ? error.message : String(error);
    if (msg.toLowerCase().includes("abort")) {
      throw new LocalLLMError(`Local LLM timed out after ${timeoutMs}ms at ${baseUrl}`);
    }
    throw new LocalLLMError(`Local LLM connection failed at ${baseUrl}: ${msg}`);
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Standalone MCP tool. The friendly offline hint lives HERE (the tool boundary),
 * so a human running local_query directly gets guidance, while callLocal still
 * surfaces the typed error to orchestrators (jury) for clean drop-on-failure.
 */
export const localQueryTool = {
  name: "local_query",
  description:
    "Query a local open-weight model (Ollama / LM Studio / llama.cpp / vLLM) — zero-cost, offline, private. Set LOCAL_LLM_BASE_URL / LOCAL_LLM_MODEL; LOCAL_LLM_NUM_CTX for long prompts (Ollama).",
  parameters: z.object({
    prompt: z.string().describe("The prompt to send to the local model"),
    model: z.string().optional().describe("Model tag, e.g. hermes3, qwen2.5"),
    temperature: z.number().optional().default(0.4),
  }),
  execute: async (
    a: { prompt: string; model?: string; temperature?: number },
    { log }: any = {},
  ) => {
    log?.info?.("Local LLM query", { model: a.model || getLocalLLMModel() });
    try {
      return await callLocal([{ role: "user", content: a.prompt }], {
        model: a.model,
        temperature: a.temperature,
      });
    } catch (e) {
      if (e instanceof LocalLLMError) {
        return `Local LLM unavailable — ${e.message}. Start Ollama (\`ollama serve\` + \`ollama pull hermes3\`) or LM Studio, then set LOCAL_LLM_BASE_URL / LOCAL_LLM_MODEL.`;
      }
      throw e;
    }
  },
};

// plop:tools — generated tool imports are appended here by `npm run add-tool`

/**
 * Returns all local-model tools. The registry imports `localQueryTool` directly
 * today; this getter is the extension point for tools added via `npm run add-tool`.
 * `// plop:register` marks the insertion point inside the return array.
 */
export function getAllLocalTools() {
  return [
    localQueryTool,
    // plop:register
  ];
}
