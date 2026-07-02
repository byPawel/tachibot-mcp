import { planCritiqueTool, buildPlanCritiquePrompt, buildPlanCritiqueJudgePrompt } from "../../src/tools/plan-critique-tool.js";

const SAMPLE_PLAN = "1. Add OAuth login\n2. Migrate users table\n3. Ship to prod Friday";

describe("plan_critique tool", () => {
  test("contract: name and parameter keys", () => {
    expect(planCritiqueTool.name).toBe("plan_critique");
    const keys = Object.keys(planCritiqueTool.parameters.shape);
    expect(keys).toEqual(expect.arrayContaining(["plan", "goal", "constraints", "files"]));
  });

  test("critique prompt carries pre-mortem framing, the plan, and the goal", () => {
    const p = buildPlanCritiquePrompt({ plan: SAMPLE_PLAN, goal: "secure login without downtime" });
    expect(p).toMatch(/failed|failure/i);          // pre-mortem framing
    expect(p).toMatch(/assumption/i);              // hidden-assumption audit
    expect(p).toContain("Migrate users table");
    expect(p).toContain("secure login without downtime");
  });

  test("judge prompt includes every critic and demands ranked risks", () => {
    const p = buildPlanCritiqueJudgePrompt(
      [{ label: "DeepSeek", text: "step 2 has no rollback" }, { label: "Grok", text: "Friday deploy risk" }],
      { plan: SAMPLE_PLAN },
    );
    expect(p).toContain("no rollback");
    expect(p).toMatch(/rank/i);
  });

  test("execute rejects a missing plan without a network call", async () => {
    const out = await planCritiqueTool.execute(
      {} as any,
      { log: () => {}, reportProgress: async () => {} } as any,
    );
    expect(String(out)).toMatch(/'plan' is required/i);
  });
});
