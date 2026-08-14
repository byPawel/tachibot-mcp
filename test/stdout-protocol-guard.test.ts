/**
 * stdout protocol guard — no stdout writes in src/.
 *
 * WHY THIS EXISTS: TachiBot is a stdio-transport MCP server. stdout IS the
 * JSON-RPC channel between the server and the client. Anything written to
 * stdout that is not a JSON-RPC frame corrupts the protocol stream and can
 * break or wedge the client session. console.log, console.info and
 * console.debug all write to stdout, as does process.stdout.write, so every
 * diagnostic in src/ must use console.error (stderr) instead.
 *
 * If this test just failed on your new code: do NOT silence or exclude it —
 * change your console.log/info/debug(...) to console.error(...). The output
 * still shows up in the terminal/logs; it just stays off the protocol channel.
 *
 * Deliberate exclusions:
 *  - src/cli/          a real CLI, stdout is the correct place for its output
 *  - src/server-raw.ts not the live server (src/server.ts dispatches to
 *                      src/server-main.ts); kept out of scope intentionally
 */

import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

const SRC_DIR = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../src",
);

const EXCLUDED = [
  path.join(SRC_DIR, "cli") + path.sep, // CLI: stdout is correct there
  path.join(SRC_DIR, "server-raw.ts"), // not the live server
];

function collectTsFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...collectTsFiles(full));
    } else if (entry.isFile() && full.endsWith(".ts")) {
      out.push(full);
    }
  }
  return out;
}

// Every call form that writes to stdout. Paren-anchored so prose mentions in
// string literals (e.g. commit-guardian's "Remove console.log statements"
// suggestion text) don't trip the guard.
const STDOUT_WRITERS = [
  "console.log(",
  "console.info(",
  "console.debug(",
  "process.stdout.write(",
];

describe("stdout protocol guard", () => {
  it("src/ contains no stdout writes (stdout is the MCP JSON-RPC channel)", () => {
    const offenders: string[] = [];

    const files = collectTsFiles(SRC_DIR).filter(
      (f) => !EXCLUDED.some((ex) => f === ex || f.startsWith(ex)),
    );

    for (const file of files) {
      const lines = fs.readFileSync(file, "utf8").split("\n");
      lines.forEach((line, i) => {
        const trimmed = line.trim();
        // Skip pure comment lines — only executable writes corrupt stdout
        if (trimmed.startsWith("//") || trimmed.startsWith("*")) return;
        const hit = STDOUT_WRITERS.find((w) => line.includes(w));
        if (hit) {
          offenders.push(`${path.relative(SRC_DIR, file)}:${i + 1} (${hit}...)`);
        }
      });
    }

    if (offenders.length > 0) {
      throw new Error(
        `stdout write found in src/ — stdout is the MCP JSON-RPC protocol channel ` +
          `on stdio transport, so console.log/info/debug and process.stdout.write ` +
          `CORRUPT the stream and can break the client session. Use console.error ` +
          `instead (stderr is safe and still visible in logs). Offenders:\n  ` +
          `${offenders.join("\n  ")}`,
      );
    }
  });
});
