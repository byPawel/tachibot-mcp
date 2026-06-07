/**
 * Task 0.3 — Shared Zod base schema partials.
 *
 * Verifies:
 *   1. Each exported partial parses a valid representative input and rejects
 *      an invalid one (type-safety / runtime parse guard).
 *   2. A z.object spread with the partial emits an IDENTICAL inputSchema
 *      (via FastMCP's real ListTools wire path) as a hand-written z.object
 *      with the EXACT same field definition — the emit-equality assertion
 *      that is the codemod's safety gate.
 *
 * Emit-equality mechanism: we use the SAME FastMCPSession + InMemoryTransport
 * + MCP Client path that emit-schema.ts uses for the server-wide gate, so
 * the JSON schema comparison is against FastMCP's own `toJsonSchema` (via
 * xsschema), not a re-implementation. Each partial produces a throwaway tool
 * whose `inputSchema` from `client.listTools()` must deep-equal the one
 * produced by the hand-written equivalent.
 */

import { z } from "zod";
import { FastMCPSession } from "fastmcp";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";

import {
  filesField,
  reasoningContextField,
} from "../../src/tools/factory/base-schemas.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type CapturedTool = {
  name: string;
  description?: string;
  parameters?: unknown;
  [key: string]: unknown;
};

/**
 * Spin up a throwaway FastMCPSession with a single tool and return the
 * `inputSchema` exactly as an MCP client would receive it over the wire.
 * This is the same FastMCP ListTools path used by the server-wide harness.
 */
async function emitInputSchema(
  toolName: string,
  parameters: z.ZodObject<z.ZodRawShape>,
): Promise<unknown> {
  const tool: CapturedTool = {
    name: toolName,
    description: "throwaway tool for emit-equality test",
    parameters,
  };

  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const client = new Client(
    { name: "base-schemas-test-client", version: "0.0.0" },
    { capabilities: {} },
  );

  const session = new (FastMCPSession as unknown as {
    new (opts: Record<string, unknown>): { connect: (t: unknown) => Promise<void> };
  })({
    name: "base-schemas-test-session",
    version: "0.0.0",
    tools: [tool],
    prompts: [],
    resources: [],
    resourcesTemplates: [],
    transportType: "stdio",
  });

  await Promise.all([
    client.connect(clientTransport),
    session.connect(serverTransport),
  ]);

  let result: { tools: Array<Record<string, unknown>> };
  try {
    result = (await client.listTools()) as unknown as {
      tools: Array<Record<string, unknown>>;
    };
  } finally {
    await client.close().catch(() => {});
  }

  const emitted = result.tools.find((t) => t.name === toolName);
  if (!emitted) throw new Error(`Tool '${toolName}' not found in emitted list`);
  return emitted["inputSchema"];
}

// ---------------------------------------------------------------------------
// filesField
// ---------------------------------------------------------------------------

describe("filesField partial", () => {
  it("spreads into a z.object and parses a valid input", () => {
    const schema = z.object({ ...filesField });
    expect(schema.parse({ files: ["src/a.ts:1-10", "src/b.ts"] })).toEqual({
      files: ["src/a.ts:1-10", "src/b.ts"],
    });
  });

  it("parses with no files field (field is optional)", () => {
    const schema = z.object({ ...filesField });
    expect(schema.parse({})).toEqual({});
  });

  it("rejects a non-string array element", () => {
    const schema = z.object({ ...filesField });
    expect(() => schema.parse({ files: [123] })).toThrow();
  });

  it("rejects a non-array value", () => {
    const schema = z.object({ ...filesField });
    expect(() => schema.parse({ files: "src/a.ts" })).toThrow();
  });

  it("emit-equality: spread partial == hand-written identical definition", async () => {
    const DESCRIBE_TEXT =
      "File paths to read as code context. Supports line ranges: 'src/foo.ts:100-200'. Model sees ACTUAL CODE.";

    const fromPartial = z.object({ ...filesField });

    const handWritten = z.object({
      files: z.array(z.string()).optional().describe(DESCRIBE_TEXT),
    });

    const [schemaFromPartial, schemaHandWritten] = await Promise.all([
      emitInputSchema("emit_files_partial", fromPartial),
      emitInputSchema("emit_files_handwritten", handWritten),
    ]);

    expect(schemaFromPartial).toEqual(schemaHandWritten);
  });

  it("spread from two different tools creates independent z.object instances", () => {
    const schemaA = z.object({ ...filesField, extra: z.string() });
    const schemaB = z.object({ ...filesField });
    // They must not share the same object reference
    expect(schemaA).not.toBe(schemaB);
    // And schemaB must not have 'extra'
    const parsed = schemaB.safeParse({ files: [], extra: "x" });
    // extra is stripped (strict mode is not active by default, so parse strips unknown)
    expect(parsed.success).toBe(true);
    expect((parsed.data as Record<string, unknown>).extra).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// reasoningContextField
// ---------------------------------------------------------------------------

describe("reasoningContextField partial", () => {
  it("spreads into a z.object and parses a valid input", () => {
    const schema = z.object({ ...reasoningContextField });
    expect(
      schema.parse({ context: "Additional context for the reasoning task" }),
    ).toEqual({ context: "Additional context for the reasoning task" });
  });

  it("parses with no context (field is optional)", () => {
    const schema = z.object({ ...reasoningContextField });
    expect(schema.parse({})).toEqual({});
  });

  it("rejects a non-string context value", () => {
    const schema = z.object({ ...reasoningContextField });
    expect(() => schema.parse({ context: 42 })).toThrow();
  });

  it("emit-equality: spread partial == hand-written identical definition", async () => {
    const DESCRIBE_TEXT = "Additional context for the reasoning task";

    const fromPartial = z.object({ ...reasoningContextField });

    const handWritten = z.object({
      context: z.string().optional().describe(DESCRIBE_TEXT),
    });

    const [schemaFromPartial, schemaHandWritten] = await Promise.all([
      emitInputSchema("emit_context_partial", fromPartial),
      emitInputSchema("emit_context_handwritten", handWritten),
    ]);

    expect(schemaFromPartial).toEqual(schemaHandWritten);
  });

  it("can be combined with filesField in the same z.object", () => {
    const schema = z.object({ ...filesField, ...reasoningContextField });
    const parsed = schema.parse({
      files: ["src/foo.ts"],
      context: "some context",
    });
    expect(parsed).toEqual({ files: ["src/foo.ts"], context: "some context" });
  });
});
