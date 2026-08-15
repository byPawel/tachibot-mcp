/**
 * grok_search grounding tests — regression guard for the "search that never searched" bug.
 *
 * HISTORY (2026-08-14): grok_search was pinned to grok-4.5, and grok-4.5 does NOT
 * invoke the web_search tool on xAI's Agent Tools API (/v1/responses). The tool
 * returned ungrounded training-data answers ("today" off by 10 months) while still
 * rendering a source footer and a cost line implying search happened. grok-4.6
 * verifiably searches (web_search_call entries + url_citation annotations).
 *
 * TESTING PRINCIPLE — assert the MECHANISM (did it search), never the OUTCOME
 * (is the answer correct). A plausible ungrounded answer is exactly what hid
 * this bug: the model "knew" enough to sound right. So we check for
 * web_search_call output entries and url_citation annotations, and deliberately
 * never assert anything about the answer text itself.
 *
 * Two layers:
 *  1. Keyless wiring guard (always runs, mocked fetch): grokSearchTool must send
 *     the pinned search model (CURRENT_MODELS.grok.search) to /v1/responses with
 *     a web_search tool declared. Catches pin drift without network or keys.
 *  2. Live grounding probe (EXPLICIT OPT-IN: set RUN_LIVE_TESTS=1 AND have a
 *     real GROK_API_KEY / XAI_API_KEY): the pinned model must actually invoke
 *     web_search. Catches the grok-4.5 failure mode, which is invisible at the
 *     request level. Opt-in because it fires a real BILLED web search with a
 *     180s timeout — a key in .env alone must not make every local `npm test`
 *     cost money and depend on the network. Run it with:
 *       RUN_LIVE_TESTS=1 npm test -- grok-search-grounding
 */

import { jest } from "@jest/globals";
import { config } from "dotenv";

// Capture the NATIVE fetch before jest.setup.ts's beforeEach replaces it with a
// mock — the live probe below needs the real network.
const nativeFetch = global.fetch;

// Load the repo .env so a local run with keys exercises the live probe.
// (dotenv never overrides vars already in the environment.)
config({ path: new URL("../../.env", import.meta.url).pathname });

// Snapshot the REAL key before we inject a fake one for the wiring guard.
const REAL_GROK_KEY = process.env.GROK_API_KEY || process.env.XAI_API_KEY;

// grok-enhanced.ts captures the API key into a module-level const at import
// time, so a fake key must be in place BEFORE the dynamic import below.
if (!REAL_GROK_KEY) {
  process.env.XAI_API_KEY = "wiring-guard-fake-key";
}

const { grokSearchTool, GrokModel } = await import(
  "../../src/tools/grok-enhanced.js"
);
const { CURRENT_MODELS } = await import("../../src/config/model-constants.js");

const fakeCtx = {
  log: {
    info: (..._args: unknown[]) => {},
    warn: (..._args: unknown[]) => {},
    error: (..._args: unknown[]) => {},
  },
  reportProgress: async (_p: { progress: number; total: number }) => {},
};

// Canned /v1/responses payload shaped like a real grounded answer.
const cannedResponsesPayload = {
  output: [
    { type: "web_search_call", id: "ws_1", status: "completed" },
    {
      type: "message",
      content: [
        {
          type: "output_text",
          text: "Canned grounded answer.",
          annotations: [
            {
              type: "url_citation",
              url: "https://example.com/a",
              title: "Example A",
            },
          ],
        },
      ],
    },
  ],
  usage: { input_tokens: 10, output_tokens: 20 },
};

describe("grok_search wiring guard (no network, no real key needed)", () => {
  it("pins search to a single model in both model-constants and the GrokModel enum", () => {
    // Two places pin the search model: CURRENT_MODELS.grok.search and the
    // GrokModel enum member grok-enhanced.ts hardcodes. If someone bumps one
    // without the other, the live probe below may test the wrong model.
    expect(CURRENT_MODELS.grok.search).toBe(GrokModel.GROK_4_6);
  });

  it("sends the pinned search model to /v1/responses with web_search declared", async () => {
    const captured: { url?: string; body?: any } = {};

    global.fetch = jest.fn(async (url: string | URL | Request, init?: any) => {
      captured.url = url.toString();
      captured.body = JSON.parse(init?.body ?? "{}");
      return {
        ok: true,
        status: 200,
        json: async () => cannedResponsesPayload,
      } as Response;
    }) as typeof fetch;

    const result = await grokSearchTool.execute(
      { query: "wiring guard probe" },
      fakeCtx,
    );

    expect(captured.url).toContain("/v1/responses");
    expect(captured.body.model).toBe(CURRENT_MODELS.grok.search);
    const toolTypes = (captured.body.tools ?? []).map((t: any) => t.type);
    expect(toolTypes).toContain("web_search");
    // Citations parsed from annotations surface in the rendered footer
    expect(result).toContain("Sources:");
  });
});

// Live probe — needs BOTH a real key AND the explicit RUN_LIVE_TESTS=1 opt-in
// (see header). Everything else stays green via describe.skip.
const describeLive =
  REAL_GROK_KEY && process.env.RUN_LIVE_TESTS === "1" ? describe : describe.skip;

describeLive("grok_search grounding (LIVE network — costs one real API call)", () => {
  it(
    "the pinned search model actually invokes web_search and returns citations",
    async () => {
      // Restore real fetch (jest.setup.ts's beforeEach installed a mock).
      global.fetch = nativeFetch;

      // The exact request shape callGrokEnhanced sends on the search path.
      const response = await nativeFetch("https://api.x.ai/v1/responses", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${REAL_GROK_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: CURRENT_MODELS.grok.search,
          input: [
            {
              role: "user",
              content: "What is today's date? Search the web to confirm.",
            },
          ],
          tools: [{ type: "web_search" }, { type: "x_search" }],
          temperature: 0.3,
          max_output_tokens: 1000,
        }),
      });

      expect(response.ok).toBe(true);
      const data = (await response.json()) as any;

      // MECHANISM assertion 1: the model actually ran at least one web search.
      // grok-4.5 returns zero web_search_call entries here — that is the bug.
      const searchCalls = (data.output ?? []).filter(
        (o: any) => o.type === "web_search_call",
      );
      expect(searchCalls.length).toBeGreaterThanOrEqual(1);

      // MECHANISM assertion 2: the answer carries at least one citation.
      const message = (data.output ?? []).find((o: any) => o.type === "message");
      const citations = (message?.content ?? []).flatMap((c: any) =>
        (c.annotations ?? []).filter((a: any) => a.type === "url_citation"),
      );
      expect(citations.length).toBeGreaterThanOrEqual(1);

      // Deliberately NO assertion on the answer text — outcome checks pass on
      // plausible ungrounded answers and would hide exactly this bug again.
    },
    180_000,
  );

  // grok_search_lite runs a different, cheaper model than grok_search, so the
  // probe above says nothing about it. That gap let a false claim stand in the
  // v2.30.0 notes — "grok-4.3 does not invoke web search either" — which would
  // have justified deleting a tool that works. Re-probed 2026-08-15: grok-4.3
  // returned 2 web_search_call entries and 1 citation. Assert it, don't assume.
  it(
    "the cheap search tier also invokes web_search and returns citations",
    async () => {
      global.fetch = nativeFetch;

      const response = await nativeFetch("https://api.x.ai/v1/responses", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${REAL_GROK_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: GrokModel.GROK_4_3,
          input: [
            {
              role: "user",
              content: "What is today's date? Search the web to confirm.",
            },
          ],
          tools: [{ type: "web_search" }, { type: "x_search" }],
          temperature: 0.3,
          max_output_tokens: 1000,
        }),
      });

      expect(response.ok).toBe(true);
      const data = (await response.json()) as any;

      // Guards the silent-substitution failure mode that hid the grok-4-1-fast
      // retirement: xAI returns HTTP 200 and discloses the swap only here.
      expect(data.model).toBe(GrokModel.GROK_4_3);

      const searchCalls = (data.output ?? []).filter(
        (o: any) => o.type === "web_search_call",
      );
      expect(searchCalls.length).toBeGreaterThanOrEqual(1);

      const message = (data.output ?? []).find((o: any) => o.type === "message");
      const citations = (message?.content ?? []).flatMap((c: any) =>
        (c.annotations ?? []).filter((a: any) => a.type === "url_citation"),
      );
      expect(citations.length).toBeGreaterThanOrEqual(1);
    },
    180_000,
  );
});
