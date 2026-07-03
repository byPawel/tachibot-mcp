import { getTachiTools } from "../../src/tools/tachi-tool.js";

const ctx = { log: { info: () => {} }, reportProgress: async () => {} } as any;
const tachi = getTachiTools()[0];

describe("tachi — prompt-improvement intent menu", () => {
  test.each([
    "how can I improve my prompts?",
    "make this prompt better",
    "refine my prompt with a technique",
    "update prompt technique",
  ])("'%s' returns the improvement menu without routing to a model", async (q) => {
    const out = String(await tachi.execute({ query: q }, ctx));
    expect(out).toContain("IMPROVE A PROMPT");
    expect(out).toContain("refine_prompt");
    expect(out).toContain("preview_prompt_technique");
    expect(out).toContain('technique: "auto"');
  });

  test("menu explains the combined path (refine first, then technique)", async () => {
    const out = String(await tachi.execute({ query: "improve my prompt" }, ctx));
    expect(out).toMatch(/refine_prompt first[\s\S]*preview_prompt_technique/);
  });
});
