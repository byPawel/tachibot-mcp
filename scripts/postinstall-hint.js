#!/usr/bin/env node
// Non-interactive npm postinstall can't prompt, so it points at the wizard
// (`tachibot init`) which configures keys/clients AND installs Claude Code
// skills with a per-skill skip choice — instead of silently writing to
// ~/.claude. Kept quiet in CI. Never fails the install.
try {
  if (process.env.CI || process.env.npm_config_loglevel === "silent") process.exit(0);
  const line = "─".repeat(64);
  process.stdout.write(
    `\n${line}\n` +
    ` TachiBot MCP installed.\n` +
    ` Next:  npx -y -p tachibot-mcp tachibot init\n` +
    `        configures API keys + client, and installs Claude Code skills\n` +
    `        (choose which to skip). Skills are opt-in — nothing was written\n` +
    `        to ~/.claude yet.\n` +
    `${line}\n`,
  );
} catch {
  // never break an install over a hint
}
