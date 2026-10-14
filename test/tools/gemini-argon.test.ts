/**
 * Gemini 4 Argon routing tests.
 *
 * Argon (GA Oct 13, 2026) is the Pro-tier default, switchable without a code
 * change via TACHI_GEMINI_PRO_MODEL. Its intro price doubles on Dec 1, 2026,
 * so rolling back to gemini-3.1-pro-preview must be a one-line env edit.
 *
 * MECHANISM assertions on the captured request URL/body, never on model output.
 */

import { jest } from "@jest/globals";

// Key is captured into a module-level const at import time — set BEFORE import.
if (!process.env.GOOGLE_API_KEY && !process.env.GEMINI_API_KEY) {
  process.env.GOOGLE_API_KEY = "argon-fake-key";
}

const GATEWAY_MODULE = new URL(
  "../../src/utils/openrouter-gateway.ts",
  import.meta.url,
).pathname;

jest.unstable_mockModule(GATEWAY_MODULE, () => ({
  isGatewayEnabled: () => false,
  tryOpenRouterGateway: async () => null,
}));

const { callGemini } = await import("../../src/tools/gemini-tools.js");
const { GEMINI_MODELS, CURRENT_MODELS, getGeminiProModel } = await import(
  "../../src/config/model-constants.js"
);

const okBody = {
  candidates: [{ content: { parts: [{ text: "a real answer" }] }, finishReason: "STOP" }],
  usageMetadata: { promptTokenCount: 5, candidatesTokenCount: 3, totalTokenCount: 8 },
};

let calls: Array<{ model: string; body: any }> = [];

function mockFetch(handler: (model: string) => { status: number; json: any }) {
  calls = [];
  global.fetch = jest.fn(async (url: string | URL | Request, init?: any) => {
    const model = /models\/([^:]+):/.exec(url.toString())?.[1] ?? "";
    calls.push({ model, body: JSON.parse(init?.body ?? "{}") });
    const { status, json } = handler(model);
    return {
      ok: status >= 200 && status < 300,
      status,
      statusText: String(status),
      json: async () => json,
      text: async () => JSON.stringify(json),
    } as Response;
  }) as typeof fetch;
}

const ORIGINAL = process.env.TACHI_GEMINI_PRO_MODEL;
afterEach(() => {
  if (ORIGINAL === undefined) delete process.env.TACHI_GEMINI_PRO_MODEL;
  else process.env.TACHI_GEMINI_PRO_MODEL = ORIGINAL;
});

describe("Gemini Pro model switch", () => {
  test("defaults to gemini-4-argon", () => {
    delete process.env.TACHI_GEMINI_PRO_MODEL;
    expect(getGeminiProModel()).toBe("gemini-4-argon");
    expect(GEMINI_MODELS.PRO).toBe("gemini-4-argon");
    expect(GEMINI_MODELS.GEMINI_3_PRO).toBe("gemini-4-argon");
    expect(CURRENT_MODELS.gemini.default).toBe("gemini-4-argon");
  });

  test("TACHI_GEMINI_PRO_MODEL is read at call time, not import time", () => {
    process.env.TACHI_GEMINI_PRO_MODEL = "gemini-3.1-pro-preview";
    expect(GEMINI_MODELS.PRO).toBe("gemini-3.1-pro-preview");
    expect(GEMINI_MODELS.GEMINI_3_PRO).toBe("gemini-3.1-pro-preview");
    expect(CURRENT_MODELS.gemini.default).toBe("gemini-3.1-pro-preview");
  });

  test("callGemini's default model follows the override", async () => {
    process.env.TACHI_GEMINI_PRO_MODEL = "gemini-3.1-pro-preview";
    mockFetch(() => ({ status: 200, json: okBody }));

    await callGemini("hi");

    expect(calls[0].model).toBe("gemini-3.1-pro-preview");
  });
});

describe("Gemini 4 Argon", () => {
  test("clamps maxOutputTokens to Argon's 32K ceiling", async () => {
    mockFetch(() => ({ status: 200, json: okBody }));

    await callGemini("hi", "gemini-4-argon", undefined, 0.7, "llm-orchestration", 50000);

    expect(calls[0].model).toBe("gemini-4-argon");
    expect(calls[0].body.generationConfig.maxOutputTokens).toBe(32768);
  });

  test("falls back to gemini-3.1-pro-preview on a non-retryable Argon failure", async () => {
    mockFetch((model) =>
      model === "gemini-4-argon"
        ? { status: 404, json: { error: { code: 404, message: "models/gemini-4-argon is not found", status: "NOT_FOUND" } } }
        : { status: 200, json: okBody },
    );

    const result = await callGemini("hi", "gemini-4-argon");

    expect(calls.map((c) => c.model)).toEqual(["gemini-4-argon", "gemini-3.1-pro-preview"]);
    expect(result).toContain("a real answer");
  });
});
