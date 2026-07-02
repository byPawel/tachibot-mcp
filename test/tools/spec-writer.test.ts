import { specWriterTool, buildSpecWriterPrompt } from "../../src/tools/spec-writer-tool.js";

describe("spec_writer tool", () => {
  test("contract: name and parameter keys", () => {
    expect(specWriterTool.name).toBe("spec_writer");
    const keys = Object.keys(specWriterTool.parameters.shape);
    expect(keys).toEqual(expect.arrayContaining(["request", "context", "files", "format"]));
  });

  test("prompt demands out-of-scope, open questions, and ambiguity preservation", () => {
    const { system, user } = buildSpecWriterPrompt({
      request: "add OAuth login, users keep complaining",
      context: "existing session-cookie auth, 10k users",
      format: "gherkin",
    });
    expect(system).toMatch(/out.of.scope/i);
    expect(system).toMatch(/open question/i);
    expect(system).toMatch(/do not invent|never invent|preserve/i);
    expect(system).toContain("Given");
    expect(user).toContain("OAuth");
    expect(user).toContain("session-cookie");
  });

  test("execute rejects a missing request without a network call", async () => {
    const out = await specWriterTool.execute(
      { format: "both" } as any,
      { log: () => {}, reportProgress: async () => {} } as any,
    );
    expect(String(out)).toMatch(/'request' is required/i);
  });
});
