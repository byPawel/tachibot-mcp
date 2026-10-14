import { OpenRouterModel } from "../openrouter-tools";

describe("roster expansion: StepFun models", () => {
  it("registers the verified slugs", () => {
    expect(OpenRouterModel.STEPFUN_5_PREVIEW).toBe("stepfun/step-5-preview");
    expect(OpenRouterModel.STEPFUN_3_7).toBe("stepfun/step-3.7-flash");
    expect(OpenRouterModel.STEPFUN_3_5).toBe("stepfun/step-3.5-flash");
    // ERNIE left OpenRouter on 2026-10-08 — the slug must not come back
    expect((OpenRouterModel as Record<string, string>).ERNIE_4_5_VL).toBeUndefined();
  });
});

import { getOpenRouterModelTimeout } from "../../config/timeout-config";

describe("roster expansion: timeouts", () => {
  it("gives StepFun the extended 600s ceiling", () => {
    expect(getOpenRouterModelTimeout("stepfun/step-3.7-flash")).toBe(600000);
    expect(getOpenRouterModelTimeout("stepfun/step-5-preview")).toBe(600000);
  });
  it("leaves non-reasoning models at the 180s default", () => {
    expect(getOpenRouterModelTimeout("qwen/qwen3-coder-next")).toBe(180000);
  });
});

import * as openrouterTools from "../openrouter-tools";
const { stepfunReasonTool } = openrouterTools;

describe("roster expansion: new tools", () => {
  it("exposes stepfun_reason; ernie_reason is gone", () => {
    expect(stepfunReasonTool.name).toBe("stepfun_reason");
    expect((openrouterTools as Record<string, unknown>).ernieReasonTool).toBeUndefined();
    // parameters schema accepts a problem string
    expect(stepfunReasonTool.parameters.safeParse({ problem: "x" }).success).toBe(true);
  });
});

import { JUROR_REGISTRY } from "../jury-tool";

describe("roster expansion: jurors", () => {
  it("adds deepseek + glm jurors with label/role/call", () => {
    expect(JUROR_REGISTRY["ernie"]).toBeUndefined();
    for (const k of ["deepseek", "glm", "stepfun"]) {
      expect(JUROR_REGISTRY[k]).toBeDefined();
      expect(typeof JUROR_REGISTRY[k].label).toBe("string");
      expect(JUROR_REGISTRY[k].label.length).toBeGreaterThan(0);
      expect(typeof JUROR_REGISTRY[k].role).toBe("string");
      expect(typeof JUROR_REGISTRY[k].call).toBe("function");
    }
  });
});

import { DEFAULT_JURORS } from "../jury-tool";

describe("roster expansion: default panel", () => {
  it("includes deepseek and stays 3-5 jurors", () => {
    expect(DEFAULT_JURORS).toContain("deepseek");
    expect(DEFAULT_JURORS.length).toBeGreaterThanOrEqual(3);
    expect(DEFAULT_JURORS.length).toBeLessThanOrEqual(5);
  });
});

describe("local juror honesty", () => {
  it("has exactly one local juror — no hermes persona variant", () => {
    expect(JUROR_REGISTRY["local"]).toBeDefined();
    expect(JUROR_REGISTRY["hermes"]).toBeUndefined();
  });
  it("local juror prompt anchors true identity (no false-role claim)", () => {
    // The system prompt must not claim to BE a specific model like Hermes;
    // it should describe the juror as a local open-weights model.
    expect(JUROR_REGISTRY["local"].role).toMatch(/local open-weights/i);
  });
});
