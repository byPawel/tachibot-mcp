/**
 * Gemini Tools Smoke Test — Pilot Gate (Task 1.3)
 *
 * Verifies that migrated gemini tools EXECUTE correctly without network calls.
 *
 * Seam: `callGemini` (defined in gemini-tools.ts) calls `global.fetch` directly
 * against `generativelanguage.googleapis.com`. We override `global.fetch` to
 * return a canned Gemini-shaped response (same pattern as local-tools.test.ts).
 *
 * ESM key-capture issue: `GEMINI_API_KEY` is a module-level `const` in
 * gemini-tools.ts. In Jest ESM (--experimental-vm-modules), static imports are
 * evaluated before the test file's top-level code runs, so setting
 * `process.env.GOOGLE_API_KEY` before the `import` statement does not help.
 *
 * Solution: use `jest.unstable_mockModule` on `openrouter-gateway` (so
 * `isGatewayEnabled()` returns false) combined with a dynamic `import()` of
 * `gemini-tools.js` AFTER we have set `process.env.GOOGLE_API_KEY`.  With
 * `unstable_mockModule` + dynamic import the module is evaluated lazily, after
 * the env var is in place, so `GEMINI_API_KEY` is populated correctly.
 */

import { jest } from "@jest/globals";

// Set env var BEFORE the dynamic import below loads gemini-tools.ts.
process.env.GOOGLE_API_KEY = "smoke-test-fake-key";

// Register mock for openrouter-gateway BEFORE dynamic import.
// Use absolute path — Jest ESM resolves unstable_mockModule paths from the
// project root when given an absolute path, avoiding setup-file confusion.
const GATEWAY_MODULE = new URL(
  "../../src/utils/openrouter-gateway.ts",
  import.meta.url
).pathname;

jest.unstable_mockModule(GATEWAY_MODULE, () => ({
  isGatewayEnabled: () => false,
  tryOpenRouterGateway: async () => null,
}));

// Lazy import — evaluated AFTER env var + mock are in place.
const { geminiBrainstormTool } = await import(
  "../../src/tools/gemini-tools.js"
);

// ---------------------------------------------------------------------------
// Fake context — minimal shape that geminiBrainstormTool.execute() uses
// ---------------------------------------------------------------------------
const fakeCtx = {
  log: {
    info: (..._args: unknown[]) => {},
    warn: (..._args: unknown[]) => {},
    error: (..._args: unknown[]) => {},
  },
  reportProgress: async (_p: { progress: number; total: number }) => {},
};

// Canned Gemini API response — shaped exactly as callGemini() expects
const GEMINI_TEXT = "Cluster A: High-value ideas (score 9). Cluster B: Quick wins (score 7).";

const cannedGeminiResponse = {
  candidates: [
    {
      content: {
        parts: [{ text: GEMINI_TEXT }],
        role: "model",
      },
      finishReason: "STOP",
    },
  ],
  usageMetadata: {
    promptTokenCount: 10,
    candidatesTokenCount: 20,
    totalTokenCount: 30,
  },
};

describe("gemini smoke — geminiBrainstormTool.execute (pilot gate)", () => {
  beforeEach(() => {
    // Install a tight fetch mock that returns the canned Gemini payload.
    // Overrides the global mock from jest.setup.ts.
    global.fetch = jest.fn(async (url: string | URL | Request) => {
      const urlStr = url.toString();
      expect(urlStr).toContain("generativelanguage.googleapis.com");
      return {
        ok: true,
        status: 200,
        json: async () => cannedGeminiResponse,
      } as Response;
    }) as typeof fetch;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("returns a non-empty string", async () => {
    const result = await geminiBrainstormTool.execute(
      { prompt: "brainstorm ideas for a new product", maxClusters: 2 },
      fakeCtx,
    );

    expect(typeof result).toBe("string");
    expect((result as string).length).toBeGreaterThan(0);
  });

  it("result incorporates the mocked Gemini text (possibly stripped of markdown)", async () => {
    const result = await geminiBrainstormTool.execute(
      { prompt: "brainstorm ideas for a new product", maxClusters: 2 },
      fakeCtx,
    );

    // stripFormatting() removes **bold** / *italic* but keeps plain text.
    // GEMINI_TEXT has no markdown, so it should survive unchanged.
    expect(result as string).toContain("Cluster A");
    expect(result as string).toContain("Cluster B");
  });

  it("fetch was called exactly once per execute() invocation", async () => {
    await geminiBrainstormTool.execute(
      { prompt: "smoke test ping", maxClusters: 1 },
      fakeCtx,
    );

    // One network call to Gemini — no retries, no gateway
    expect((global.fetch as jest.Mock).mock.calls).toHaveLength(1);
  });
});
