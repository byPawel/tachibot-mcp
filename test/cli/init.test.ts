import { detectSetup, buildClaudeCodeCommand, buildDesktopSnippet, listAvailableSkills, parseSkipSelection, installSkills } from "../../src/cli/init.js";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

const probe = (haveClaude: boolean, haveDesktop: boolean) => ({
  which: (bin: string) => bin === "claude" && haveClaude,
  exists: (_p: string) => haveDesktop,
});

describe("tachibot init — detection and emission", () => {
  test("detects present and missing keys without leaking values", () => {
    const setup = detectSetup(
      { OPENROUTER_API_KEY: "sk-or-v1-secret123456", GOOGLE_API_KEY: "" } as any,
      probe(true, false),
    );
    const or = setup.keys.find((k) => k.envVar === "OPENROUTER_API_KEY")!;
    const gg = setup.keys.find((k) => k.envVar === "GOOGLE_API_KEY")!;
    expect(or.present).toBe(true);
    expect(gg.present).toBe(false);
    expect(JSON.stringify(setup)).not.toContain("secret123456");
  });

  test("detects clients via injected probe", () => {
    const setup = detectSetup({} as any, probe(true, true));
    expect(setup.clients.claudeCode).toBe(true);
    expect(setup.clients.claudeDesktop).toBe(true);
  });

  test("claude-code command uses the dual-bin-safe npx form and only present keys", () => {
    const setup = detectSetup({ PERPLEXITY_API_KEY: "pplx-abc" } as any, probe(true, false));
    const cmd = buildClaudeCodeCommand(setup);
    expect(cmd).toContain("claude mcp add tachibot");
    expect(cmd).toContain("npx -y -p tachibot-mcp tachibot");
    expect(cmd).toContain("--env PERPLEXITY_API_KEY=");
    expect(cmd).not.toContain("--env OPENROUTER_API_KEY=");
    expect(cmd).not.toContain("pplx-abc"); // placeholder, not the real value
  });

  test("desktop snippet is valid JSON with command tachibot and chosen profile", () => {
    const setup = detectSetup({ OPENROUTER_API_KEY: "x" } as any, probe(false, true));
    const snippet = buildDesktopSnippet(setup, "full");
    const parsed = JSON.parse(snippet);
    expect(parsed.mcpServers.tachibot.command).toBe("tachibot");
    expect(parsed.mcpServers.tachibot.env.TACHIBOT_PROFILE).toBe("full");
    expect(Object.keys(parsed.mcpServers.tachibot.env)).toContain("OPENROUTER_API_KEY");
  });
});

describe("tachibot init — skills install", () => {
  // Build a fixture skills dir with three fake skills.
  function fixture(): { skillsDir: string; targetDir: string } {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "tachi-skills-"));
    const skillsDir = path.join(root, "skills");
    for (const [name, desc] of [["alpha", "first skill"], ["beta", "second skill"], ["gamma", "third skill"]]) {
      const d = path.join(skillsDir, name);
      fs.mkdirSync(d, { recursive: true });
      fs.writeFileSync(path.join(d, "SKILL.md"), `---\nname: ${name}\ndescription: ${desc}\nuser-invocable: true\n---\n# ${name}\n`);
    }
    // a non-skill dir with no SKILL.md must be ignored
    fs.mkdirSync(path.join(skillsDir, "not-a-skill"), { recursive: true });
    return { skillsDir, targetDir: path.join(root, "target") };
  }

  test("listAvailableSkills reads name + description, ignores non-skill dirs", () => {
    const { skillsDir } = fixture();
    const skills = listAvailableSkills(skillsDir);
    expect(skills.map((s) => s.name)).toEqual(["alpha", "beta", "gamma"]); // sorted, no 'not-a-skill'
    expect(skills[1].description).toBe("second skill");
  });

  test("listAvailableSkills returns [] for a missing dir", () => {
    expect(listAvailableSkills("/no/such/dir")).toEqual([]);
  });

  test("parseSkipSelection turns 1-based input into 0-based indices, ignoring junk/out-of-range", () => {
    expect([...parseSkipSelection("1,3", 3)].sort()).toEqual([0, 2]);
    expect([...parseSkipSelection(" 2 ,, x, 9 ", 3)]).toEqual([1]); // 'x' and 9 dropped
    expect(parseSkipSelection("", 3).size).toBe(0);
  });

  test("installSkills copies only chosen skills into target/<name>/SKILL.md", () => {
    const { skillsDir, targetDir } = fixture();
    const installed = installSkills(["alpha", "gamma"], skillsDir, targetDir);
    expect(installed).toEqual(["alpha", "gamma"]);
    expect(fs.existsSync(path.join(targetDir, "alpha", "SKILL.md"))).toBe(true);
    expect(fs.existsSync(path.join(targetDir, "gamma", "SKILL.md"))).toBe(true);
    expect(fs.existsSync(path.join(targetDir, "beta", "SKILL.md"))).toBe(false);
  });

  test("installSkills skips names with no source file", () => {
    const { skillsDir, targetDir } = fixture();
    const installed = installSkills(["alpha", "ghost"], skillsDir, targetDir);
    expect(installed).toEqual(["alpha"]);
  });

  test("skip-then-install round trip: skipping #2 installs alpha + gamma", () => {
    const { skillsDir, targetDir } = fixture();
    const all = listAvailableSkills(skillsDir);
    const skip = parseSkipSelection("2", all.length);
    const chosen = all.filter((_, i) => !skip.has(i)).map((s) => s.name);
    expect(installSkills(chosen, skillsDir, targetDir)).toEqual(["alpha", "gamma"]);
  });
});
