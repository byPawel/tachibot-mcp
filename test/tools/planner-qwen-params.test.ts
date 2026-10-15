/**
 * Planner → qwen_coder param contract test.
 *
 * BUG HISTORY (2026-08-14): the planner's analyze_qwen step emitted
 * {task, code, requirements} — but qwen_coder's schema REQUIRES `query`, has
 * no `requirements` field, and "requirements" is not in MAIN_INPUT_ALIASES,
 * so every agent executing the planner's Qwen step hit a Zod validation
 * failure ("query: Required").
 *
 * The test parses the params the planner actually emits against the REAL
 * qwen_coder schema exactly as production applies it (withParamAliases, as in
 * server-main.ts safeAddTool) — so schema and emitter can't silently drift.
 */

// Static imports (not top-level await): without an import/export statement the
// file is not a module, so plain `npx jest <file>` fails under CJS emit with
// "await expressions are only allowed at the top level of a module". Nothing
// here needs env vars set before import, so static imports are safe.
import { ALL_WORKFLOW_STEPS } from "../../src/tools/planner-tools.js";
import { qwenCoderTool, deepseekReasonTool, qwenReasonTool } from "../../src/tools/openrouter-tools.js";
import { withParamAliases } from "../../src/utils/param-aliases.js";

// The schema exactly as registered: alias preprocessing wrapped around it
const registeredSchema = withParamAliases(qwenCoderTool).parameters;

const analyzeQwenStep = ALL_WORKFLOW_STEPS.find(
  (s: any) => s.id === "analyze_qwen",
);

describe("planner analyze_qwen step emits schema-valid qwen_coder params (standard tier)", () => {
  const prev = process.env.TACHI_PLANNER_TIER;
  beforeAll(() => { process.env.TACHI_PLANNER_TIER = "standard"; });
  afterAll(() => {
    if (prev === undefined) delete process.env.TACHI_PLANNER_TIER;
    else process.env.TACHI_PLANNER_TIER = prev;
  });

  it("the step exists and targets qwen_coder", () => {
    expect(analyzeQwenStep).toBeDefined();
    expect(analyzeQwenStep!.tool).toBe("qwen_coder");
  });

  it("params without codeContext parse against the registered schema", () => {
    const params = analyzeQwenStep!.buildParams(
      "add rate limiting to the API",
      "",
      "",
      "",
      {},
    );
    const parsed = registeredSchema.safeParse(params);
    if (!parsed.success) {
      throw new Error(
        `planner-emitted qwen_coder params failed the real schema: ` +
          JSON.stringify(parsed.error.issues),
      );
    }
  });

  it("params with codeContext parse and carry the code through", () => {
    const params = analyzeQwenStep!.buildParams(
      "review this handler",
      "express app",
      "function handler(req, res) { res.send('ok'); }",
      "",
      { search: "some research output" },
    );
    const parsed = registeredSchema.safeParse(params);
    if (!parsed.success) {
      throw new Error(
        `planner-emitted qwen_coder params failed the real schema: ` +
          JSON.stringify(parsed.error.issues),
      );
    }
    expect(parsed.data.task).toBe("review");
    expect(parsed.data.code).toContain("function handler");
  });
});

/**
 * Quality tier (default): the code-analysis step routes to deepseek_reason
 * (DeepSeek V4 Pro). Its params must parse against THAT tool's schema.
 */
describe("planner analyze step in quality tier emits schema-valid deepseek_reason params", () => {
  const prev = process.env.TACHI_PLANNER_TIER;
  beforeAll(() => { delete process.env.TACHI_PLANNER_TIER; });
  afterAll(() => {
    if (prev === undefined) delete process.env.TACHI_PLANNER_TIER;
    else process.env.TACHI_PLANNER_TIER = prev;
  });

  const deepseekSchema = withParamAliases(deepseekReasonTool as any).parameters;

  it("defaults to deepseek_reason", () => {
    expect(analyzeQwenStep!.tool).toBe("deepseek_reason");
    expect(analyzeQwenStep!.description).toContain("DeepSeek V4 Pro");
  });

  it("params parse and carry the code into the problem", () => {
    const params = analyzeQwenStep!.buildParams(
      "review this handler",
      "express app",
      "function handler(req, res) { res.send('ok'); }",
      "",
      { search: "some research output" },
    );
    const parsed = deepseekSchema.safeParse(params);
    if (!parsed.success) {
      throw new Error(`deepseek_reason params failed: ${JSON.stringify(parsed.error.issues)}`);
    }
    expect(parsed.data.problem).toContain("function handler");
  });

  it("falls back to qwen_coder when the profile lacks deepseek_reason", () => {
    process.env.DISABLE_TOOL_DEEPSEEK_REASON = "true";
    try {
      expect(analyzeQwenStep!.tool).toBe("qwen_coder");
      const params = analyzeQwenStep!.buildParams("add rate limiting", "", "", "", {});
      expect(registeredSchema.safeParse(params).success).toBe(true);
    } finally {
      delete process.env.DISABLE_TOOL_DEEPSEEK_REASON;
    }
  });
});

describe("planner judge_draft step", () => {
  const judgeDraft = ALL_WORKFLOW_STEPS.find((s: any) => s.id === "judge_draft")!;
  const qwenSchema = withParamAliases(qwenReasonTool as any).parameters;
  const deepseekSchema = withParamAliases(deepseekReasonTool as any).parameters;
  const prior = { analyze_qwen: "a", analyze_kimi: "b", critique: "c" };

  it("uses qwen_reason with schema-valid params", () => {
    expect(judgeDraft.tool).toBe("qwen_reason");
    expect(qwenSchema.safeParse(judgeDraft.buildParams("t", "", "", "", prior)).success).toBe(true);
  });

  it("falls back to deepseek_reason when qwen_reason is not in the profile (code_focus)", () => {
    process.env.DISABLE_TOOL_QWEN_REASON = "true";
    try {
      expect(judgeDraft.tool).toBe("deepseek_reason");
      expect(deepseekSchema.safeParse(judgeDraft.buildParams("t", "", "", "", prior)).success).toBe(true);
    } finally {
      delete process.env.DISABLE_TOOL_QWEN_REASON;
    }
  });
});
