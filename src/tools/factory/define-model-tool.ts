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
 * IDENTITY-PRESERVING: the RETURN type is the concrete tool type `T`, not
 * `ModelTool<S>`. Wrapping a tool is therefore type-transparent — the wrapped
 * const keeps the *exact* concrete type it would have unwrapped (e.g.
 * `execute`'s real `Promise<string>` return and its concrete input where
 * `.default()` fields are still optional at the call site). Returning
 * `ModelTool<S>` instead would widen `execute` to
 * `(input: z.infer<S>, ctx) => Promise<unknown>` and break direct callers such
 * as `src/tools/prompt-technique-tools.ts` that invoke `.execute(...)` outside
 * FastMCP's parse step.
 *
 * Two type params are required for BOTH goals at once:
 *   - `S` is inferred from `tool.parameters` so the shape constraint's
 *     `execute` input is `z.infer<S>` — i.e. the tool's OWN output type, which
 *     its concrete `execute` is assignable to (contravariantly). Constraining
 *     to the generic `ModelTool<z.ZodObject<z.ZodRawShape>>` instead resolves
 *     the input to `{ [x: string]: any }` (an index signature with no required
 *     keys), to which a concrete `execute(input: { prompt: string })` is NOT
 *     assignable — so a single `T extends ModelTool<…>` param wrongly rejects
 *     every real tool.
 *   - `T extends ModelTool<S>` captures and returns the concrete tool type.
 * The `ModelTool<S>` bound still validates the shape (rejects a missing
 * `name`/`description`/`execute` or a non-`ZodObject` `parameters`).
 *
 * C3: a future tool whose top-level `parameters` uses `.refine()` /
 * `.superRefine()` / `.transform()` would produce a `ZodEffects` (not a
 * `ZodObject`) and would require widening the `S` constraint here. No such
 * tool exists today (grep-confirmed), so the `z.ZodObject` constraint is
 * correct for now.
 */
export function defineModelTool<
  S extends z.ZodObject<z.ZodRawShape>,
  T extends ModelTool<S>,
>(tool: T & { parameters: S }): T {
  return tool;
}
