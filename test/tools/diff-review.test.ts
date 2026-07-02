import { diffReviewTool, buildDiffReviewerPrompt, buildDiffJudgePrompt } from "../../src/tools/diff-review-tool.js";

const SAMPLE_DIFF = `--- a/src/pay.ts
+++ b/src/pay.ts
@@ -10,3 +10,3 @@
-  const total = items.reduce((s, i) => s + i.price, 0);
+  const total = items.reduce((s, i) => s + i.price * i.qty, 0);`;

describe("diff_review tool", () => {
  test("contract: name and parameter keys", () => {
    expect(diffReviewTool.name).toBe("diff_review");
    const keys = Object.keys(diffReviewTool.parameters.shape);
    expect(keys).toEqual(expect.arrayContaining(["diff", "intent", "files", "focus", "severityFloor"]));
  });

  test("reviewer prompt scopes to the diff and carries intent + focus", () => {
    const p = buildDiffReviewerPrompt({ diff: SAMPLE_DIFF, intent: "charge quantity, not unit price", focus: "correctness" });
    expect(p).toMatch(/changed .*lines|only .*changed/i);
    expect(p).toContain("charge quantity");
    expect(p).toContain(SAMPLE_DIFF);
    expect(p).toContain("correctness");
  });

  test("judge prompt includes every perspective and the severity floor", () => {
    const p = buildDiffJudgePrompt(
      [{ label: "Kimi (SWE)", text: "off-by-one in reduce" }, { label: "DeepSeek", text: "missing null check" }],
      { diff: SAMPLE_DIFF, severityFloor: "major" },
    );
    expect(p).toContain("Kimi (SWE)");
    expect(p).toContain("missing null check");
    expect(p).toContain("major");
  });

  test("execute rejects a missing diff without a network call", async () => {
    const out = await diffReviewTool.execute(
      { focus: "all", severityFloor: "nit" } as any,
      { log: () => {}, reportProgress: async () => {} } as any,
    );
    expect(String(out)).toMatch(/'diff' is required/i);
  });
});
