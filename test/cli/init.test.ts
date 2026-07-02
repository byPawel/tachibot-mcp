import { detectSetup, buildClaudeCodeCommand, buildDesktopSnippet } from "../../src/cli/init.js";

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
