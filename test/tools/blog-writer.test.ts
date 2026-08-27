import { buildBlogWriterPrompt } from "../../src/tools/blog-writer-tool.js";
import { PromptEngineerLite } from "../../src/prompt-engineer-lite.js";

describe("blog_writer prompt construction", () => {
  test("uses the storm template rather than a private copy", () => {
    const p = buildBlogWriterPrompt({ topic: "MCP tool bloat", research: true });
    // Weak-but-readable: the phrases a private copy could also satisfy.
    expect(p).toContain("STAGE 1 — PERSPECTIVES");
    expect(p).toContain("[SEARCH]");
    // Strong: fails the instant the tool's text diverges from the engine's real output
    // by even one character, which the phrase checks above cannot detect.
    expect(p).toContain(
      new PromptEngineerLite().applyTechnique("blog_writer", "storm", "MCP tool bloat"),
    );
  });

  test("uses the re3 template for the writing half", () => {
    const p = buildBlogWriterPrompt({ topic: "MCP tool bloat", research: true });
    // Weak-but-readable phrase check, plus the strong exact-output check (see above).
    expect(p).toContain("PASS 3 — REWRITE, STRUCTURE ONLY");
    expect(p).toContain(
      new PromptEngineerLite().applyTechnique("blog_writer", "re3", "MCP tool bloat"),
    );
  });

  test("skips the research stage when research is false", () => {
    const p = buildBlogWriterPrompt({ topic: "x", research: false });
    expect(p).not.toContain("STAGE 1 — PERSPECTIVES");
    expect(p).toContain("PASS 1 — PLAN");
  });

  test("carries the word budget into the prompt when given", () => {
    const p = buildBlogWriterPrompt({ topic: "x", wordCount: 1200 });
    expect(p).toContain("1200");
  });

  test("names the audience when given", () => {
    const p = buildBlogWriterPrompt({ topic: "x", audience: "backend engineers" });
    expect(p).toContain("backend engineers");
  });
});
