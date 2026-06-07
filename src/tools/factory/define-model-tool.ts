import type { z } from "zod";

/**
 * The exact tool shape FastMCP expects.
 *
 * Confirmed against `src/server.ts` `interface MCPTool` (safeAddTool, ~L159):
 *   { name: string; description: string; parameters: z.ZodType<any>;
 *     execute: (args: any, context: MCPContext) => Promise<any> }
 * and against concrete tools in `src/tools/gemini-tools.ts`
 *   (e.g. geminiBrainstormTool): `parameters: z.object({...})` and a
 *   two-arg `execute: async (args, ctx) => {...}`.
 *
 * This interface narrows `parameters` to `z.ZodObject` (server.ts uses the
 * wider `z.ZodType<any>`, which `z.ZodObject` satisfies) and keeps `ctx`
 * permissive as `unknown` (server.ts passes a concrete context typed `any`,
 * which is bivariantly compatible with `unknown`). Existing gemini tools
 * therefore assign to `ModelTool` without modification or widening.
 */
export interface ModelTool<S extends z.ZodObject<z.ZodRawShape> = z.ZodObject<z.ZodRawShape>> {
  name: string;
  description: string;
  parameters: S;
  execute: (input: z.infer<S>, ctx: unknown) => Promise<unknown>;
}

/**
 * PURE pass-through. Adds types + a single definition site — NO schema
 * transformation, NO added .describe()/defaults. The emitted JSON schema MUST
 * be unchanged. The body is exactly `return tool;` and must stay that way.
 *
 * C3: a future tool whose top-level `parameters` uses `.refine()` /
 * `.superRefine()` / `.transform()` would produce a `ZodEffects` (not a
 * `ZodObject`) and would require widening the `S` constraint here. No such
 * tool exists today (grep-confirmed), so the `z.ZodObject` constraint is
 * correct for now.
 */
export function defineModelTool<S extends z.ZodObject<z.ZodRawShape>>(tool: ModelTool<S>): ModelTool<S> {
  return tool;
}
