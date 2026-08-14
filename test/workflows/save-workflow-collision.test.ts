/**
 * saveWorkflow collision guard — a name collision must never silently destroy
 * a user's existing workflow YAML.
 *
 * BUG HISTORY: saveWorkflow() checked existsSync on the DIRECTORY only, then
 * did a bare writeFileSync on the file path. create_workflow with an existing
 * workflow name silently overwrote the user's (possibly hand-edited) file.
 *
 * The engine writes to <cwd>/.tachibot/workflows, so these tests chdir into a
 * fresh temp dir before constructing the engine and restore cwd afterwards.
 */

import * as fs from "fs";
import * as os from "os";
import * as path from "path";

const originalCwd = process.cwd();
const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "tachibot-wf-collision-"));
process.chdir(tempDir);

// Import AFTER chdir — the engine reads/writes relative to process.cwd().
// NOTE: the module also instantiates a singleton (workflowEngine) at import
// time whose cleanup interval keeps the event loop alive; destroy it in
// teardown or jest never exits.
const { CustomWorkflowEngine, workflowEngine } = await import(
  "../../src/workflows/custom-workflows.js"
);

const engine = new CustomWorkflowEngine();

const workflowFixture = (description: string) => ({
  name: "collision-probe",
  description,
  version: "1.0",
  settings: {},
  steps: [{ name: "s1", tool: "perplexity_ask", input: { prompt: "x" } }],
});

const savedPath = path.join(
  tempDir,
  ".tachibot",
  "workflows",
  "collision-probe.yaml",
);

afterAll(() => {
  engine.destroy();
  workflowEngine.destroy(); // module-level singleton — see import note above
  process.chdir(originalCwd);
  fs.rmSync(tempDir, { recursive: true, force: true });
});

describe("saveWorkflow collision guard", () => {
  it("first save writes the file", async () => {
    await engine.saveWorkflow(workflowFixture("original") as any, "yaml");
    expect(fs.existsSync(savedPath)).toBe(true);
  });

  it("saving over an existing file throws and leaves the file untouched", async () => {
    // Simulate the user having hand-edited their workflow since creation —
    // this is exactly the content a silent overwrite would destroy.
    const userEdited = "# USER EDITED CONTENT — must survive\n";
    fs.writeFileSync(savedPath, userEdited);

    await expect(
      engine.saveWorkflow(workflowFixture("colliding rewrite") as any, "yaml"),
    ).rejects.toThrow(/already exists/);

    expect(fs.readFileSync(savedPath, "utf8")).toBe(userEdited);
  });

  it("overwrite: true replaces the file deliberately", async () => {
    await engine.saveWorkflow(
      workflowFixture("deliberate overwrite") as any,
      "yaml",
      true,
    );
    expect(fs.readFileSync(savedPath, "utf8")).toContain(
      "deliberate overwrite",
    );
  });
});
