/**
 * testgen — routed test generation.
 * Hands test-writing to a coding-specialized model (Qwen3-Coder-Next) instead
 * of reshaping Claude's own prompt (which is what the test_driven/bdd_spec
 * prompt TECHNIQUES do). Returns runnable test code.
 */
import { z } from "zod";
import { defineModelTool } from "./factory/define-model-tool.js";
import { callOpenRouter, OpenRouterModel } from "./openrouter-tools.js";
import { readFilesIntoContext } from "../utils/file-reader.js";
import { FORMAT_INSTRUCTION } from "../utils/format-constants.js";
import { withHeartbeat } from "../utils/streaming-helper.js";

export function buildTestgenPrompt(args: {
  code?: string;
  files?: string[];
  framework?: string;
  coverage?: string;
  existingTests?: string;
}): { system: string; user: string } {
  const coverage = args.coverage || "all";
  const system = `You are Qwen3-Coder-Next, an expert test engineer. Generate RUNNABLE tests for the code provided.

PROCESS (in order):
1. Identify the testing framework: ${args.framework || "infer it from the code/imports; state your inference"}.
2. Enumerate edge cases and failure modes FIRST (empty/null, boundaries, invalid types, error paths, concurrency where relevant).
3. Emit complete, runnable test code targeting uncovered branches. Match the conventions of any existing tests provided.

COVERAGE FOCUS: ${coverage} (edge = boundary/failure cases only; happy = main paths; regression = lock current behavior; all = everything).

OUTPUT: a single test file's contents, then a short list of cases deliberately NOT covered and why. ${FORMAT_INSTRUCTION}`;

  const fileContext = args.files?.length
    ? `\n\nSOURCE FILES:\n${readFilesIntoContext(args.files)}`
    : "";
  const existing = args.existingTests
    ? `\n\nEXISTING TESTS (match these conventions):\n${args.existingTests}`
    : "";
  const user = `CODE UNDER TEST:\n${args.code || "(see SOURCE FILES)"}${fileContext}${existing}`;
  return { system, user };
}

export const testgenTool = defineModelTool({
  name: "testgen",
  description:
    "Generate runnable tests with a coding-specialized model (Qwen3-Coder-Next). Enumerates edge cases first, then emits test code. Provide 'code' or 'files'.",
  parameters: z.object({
    code: z.string().optional().describe("The code to generate tests for (or use 'files')"),
    files: z.array(z.string()).optional().describe("File paths to read as code-under-test. Supports line ranges: 'src/foo.ts:100-200'."),
    framework: z.string().optional().describe("Test framework (e.g. jest, vitest, pytest). Omit to infer."),
    coverage: z.enum(["edge", "happy", "regression", "all"]).optional().default("all").describe("Coverage focus"),
    existingTests: z.string().optional().describe("Paste existing tests so generated ones match conventions"),
  }),
  execute: async (args, { reportProgress }: any) => {
    if (!args.code && !args.files?.length) {
      return "Error: provide 'code' or 'files' — there is nothing to generate tests for.";
    }
    const { system, user } = buildTestgenPrompt(args);
    return withHeartbeat(
      () =>
        callOpenRouter(
          [
            { role: "system", content: system },
            { role: "user", content: user },
          ],
          OpenRouterModel.QWEN3_CODER_NEXT,
          0.3,
          12000,
        ),
      reportProgress,
      10000,
    );
  },
});

export function getAllTestgenTools() {
  return [testgenTool] as const;
}
