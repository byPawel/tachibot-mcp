import { listPromptTechniquesTool, previewPromptTechniqueTool } from "../../src/tools/prompt-technique-tools.js";
import { PromptEngineerLite } from "../../src/prompt-engineer-lite.js";

describe("prompt techniques — curated list", () => {
  test("default list shows only core techniques, not the full library", async () => {
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

// The catalog lives in two files: metadata + recommender rules in prompt-technique-tools,
// prompt text in prompt-engineer-lite. Drift between them is SILENT — a technique can be
// listed, described and recommended while applyTechnique quietly falls through to the
// identity function and hands the model back the raw query.
describe("prompt techniques — the two catalogs agree", () => {
  const pe = new PromptEngineerLite();
  const listedNames = async () => {
    const out = await listPromptTechniquesTool.execute({ all: true });
    // Entry lines only: "  name", "  name (alias: x)", "  name (alias: x) [core]".
    // The trailing $ keeps the usage footer ("  preview_prompt_technique --technique ...") out.
    return [...out.matchAll(/^ {2}([a-z0-9_]+)(?: \(alias: ([a-z0-9_]+)\))?(?: \[core\])?$/gm)]
      .map(m => ({ name: m[1], alias: m[2] }));
  };

  test("every listed technique has prompt text and a description", async () => {
    const missing: string[] = [];
    for (const { name } of await listedNames()) {
      if (pe.applyTechnique("grok_reason", name, "ZZQUERY") === "ZZQUERY") missing.push(`${name}: no prompt`);
      if (pe.getTechniqueDescription(name) === name) missing.push(`${name}: no description`);
    }
    expect(missing).toEqual([]);
  });

  // spotlighting mints a fresh fence tag per call by design, so compare prompts with any
  // such tag normalised away — the invariant is that the alias routes to the same
  // technique, not that two calls produce byte-identical strings.
  const stable = (s: string) => s.replace(/UNTRUSTED_[A-Z0-9]+/g, "UNTRUSTED_X");

  test("every listed alias resolves to the same prompt as its technique", async () => {
    const broken: string[] = [];
    for (const { name, alias } of await listedNames()) {
      if (!alias) continue;
      const viaAlias = stable(pe.applyTechnique("grok_reason", alias, "ZZQUERY"));
      const viaName = stable(pe.applyTechnique("grok_reason", name, "ZZQUERY"));
      if (viaAlias !== viaName) broken.push(`${alias} -> ${name}`);
    }
    expect(broken).toEqual([]);
  });
});

describe("prompt techniques — tabular & structured data", () => {
  const pe = new PromptEngineerLite();
  const FAMILY = ["chain_of_table", "sub_table_first", "sql_stages", "self_debug", "data_assert"];

  test("all five are listed and applicable", async () => {
    const out = await listPromptTechniquesTool.execute({ filter: "tabular" });
    for (const t of FAMILY) {
      expect(out).toContain(t);
      expect(pe.applyTechnique("grok_reason", t, "ZZQUERY")).toContain("ZZQUERY");
    }
  });

  test("aliases route to the canonical technique", () => {
    const aliases: Record<string, string> = {
      table_walk: "chain_of_table",
      tabsqlify: "sub_table_first",
      schema_prune: "sub_table_first",
      din_sql: "sql_stages",
      mac_sql: "sql_stages",
      feed_the_traceback: "self_debug",
      assert_dont_eyeball: "data_assert",
    };
    for (const [alias, canonical] of Object.entries(aliases)) {
      expect(pe.applyTechnique("grok_reason", alias, "q")).toBe(pe.applyTechnique("grok_reason", canonical, "q"));
    }
  });

  // The loops these two describe run against real data on someone else's bill. An
  // unbounded "keep trying until it works" is the expensive failure mode.
  test("the looping techniques state a hard iteration cap", () => {
    expect(pe.applyTechnique("grok_reason", "self_debug", "q")).toMatch(/maximum 3 rounds/i);
    expect(pe.applyTechnique("grok_reason", "sql_stages", "q")).toMatch(/at most 2 correction rounds/i);
  });

  test("a table task recommends the tabular family", async () => {
    const out = await previewPromptTechniqueTool.execute(
      { technique: "auto", query: "give me only the rows in this csv where status is active" },
      {} as any,
    );
    expect(out).toMatch(/chain_of_table|sub_table_first|data_assert/);
  });

  test("a text-to-SQL task recommends sql_stages", async () => {
    const out = await previewPromptTechniqueTool.execute(
      { technique: "auto", query: "write a query joining orders and customers in postgres" },
      {} as any,
    );
    expect(out).toContain("sql_stages");
  });

  test("a traceback recommends self_debug", async () => {
    const out = await previewPromptTechniqueTool.execute(
      { technique: "auto", query: "this keeps throwing a KeyError, here is the traceback" },
      {} as any,
    );
    expect(out).toContain("self_debug");
  });
});

describe("prompt techniques — retrieval discipline", () => {
  const pe = new PromptEngineerLite();

  test("the three new retrieval techniques are applicable", () => {
    for (const t of ["hyde", "crag", "astute_rag"]) {
      expect(pe.applyTechnique("grok_reason", t, "ZZQUERY")).toContain("ZZQUERY");
    }
  });

  test("aliases route to the canonical technique", () => {
    const aliases: Record<string, string> = {
      hypothetical_answer: "hyde",
      corrective_rag: "crag",
      grade_the_sources: "crag",
      conflict_check: "astute_rag",
      memory_vs_sources: "astute_rag",
      map_the_sheet: "xlsx_map",
      flextaf: "table_format",
    };
    for (const [alias, canonical] of Object.entries(aliases)) {
      expect(pe.applyTechnique("grok_reason", alias, "q")).toBe(pe.applyTechnique("grok_reason", canonical, "q"));
    }
  });

  // The whole point of astute_rag is that it commits to an independent answer BEFORE
  // reading the sources. Drop that ordering and it degenerates into chain_of_note.
  test("astute_rag answers from memory before reading the sources", () => {
    const out = pe.applyTechnique("grok_reason", "astute_rag", "q");
    expect(out).toMatch(/answer from memory first/i);
    expect(out.indexOf("MEMORY")).toBeLessThan(out.indexOf("READ the sources"));
    expect(out).toMatch(/CONFLICTS/);
  });

  // hyde's draft is a search key. If it survives into the answer it's a hallucination
  // with a citation shape, which is worse than not having searched.
  test("hyde discards the drafted answer rather than reasoning from it", () => {
    expect(pe.applyTechnique("grok_reason", "hyde", "q")).toMatch(/discard the draft/i);
  });

  // A grade nobody acts on is a comment. Each verdict needs its own branch.
  test("crag branches on every verdict, including the all-wrong case", () => {
    const out = pe.applyTechnique("grok_reason", "crag", "q");
    for (const verdict of ["CORRECT", "AMBIGUOUS", "WRONG"]) expect(out).toContain(verdict);
    expect(out).toMatch(/do NOT assemble an answer out of fragments/i);
  });

  test("a source-conflict task recommends astute_rag", async () => {
    const out = await previewPromptTechniqueTool.execute(
      { technique: "auto", query: "this page contradicts what I thought, which is right?" },
      {} as any,
    );
    expect(out).toContain("astute_rag");
  });

  test("a spreadsheet task recommends xlsx_map, not the plain table family", async () => {
    const out = await previewPromptTechniqueTool.execute(
      { technique: "auto", query: "analyse this excel workbook with merged cells" },
      {} as any,
    );
    expect(out).toContain("xlsx_map");
  });
});

describe("prompt techniques — spotlighting fences untrusted text", () => {
  const pe = new PromptEngineerLite();

  // A fixed marker is a guessable marker, and a guessable marker can be closed by the
  // injected text itself — which is the entire attack this technique exists to stop.
  test("the fence tag is randomised per call", () => {
    const tagOf = (s: string) => s.match(/<<<(UNTRUSTED_[A-Z0-9]+)/)?.[1];
    const a = tagOf(pe.applyTechnique("grok_reason", "spotlighting", "q"));
    const b = tagOf(pe.applyTechnique("grok_reason", "spotlighting", "q"));
    expect(a).toBeDefined();
    expect(a).not.toBe(b);
  });

  test("the fence opens and closes with the same tag", () => {
    const out = pe.applyTechnique("grok_reason", "spotlighting", "q");
    const tag = out.match(/<<<(UNTRUSTED_[A-Z0-9]+)/)![1];
    expect(out).toContain(`${tag}>>>`);
  });

  // Downstream snippet generators type these prompts literally, where a newline submits
  // the message and modifier characters mistype.
  test("the tag stays single-line and typeable", () => {
    const tag = pe.applyTechnique("grok_reason", "spotlighting", "q").match(/<<<(UNTRUSTED_[A-Z0-9]+)/)![1];
    expect(tag).toMatch(/^UNTRUSTED_[A-Z0-9]+$/);
  });

  // The tag's only job is to be unguessable, so entropy is the property to guard, and it
  // can be lost two ways that look identical in any single sample.
  //
  // A LOWER BOUND, not an exact width: 8 hex characters is 32 bits, chosen to sit above the
  // ~31 the base-36 predecessor carried so that swapping to a CSPRNG didn't quietly cost
  // width. Pinning the exact number instead would fail the day someone WIDENS the fence —
  // a check that breaks when the thing it guards improves trains people to delete it.
  //
  // Comparing the widths to each other rather than to a number does not work here: 500 tags
  // narrowed to 6 hex characters are all mutually consistent and all distinct, so uniform
  // narrowing — the actual regression this guards — passes such a check untouched.
  test("the tag carries at least 32 bits, and is distinct across calls", () => {
    const tags = new Set<string>();
    for (let i = 0; i < 500; i++) {
      const tag = pe.applyTechnique("grok_reason", "spotlighting", "q").match(/<<<(UNTRUSTED_[A-Z0-9]+)/)![1];
      expect(tag).toMatch(/^UNTRUSTED_[0-9A-F]{8,}$/);
      tags.add(tag);
    }
    // Birthday collisions over 2^32 are ~3e-5 at this sample size, so a repeat means a
    // constant or a reused seed, not luck. This is what catches a fence that stopped
    // varying at all, which the width bound alone would happily accept.
    expect(tags.size).toBe(500);
  });

  test("it tells the model that in-block instructions are forged", () => {
    expect(pe.applyTechnique("grok_reason", "spotlighting", "q")).toMatch(/forged/i);
  });
});
