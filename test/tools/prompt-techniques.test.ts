import { listPromptTechniquesTool, previewPromptTechniqueTool } from "../../src/tools/prompt-technique-tools.js";

describe("prompt techniques — curated list", () => {
  test("default list shows only core techniques, not all 31", async () => {
    const out = await listPromptTechniquesTool.execute({});
    expect(out).toContain("CORE PROMPT TECHNIQUES");
    // core contracts present
    expect(out).toContain("scot");
    expect(out).toContain("pre_mortem");
    expect(out).toContain("bdd_spec");
    // obsolete-on-reasoning-models techniques hidden by default
    expect(out).not.toContain("chain_of_thought");
    expect(out).not.toContain("self_consistency");
    // points the user at the full set
    expect(out).toMatch(/all=true/);
  });

  test("all=true reveals the full set incl. the advanced techniques", async () => {
    const out = await listPromptTechniquesTool.execute({ all: true });
    expect(out).toContain("chain_of_thought");
    expect(out).toContain("tree_of_thoughts");
    expect(out).toContain("scot");
  });

  test("category filter shows that category in full", async () => {
    const out = await listPromptTechniquesTool.execute({ filter: "reasoning" });
    expect(out).toContain("chain_of_thought");
    expect(out).toContain("tree_of_thoughts");
    expect(out).not.toContain("pre_mortem"); // different category
  });
});

describe("prompt techniques — auto recommend", () => {
  test("debugging task recommends rubber_duck / react", async () => {
    const out = await previewPromptTechniqueTool.execute(
      { technique: "auto", query: "there is a null pointer exception crashing on checkout" },
      {} as any,
    );
    expect(out).toContain("RECOMMENDED TECHNIQUES");
    expect(out).toMatch(/rubber_duck|react/);
    expect(out).not.toContain("EXECUTION TOKEN"); // auto recommends, does not apply
  });

  test("decision task recommends adversarial / pre_mortem", async () => {
    const out = await previewPromptTechniqueTool.execute(
      { technique: "auto", query: "should we use Redis vs Postgres for the job queue" },
      {} as any,
    );
    expect(out).toMatch(/adversarial|pre_mortem/);
  });

  test("unmatched task falls back to core contracts", async () => {
    const out = await previewPromptTechniqueTool.execute(
      { technique: "auto", query: "xyzzy" },
      {} as any,
    );
    expect(out).toContain("RECOMMENDED TECHNIQUES");
    expect(out).toMatch(/core/);
  });

  test("previewing a specific technique without a tool errors clearly", async () => {
    const out = await previewPromptTechniqueTool.execute(
      { technique: "scot", query: "design a cache" },
      {} as any,
    );
    expect(out).toMatch(/'tool' is required/);
  });
});
