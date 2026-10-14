/**
 * GPT-6 Astra routing tests.
 *
 * BUG (verified live Sep 14, 2026): callOpenAI chose the endpoint with
 * startsWith('gpt-5.'), so gpt-6-astra fell through to Chat Completions with
 * temperature:0.7 and no reasoning effort. OpenAI rejects that with 400
 * "'temperature' does not support 0.7 with this model". Astra also rejects
 * reasoning.effort "none"/"minimal" — it accepts only low|medium|high|xhigh|max.
 *
 * MECHANISM assertions on the captured request (URL + body), never on model
 * output. Same seam as test/tools/openai-empty-response.test.ts.
 */

import { jest } from "@jest/globals";

// Key is captured into a module-level const at import time — set BEFORE import.
if (!process.env.OPENAI_API_KEY) {
  process.env.OPENAI_API_KEY = "astra-fake-key";
}

const GATEWAY_MODULE = new URL(
  "../../src/utils/openrouter-gateway.ts",
  import.meta.url,
).pathname;

jest.unstable_mockModule(GATEWAY_MODULE, () => ({
  isGatewayEnabled: () => false,
  tryOpenRouterGateway: async () => null,
}));

const { callOpenAI } = await import("../../src/tools/openai-tools.js");
const { OPENAI_MODELS } = await import("../../src/config/model-constants.js");

const messages = [{ role: "user", content: "test question" }];

const completedBody = (model: string) => ({
  id: "resp_ok",
  object: "response",
  created_at: 1757800000,
  status: "completed",
  model,
  output: [
    {
      id: "msg_1",
      type: "message",
      status: "completed",
      role: "assistant",
      content: [{ type: "output_text", text: "a real answer", annotations: [] }],
    },
  ],
  usage: { input_tokens: 12, output_tokens: 40, total_tokens: 52 },
});

let calls: Array<{ url: string; body: any }>;

function mockFetch(respond: (body: any) => { status: number; json: unknown }) {
  calls = [];
  global.fetch = jest.fn(async (url: string | URL | Request, init?: any) => {
    const body = JSON.parse(init?.body ?? "{}");
    calls.push({ url: url.toString(), body });
    const { status, json } = respond(body);
    return {
      ok: status < 400,
      status,
      statusText: status < 400 ? "OK" : "Forbidden",
      json: async () => json,
      text: async () => JSON.stringify(json),
    };
  }) as unknown as typeof fetch;
}

const succeed = (body: any) => ({ status: 200, json: completedBody(body.model) });

describe("GPT-6 Astra", () => {
  test("is the default OpenAI model, with sol kept as an explicit tier", () => {
    expect(OPENAI_MODELS.ASTRA).toBe("gpt-6-astra");
    expect(OPENAI_MODELS.DEFAULT).toBe("gpt-6-astra");
    expect(OPENAI_MODELS.SOL).toBe("gpt-6.1-sol");
    expect(OPENAI_MODELS.SOL_6_0).toBe("gpt-6-sol");
  });

  test("uses the Responses API with reasoning effort and no temperature", async () => {
    mockFetch(succeed);

    const result = await callOpenAI(messages, "gpt-6-astra", 0.7, 8000, "high", false, true);

    expect(result).toBe("a real answer");
    expect(calls[0].url).toBe("https://api.openai.com/v1/responses");
    expect(calls[0].body.model).toBe("gpt-6-astra");
    expect(calls[0].body.reasoning).toEqual({ effort: "high" });
    expect(calls[0].body).not.toHaveProperty("temperature");
    expect(calls[0].body.max_output_tokens).toBe(25000);
  });

  test.each(["none", "minimal"])("maps unsupported effort '%s' to 'low'", async (effort) => {
    mockFetch(succeed);

    await callOpenAI(messages, "gpt-6-astra", 0.7, 8000, effort, false, true);

    expect(calls[0].body.reasoning).toEqual({ effort: "low" });
    // Still a reasoning call, so the 25k output floor applies
    expect(calls[0].body.max_output_tokens).toBe(25000);
  });

  test("keeps 'none' for GPT-5.6 tiers that accept it", async () => {
    mockFetch(succeed);

    await callOpenAI(messages, "gpt-5.6-sol", 0.7, 8000, "none", false, true);

    expect(calls[0].body.reasoning).toEqual({ effort: "none" });
  });

  test("falls back to gpt-6.1-sol when Astra is unavailable to the org", async () => {
    mockFetch((body) =>
      body.model === "gpt-6-astra"
        ? { status: 403, json: { error: { message: "insufficient permissions for this model" } } }
        : succeed(body),
    );

    const result = await callOpenAI(messages, "gpt-6-astra", 0.7, 8000, "none", false, true);

    expect(result).toBe("a real answer");
    expect(calls.map((c) => c.body.model)).toEqual(["gpt-6-astra", "gpt-6.1-sol"]);
    // Effort is normalised per attempt: gpt-6.1-sol shares Astra's effort floor, so "none" runs as "low"
    expect(calls[1].body.reasoning).toEqual({ effort: "low" });
  });
});
