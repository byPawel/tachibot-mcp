import { callLocal, LocalLLMError } from "../local-tools";

describe("callLocal", () => {
  const realFetch = global.fetch;
  const origEnv = { ...process.env };
  afterEach(() => {
    global.fetch = realFetch;
    process.env = { ...origEnv };
  });

  it("uses Ollama native /api/chat with num_ctx honored (default base is Ollama)", async () => {
    let url = "";
    const seen: any = {};
    global.fetch = (async (u: string, init: any) => {
      url = u;
      Object.assign(seen, JSON.parse(init.body));
      return { ok: true, json: async () => ({ message: { content: "local answer" } }) };
    }) as any;

    const out = await callLocal([{ role: "user", content: "ping" }], {
      model: "hermes3:latest",
      numCtx: 8192,
    });

    expect(out).toBe("local answer");
    expect(url).toBe("http://localhost:11434/api/chat"); // native — /v1 would drop num_ctx
    expect(seen.model).toBe("hermes3"); // :latest stripped
    expect(seen.options.num_ctx).toBe(8192); // honored on native path
    expect(seen.stream).toBe(false);
  });

  it("uses OpenAI-compat /chat/completions for a non-Ollama endpoint", async () => {
    process.env.LOCAL_LLM_BASE_URL = "http://localhost:8000/v1"; // e.g. vLLM
    let url = "";
    global.fetch = (async (u: string) => {
      url = u;
      return { ok: true, json: async () => ({ choices: [{ message: { content: "ok" } }] }) };
    }) as any;

    const out = await callLocal([{ role: "user", content: "ping" }]);
    expect(out).toBe("ok");
    expect(url).toBe("http://localhost:8000/v1/chat/completions");
  });

  it("throws a TYPED LocalLLMError when the server is offline (no sentinel string)", async () => {
    global.fetch = (async () => {
      throw new Error("ECONNREFUSED");
    }) as any;

    await expect(
      callLocal([{ role: "user", content: "ping" }]),
    ).rejects.toBeInstanceOf(LocalLLMError);
  });
});
