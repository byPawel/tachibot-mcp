/**
 * tool-mapper qwen_algo / qwq_reason parity tests.
 *
 * BUG HISTORY (2026-08-14): tool-mapper's executeTool switch is a parallel
 * reimplementation with hand-written prompts, so it silently drifted from the
 * real MCP tools: the qwen_algo case ran QWQ-32B with a generic prompt while
 * the real qwen_algo tool runs Qwen3.8-Max (reasoning_effort=medium) with the
 * Principal Algorithm Engineer protocol; the qwq_reason case lost the
 * 4-persona (OPTIMIST/PESSIMIST/DOMAIN EXPERT/CONTRARIAN) protocol entirely.
 * Both cases now delegate to the real tool objects.
 *
 * MECHANISM assertions on the captured request body — which model is asked
 * and with which system prompt — never on model output.
 */

import { jest } from "@jest/globals";

// openrouter-tools captures the key at import time — set BEFORE the import.
// fetch is mocked below, so no real call is ever made with this value.
if (!process.env.OPENROUTER_API_KEY) {
  process.env.OPENROUTER_API_KEY = "tool-mapper-fake-key";
}

const { executeWorkflowTool } = await import(
  "../../src/workflows/tool-mapper.js"
);

const cannedOpenRouterResponse = {
  choices: [
    { message: { content: "canned openrouter reply", role: "assistant" }, finish_reason: "stop" },
  ],
  usage: { prompt_tokens: 5, completion_tokens: 5, total_tokens: 10 },
};

let captured: { url?: string; body?: any };

beforeEach(() => {
  captured = {};
  global.fetch = jest.fn(async (url: string | URL | Request, init?: any) => {
    captured.url = url.toString();
    captured.body = JSON.parse(init?.body ?? "{}");
    return {
      ok: true,
      status: 200,
      json: async () => cannedOpenRouterResponse,
    } as Response;
  }) as typeof fetch;
});

const systemPromptOf = (body: any): string =>
  (body?.messages ?? []).find((m: any) => m.role === "system")?.content ?? "";

describe("tool-mapper qwen_algo parity with the real MCP tool", () => {
  it("runs Qwen3.8-Max with reasoning_effort=medium and the algo protocol", async () => {
    const result = await executeWorkflowTool(
      "qwen_algo",
      "analyze the complexity of this nested loop",
    );

    expect(captured.url).toContain("openrouter.ai");
    // The bug: this was qwen/qwq-32b — a silently weaker model
    expect(captured.body.model).toBe("qwen/qwen3.8-max");
    // Unset effort behaves like "high" (~5 min, ~15x cost) — must be pinned
    expect(captured.body.reasoning_effort).toBe("medium");
    expect(systemPromptOf(captured.body)).toContain(
      "Principal Algorithm Engineer",
    );
    expect(result.modelUsed).toBe("qwen/qwen3.8-max");
  });
});

describe("tool-mapper qwq_reason parity with the real MCP tool", () => {
  it("runs QwQ-32B with the 4-persona multi-perspective protocol", async () => {
    const result = await executeWorkflowTool(
      "qwq_reason",
      "should we migrate this service to event sourcing",
    );

    expect(captured.url).toContain("openrouter.ai");
    expect(captured.body.model).toBe("qwen/qwq-32b");
    const system = systemPromptOf(captured.body);
    // The bug: the mapper's generic prompt had none of the persona protocol
    expect(system).toContain("OPTIMIST");
    expect(system).toContain("PESSIMIST");
    expect(system).toContain("CONTRARIAN");
    expect(result.modelUsed).toBe("qwen/qwq-32b");
  });
});
