import { refinePromptTool, buildRefinePrompt } from "../../src/tools/refine-prompt-tool.js";

describe("refine_prompt tool", () => {
  test("contract: name and parameter keys", () => {
    expect(refinePromptTool.name).toBe("refine_prompt");
    const keys = Object.keys(refinePromptTool.parameters.shape);
    expect(keys).toEqual(expect.arrayContaining(["query", "goal", "context"]));
  });

  test("system prompt encodes the guardrails: open questions, no invented requirements, no reasoning injection", () => {
    const { system } = buildRefinePrompt({ query: "make login better" });
    expect(system).toMatch(/OPEN QUESTION/i);
    expect(system).toMatch(/never add requirements|do not add requirements/i);
    expect(system).toMatch(/think step by step|chain of thought/i); // named as PROHIBITED
    expect(system).toMatch(/WHAT CHANGED/);
    expect(system).toMatch(/REFINED PROMPT/);
  });

  test("user prompt carries query, goal, and context", () => {
    const { user } = buildRefinePrompt({
      query: "make login better",
      goal: "reduce support tickets about lockouts",
      context: "existing session-cookie auth, 10k users",
    });
    expect(user).toContain("make login better");
    expect(user).toContain("lockouts");
    expect(user).toContain("session-cookie");
  });

  test("execute rejects a missing query without a network call", async () => {
    const out = await refinePromptTool.execute({} as any, { log: () => {}, reportProgress: async () => {} } as any);
    expect(String(out)).toMatch(/'query' is required/i);
  });
});
