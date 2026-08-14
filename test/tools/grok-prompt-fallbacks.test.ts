/**
 * grok_reason / grok_code prompt-fallback tests.
 *
 * BUG CLASS (same as commit 7928d9e for openai tools): a prompt map indexed
 * with a free-form string and NO `||` fallback interpolates the literal
 * string "undefined" into the system prompt for any out-of-set value.
 * `approach` and `task` are unconstrained z.string() fields, so LLM callers
 * routinely send values outside the map's keys.
 *
 * Seam: mock the OpenRouter gateway off and capture the direct-API fetch
 * body, then assert on the system prompt actually sent (mechanism, not
 * model output). Same pattern as test/smoke/gemini.smoke.test.ts.
 */

import { jest } from "@jest/globals";

// Key is captured into a module-level const at import time — set BEFORE import.
if (!process.env.GROK_API_KEY && !process.env.XAI_API_KEY) {
  process.env.XAI_API_KEY = "prompt-fallback-fake-key";
}

const GATEWAY_MODULE = new URL(
  "../../src/utils/openrouter-gateway.ts",
  import.meta.url,
).pathname;

jest.unstable_mockModule(GATEWAY_MODULE, () => ({
  isGatewayEnabled: () => false,
  tryOpenRouterGateway: async () => null,
}));

const { grokReasonTool, grokCodeTool } = await import(
  "../../src/tools/grok-tools.js"
);

const fakeCtx = {
  log: {
    info: (..._args: unknown[]) => {},
    warn: (..._args: unknown[]) => {},
    error: (..._args: unknown[]) => {},
  },
  reportProgress: async (_p: { progress: number; total: number }) => {},
};

const cannedGrokResponse = {
  choices: [
    { message: { content: "canned grok reply", role: "assistant" }, finish_reason: "stop" },
  ],
  usage: { prompt_tokens: 5, completion_tokens: 5, total_tokens: 10 },
};

let capturedSystemPrompt: string;

beforeEach(() => {
  capturedSystemPrompt = "";
  global.fetch = jest.fn(async (_url: string | URL | Request, init?: any) => {
    const body = JSON.parse(init?.body ?? "{}");
    capturedSystemPrompt =
      (body.messages ?? []).find((m: any) => m.role === "system")?.content ?? "";
    return {
      ok: true,
      status: 200,
      json: async () => cannedGrokResponse,
    } as Response;
  }) as typeof fetch;
});

describe("grok_reason approach prompt fallback", () => {
  it("unknown approach never injects the literal 'undefined'", async () => {
    await grokReasonTool.execute(
      { problem: "probe problem", approach: "zen-koan" },
      fakeCtx,
    );
    expect(capturedSystemPrompt.length).toBeGreaterThan(0);
    expect(capturedSystemPrompt).not.toContain("undefined");
    // Falls back to the first-principles prompt, matching the schema default
    expect(capturedSystemPrompt).toContain("fundamental truths");
  });

  it("known approach still selects its own prompt", async () => {
    await grokReasonTool.execute(
      { problem: "probe problem", approach: "creative" },
      fakeCtx,
    );
    expect(capturedSystemPrompt).toContain("outside the box");
    expect(capturedSystemPrompt).not.toContain("undefined");
  });
});

describe("grok_code task prompt fallback", () => {
  it("unknown task never injects the literal 'undefined'", async () => {
    await grokCodeTool.execute(
      { task: "transmogrify", code: "const x = 1;" },
      fakeCtx,
    );
    expect(capturedSystemPrompt.length).toBeGreaterThan(0);
    expect(capturedSystemPrompt).not.toContain("undefined");
    // Falls back to the analyze prompt (the most general task)
    expect(capturedSystemPrompt).toContain("Analyze this code");
  });

  it("known task still selects its own prompt", async () => {
    await grokCodeTool.execute(
      { task: "refactor", code: "const x = 1;" },
      fakeCtx,
    );
    expect(capturedSystemPrompt).toContain("Refactor this code");
    expect(capturedSystemPrompt).not.toContain("undefined");
  });
});
