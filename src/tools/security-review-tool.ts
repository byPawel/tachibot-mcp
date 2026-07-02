/**
 * security_review — dedicated security audit for code you own/are authorized
 * to review. Unlike openai_code_review's generic reviewer with a `security`
 * focusArea, this carries a real attacker mental model: taint/data-flow,
 * OWASP/CWE framing, exploit sketch + concrete fix per finding.
 */
import { z } from "zod";
import { defineModelTool } from "./factory/define-model-tool.js";
import { callOpenRouter, OpenRouterModel } from "./openrouter-tools.js";
import { readFilesIntoContext } from "../utils/file-reader.js";
import { FORMAT_INSTRUCTION } from "../utils/format-constants.js";
import { withHeartbeat } from "../utils/streaming-helper.js";

export function buildSecurityReviewPrompt(args: {
  code?: string;
  diff?: string;
  files?: string[];
  language?: string;
  context?: string;
  standard?: string;
}): { system: string; user: string } {
  const standard = args.standard || "both";
  const standardLine =
    standard === "owasp"
      ? "Map findings to OWASP Top 10 (2025) categories."
      : standard === "cwe"
        ? "Assign a CWE id to every finding."
        : "Map findings to OWASP Top 10 (2025) categories AND assign a CWE id to every finding.";

  const system = `You are a principal application-security engineer performing an AUTHORIZED defensive review of the owner's own code. Think like an attacker; report like an engineer.

METHOD:
1. TAINT / DATA-FLOW — trace every untrusted input (params, headers, files, env, DB reads of user data) to its sinks (queries, exec, deserialization, file paths, templates, redirects).
2. AUTHN/AUTHZ — missing checks, confused-deputy, IDOR, privilege boundaries.
3. SECRETS & CRYPTO — hardcoded credentials, weak primitives, misused randomness.
4. INJECTION & DESERIALIZATION — SQL/NoSQL/command/template injection, unsafe eval/deserialize.
5. DENIAL & ABUSE — unbounded loops/allocations from user input, missing rate limits (flag only; do not design attacks).

${standardLine}

PER FINDING: [SEVERITY critical|high|medium|low] [CWE/OWASP ref] — location (file:line if derivable), why it's exploitable (1-2 sentence sketch, no weaponized payloads), and the CONCRETE FIX (code-level).
END WITH: a severity-ordered summary table and an overall risk verdict.
If the code is clean in an area you checked, say so explicitly — absence of findings must be an assertion, not an omission. ${FORMAT_INSTRUCTION}`;

  const parts: string[] = [];
  if (args.context) parts.push(`DEPLOYMENT/TRUST CONTEXT: ${args.context}`);
  if (args.language) parts.push(`LANGUAGE/FRAMEWORK: ${args.language}`);
  if (args.diff) parts.push(`DIFF UNDER REVIEW:\n${args.diff}`);
  if (args.code) parts.push(`CODE UNDER REVIEW:\n${args.code}`);
  if (args.files?.length) parts.push(`SOURCE FILES:\n${readFilesIntoContext(args.files)}`);
  return { system, user: parts.join("\n\n") };
}

export const securityReviewTool = defineModelTool({
  name: "security_review",
  description:
    "Dedicated security audit (DeepSeek V4 Pro): taint/data-flow analysis, OWASP/CWE-mapped findings with severity, exploitability sketch, and concrete fixes. For code you are authorized to review. Provide 'code', 'diff', or 'files'.",
  parameters: z.object({
    code: z.string().optional().describe("Code to audit (or use 'diff'/'files')"),
    diff: z.string().optional().describe("Unified diff to audit (scopes the review to the change)"),
    files: z.array(z.string()).optional().describe("File paths to read server-side. Supports line ranges: 'src/foo.ts:100-200'."),
    language: z.string().optional().describe("Language/framework hint (e.g. 'TypeScript/Express')"),
    context: z.string().optional().describe("Trust boundaries & deployment context (e.g. 'internal-only service behind VPN')"),
    standard: z.enum(["owasp", "cwe", "both"]).optional().default("both").describe("Finding-mapping standard"),
  }),
  execute: async (args, { reportProgress }: any) => {
    if (!args.code && !args.diff && !args.files?.length) {
      return "Error: provide 'code', 'diff', or 'files' — there is nothing to audit.";
    }
    const { system, user } = buildSecurityReviewPrompt(args);
    return withHeartbeat(
      () =>
        callOpenRouter(
          [
            { role: "system", content: system },
            { role: "user", content: user },
          ],
          OpenRouterModel.DEEPSEEK_V4_PRO,
          0.2,
          12000,
        ),
      reportProgress,
      10000,
    );
  },
});

export function getAllSecurityReviewTools() {
  return [securityReviewTool] as const;
}
