/**
 * tool-mapper OpenAI parity tests.
 *
 * Same drift class as tool-mapper-qwen.test.ts: the workflow switch
 * reimplemented openai_code_review / openai_explain / openai_reason with
 * hand-written prompts and its own model picks, so a workflow step ran a
 * different model than the MCP tool of the same name. After the GPT-6 Astra
 * bump (v2.34.0), openai_code_review ran gpt-6-astra as a tool but
 * gpt-5.6-luna as a workflow step. The cases now delegate to the real tools.
 *
 * MECHANISM assertions on the captured request body — never on model output.
 */

import { jest } from "@jest/globals";

// openai-tools captures the key at import time — set BEFORE the import.
// fetch is mocked below, so no real call is ever made with this value.
if (!process.env.OPENAI_API_KEY) {
  process.env.OPENAI_API_KEY = "tool-mapper-openai-fake-key";
}
// The gateway reads this per call and dotenv never overrides an existing value.
process.env.USE_OPENROUTER_GATEWAY = "false";

const { executeWorkflowTool } = await import(
  "../../src/workflows/tool-mapper.js"
);

const cannedResponsesBody = {
  id: "resp_ok",
  object: "response",
  created_at: 1757800000,
  status: "completed",
  model: "canned",
  output: [
    {
      id: "msg_1",
      type: "message",
      status: "completed",
      role: "assistant",
      content: [{ type: "output_text", text: "canned openai reply", annotations: [] }],
    },
  ],
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
      json: async () => cannedResponsesBody,
      text: async () => JSON.stringify(cannedResponsesBody),
    } as Response;
  }) as typeof fetch;
});

const messageOf = (body: any, role: string): string =>
  (body?.input ?? []).find((m: any) => m.role === role)?.content ?? "";

describe("tool-mapper OpenAI parity with the real MCP tools", () => {
  it("openai_code_review runs the flagship with the real review prompt", async () => {
    const result = await executeWorkflowTool(
      "openai_code_review",
      "function avg(a){return a.reduce((s,x)=>s+x)/a.length}",
    );

    expect(captured.url).toBe("https://api.openai.com/v1/responses");
    // The bug: this was gpt-5.6-luna while the MCP tool runs the flagship
    expect(captured.body.model).toBe("gpt-6-astra");
    expect(captured.body.reasoning).toEqual({ effort: "medium" });
    expect(messageOf(captured.body, "user")).toContain("Review this code:");
    expect(result.modelUsed).toBe("gpt-6-astra");
  });

  it("openai_explain runs sol with the real educator prompt", async () => {
    const result = await executeWorkflowTool("openai_explain", "idempotency keys");

    // The bug: this was gpt-5.6-luna while the MCP tool runs sol
    expect(captured.body.model).toBe("gpt-6.1-sol");
    expect(messageOf(captured.body, "user")).toContain("Explain: idempotency keys");
    expect(result.modelUsed).toBe("gpt-6.1-sol");
  });

  it("openai_reason runs the flagship at xhigh effort like the MCP tool", async () => {
    const result = await executeWorkflowTool(
      "openai_reason",
      "prove that the square root of 2 is irrational",
    );

    expect(captured.body.model).toBe("gpt-6-astra");
    // The bug: the mapper sent "high" with a generic prompt
    expect(captured.body.reasoning).toEqual({ effort: "xhigh" });
    expect(messageOf(captured.body, "system")).toContain("expert reasoner");
    expect(result.modelUsed).toBe("gpt-6-astra");
  });
});
