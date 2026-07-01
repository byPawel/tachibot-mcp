import { testgenTool, buildTestgenPrompt } from "../../src/tools/testgen-tool.js";

describe("testgen tool", () => {
  test("contract: name and parameter keys", () => {
    expect(testgenTool.name).toBe("testgen");
    const keys = Object.keys(testgenTool.parameters.shape);
    expect(keys).toEqual(expect.arrayContaining(["code", "files", "framework", "coverage", "existingTests"]));
  });

  test("prompt builder embeds framework, coverage, and code", () => {
    const { system, user } = buildTestgenPrompt({
      code: "export function add(a: number, b: number) { return a + b; }",
      framework: "jest",
      coverage: "edge",
    });
    expect(system).toContain("jest");
    expect(system).toContain("edge");
    expect(user).toContain("export function add");
  });

  test("execute rejects empty input without a network call", async () => {
    const out = await testgenTool.execute(
      { coverage: "all" } as any,
      { log: () => {}, reportProgress: async () => {} } as any,
    );
    expect(String(out)).toMatch(/provide 'code' or 'files'/i);
  });
});
