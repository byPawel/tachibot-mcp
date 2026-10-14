/**
 * Jev in workflows — mapper routing + branchable conditions.
 *
 * BUG HISTORY (2026-10-14): tool-mapper had no jev_decide case, and its
 * `default` branch sent every unknown tool name to GPT codex-mini as free text.
 * A Jev step therefore returned invented prose, not probabilities — and 46
 * registered tools (deepseek_*, glm_reason, jury, gemini_judge, ...) silently
 * ran the wrong model the same way. Separately, `condition.if` only understood
 * `var == value` and only skipped when `skip: true` was ALSO set, so nothing
 * could branch on a Jev probability.
 *
 * MECHANISM assertions: which URL is hit with which body, and how conditions
 * evaluate against real Jev-shaped output — never on model output.
 */

import { jest } from "@jest/globals";

if (!process.env.OPENROUTER_API_KEY) {
  process.env.OPENROUTER_API_KEY = "jev-workflow-fake-key";
}

const { executeWorkflowTool, executeJevStep, executeRegisteredTool } = await import(
  "../../src/workflows/tool-mapper.js"
);
const { WorkflowHelpers } = await import("../../src/workflows/engine/WorkflowHelpers.js");

// Shape captured from a live jev-1.13 call on 2026-10-14.
const JEV_ANSWER = {
  model: "typesafe/jev-1.13-20260917",
  answers: {
    sufficient: { type: "noul", noul: 0.36 },
    pick: { type: "choice", choice: "postgres", probabilities: { postgres: 0.97, redis: 0.03 }, confidence: 0.94 },
    risk: { type: "score", score: 0.21, legend: { "0": "low", "1": "medium", "2": "high" }, probabilities: { "0": 0.81, "1": 0.18, "2": 0.01 }, confidence: 0.7 },
  },
  usage: { input_tokens: 452, output_tokens: 64, cost: 0.000018984 },
};

let captured: { url?: string; body?: any; calls: number };

beforeEach(() => {
  captured = { calls: 0 };
  global.fetch = jest.fn(async (url: string | URL | Request, init?: any) => {
    captured.calls++;
    captured.url = url.toString();
    captured.body = JSON.parse(init?.body ?? "{}");
    return { ok: true, status: 200, json: async () => JEV_ANSWER } as Response;
  }) as typeof fetch;
});

const QUESTIONS = { ok: { type: "noul", instructions: "Is the answer grounded?" } };

describe("tool-mapper routes jev_decide to the System One endpoint", () => {
  it("sends state + questions to /systemone, not chat-completions or OpenAI", async () => {
    const { result, modelUsed } = await executeWorkflowTool("jev_decide", {
      state: "the answer cites two sources",
      questions: QUESTIONS,
    });
    expect(captured.url).toBe("https://openrouter.ai/api/v1/systemone");
    expect(captured.body).toEqual({
      model: "typesafe/jev-1.13",
      state: "the answer cites two sources",
      questions: QUESTIONS,
    });
    expect(modelUsed).toBe("typesafe/jev-1.13");
    expect(JSON.parse(result).answers.sufficient.noul).toBe(0.36);
  });

  it("accepts questions as a JSON string (YAML block scalar)", async () => {
    await executeJevStep({ state: "x", questions: JSON.stringify(QUESTIONS) });
    expect(captured.body.questions).toEqual(QUESTIONS);
  });

  it("falls back to previousStep / context text for state", async () => {
    await executeJevStep({ previousStep: "prior step output", questions: QUESTIONS });
    expect(captured.body.state).toBe("prior step output");
  });

  it("fails loudly without a network call on bad input", async () => {
    expect((await executeJevStep("just a string")).result).toMatch(/needs an object input/);
    expect((await executeJevStep({ state: "x", questions: "{not json" })).result).toMatch(/not valid JSON/);
    expect((await executeJevStep({ questions: QUESTIONS })).result).toMatch(/'state' is empty/);
    expect(captured.calls).toBe(0);
  });
});

describe("unknown workflow tools no longer fall back to GPT", () => {
  it("returns an error for a name that is neither mapped nor registered", async () => {
    const { result, modelUsed } = await executeWorkflowTool("pingpong", { problem: "debate fixes" });
    expect(modelUsed).toBe("error");
    expect(result).toMatch(/unknown workflow tool 'pingpong'/);
    expect(captured.calls).toBe(0);
  });

  it("delegates an unmapped registered tool to the real tool (deepseek_reason → DeepSeek)", async () => {
    global.fetch = jest.fn(async (url: string | URL | Request, init?: any) => {
      captured.calls++;
      captured.url = url.toString();
      captured.body = JSON.parse(init?.body ?? "{}");
      return {
        ok: true,
        status: 200,
        json: async () => ({
          choices: [{ message: { role: "assistant", content: "deepseek reply" }, finish_reason: "stop" }],
          usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
        }),
      } as Response;
    }) as typeof fetch;
    const { result, modelUsed } = await executeWorkflowTool("deepseek_reason", { query: "prove it terminates" });
    expect(captured.url).toContain("openrouter.ai/api/v1/chat/completions");
    expect(String(captured.body.model)).toMatch(/^deepseek\//);
    expect(modelUsed).toBe("deepseek_reason");
    expect(result).toContain("deepseek reply");
  });

  it("refuses workflow-control tools as steps", async () => {
    const out = await executeRegisteredTool("workflow", { name: "x" }, "x");
    expect(out?.modelUsed).toBe("error");
  });
});

describe("condition.if can branch on Jev output", () => {
  const json = JSON.stringify(JEV_ANSWER, null, 2);
  const ctx = { gate: json, mode: "fast", flag: "yes" };
  const ev = (c: string) => WorkflowHelpers.evaluateCondition(c, ctx);

  it("reads into JSON string output with numeric comparisons", () => {
    expect(ev("gate.answers.sufficient.noul < 0.5")).toBe(true);
    expect(ev("gate.answers.sufficient.noul >= 0.5")).toBe(false);
    expect(ev("gate.answers.pick.probabilities.postgres > 0.9")).toBe(true);
    expect(ev("${gate.answers.risk.confidence >= 0.7}")).toBe(true);
  });

  it("supports == / != on strings, quotes optional", () => {
    expect(ev("gate.answers.pick.choice == postgres")).toBe(true);
    expect(ev("gate.answers.pick.choice == 'postgres'")).toBe(true);
    expect(ev("gate.answers.pick.choice != redis")).toBe(true);
    expect(ev("mode == fast")).toBe(true);
  });

  it("resolves hyphenated step names", () => {
    expect(WorkflowHelpers.evaluateCondition("evidence-gate.answers.sufficient.noul < 0.5", { "evidence-gate": json })).toBe(true);
  });

  it("keeps the legacy truthy check", () => {
    expect(ev("flag")).toBe(true);
    expect(ev("missing")).toBe(false);
  });

  it("is false (not a crash) on unresolvable paths or non-numbers", () => {
    expect(ev("gate.answers.nope.noul > 0.1")).toBe(false);
    expect(ev("mode > 1")).toBe(false);
    expect(ev("missing.deep.path == x")).toBe(false);
  });

  it("parses JSON wrapped in prose", () => {
    const wrapped = { gate: `Result:\n${json}\n(done)` };
    expect(WorkflowHelpers.evaluateCondition("gate.answers.sufficient.noul == 0.36", wrapped)).toBe(true);
  });

  it("loads FileReference step outputs before evaluating", async () => {
    const fileRef = { id: "1", stepName: "gate", summary: "s", filePath: null, sizeBytes: 1, getContent: async () => json };
    const resolved = await WorkflowHelpers.resolveConditionContext("gate.answers.sufficient.noul < 0.5", { gate: fileRef });
    expect(WorkflowHelpers.evaluateCondition("gate.answers.sufficient.noul < 0.5", resolved)).toBe(true);
  });
});
