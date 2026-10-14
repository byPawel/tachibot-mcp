import { jevDecideTool, buildJevRequest, JEV_DEFAULT_MODEL } from "../../src/tools/jev-tool.js";

describe("jev_decide tool", () => {
  test("contract: name and parameter keys", () => {
    expect(jevDecideTool.name).toBe("jev_decide");
    const keys = Object.keys(jevDecideTool.parameters.shape);
    expect(keys).toEqual(expect.arrayContaining(["state", "questions", "model"]));
  });

  test("request builder emits the System One shape and drops criteria on noul", () => {
    const built = buildJevRequest({
      state: { ticket: "charged twice" },
      questions: {
        refund: { type: "noul", instructions: "Refund requested?", criteria: ["ignored", "x"] },
        topic: { type: "choice", instructions: "Queue?", criteria: { Payments: "billing", Bugs: "defects" } },
        urgency: { type: "score", instructions: "Urgency?", criteria: ["low", "medium", "high"] },
      },
    });
    expect("body" in built).toBe(true);
    const body = (built as { body: any }).body;
    expect(body.model).toBe(JEV_DEFAULT_MODEL);
    expect(body.state).toEqual({ ticket: "charged twice" });
    expect(body.questions.refund).toEqual({ type: "noul", instructions: "Refund requested?" });
    expect(body.questions.topic.criteria).toEqual({ Payments: "billing", Bugs: "defects" });
    expect(body.questions.urgency.criteria).toEqual(["low", "medium", "high"]);
  });

  test("request builder rejects criteria that don't match the question type", () => {
    const choice = buildJevRequest({ state: "x", questions: { q: { type: "choice", instructions: "?", criteria: ["a", "b"] } } });
    expect((choice as { error: string }).error).toMatch(/'choice'.*map/);
    const score = buildJevRequest({ state: "x", questions: { q: { type: "score", instructions: "?" } } });
    expect((score as { error: string }).error).toMatch(/'score'.*array/);
  });

  test("execute rejects empty questions without a network call", async () => {
    const out = await jevDecideTool.execute({ state: "x", questions: {} } as any);
    expect(String(out)).toMatch(/at least one question/i);
  });
});
