import { getOpenRouterModelTimeout, getTimeoutConfig } from "../timeout-config.js";

describe("getOpenRouterModelTimeout", () => {
  const { openrouter, openrouterThinking } = getTimeoutConfig();

  it("gives Kimi K2.x the extended thinking timeout (regression: kimi timeouts)", () => {
    // Kimi IDs contain neither "thinking" nor "reasoning" — they must still
    // be classified as slow reasoning models, else they fall back to 180s.
    expect(getOpenRouterModelTimeout("moonshotai/kimi-k2.5")).toBe(openrouterThinking);
    expect(getOpenRouterModelTimeout("moonshotai/kimi-k2.6")).toBe(openrouterThinking);
  });

  it("still gives explicit thinking/reasoning models the extended timeout", () => {
    expect(getOpenRouterModelTimeout("moonshotai/kimi-k2-thinking")).toBe(openrouterThinking);
    expect(getOpenRouterModelTimeout("some/model-reasoning")).toBe(openrouterThinking);
  });

  it("gives standard models the default timeout", () => {
    expect(getOpenRouterModelTimeout("qwen/qwen3-coder-next")).toBe(openrouter);
  });
});
