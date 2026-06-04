/**
 * Ollama Tools — local open-weight models, zero-cost / offline / private.
 *
 * Uses Ollama's NATIVE /api/chat endpoint (NOT the OpenAI-compat /v1 path):
 * `options.num_ctx` is silently DROPPED on /v1, truncating context to 2048.
 * Failures throw a typed OllamaUnavailableError (never a sentinel string)
 * so the orchestrator can soft-fail by `instanceof` without regex-matching text.
 */
import { z } from "zod";

// Resolved lazily from process.env (loaded by the server at startup) so there
// are no module-load-order surprises and tests run with sane defaults.
const baseUrl = () => process.env.OLLAMA_BASE_URL || "http://127.0.0.1:11434"; // localhost-bound (no SSRF)
const defaultModel = () => process.env.OLLAMA_MODEL || "qwen2.5";
const defaultNumCtx = () => Number(process.env.OLLAMA_NUM_CTX) || 8192; // native /api/chat honors this; /v1 drops it

export interface OllamaMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
}

interface CallOpts {
  numCtx?: number;
  temperature?: number;
}

/** Typed failure so callers check `instanceof` — never a magic string that could collide with model output. */
export class OllamaUnavailableError extends Error {
  constructor(detail = "Ollama service unreachable") {
    super(detail);
    this.name = "OllamaUnavailableError";
  }
}

export async function callOllama(
  model: string,
  messages: OllamaMessage[],
  opts: CallOpts = {},
): Promise<string> {
  try {
    const res = await fetch(`${baseUrl()}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: (model || defaultModel()).replace(/:latest$/, ""),
        messages,
        stream: false,
        options: {
          num_ctx: opts.numCtx ?? defaultNumCtx(),
          temperature: opts.temperature ?? 0.7,
        },
      }),
    });
    if (!res.ok) {
      throw new OllamaUnavailableError(`Ollama API ${res.status} ${res.statusText}`);
    }
    const data: any = await res.json();
    return data.message?.content ?? "";
  } catch (e) {
    if (e instanceof OllamaUnavailableError) throw e;
    throw new OllamaUnavailableError(e instanceof Error ? e.message : String(e));
  }
}

/**
 * MCP tool. The user-facing offline message lives HERE (the tool boundary),
 * so a human running `ollama_query` directly gets a friendly hint, while the
 * orchestrator path (callOllama) still surfaces the typed error for soft-fail.
 */
export const ollamaQueryTool = {
  name: "ollama_query",
  description:
    "Query a local open-weight model via Ollama — zero-cost, offline, private (set OLLAMA_NUM_CTX for long prompts)",
  parameters: z.object({
    prompt: z.string().describe("The prompt to send to the local model"),
    model: z.string().optional().describe("Ollama model tag, e.g. qwen2.5, hermes3"),
    temperature: z.number().optional().default(0.7),
  }),
  execute: async (
    a: { prompt: string; model?: string; temperature?: number },
    { log }: any = {},
  ) => {
    log?.info?.("Ollama query", { model: a.model || defaultModel() });
    try {
      return await callOllama(
        a.model ?? defaultModel(),
        [{ role: "user", content: a.prompt }],
        { temperature: a.temperature },
      );
    } catch (e) {
      if (e instanceof OllamaUnavailableError) {
        return `Ollama isn't reachable. Start it (\`ollama serve\`) and pull a model (e.g. \`ollama pull qwen2.5\`).`;
      }
      throw e;
    }
  },
};
