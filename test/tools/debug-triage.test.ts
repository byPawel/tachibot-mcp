import { debugTriageTool, buildDebugTriagePrompt } from "../../src/tools/debug-triage-tool.js";

describe("debug_triage tool", () => {
  test("contract: name and parameter keys", () => {
    expect(debugTriageTool.name).toBe("debug_triage");
    const keys = Object.keys(debugTriageTool.parameters.shape);
    expect(keys).toEqual(expect.arrayContaining(["error", "code", "files", "context", "runtime"]));
  });

  test("prompt demands RANKED hypotheses with discriminating evidence", () => {
    const { system, user } = buildDebugTriagePrompt({
      error: "TypeError: Cannot read properties of undefined (reading 'map') at render (App.tsx:42)",
      context: "started after upgrading react-query",
      runtime: "node 22 / react 19",
    });
    expect(system).toMatch(/rank/i);
    expect(system).toMatch(/hypothes/i);
    expect(system).toMatch(/evidence/i);
    expect(user).toContain("App.tsx:42");
    expect(user).toContain("react-query");
    expect(user).toContain("node 22");
  });

  test("execute rejects a missing error without a network call", async () => {
    const out = await debugTriageTool.execute(
      {} as any,
      { log: () => {}, reportProgress: async () => {} } as any,
    );
    expect(String(out)).toMatch(/'error' is required/i);
  });
});
