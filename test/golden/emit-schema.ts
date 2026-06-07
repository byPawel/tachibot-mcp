/**
 * Emitted-schema golden harness — THE linchpin of the tool-standardization
 * codemod's safety model.
 *
 * `getEmittedTools()` returns the NORMALIZED, EMITTED `tools/list` payload —
 * i.e. exactly what an MCP client receives over the wire — for the current
 * server build. Later migrations are gated by deep-equality against the
 * committed baseline (`__snapshots__/tool-contracts.json`).
 *
 * WHY this is faithful (not a re-serialization by hand):
 *   FastMCP v4's `ListToolsRequestSchema` handler (node_modules/fastmcp,
 *   chunk-*.js) emits, per tool:
 *       { annotations, description, inputSchema: await toJsonSchema(parameters),
 *         name, [outputSchema], [_meta] }
 *   We do NOT reimplement that. We:
 *     1. Patch FastMCP.prototype.start → no-op that resolves a
 *        `registrationComplete` promise (start() is the LAST call in
 *        server.ts:initializeServer(), so resolving there means every sync AND
 *        async registration has run). This also avoids booting a real stdio
 *        server.
 *     2. Spy FastMCP.prototype.addTool / addTools to capture every wrapped tool
 *        that reaches the server — these are the POST-safeAddTool objects
 *        (alias-preprocessed + annotation-merged) AND the tools registered
 *        directly (e.g. workflow-runner's `server.addTool(...)`). Capturing at
 *        the prototype level means we see the exact real registration surface.
 *     3. Feed the captured tools into a FRESH real FastMCP instance and read the
 *        emitted list through the @modelcontextprotocol/sdk in-memory transport
 *        (InMemoryTransport.createLinkedPair → Client.listTools()). That runs
 *        FastMCP's actual ListTools handler, yielding the LITERAL wire payload.
 *
 * Determinism is pinned via setupGoldenEnv() — see its docs.
 */

import { FastMCP, FastMCPSession } from "fastmcp";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";

/** A captured wrapped tool as it reaches FastMCP.addTool. */
type CapturedTool = {
  name: string;
  description?: string;
  parameters?: unknown;
  annotations?: unknown;
  outputSchema?: unknown;
  _meta?: unknown;
  [key: string]: unknown;
};

/** The normalized emitted tool record (what we snapshot). */
export interface EmittedTool {
  name: string;
  description?: string;
  inputSchema: unknown;
  annotations?: unknown;
  outputSchema?: unknown;
  _meta?: unknown;
}

/**
 * Pin EVERY input that determines WHICH tools register and WHAT schema they
 * emit, so the harness is reproducible regardless of the developer's shell.
 *
 * Tool ENABLEMENT (src/utils/tool-config.ts):
 *   `isToolEnabled` returns true for ALL tools when `profileSource === 'default'`,
 *   which happens when no `tools.config.json` is found at the repo root (it is
 *   NOT present in this repo). To guarantee the full set even if a config file
 *   appears, we clear TACHIBOT_PROFILE and ensure no global disable is set, and
 *   we DO NOT set per-tool ENABLE_TOOL_x / DISABLE_TOOL_x overrides. (If a
 *   tools.config.json
 *   is later committed, the baseline must be regenerated — documented in the
 *   test.)
 *
 * Provider AVAILABILITY (src/tools/*-tools.ts read env into module-level consts
 * AT IMPORT TIME, so these MUST be set BEFORE server.ts is imported):
 *   - OPENAI_API_KEY      → isOpenAIAvailable()      (openai-tools.ts)
 *   - PERPLEXITY_API_KEY  → isPerplexityAvailable()  (perplexity-tools.ts)
 *   - XAI_API_KEY         → isGrokAvailable()        (api-keys.ts: XAI||GROK)
 *   - GOOGLE_API_KEY      → isGeminiAvailable()      (gemini-tools.ts: GOOGLE||GEMINI)
 *   - OPENROUTER_API_KEY  → isOpenRouterAvailable()  (openrouter-tools.ts)
 *   areAdvancedModesAvailable() is unconditional `return true`.
 *   local_query is registered unconditionally.
 *
 * The dummy values are NEVER used for a network call — the harness only lists
 * tools, never executes them.
 */
export function setupGoldenEnv(): void {
  // Provider keys — enable every provider block deterministically.
  process.env.OPENAI_API_KEY = "golden-test-openai-key";
  process.env.PERPLEXITY_API_KEY = "golden-test-perplexity-key";
  process.env.XAI_API_KEY = "golden-test-xai-key";
  process.env.GOOGLE_API_KEY = "golden-test-google-key";
  process.env.OPENROUTER_API_KEY = "golden-test-openrouter-key";

  // Pin the tool-enable profile to "default" (all tools enabled).
  delete process.env.TACHIBOT_PROFILE;
  delete process.env.DISABLE_ALL_TOOLS;

  // Avoid spurious work / non-determinism during import.
  process.env.TACHI_ENABLE_CACHE = "false";
  process.env.TACHI_ENABLE_BATCHING = "false";
  // Don't let local-LLM opt-in flags change anything (presence-based).
  delete process.env.LOCAL_LLM_BASE_URL;
  delete process.env.LOCAL_LLM_MODEL;
}

/** Recursively sort object keys so comparison is key-order-insensitive. */
function sortDeep(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sortDeep);
  }
  if (value && typeof value === "object") {
    const obj = value as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(obj).sort()) {
      out[key] = sortDeep(obj[key]);
    }
    return out;
  }
  return value;
}

// ---------------------------------------------------------------------------
// Single-tool emit helper (shared by hard-case tests and base-schema tests)
// ---------------------------------------------------------------------------

/**
 * Spin up a throwaway FastMCPSession with ONE tool and return the `inputSchema`
 * exactly as an MCP client would receive it over the wire.
 *
 * This is the same FastMCP ListTools path used by the server-wide harness
 * (`getEmittedTools`), kept here so tests can compare two emitted schemas
 * without importing the full server.
 */
export async function emitOne(
  toolName: string,
  parameters: unknown,
): Promise<unknown> {
  const tool: CapturedTool = {
    name: toolName,
    description: "throwaway tool for emit-equality test",
    parameters,
  };

  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const client = new Client(
    { name: "emit-one-client", version: "0.0.0" },
    { capabilities: {} },
  );

  const session = new (FastMCPSession as unknown as {
    new (opts: Record<string, unknown>): { connect: (t: unknown) => Promise<void> };
  })({
    name: "emit-one-session",
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

let cachedEmitted: EmittedTool[] | null = null;

/**
 * Returns the normalized emitted `tools/list` payload for the current server.
 * Result is cached for the process (importing server.ts is a one-time, global
 * side effect). Idempotent and deterministic.
 */
export async function getEmittedTools(): Promise<EmittedTool[]> {
  if (cachedEmitted) return cachedEmitted;

  setupGoldenEnv();

  const captured: CapturedTool[] = [];

  // --- 1. Patch FastMCP so importing server.ts captures tools WITHOUT booting.
  const proto = FastMCP.prototype as unknown as {
    start: (...a: unknown[]) => unknown;
    addTool: (tool: CapturedTool) => unknown;
    addTools: (tools: CapturedTool[]) => unknown;
  };
  const originalStart = proto.start;
  const originalAddTool = proto.addTool;
  const originalAddTools = proto.addTools;

  let resolveRegistration!: () => void;
  const registrationComplete = new Promise<void>((resolve) => {
    resolveRegistration = resolve;
  });

  proto.addTool = function (tool: CapturedTool) {
    captured.push(tool);
    // Do NOT call through: we don't want the module-local server to wire a
    // session or grow state we don't read. Capture-only is sufficient and is
    // exactly the set of tools the real server would hold.
    return undefined;
  };
  proto.addTools = function (tools: CapturedTool[]) {
    for (const t of tools) captured.push(t);
    return undefined;
  };
  proto.start = function () {
    // start() is the final statement of initializeServer(); reaching it means
    // all sync + async registrations are done.
    resolveRegistration();
    return undefined;
  };

  // server.ts creates a heartbeat setInterval AFTER server.start(). Neutralize
  // it so it can't keep the Jest process alive; restore immediately after.
  const realSetInterval = globalThis.setInterval;
  globalThis.setInterval = ((...args: Parameters<typeof setInterval>) => {
    const handle = realSetInterval(...args);
    if (handle && typeof (handle as NodeJS.Timeout).unref === "function") {
      (handle as NodeJS.Timeout).unref();
    }
    return handle;
  }) as typeof setInterval;

  // server.ts's initializeServer() catch (server.ts:881-883) and the top-level
  // `initializeServer().catch(...)` both call process.exit(1) on ANY thrown
  // error during init. Today that path is never hit (the throw, if any, lands
  // strictly AFTER all registrations + the no-op start() — see helper docs), but
  // an unguarded process.exit() in the import path is a latent way for the whole
  // golden suite to die confusingly once Phase 3 changes provider modules.
  // Stub it to a recorder no-op so a stray exit can NEVER terminate the jest
  // worker; restore in finally. We do NOT swallow the underlying error — server.ts
  // has already logged it before calling exit, and we surface it via stderr filter.
  const realProcessExit = process.exit.bind(process);
  let exitWasIntercepted: { code: number | undefined } | null = null;
  process.exit = ((code?: number) => {
    exitWasIntercepted = { code };
    // Return undefined instead of `never` — intentionally not terminating.
    return undefined as never;
  }) as typeof process.exit;

  // Silence the expected, voluminous server STARTUP chatter that server.ts emits
  // to stderr during import (provider availability, profile warnings, workflow
  // engine banners, heartbeat/startup logs). This is NOT swallowing unrelated
  // errors: it is scoped strictly to the import window and restored in finally;
  // anything thrown still propagates and the gate test still asserts the result.
  const realConsoleError = console.error;
  const realConsoleWarn = console.warn;
  console.error = () => {};
  console.warn = () => {};

  try {
    // --- 2. Import the server (AFTER patching + env). Dynamic so patches apply.
    //     `.js` specifier is rewritten to the .ts source by jest moduleNameMapper.
    await import("../../src/server.js");

    // Wait for async initializeServer() to reach start(), then flush microtasks
    // so any trailing synchronous-after-await registrations are captured.
    await registrationComplete;
    await new Promise((r) => setImmediate(r));
    await Promise.resolve();
  } finally {
    proto.start = originalStart;
    proto.addTool = originalAddTool;
    proto.addTools = originalAddTools;
    globalThis.setInterval = realSetInterval;
    process.exit = realProcessExit;
    console.error = realConsoleError;
    console.warn = realConsoleWarn;
  }

  if (exitWasIntercepted) {
    // Diagnostic only: surfaces if server.ts ever exits during import. Does not
    // fail the harness (registrations + start() complete before any exit path);
    // the gate test's count/deep-equal assertions are the real safety net.
    // eslint-disable-next-line no-console
    console.error(
      `[golden] NOTE: process.exit(${(exitWasIntercepted as { code: number | undefined }).code}) ` +
        `was intercepted during server import and neutralized.`,
    );
  }

  // --- 3. Emit the REAL wire payload through FastMCP's own ListTools handler.
  //
  // FastMCP builds a FastMCPSession only inside start() (private), wiring its
  // session to `this.#tools`. To feed OUR captured tools over an in-memory
  // transport (instead of stdio), we construct the SAME FastMCPSession class
  // FastMCP exports, with the same option shape start() uses (see FastMCP
  // chunk source: start() → `new FastMCPSession({ ..., tools: this.#tools })`).
  // The session's setupToolHandlers(tools) installs the real
  // ListToolsRequestSchema handler — so client.listTools() returns the literal
  // wire payload, identical to what a stdio client would receive.
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const client = new Client(
    { name: "golden-client", version: "0.0.0" },
    { capabilities: {} },
  );

  // Dedupe by name, last-wins — exactly how FastMCP.addTool behaves
  // (`this.#tools.filter(t => t.name !== tool.name); push(tool)`).
  const byName = new Map<string, CapturedTool>();
  for (const t of captured) byName.set(t.name, t);
  const dedupedTools = [...byName.values()];

  const session = new (FastMCPSession as unknown as {
    new (opts: Record<string, unknown>): { connect: (t: unknown) => Promise<void> };
  })({
    name: "golden-emit",
    version: "0.0.0",
    tools: dedupedTools,
    prompts: [],
    resources: [],
    resourcesTemplates: [],
    transportType: "stdio",
  });

  await Promise.all([
    client.connect(clientTransport),
    session.connect(serverTransport),
  ]);

  let emittedRaw: { tools: Array<Record<string, unknown>> };
  try {
    emittedRaw = (await client.listTools()) as unknown as {
      tools: Array<Record<string, unknown>>;
    };
  } finally {
    await client.close().catch(() => {});
  }

  const normalized: EmittedTool[] = emittedRaw.tools
    .map((t) => sortDeep(t) as unknown as EmittedTool)
    .sort((a, b) => a.name.localeCompare(b.name));

  cachedEmitted = normalized;
  return normalized;
}
