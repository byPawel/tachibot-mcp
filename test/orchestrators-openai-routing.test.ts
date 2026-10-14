/**
 * nextThought → OpenAI routing.
 *
 * BUG (hit live in a /council run 2026-10-14): smartRouteByIntent sent ANY OpenAI prompt
 * containing ``` to "openai_code_review" — and nextThought prompts include prior thoughts'
 * output, which often has code fences. executeMCPTool had no case for that tool, so the
 * step returned "[Tool openai_code_review not available - using fallback …]" and no model
 * was called.
 */

const { toolExecutionService } = await import(
  "../src/orchestrators/collaborative/services/tool-execution/ToolExecutionService.js"
);

const route = (prompt: string) => (toolExecutionService as any).smartRouteByIntent("openai", prompt);

describe("OpenAI smart routing", () => {
  test("a code fence carried in context is not code-review intent", () => {
    const prompt = "Previous thoughts:\n```\nopt = 42 + 20\n```\nStep 3: what are the top 3 risks? Reason step by step.";
    expect(route(prompt)).toBe("openai_reason");
  });

  test("explicit review intent still routes to code review", () => {
    expect(route("Please review this code for race conditions")).toBe("openai_code_review");
  });

  test("every tool the OpenAI router can return has parameters built for it", () => {
    const build = (t: string) => (toolExecutionService as any).buildToolParameters(t, "x", "analytical");
    expect(build("openai_code_review")).toEqual({ code: "x" });
  });
});
