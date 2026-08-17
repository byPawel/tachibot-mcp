import { PromptEngineerLite } from "../../src/prompt-engineer-lite.js";
import { listPromptTechniquesTool } from "../../src/tools/prompt-technique-tools.js";

describe("writing family", () => {
  const pe = new PromptEngineerLite();

  test("all three writing techniques resolve to real templates", () => {
    for (const name of ["storm", "re3", "de_generic"]) {
      const out = pe.applyTechnique("grok_reason", name, "TESTQ");
      expect(out.trim()).not.toBe("TESTQ");
      expect(out.length).toBeGreaterThan(200);
    }
  });

  test("aliases resolve to the same template as their canonical name", () => {
    const pairs: Record<string, string> = {
      research_first: "storm",
      four_pass: "re3",
      fix_boring: "de_generic",
    };
    for (const [alias, canonical] of Object.entries(pairs)) {
      expect(pe.applyTechnique("grok_reason", alias, "q")).toBe(
        pe.applyTechnique("grok_reason", canonical, "q"),
      );
    }
  });

  test("storm refuses to start writing before research", () => {
    const out = pe.applyTechnique("grok_reason", "storm", "q");
    expect(out).toMatch(/do not start writing/i);
    expect(out).toContain("[SEARCH]");
  });

  test("re3 keeps structural and line editing in separate passes", () => {
    const out = pe.applyTechnique("grok_reason", "re3", "q");
    expect(out).toMatch(/structure only/i);
    expect(out).toMatch(/line only/i);
  });

  test("de_generic forbids lengthening", () => {
    const out = pe.applyTechnique("grok_reason", "de_generic", "q");
    expect(out).toMatch(/do not lengthen/i);
  });

  test("the writing category is listed and filterable", async () => {
    const out = await listPromptTechniquesTool.execute({ filter: "writing" });
    expect(out).toContain("storm");
    expect(out).toContain("re3");
    expect(out).toContain("de_generic");
  });
});
