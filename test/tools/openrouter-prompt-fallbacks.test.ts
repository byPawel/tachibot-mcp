/**
 * OpenRouter reasoning tools — approach prompt-fallback tests.
 *
 * BUG CLASS (same as commits 7928d9e / openai and 4600186 / grok): a prompt
 * map indexed with a free-form string where the `||` fallback sits INSIDE the
 * brackets — `approachPrompts[args.approach || 'default']` — only rescues an
 * EMPTY approach. Any unknown non-empty value (a caller typo, or a cross-tool
 * approach name like "first-principles" sent to glm_reason) still indexes to
 * undefined and interpolates the literal string "undefined" into the system
 * prompt. The correct idiom resolves the index FIRST, then falls back:
 * `approachPrompts[args.approach] || approachPrompts['default']` (as
 * qwq_reason already does).
 *
 * Seam: capture the fetch body sent to OpenRouter and assert on the system
 * prompt actually transmitted (mechanism, not model output). Same pattern as
 * test/tools/grok-prompt-fallbacks.test.ts.
 */

import { jest } from "@jest/globals";

// Key is captured into a module-level const at import time — set BEFORE import.
if (!process.env.OPENROUTER_API_KEY) {
  process.env.OPENROUTER_API_KEY = "prompt-fallback-fake-key";
}

const {
  kimiThinkingTool,
  qwenReasonTool,
  deepseekReasonTool,
  glmReasonTool,
  stepfunReasonTool,
  ernieReasonTool,
} = await import("../../src/tools/openrouter-tools.js");

const fakeCtx = {
  log: {
    info: (..._args: unknown[]) => {},
    warn: (..._args: unknown[]) => {},
    error: (..._args: unknown[]) => {},
  },
  reportProgress: async (_p: { progress: number; total: number }) => {},
};

const cannedOpenRouterResponse = {
  choices: [
    { message: { content: "canned openrouter reply", role: "assistant" }, finish_reason: "stop" },
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
      json: async () => cannedOpenRouterResponse,
    } as Response;
  }) as typeof fetch;
});

// One case per tool: an approach value NOT in the tool's map, the distinctive
// text of the tool's OWN schema default (what the fallback must select), and a
// known non-default approach with its distinctive text (proves selection still
// works). maxSteps is passed for kimi because direct .execute() bypasses zod
// defaults — production always gets it via .default(3).
const cases = [
  {
    tool: kimiThinkingTool,
    name: "kimi_thinking",
    extraArgs: { maxSteps: 3 },
    defaultText: "Break down the problem into clear steps and solve systematically",
    known: { approach: "creative", text: "explore unconventional solutions" },
  },
  {
    tool: qwenReasonTool,
    name: "qwen_reason",
    extraArgs: {},
    defaultText: "Apply rigorous mathematical reasoning with proofs",
    known: { approach: "proof", text: "Construct formal proofs with clear steps" },
  },
  {
    tool: deepseekReasonTool,
    name: "deepseek_reason",
    extraArgs: {},
    defaultText: "weighing multiple perspectives and implications before concluding",
    known: { approach: "first-principles", text: "Strip to fundamental truths" },
  },
  {
    tool: glmReasonTool,
    name: "glm_reason",
    extraArgs: {},
    defaultText: "Reason as an agent: define the goal",
    known: { approach: "systematic", text: "verification at each step" },
  },
  {
    tool: stepfunReasonTool,
    name: "stepfun_reason",
    extraArgs: {},
    defaultText: "weighing perspectives and implications before concluding",
    known: { approach: "mathematical", text: "explicit derivations" },
  },
  {
    tool: ernieReasonTool,
    name: "ernie_reason",
    extraArgs: {},
    defaultText: "Analyze across multiple angles",
    known: { approach: "systematic", text: "systematic reasoning with clear logic chains" },
  },
] as const;

describe.each(cases)("$name approach prompt fallback", ({ tool, extraArgs, defaultText, known }) => {
  it("unknown approach never injects the literal 'undefined'", async () => {
    await (tool as any).execute(
      { problem: "probe problem", approach: "zen-koan", ...extraArgs },
      fakeCtx,
    );
    expect(capturedSystemPrompt.length).toBeGreaterThan(0);
    expect(capturedSystemPrompt).not.toContain("undefined");
    // Falls back to the tool's own default approach prompt
    expect(capturedSystemPrompt).toContain(defaultText);
  });

  it("known approach still selects its own prompt", async () => {
    await (tool as any).execute(
      { problem: "probe problem", approach: known.approach, ...extraArgs },
      fakeCtx,
    );
    expect(capturedSystemPrompt).toContain(known.text);
    expect(capturedSystemPrompt).not.toContain("undefined");
  });
});
