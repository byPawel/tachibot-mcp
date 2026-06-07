/**
 * Task 1.1 — Hard-schema fixture (test-only, never production-registered).
 *
 * Exercises all three "hard" Zod shapes that the factory must preserve:
 *   - z.array(z.string()).optional()       — optional array
 *   - z.enum([...]).default("v1")          — enum with default
 *   - z.union([z.string(), z.number()])    — union type
 *
 * The parameters object is constructed ONCE and shared between the
 * hand-written baseline and the `defineModelTool`-wrapped variant so
 * the emit comparison is purely about factory purity, not schema identity.
 */

import { z } from "zod";
import { defineModelTool, ModelTool } from "../../src/tools/factory/define-model-tool.js";

/** The hard parameters schema — constructed once, referenced by both tools. */
export const hardParameters = z.object({
  /** optional array of strings */
  files: z.array(z.string()).optional().describe("File paths to process"),
  /** enum with a default value */
  apiVersion: z.enum(["v1", "v2"]).default("v1").describe("API version to use"),
  /** union of string or number */
  identifier: z
    .union([z.string(), z.number()])
    .describe("String name or numeric ID"),
});

/** Raw (hand-written) baseline — NOT wrapped by the factory. */
export const hardToolRaw: ModelTool<typeof hardParameters> = {
  name: "hard_case_raw",
  description: "Hard-schema fixture — raw baseline",
  parameters: hardParameters,
  execute: async (_input, _ctx) => "raw",
};

/** Factory-wrapped variant — must emit identically to the raw baseline. */
export const hardToolWrapped = defineModelTool({
  name: "hard_case_wrapped",
  description: "Hard-schema fixture — factory-wrapped",
  parameters: hardParameters,
  execute: async (_input, _ctx) => "wrapped",
});
