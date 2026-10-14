/**
 * callOpenRouter — reasoning-budget exhaustion.
 *
 * BUG (verified live 2026-09-29): deepseek_reason/deepseek_algo send max_tokens 8000.
 * DeepSeek V4 Pro spent all 8000 on reasoning (finish_reason "length", empty
 * content, reasoning_tokens 8000), and callOpenRouter fell through to
 * `message.reasoning`, returning the half-finished chain of thought as if it were
 * the answer. The caller saw "reasoning that got cut off".
 *
 * Contract: an empty-content "length" stop retries ONCE with a larger budget. If
 * that is still empty, return an explicit [OpenRouter incomplete: …] marker, never
 * the raw reasoning. A non-empty answer cut by "length" gets a truncation note.
 */

import { jest } from "@jest/globals";

if (!process.env.OPENROUTER_API_KEY) {
  process.env.OPENROUTER_API_KEY = "truncation-fake-key";
}

const { callOpenRouter, OpenRouterModel } = await import("../../src/tools/openrouter-tools.js");

type Reply = { content?: string; reasoning?: string; finish: string };
let bodies: any[];

function mockReplies(...replies: Reply[]) {
  bodies = [];
  let i = 0;
  global.fetch = jest.fn(async (_url: any, init?: any) => {
    bodies.push(JSON.parse(init?.body ?? "{}"));
    const r = replies[Math.min(i++, replies.length - 1)];
    return {
      ok: true,
      json: async () => ({
        choices: [{ message: { content: r.content ?? "", reasoning: r.reasoning }, finish_reason: r.finish }],
      }),
      text: async () => "",
    };
  }) as any;
}

const msgs = [{ role: "user", content: "hard problem" }];

describe("callOpenRouter reasoning-budget exhaustion", () => {
  test("empty answer + length: retries once with a larger budget and returns the answer", async () => {
    mockReplies(
      { content: "", reasoning: "half a thought", finish: "length" },
      { content: "the real answer", reasoning: "full thought", finish: "stop" },
    );
    const out = await callOpenRouter(msgs, OpenRouterModel.DEEPSEEK_V4_PRO, 0.3, 8000);
    expect(out).toBe("the real answer");
    expect(bodies.map((b) => b.max_tokens)).toEqual([8000, 32000]);
    expect(bodies[1].model).toBe(OpenRouterModel.DEEPSEEK_V4_PRO);
  });

  test("still empty after retry: explicit incomplete marker, never the raw reasoning", async () => {
    mockReplies({ content: "", reasoning: "half a thought", finish: "length" });
    const out = await callOpenRouter(msgs, OpenRouterModel.DEEPSEEK_V4_PRO, 0.3, 8000);
    expect(out).toMatch(/^\[OpenRouter incomplete:/);
    expect(out).toContain("32000");
    expect(out).not.toContain("half a thought");
    expect(bodies).toHaveLength(2);
  });

  test("non-empty answer cut by length: keeps the text and flags truncation", async () => {
    mockReplies({ content: "partial answer", finish: "length" });
    const out = await callOpenRouter(msgs, OpenRouterModel.GLM_5_3, 0.3, 8000);
    expect(out).toContain("partial answer");
    expect(out).toContain("[truncated: hit max_tokens=8000]");
    expect(bodies).toHaveLength(1);
  });

  test("retry keeps the caller's reasoning_effort", async () => {
    mockReplies(
      { content: "", finish: "length" },
      { content: "ok", finish: "stop" },
    );
    await callOpenRouter(msgs, OpenRouterModel.QWEN3_8_MAX, 0.3, 12000, { reasoning_effort: "medium" });
    expect(bodies[1].reasoning_effort).toBe("medium");
    expect(bodies[1].max_tokens).toBe(36000);
  });

  test("normal stop is untouched", async () => {
    mockReplies({ content: "fine", finish: "stop" });
    expect(await callOpenRouter(msgs, OpenRouterModel.GLM_5_3, 0.3, 8000)).toBe("fine");
  });
});
