import { securityReviewTool, buildSecurityReviewPrompt } from "../../src/tools/security-review-tool.js";

describe("security_review tool", () => {
  test("contract: name and parameter keys", () => {
    expect(securityReviewTool.name).toBe("security_review");
    const keys = Object.keys(securityReviewTool.parameters.shape);
    expect(keys).toEqual(expect.arrayContaining(["code", "diff", "files", "language", "context", "standard"]));
  });

  test("prompt builder embeds taint-analysis framing, standard, and trust context", () => {
    const { system, user } = buildSecurityReviewPrompt({
      code: "app.get('/u', (req,res) => db.query(`SELECT * FROM users WHERE id=${req.query.id}`))",
      standard: "owasp",
      context: "public internet-facing API",
    });
    expect(system).toMatch(/taint|untrusted input/i);
    expect(system).toContain("OWASP");
    expect(user).toContain("db.query");
    expect(user).toContain("public internet-facing API");
  });

  test("execute rejects empty input without a network call", async () => {
    const out = await securityReviewTool.execute(
      { standard: "both" } as any,
      { log: () => {}, reportProgress: async () => {} } as any,
    );
    expect(String(out)).toMatch(/provide 'code', 'diff', or 'files'/i);
  });
});
