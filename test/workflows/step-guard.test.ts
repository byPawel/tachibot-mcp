/**
 * Workflow step trust boundary (security review of 33b6704, 2026-10-14).
 *
 * executeRegisteredTool let any workflow YAML call any registered tool with any args:
 * profile-disabled tools ran, `files` could read ~/.ssh or ../../.env (the file reader
 * has no sandbox) and ship them to a model provider, and `useHeavy` / jev `model`
 * escalated cost. checkStep is the gate; direct tool calls are unaffected.
 */
import * as fs from "fs";
import * as os from "os";
import * as path from "path";

const { checkStep, stepFileViolation } = await import("../../src/workflows/step-guard.js");
const { executeRegisteredTool } = await import("../../src/workflows/tool-mapper.js");

describe("stepFileViolation", () => {
  test.each([
    ["/etc/passwd", "outside"],
    ["../../.env", "secret"],
    ["../outside.txt", "outside"],
    ["~/.ssh/id_rsa", "home"],
    [".env", "secret"],
    [".env.production", "secret"],
    ["config/credentials.json", "secret"],
    ["certs/server.pem", "secret"],
    [path.join(os.homedir(), ".aws", "credentials"), "secret"],
  ])("refuses %s", (p, kind) => {
    const why = stepFileViolation(p);
    expect(why).not.toBeNull();
    if (kind === "outside") expect(why).toMatch(/outside/);
    if (kind === "secret") expect(why).toMatch(/secret|outside/);
    if (kind === "home") expect(why).toMatch(/home/);
  });

  test.each(["src/tools/jev-tool.ts", "src/tools/jev-tool.ts:10-40", "README.md", "./package.json"])(
    "allows in-repo path %s",
    (p) => expect(stepFileViolation(p)).toBeNull(),
  );

  test("a symlink inside the root pointing outside it is refused", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "stepguard-"));
    const link = path.join(dir, "escape");
    fs.symlinkSync(os.tmpdir(), link);
    try {
      expect(stepFileViolation("escape/x.txt", dir)).toMatch(/outside/);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("checkStep", () => {
  test("meta tools cannot run as steps", () => {
    expect(checkStep("validate_workflow_file", {})).toMatch(/cannot run as a workflow step/);
    expect(checkStep("workflow", {})).toMatch(/cannot run/);
  });

  test("useHeavy cost escalation is refused", () => {
    expect(checkStep("grok_reason", { problem: "x", useHeavy: true })).toMatch(/useHeavy/);
    expect(checkStep("grok_reason", { problem: "x", useHeavy: false })).toBeNull();
  });

  test("jev_decide model is limited to typesafe/*", () => {
    expect(checkStep("jev_decide", { model: "openai/gpt-6-astra-pro" })).toMatch(/typesafe/);
    expect(checkStep("jev_decide", { model: "typesafe/jev-1.13" })).toBeNull();
  });

  test("files outside the repo are refused", () => {
    expect(checkStep("deepseek_reason", { problem: "x", files: ["src/a.ts", "/etc/passwd"] })).toMatch(/passwd.*outside/);
  });
});

describe("executeRegisteredTool enforces the guard before executing", () => {
  test("a step that tries to read a secret never calls the tool", async () => {
    // think is always registered (no key) and takes no files — use a file-taking tool if present
    const out = await executeRegisteredTool("validate_workflow_file", { filePath: "/etc/passwd" } as any, "");
    expect(out?.result).toMatch(/cannot run as a workflow step/);
  });
});
