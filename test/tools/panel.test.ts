import { runPanel, type Panelist } from "../../src/tools/panel.js";

describe("runPanel", () => {
  test("collects successful panelists and drops throwing ones", async () => {
    const panel: Panelist[] = [
      { key: "a", label: "A", call: async () => "alpha says yes" },
      { key: "b", label: "B", call: async () => { throw new Error("offline"); } },
      { key: "c", label: "C", call: async () => "gamma says no" },
    ];
    const out = await runPanel(panel, "question");
    expect(out.map((r) => r.label)).toEqual(["A", "C"]);
    expect(out[0].text).toContain("alpha");
  });

  test("passes the same prompt to every panelist", async () => {
    const seen: string[] = [];
    const panel: Panelist[] = [
      { key: "a", label: "A", call: async (q) => { seen.push(q); return "x"; } },
      { key: "b", label: "B", call: async (q) => { seen.push(q); return "y"; } },
    ];
    await runPanel(panel, "the-prompt");
    expect(seen).toEqual(["the-prompt", "the-prompt"]);
  });

  test("drops a panelist that returns an empty string", async () => {
    const panel: Panelist[] = [
      { key: "a", label: "A", call: async () => "alpha says yes" },
      { key: "b", label: "B", call: async () => "" },
    ];
    const out = await runPanel(panel, "question");
    expect(out.map((r) => r.label)).toEqual(["A"]);
  });
});
