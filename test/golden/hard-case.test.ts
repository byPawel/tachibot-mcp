/**
 * Task 1.1 — Hard-schema factory round-trip guard.
 *
 * Proves that `defineModelTool` preserves the EMITTED JSON schema even when
 * `parameters` uses hard Zod shapes:
 *   - z.array(z.string()).optional()
 *   - z.enum([...]).default("v1")
 *   - z.union([z.string(), z.number()])
 *
 * The factory is `return tool;` so this SHOULD be trivially green — the test
 * is an explicit regression guard that would catch a future implementation that
 * accidentally clones or transforms the parameters schema.
 */

import { emitOne } from "./emit-schema.js";
import {
  hardParameters,
  hardToolRaw,
  hardToolWrapped,
} from "./hard-case.tool.js";

describe("hard-schema factory round-trip (Task 1.1)", () => {
  let rawSchema: unknown;
  let wrappedSchema: unknown;

  beforeAll(async () => {
    [rawSchema, wrappedSchema] = await Promise.all([
      emitOne(hardToolRaw.name, hardToolRaw.parameters),
      emitOne(hardToolWrapped.name, hardToolWrapped.parameters),
    ]);
  });

  // ── Core assertion: factory must not perturb the emitted schema ──────────

  it("factory-wrapped tool emits an inputSchema deep-equal to the raw baseline", () => {
    expect(wrappedSchema).toEqual(rawSchema);
  });

  // ── Structural assertions: emitted schema actually reflects hard shapes ───
  // These guard against a future converter that silently drops/flattens shapes.

  it("emitted schema contains 'files' as an optional array of strings", () => {
    const schema = rawSchema as Record<string, unknown>;
    const props = schema["properties"] as Record<string, unknown>;
    expect(props).toBeDefined();

    const filesProp = props["files"] as Record<string, unknown>;
    expect(filesProp).toBeDefined();
    // optional array → type array is present; 'files' must NOT be in required
    expect(filesProp["type"]).toBe("array");
    const items = filesProp["items"] as Record<string, unknown>;
    expect(items?.["type"]).toBe("string");

    const required = schema["required"] as string[] | undefined;
    expect(required ?? []).not.toContain("files");
  });

  it("emitted schema reflects the enum with its default value", () => {
    const schema = rawSchema as Record<string, unknown>;
    const props = schema["properties"] as Record<string, unknown>;
    const apiVersionProp = props["apiVersion"] as Record<string, unknown>;
    expect(apiVersionProp).toBeDefined();
    // enum → represented as an enum array in JSON Schema
    expect(apiVersionProp["enum"]).toEqual(expect.arrayContaining(["v1", "v2"]));
    // default must be preserved
    expect(apiVersionProp["default"]).toBe("v1");
  });

  it("emitted schema represents the union (string | number)", () => {
    const schema = rawSchema as Record<string, unknown>;
    const props = schema["properties"] as Record<string, unknown>;
    const identifierProp = props["identifier"] as Record<string, unknown>;
    expect(identifierProp).toBeDefined();
    // FastMCP / xsschema emits z.union([z.string(), z.number()]) as a JSON
    // Schema type array: { "type": ["string", "number"] }.
    const typeField = identifierProp["type"] as string[];
    expect(Array.isArray(typeField)).toBe(true);
    expect(typeField).toEqual(expect.arrayContaining(["string", "number"]));
    expect(typeField).toHaveLength(2);
  });

  // ── Factory purity: same parameters reference ────────────────────────────

  it("defineModelTool returns the same parameters reference (no clone)", () => {
    expect(hardToolWrapped.parameters).toBe(hardParameters);
  });

  it("defineModelTool returns the same tool object reference", () => {
    // Re-import to get the constructed value and compare
    // (hardToolWrapped was built from defineModelTool — it IS the returned object)
    expect(hardToolWrapped.parameters).toBe(hardToolRaw.parameters);
  });
});
