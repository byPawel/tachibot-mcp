/**
 * GATE TEST — the wire-contract guard for the tool-standardization codemod.
 *
 * Asserts that the normalized, emitted `tools/list` payload (what an MCP client
 * actually receives) deep-equals the committed baseline AND has the exact same
 * tool count. Any addition, removal, or schema drift fails loudly.
 *
 * This MUST run green against the current, unmodified server — that is the
 * proof the harness is faithful to reality. Later migrations are gated by
 * re-running this test; if a migration is truly behavior-preserving, the
 * emitted contract is unchanged and this test stays green.
 *
 * Regenerate the baseline (e.g. after an INTENTIONAL contract change, a profile
 * change, or a tools.config.json being committed):
 *     UPDATE_GOLDEN=1 npm run test:golden
 */

import { readFileSync, writeFileSync, existsSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { getEmittedTools, EmittedTool } from "./emit-schema.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const BASELINE_PATH = join(__dirname, "__snapshots__", "tool-contracts.json");

describe("emitted tool contracts (wire-payload golden)", () => {
  let emitted: EmittedTool[];

  beforeAll(async () => {
    emitted = await getEmittedTools();
  });

  it("matches the committed baseline (deep-equal) and exact tool count", () => {
    if (process.env.UPDATE_GOLDEN === "1") {
      writeFileSync(BASELINE_PATH, JSON.stringify(emitted, null, 2) + "\n", "utf-8");
      // eslint-disable-next-line no-console
      console.error(
        `[golden] Wrote baseline with ${emitted.length} tools to ${BASELINE_PATH}`,
      );
      return;
    }

    if (!existsSync(BASELINE_PATH)) {
      throw new Error(
        `Golden baseline missing at ${BASELINE_PATH}. ` +
          `Generate it with: UPDATE_GOLDEN=1 npm run test:golden`,
      );
    }

    const baseline = JSON.parse(readFileSync(BASELINE_PATH, "utf-8")) as EmittedTool[];

    // Exact count first — surfaces additions/removals with a clear message.
    expect(emitted.length).toBe(baseline.length);

    // Deep equality of the entire normalized payload (the wire contract).
    expect(emitted).toEqual(baseline);
  });

  it("emits a non-empty, name-sorted, unique-named tool list", () => {
    expect(emitted.length).toBeGreaterThan(0);

    const names = emitted.map((t) => t.name);
    const sorted = [...names].sort((a, b) => a.localeCompare(b));
    expect(names).toEqual(sorted);
    expect(new Set(names).size).toBe(names.length);
  });

  it("every emitted tool has a name, description, and inputSchema", () => {
    for (const tool of emitted) {
      expect(typeof tool.name).toBe("string");
      expect(tool.name.length).toBeGreaterThan(0);
      expect(typeof tool.description).toBe("string");
      expect(tool.inputSchema).toBeDefined();
      expect(typeof tool.inputSchema).toBe("object");
    }
  });
});
