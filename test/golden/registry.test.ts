/**
 * Registry unit test — guards the central tool scan introduced in Task 2.1.
 *
 * `src/tools/registry.ts#getAllTools()` is the single source of truth for WHICH
 * provider tools `server.ts` registers (via one `safeAddTool` loop). The
 * server-wide wire-contract golden (`tool-contracts.test.ts`) proves the EMITTED
 * payload is unchanged; this test pins the registry's own invariants directly:
 *
 *   1. With the golden env (all provider keys present, default profile), the
 *      returned set has UNIQUE names — no tool is double-collected.
 *   2. It INCLUDES representative provider tools from every guarded block
 *      (Perplexity / Grok / OpenAI / Gemini+jury / OpenRouter+planner / local /
 *      workflow-validators / advanced / tachi / prompt-technique).
 *   3. It EXCLUDES the 5 inline server-local tools
 *      (think / focus / nextThought / usage_stats / continue_focus) and the
 *      workflow-runner tools (registered directly onto FastMCP, not via the
 *      registry) — so the registry set and the inline/workflow sets are DISJOINT
 *      and `safeAddTool` never sees a duplicate.
 *   4. CONDITIONALITY: with a provider key absent, that provider's tools are
 *      absent — proving the registry evaluates the SAME is*Available() guards the
 *      server used to evaluate inline.
 *
 * Provider modules read API-key env into module-level consts AT IMPORT TIME, so
 * env MUST be set BEFORE the registry (and the tool modules it pulls in) is first
 * imported. We therefore set env, then dynamic-`import()` the registry inside each
 * scenario. The no-key scenario calls `jest.resetModules()` first so its
 * missing-key import is re-evaluated from scratch and not served the all-keys
 * module instance cached during scenario (1).
 */

import { jest } from "@jest/globals";
import { setupGoldenEnv } from "./emit-schema.js";

// Tools that are registered inline in server.ts (close over server-local
// singletons) and MUST NOT be returned by the registry.
const INLINE_TOOL_NAMES = [
  "think",
  "focus",
  "nextThought",
  "usage_stats",
  "continue_focus",
];

// A representative tool from each guarded provider block — proves inclusion.
const EXPECTED_PROVIDER_TOOLS = [
  "perplexity_ask", // Perplexity (isPerplexityAvailable)
  "grok_search", // Grok (isGrokAvailable)
  "openai_reason", // OpenAI (isOpenAIAvailable)
  "gemini_search", // Gemini async block (isGeminiAvailable)
  "jury", // Jury, gated on Gemini
  "qwen_coder", // OpenRouter (isOpenRouterAvailable)
  "planner_maker", // Planner, gated on OpenRouter
  "local_query", // Local models (unconditional)
  "validate_workflow", // Workflow validator (unconditional)
  "tachi", // Tachi (unconditional)
  "list_prompt_techniques", // Prompt-technique (unconditional)
];

describe("central tool registry (getAllTools)", () => {
  describe("with all provider keys present (golden env)", () => {
    let names: string[];

    beforeAll(async () => {
      setupGoldenEnv();
      const { getAllTools } = await import("../../src/tools/registry.js");
      const tools = await getAllTools();
      names = tools.map((t) => t.name);
    });

    it("returns tools with UNIQUE names (no duplicates)", () => {
      expect(new Set(names).size).toBe(names.length);
    });

    it("includes representative provider tools from every guarded block", () => {
      for (const name of EXPECTED_PROVIDER_TOOLS) {
        expect(names).toContain(name);
      }
    });

    it("EXCLUDES the 5 inline server-local tools", () => {
      for (const name of INLINE_TOOL_NAMES) {
        expect(names).not.toContain(name);
      }
    });

    it("EXCLUDES workflow-runner tools (registered directly onto FastMCP)", () => {
      // workflow-runner registers these via server.addTool, not via the registry.
      expect(names).not.toContain("workflow");
      expect(names).not.toContain("workflow_start");
      expect(names).not.toContain("list_workflows");
    });

    it("respects the inlineTools argument by prepending them in order", async () => {
      const { getAllTools } = await import("../../src/tools/registry.js");
      const fakeInline = [
        {
          name: "think",
          description: "inline",
          parameters: { _def: {} } as never,
          execute: async () => "ok",
        },
      ];
      const withInline = await getAllTools(fakeInline);
      expect(withInline[0]?.name).toBe("think");
      // Provider tools still present after the injected inline tool.
      expect(withInline.map((t) => t.name)).toContain("perplexity_ask");
    });
  });

  describe("conditionality — a provider key absent drops only that provider", () => {
    it("omits Grok tools when the Grok key is absent", async () => {
      // Re-evaluate provider modules from scratch so isGrokAvailable() re-reads
      // env with the key removed (modules read keys at import time).
      jest.resetModules();
      setupGoldenEnv();
      // Remove BOTH env vars that feed isGrokAvailable() (XAI_API_KEY || GROK_API_KEY).
      delete process.env.XAI_API_KEY;
      delete process.env.GROK_API_KEY;

      const { getAllTools } = await import("../../src/tools/registry.js");
      const names = (await getAllTools()).map((t) => t.name);

      // Grok-specific tools gone…
      expect(names).not.toContain("grok_search");
      expect(names).not.toContain("grok_reason");
      // …while other providers are unaffected (proves it's surgical, not total).
      expect(names).toContain("perplexity_ask");
      expect(names).toContain("local_query");
    });
  });
});
