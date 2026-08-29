/**
 * callOpenAI empty-response handling tests.
 *
 * BUG: the Responses API returns HTTP 200 with status:"incomplete"
 * (incomplete_details.reason:"max_output_tokens") and a reasoning-only
 * output array — zero visible text — when the token budget is exhausted
 * during reasoning. callOpenAI treated that as SUCCESS and returned the
 * placeholder "No response from OpenAI" instead of surfacing an error or
 * trying a fallback. Docs also say max_output_tokens INCLUDES reasoning
 * tokens and recommend reserving at least 25k; our tools passed 4–8k.
 *
 * Seam: mock the OpenRouter gateway off and stub global.fetch, then assert
 * on the returned error text and the max_output_tokens actually sent.
 * Same pattern as test/tools/grok-prompt-fallbacks.test.ts.
 */

import { jest } from "@jest/globals";

// Key is captured into a module-level const at import time — set BEFORE import.
if (!process.env.OPENAI_API_KEY) {
  process.env.OPENAI_API_KEY = "empty-response-fake-key";
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

const messages = [{ role: "user", content: "test question" }];

const incompleteReasoningOnlyBody = {
  id: "resp_incomplete",
  object: "response",
  created_at: 1724900000,
  status: "incomplete",
  incomplete_details: { reason: "max_output_tokens" },
  model: "gpt-5.6-sol",
  output: [{ id: "rs_1", type: "reasoning", summary: [] }],
  usage: {
    input_tokens: 12,
    output_tokens: 8000,
    output_tokens_details: { reasoning_tokens: 8000 },
    total_tokens: 8012,
  },
};

const completedBody = {
  id: "resp_ok",
  object: "response",
  created_at: 1724900000,
  status: "completed",
  model: "gpt-5.6-sol",
  output: [
    { id: "rs_2", type: "reasoning", summary: [] },
    {
      id: "msg_1",
      type: "message",
      status: "completed",
      role: "assistant",
      content: [{ type: "output_text", text: "a real answer", annotations: [] }],
    },
  ],
  usage: { input_tokens: 12, output_tokens: 40, total_tokens: 52 },
};

let capturedBodies: any[];

function mockFetchReturning(body: unknown) {
  capturedBodies = [];
  global.fetch = jest.fn(async (_url: string | URL | Request, init?: any) => {
    capturedBodies.push(JSON.parse(init?.body ?? "{}"));
    return {
      ok: true,
      status: 200,
      statusText: "OK",
      json: async () => body,
      text: async () => JSON.stringify(body),
    };
  }) as unknown as typeof fetch;
}

describe("callOpenAI incomplete/empty Responses API handling", () => {
  test("reasoning-only incomplete response surfaces an error, not a fake success", async () => {
    mockFetchReturning(incompleteReasoningOnlyBody);

    const result = await callOpenAI(
      messages,
      "gpt-5.6-sol",
      0.7,
      8000,
      "high",
      false,
      true, // skipValidation
    );

    expect(result).not.toContain("No response from OpenAI");
    expect(result).toContain("[OpenAI request failed");
    expect(result).toContain("max_output_tokens");
    // Every model in the fallback chain was attempted before giving up.
    expect(capturedBodies.length).toBeGreaterThan(1);
  });

  test("reasoning calls enforce the documented 25k max_output_tokens floor", async () => {
    mockFetchReturning(completedBody);

    const result = await callOpenAI(
      messages,
      "gpt-5.6-sol",
      0.7,
      8000,
      "high",
      false,
      true,
    );

    expect(result).toBe("a real answer");
    expect(capturedBodies[0].max_output_tokens).toBe(25000);
  });

  test("effort 'none' keeps the caller's max_output_tokens untouched", async () => {
    mockFetchReturning(completedBody);

    await callOpenAI(messages, "gpt-5.6-sol", 0.7, 8000, "none", false, true);

    expect(capturedBodies[0].max_output_tokens).toBe(8000);
  });
});
