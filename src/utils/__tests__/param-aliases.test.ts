import { z } from "zod";
import { withParamAliases } from "../param-aliases.js";

function makeTool(params: z.ZodObject<any>, name = "test_tool") {
  return {
    name,
    description: "test",
    parameters: params,
    execute: async (args: any) => args,
  };
}

describe("withParamAliases", () => {
  it("resolves 'problem' → 'query' via Zod preprocess", () => {
    const tool = makeTool(z.object({ query: z.string(), mode: z.string().optional() }));
    const aliased = withParamAliases(tool);
    // Zod parse should succeed with 'problem' instead of 'query'
    const result = aliased.parameters.safeParse({ problem: "test Q", mode: "analytical" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.query).toBe("test Q");
    }
  });

  it("resolves 'query' → 'problem' via Zod preprocess", () => {
    const tool = makeTool(z.object({ problem: z.string(), context: z.string().optional() }));
    const aliased = withParamAliases(tool);
    const result = aliased.parameters.safeParse({ query: "my question" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.problem).toBe("my question");
    }
  });

  it("resolves 'topic' → 'query'", () => {
    const tool = makeTool(z.object({ query: z.string() }));
    const aliased = withParamAliases(tool);
    const result = aliased.parameters.safeParse({ topic: "Jira plugins" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.query).toBe("Jira plugins");
    }
  });

  it("resolves 'prompt' → 'query'", () => {
    const tool = makeTool(z.object({ query: z.string() }));
    const aliased = withParamAliases(tool);
    const result = aliased.parameters.safeParse({ prompt: "analyze this" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.query).toBe("analyze this");
    }
  });

  it("resolves 'question' → 'problem'", () => {
    const tool = makeTool(z.object({ problem: z.string() }));
    const aliased = withParamAliases(tool);
    const result = aliased.parameters.safeParse({ question: "what is X?" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.problem).toBe("what is X?");
    }
  });

  it("does not overwrite primary field if already provided", () => {
    const tool = makeTool(z.object({ query: z.string() }));
    const aliased = withParamAliases(tool);
    const result = aliased.parameters.safeParse({ query: "original", problem: "alias" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.query).toBe("original");
    }
  });

  it("still fails if NO alias or primary is provided", () => {
    const tool = makeTool(z.object({ query: z.string() }));
    const aliased = withParamAliases(tool);
    const result = aliased.parameters.safeParse({ mode: "analytical" });
    expect(result.success).toBe(false);
  });

  it("skips tools with no recognized primary input", () => {
    const tool = makeTool(z.object({ code: z.string(), language: z.string() }));
    const aliased = withParamAliases(tool);
    expect(aliased).toBe(tool); // Returned unchanged
  });

  it("skips tools where primary input is optional", () => {
    const tool = makeTool(z.object({ query: z.string().optional(), mode: z.string() }));
    const aliased = withParamAliases(tool);
    expect(aliased).toBe(tool); // Returned unchanged — query is optional, not primary
  });

  it("execute receives resolved args from Zod preprocess", async () => {
    const tool = makeTool(z.object({ query: z.string(), mode: z.string().optional() }));
    const aliased = withParamAliases(tool);
    // Simulate what FastMCP does: parse then execute
    const parsed = aliased.parameters.parse({ problem: "synthesize this", mode: "analytical" });
    const result = await aliased.execute(parsed);
    expect(result.query).toBe("synthesize this");
  });

  it("works end-to-end: the exact failing case from the bug", () => {
    // Reproduce: openai_reason expects 'query', caller sent 'problem'
    const openaiReasonParams = z.object({
      query: z.string().describe("The question or problem to reason about"),
      context: z.string().optional().describe("Additional context"),
      mode: z.string().optional().default("analytical").describe("Reasoning mode"),
    });
    const tool = makeTool(openaiReasonParams, "openai_reason");
    const aliased = withParamAliases(tool);

    const result = aliased.parameters.safeParse({
      problem: "Synthesize the pragmatic middle ground for this decision",
      mode: "analytical",
      context: "Research findings: ...",
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.query).toBe("Synthesize the pragmatic middle ground for this decision");
      expect(result.data.mode).toBe("analytical");
      expect(result.data.context).toBe("Research findings: ...");
    }
  });
});
