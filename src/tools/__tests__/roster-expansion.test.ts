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
