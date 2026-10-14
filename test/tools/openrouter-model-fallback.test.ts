/**
 * callOpenRouter — MODEL_FALLBACKS trigger.
 *
 * BUG (found in Codex review 2026-10-14): the configured fallbacks (K3 -> K2.7-Code,
 * DeepSeek V4 Pro -> V4.1 Flash, GLM 5.3 -> 5.2, StepFun 5 Preview -> 3.7 Flash …)
 * fired ONLY on Alibaba's "FreeTierOnly" error, so a retired/preview model's 404 or a
 * 429 returned an error with its fallback unused. The one hop also dropped options
 * (reasoning_effort) by passing a bare `true`.
 */

import { jest } from "@jest/globals";

if (!process.env.OPENROUTER_API_KEY) {
  process.env.OPENROUTER_API_KEY = "fallback-fake-key";
}

const { callOpenRouter, OpenRouterModel } = await import("../../src/tools/openrouter-tools.js");
const { isProviderFailure } = await import("../../src/utils/provider-failure.js");

let bodies: any[];

function mockStatuses(...steps: Array<{ status: number; text?: string }>) {
  bodies = [];
  let i = 0;
  global.fetch = jest.fn(async (_url: any, init?: any) => {
    bodies.push(JSON.parse(init?.body ?? "{}"));
    const s = steps[Math.min(i++, steps.length - 1)];
    const ok = s.status >= 200 && s.status < 300;
    return {
      ok,
      status: s.status,
      statusText: String(s.status),
      json: async () => ({ choices: [{ message: { content: "fallback answer" }, finish_reason: "stop" }] }),
      text: async () => s.text ?? "",
    };
  }) as any;
}

const msgs = [{ role: "user", content: "q" }];

describe("callOpenRouter model fallback", () => {
  test.each([404, 429, 503])("HTTP %i hops once to the configured fallback, keeping options", async (status) => {
    mockStatuses({ status }, { status: 200 });

    const out = await callOpenRouter(msgs, OpenRouterModel.STEPFUN_5_PREVIEW, 0.3, 8000, { reasoning_effort: "medium" });

    expect(out).toContain("fallback answer");
    expect(bodies.map((b) => b.model)).toEqual(["stepfun/step-5-preview", "stepfun/step-3.7-flash"]);
    expect(bodies[1].reasoning_effort).toBe("medium");
    expect(bodies[1]).not.toHaveProperty("__retry");
  });

  test("'No endpoints found' text triggers the fallback whatever the status", async () => {
    mockStatuses({ status: 400, text: '{"error":{"message":"No endpoints found for x"}}' }, { status: 200 });

    await callOpenRouter(msgs, OpenRouterModel.GLM_5_3, 0.3, 8000);

    expect(bodies.map((b) => b.model)).toEqual(["z-ai/glm-5.3", "z-ai/glm-5.2"]);
  });

  test("auth/billing errors do not fall back (another model won't fix them)", async () => {
    mockStatuses({ status: 401, text: "bad key" });

    const out = await callOpenRouter(msgs, OpenRouterModel.STEPFUN_5_PREVIEW, 0.3, 8000);

    expect(bodies).toHaveLength(1);
    expect(isProviderFailure(out)).toBe(true);
  });

  test("the fallback is a single hop — it never chains", async () => {
    mockStatuses({ status: 404 }, { status: 404 });

    const out = await callOpenRouter(msgs, OpenRouterModel.STEPFUN_5_PREVIEW, 0.3, 8000);

    expect(bodies).toHaveLength(2);
    expect(isProviderFailure(out)).toBe(true);
  });
});

describe("fallback disclosure + opt-out (TACHI_MODEL_FALLBACK)", () => {
  afterEach(() => { delete process.env.TACHI_MODEL_FALLBACK; });

  test("a fallback answer says which model answered and why", async () => {
    mockStatuses({ status: 404 }, { status: 200 });

    const out = await callOpenRouter(msgs, OpenRouterModel.STEPFUN_5_PREVIEW, 0.3, 8000);

    expect(out.startsWith("[degraded: stepfun/step-5-preview unavailable — model not available")).toBe(true);
    expect(out).toContain("answered by stepfun/step-3.7-flash]");
    expect(out).toContain("fallback answer");
    expect(isProviderFailure(out)).toBe(false); // the banner is a success, not an error
  });

  test("TACHI_MODEL_FALLBACK=off returns the original error, no hop", async () => {
    process.env.TACHI_MODEL_FALLBACK = "off";
    mockStatuses({ status: 404, text: "gone" }, { status: 200 });

    const out = await callOpenRouter(msgs, OpenRouterModel.STEPFUN_5_PREVIEW, 0.3, 8000);

    expect(bodies).toHaveLength(1);
    expect(isProviderFailure(out)).toBe(true);
    expect(out).toContain("model not available");
  });

  test("402 out of credits never falls back and says so", async () => {
    mockStatuses({ status: 402, text: '{"error":{"message":"Insufficient credits"}}' }, { status: 200 });

    const out = await callOpenRouter(msgs, OpenRouterModel.KIMI_K3, 0.3, 8000);

    expect(bodies).toHaveLength(1);
    expect(out).toContain("out of credits");
  });
});

describe("isProviderFailure", () => {
  test("treats the reasoning-budget 'incomplete' marker as a failure (jury drops the juror)", () => {
    expect(
      isProviderFailure("[OpenRouter incomplete: deepseek/deepseek-v4-pro spent the whole 32000-token budget on reasoning and returned no answer]"),
    ).toBe(true);
  });
});
