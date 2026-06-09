import { OpenRouterModel } from "../openrouter-tools";

describe("roster expansion: StepFun + ERNIE models", () => {
  it("registers the verified slugs", () => {
    expect(OpenRouterModel.STEPFUN_3_7).toBe("stepfun/step-3.7-flash");
    expect(OpenRouterModel.STEPFUN_3_5).toBe("stepfun/step-3.5-flash");
    expect(OpenRouterModel.ERNIE_4_5_VL).toBe("baidu/ernie-4.5-vl-424b-a47b");
  });
});

import { getOpenRouterModelTimeout } from "../../config/timeout-config";

describe("roster expansion: timeouts", () => {
  it("gives StepFun + ERNIE the extended 600s ceiling", () => {
    expect(getOpenRouterModelTimeout("stepfun/step-3.7-flash")).toBe(600000);
    expect(getOpenRouterModelTimeout("baidu/ernie-4.5-vl-424b-a47b")).toBe(600000);
  });
  it("leaves non-reasoning models at the 180s default", () => {
    expect(getOpenRouterModelTimeout("qwen/qwen3-coder-next")).toBe(180000);
  });
});

import { stepfunReasonTool, ernieReasonTool } from "../openrouter-tools";

describe("roster expansion: new tools", () => {
  it("exposes stepfun_reason and ernie_reason", () => {
    expect(stepfunReasonTool.name).toBe("stepfun_reason");
    expect(ernieReasonTool.name).toBe("ernie_reason");
    // parameters schema accepts a problem string
    expect(stepfunReasonTool.parameters.safeParse({ problem: "x" }).success).toBe(true);
    expect(ernieReasonTool.parameters.safeParse({ problem: "x" }).success).toBe(true);
  });
});

import { JUROR_REGISTRY } from "../jury-tool";

describe("roster expansion: jurors", () => {
  it("adds deepseek + glm jurors with label/role/call", () => {
    for (const k of ["deepseek", "glm", "stepfun", "ernie"]) {
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
