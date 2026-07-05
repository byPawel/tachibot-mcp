/**
 * `tachibot init` — setup wizard. Detection + emission first: pure functions
 * detect keys/clients and emit EXACT per-client instructions; a thin
 * readline layer only picks the client. Keys are never written to disk by
 * default and never echoed (masked to 6 chars). Node built-ins only.
 */
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import * as readline from "node:readline/promises";
import { fileURLToPath } from "node:url";

const KEYS = [
  { name: "OpenRouter", envVar: "OPENROUTER_API_KEY", unlocks: "DeepSeek/GLM/Kimi/Qwen/MiniMax/StepFun/ERNIE + planner (~30 tools)" },
  { name: "Perplexity", envVar: "PERPLEXITY_API_KEY", unlocks: "web research tools" },
  { name: "Gemini / Google", envVar: "GOOGLE_API_KEY", unlocks: "Gemini tools + jury judge + diff_review/plan_critique" },
  { name: "OpenAI", envVar: "OPENAI_API_KEY", unlocks: "GPT-5.5 tools + spec_writer" },
  { name: "Grok / xAI", envVar: "GROK_API_KEY", unlocks: "Grok tools + debug_triage" },
] as const;

export interface DetectedSetup {
  keys: { name: string; envVar: string; present: boolean; unlocks: string }[];
  clients: { claudeCode: boolean; claudeDesktop: boolean; desktopConfigPath: string | null };
}

function defaultProbe() {
  return {
    // PATH lookup done via fs, not a subprocess: no shell involved, no injection surface.
    which: (bin: string): boolean => {
      const dirs = (process.env.PATH || "").split(path.delimiter).filter(Boolean);
      const exts = process.platform === "win32" ? [".exe", ".cmd", ".bat", ""] : [""];
      return dirs.some((dir) => exts.some((ext) => {
        try { return fs.statSync(path.join(dir, bin + ext)).isFile(); } catch { return false; }
      }));
    },
    exists: (p: string): boolean => fs.existsSync(p),
  };
}

function desktopConfigPath(): string {
  if (process.platform === "darwin") {
    return path.join(os.homedir(), "Library", "Application Support", "Claude", "claude_desktop_config.json");
  }
  if (process.platform === "win32") {
    return path.join(process.env.APPDATA || "", "Claude", "claude_desktop_config.json");
  }
  return path.join(os.homedir(), ".config", "Claude", "claude_desktop_config.json");
}

export function detectSetup(
  env: NodeJS.ProcessEnv = process.env,
  probe = defaultProbe(),
): DetectedSetup {
  const keys = KEYS.map((k) => ({
    name: k.name,
    envVar: k.envVar,
    present: Boolean(env[k.envVar]?.trim()),
    unlocks: k.unlocks,
  }));
  // Gemini/Grok alternates count as present
  const alt = (primary: string, alternate: string) => {
    const row = keys.find((k) => k.envVar === primary)!;
    if (!row.present && env[alternate]?.trim()) row.present = true;
  };
  alt("GOOGLE_API_KEY", "GEMINI_API_KEY");
  alt("GROK_API_KEY", "XAI_API_KEY");

  const dcp = desktopConfigPath();
  return {
    keys,
    clients: {
      claudeCode: probe.which("claude"),
      claudeDesktop: probe.exists(dcp),
      desktopConfigPath: probe.exists(dcp) ? dcp : null,
    },
  };
}

export function buildClaudeCodeCommand(setup: DetectedSetup): string {
  const envFlags = setup.keys
    .filter((k) => k.present)
    .map((k) => `--env ${k.envVar}=<your-${k.name.toLowerCase().replace(/[^a-z]+/g, "-")}-key>`)
    .join(" \\\n  ");
  return [
    "claude mcp add tachibot \\",
    envFlags ? `  ${envFlags} \\` : null,
    "  -- npx -y -p tachibot-mcp tachibot",
  ].filter(Boolean).join("\n");
}

export function buildDesktopSnippet(setup: DetectedSetup, profile: string): string {
  const env: Record<string, string> = {};
  for (const k of setup.keys.filter((k) => k.present)) env[k.envVar] = `<your-${k.envVar}>`;
  env.TACHIBOT_PROFILE = profile;
  return JSON.stringify({ mcpServers: { tachibot: { command: "tachibot", env } } }, null, 2);
}

const mask = (v: string | undefined) => (v ? `${v.slice(0, 6)}…` : "");

// ---- Skills -----------------------------------------------------------------
// The wizard is the opt-in install path for Claude Code skills (postinstall no
// longer writes to ~/.claude silently). All fs logic is pure/testable; the
// readline glue in runInitWizard is the only untested part.

export interface AvailableSkill { name: string; description: string; }

/** The package's bundled skills dir. dist/src/cli/init.js → up 3 → pkg root. */
export function resolveSkillsDir(): string {
  const here = path.dirname(fileURLToPath(import.meta.url));
  return path.resolve(here, "..", "..", "..", "skills");
}

/** Read `skills/<name>/SKILL.md`, pulling the frontmatter `description`. */
export function listAvailableSkills(skillsDir: string): AvailableSkill[] {
  let entries: string[];
  try { entries = fs.readdirSync(skillsDir).sort(); } catch { return []; }
  const skills: AvailableSkill[] = [];
  for (const name of entries) {
    let text: string;
    try { text = fs.readFileSync(path.join(skillsDir, name, "SKILL.md"), "utf8"); }
    catch { continue; } // not a skill dir
    const m = text.match(/^description:\s*(.+)$/m);
    skills.push({ name, description: m ? m[1].trim() : "" });
  }
  return skills;
}

/**
 * Parse a "skip which" answer ("1,3, 5") into a set of 0-based indices over a
 * list of `count`. Blanks, non-numbers, and out-of-range tokens are ignored so
 * a fat-fingered entry never throws or skips the wrong skill.
 */
export function parseSkipSelection(input: string, count: number): Set<number> {
  const skip = new Set<number>();
  for (const tok of input.split(/[\s,]+/).filter(Boolean)) {
    const n = Number(tok);
    if (Number.isInteger(n) && n >= 1 && n <= count) skip.add(n - 1);
  }
  return skip;
}

/** Copy the chosen skills' SKILL.md into `targetDir/<name>/`. Returns installed names. */
export function installSkills(names: string[], skillsDir: string, targetDir: string): string[] {
  const installed: string[] = [];
  for (const name of names) {
    const src = path.join(skillsDir, name, "SKILL.md");
    if (!fs.existsSync(src)) continue;
    const dest = path.join(targetDir, name);
    fs.mkdirSync(dest, { recursive: true });
    fs.copyFileSync(src, path.join(dest, "SKILL.md"));
    installed.push(name);
  }
  return installed;
}

export async function runInitWizard(): Promise<void> {
  const setup = detectSetup();
  const out = (s: string) => process.stdout.write(s + "\n");

  out("\nTACHIBOT INIT\n=============");
  out("\nAPI keys detected in this shell:");
  for (const k of setup.keys) {
    out(`  ${k.present ? "✓" : "✗"} ${k.name} (${k.envVar})${k.present ? ` ${mask(process.env[k.envVar])}` : ""} — ${k.unlocks}`);
  }
  if (!setup.keys.some((k) => k.present)) {
    out("\nNo keys found. Get ONE key to start — OPENROUTER_API_KEY unlocks the most tools (openrouter.ai).");
  }

  out("\nClients detected:");
  out(`  ${setup.clients.claudeCode ? "✓" : "✗"} Claude Code (claude on PATH)`);
  out(`  ${setup.clients.claudeDesktop ? "✓" : "✗"} Claude Desktop${setup.clients.desktopConfigPath ? ` (${setup.clients.desktopConfigPath})` : ""}`);

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  try {
    const choice = (await rl.question("\nSet up for: [1] Claude Code  [2] Claude Desktop  [3] both  [q] quit > ")).trim();
    if (choice === "q") return;
    const profile = (await rl.question("Profile [full=all 64 tools | balanced | code_focus] (default: full) > ")).trim() || "full";

    if (choice === "1" || choice === "3") {
      out("\n— Claude Code — run this (fill in your real keys):\n");
      out(buildClaudeCodeCommand(setup));
      out("\nThen verify with /mcp inside Claude Code.");
    }
    if (choice === "2" || choice === "3") {
      out("\n— Claude Desktop — easiest: double-click the tachibot-mcp.mcpb extension package (see GitHub releases).");
      out("Or merge this into " + (setup.clients.desktopConfigPath ?? desktopConfigPath()) + ":\n");
      out(buildDesktopSnippet(setup, profile));
      out("\nThen restart Claude Desktop.");
    }
    // Skills — Claude Code slash commands, opt-in with per-skill skip.
    const skillsDir = resolveSkillsDir();
    const available = listAvailableSkills(skillsDir);
    if (available.length > 0 && choice !== "2") {
      const target = path.join(os.homedir(), ".claude", "skills");
      const ans = (await rl.question(
        `\nInstall ${available.length} Claude Code skills to ${target}? [Enter]=all · [s]=choose which to skip · [n]=none > `
      )).trim().toLowerCase();
      if (ans !== "n") {
        let chosen = available.map((s) => s.name);
        if (ans === "s") {
          out("");
          available.forEach((s, i) => out(`  ${String(i + 1).padStart(2)}. /${s.name} — ${s.description}`));
          const skip = parseSkipSelection(
            (await rl.question("\nSkip which? (comma-separated numbers, blank = skip none) > ")).trim(),
            available.length,
          );
          chosen = available.filter((_, i) => !skip.has(i)).map((s) => s.name);
        }
        const installed = installSkills(chosen, skillsDir, target);
        out(`\n✓ Installed ${installed.length} skill${installed.length === 1 ? "" : "s"}: ${installed.map((n) => "/" + n).join(", ")}`);
        const skipped = available.filter((s) => !installed.includes(s.name));
        if (skipped.length) out(`  Skipped: ${skipped.map((s) => "/" + s.name).join(", ")}`);
      }
    }

    out("\nFirst thing to run once connected: the `doctor` tool — it shows which tools your keys unlock.");
  } finally {
    rl.close();
  }
}
