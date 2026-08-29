/**
 * grok_search /v1/responses multi-message extraction tests.
 *
 * BUG (same family as the OpenAI incomplete-response fix): agentic search
 * runs interleave SEVERAL "message" items with web_search_call entries —
 * a preamble ("I'll search official docs…"), the server-side searches,
 * then the actual answer as a LATER message. callGrokEnhanced used
 * .find(o => o.type === "message"), which returns the FIRST message, so
 * any run where grok-4.6 narrated a plan returned the plan and silently
 * dropped the answer (observed 3x on 2026-08-29; lite worked because the
 * cheaper model skips the preamble).
 *
 * Seam: stub global.fetch and assert on the extracted content/sources.
 */

import { jest } from "@jest/globals";

// Key is captured into a module-level const at import time — set BEFORE import.
if (!process.env.GROK_API_KEY && !process.env.XAI_API_KEY) {
  process.env.XAI_API_KEY = "grok-multi-message-fake-key";
}

const { callGrokEnhanced } = await import("../../src/tools/grok-enhanced.js");

const messages = [{ role: "user", content: "test question" }];

const multiMessageBody = {
  id: "resp_1",
  status: "completed",
  output: [
    { type: "reasoning", id: "r1" },
    {
      type: "message",
      id: "m1",
      content: [
        { type: "output_text", text: "I'll search the official docs for this.", annotations: [] },
      ],
    },
    { type: "web_search_call", id: "ws1", status: "completed" },
    { type: "web_search_call", id: "ws2", status: "completed" },
    {
      type: "message",
      id: "m2",
      content: [
        {
          type: "output_text",
          text: "FINAL ANSWER: the docs confirm X.",
          annotations: [
            { type: "url_citation", url: "https://example.com/doc", title: "The Doc" },
          ],
        },
      ],
    },
  ],
  usage: { input_tokens: 10, output_tokens: 50 },
};

const reasoningOnlyBody = {
  id: "resp_2",
  status: "incomplete",
  incomplete_details: { reason: "max_output_tokens" },
  output: [{ type: "reasoning", id: "r2" }],
  usage: { input_tokens: 10, output_tokens: 4000 },
};

function mockFetchReturning(body: unknown) {
  global.fetch = jest.fn(async () => ({
    ok: true,
    status: 200,
    statusText: "OK",
    json: async () => body,
    text: async () => JSON.stringify(body),
  })) as unknown as typeof fetch;
}

describe("callGrokEnhanced /v1/responses extraction", () => {
  test("returns the final answer when a preamble message precedes it", async () => {
    mockFetchReturning(multiMessageBody);

    const result = await callGrokEnhanced(messages, { enableLiveSearch: true });

    expect(result.content).toContain("FINAL ANSWER: the docs confirm X.");
    // Citations live on the LATER message's annotations — must be collected.
    expect(result.sources).toEqual([
      { url: "https://example.com/doc", title: "The Doc" },
    ]);
  });

  test("reasoning-only output surfaces an error, not a fake success", async () => {
    mockFetchReturning(reasoningOnlyBody);

    const result = await callGrokEnhanced(messages, { enableLiveSearch: true });

    expect(result.content).not.toBe("No response from Grok");
    expect(result.content).toContain("[Grok error:");
    expect(result.content).toContain("max_output_tokens");
  });
});
