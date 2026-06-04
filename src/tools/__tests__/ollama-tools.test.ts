import { callOllama, OllamaUnavailableError } from "../ollama-tools";

describe("callOllama", () => {
  const realFetch = global.fetch;
  afterEach(() => {
    global.fetch = realFetch;
  });

  it("calls native /api/chat with num_ctx honored and strips :latest", async () => {
    let url = "";
    const seen: any = {};
    global.fetch = (async (u: string, init: any) => {
      url = u;
      Object.assign(seen, JSON.parse(init.body));
      return { ok: true, json: async () => ({ message: { content: "hi" } }) };
    }) as any;

    const out = await callOllama(
      "qwen2.5:latest",
      [{ role: "user", content: "ping" }],
      { numCtx: 8192 },
    );

    expect(out).toBe("hi");
    expect(url).toBe("http://127.0.0.1:11434/api/chat"); // native, NOT /v1 (which drops num_ctx)
    expect(seen.model).toBe("qwen2.5"); // :latest stripped
    expect(seen.options.num_ctx).toBe(8192); // honored on /api/chat
    expect(seen.stream).toBe(false);
  });

  it("throws a TYPED error when the daemon is offline (no sentinel string)", async () => {
    global.fetch = (async () => {
      throw new Error("ECONNREFUSED");
    }) as any;

    await expect(
      callOllama("qwen2.5", [{ role: "user", content: "ping" }]),
    ).rejects.toBeInstanceOf(OllamaUnavailableError);
  });
});
