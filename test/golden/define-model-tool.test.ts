import { z } from "zod";
import { defineModelTool, ModelTool } from "../../src/tools/factory/define-model-tool.js";

/**
 * BOTTLENECK guard: defineModelTool MUST be a pure pass-through.
 * The whole codemod's safety model depends on the emitted JSON schema being
 * byte-for-byte identical — so the factory must NOT clone/transform anything.
 */

// ---------------------------------------------------------------------------
// TYPE-LEVEL REGRESSION GUARD (compile-time; ts-jest type-checks this file).
// Proves defineModelTool is IDENTITY-PRESERVING: a wrapped tool keeps its
// CONCRETE execute return type (Promise<string>, NOT Promise<unknown>) and its
// concrete input where `.default()` fields stay OPTIONAL at the call site.
// If the factory ever reverts to returning `ModelTool<S>`, these stop
// compiling and `npx tsc --noEmit` / ts-jest fail — the regression can't hide.
// ---------------------------------------------------------------------------
{
  // A realistic tool: required `prompt`, a defaulted `count`, and a concrete
  // `execute` whose declared return is Promise<string>.
  const concreteTool = {
    name: "typed_tool",
    description: "typed",
    parameters: z.object({
      prompt: z.string(),
      count: z.number().optional().default(5),
    }),
    execute: async (args: { prompt: string; count?: number }, _ctx: unknown): Promise<string> => {
      return `${args.prompt}:${args.count ?? 0}`;
    },
  };

  const wrapped = defineModelTool(concreteTool);

  // Helper: compile error unless A and B are mutually assignable (exact type).
  type Equals<A, B> = (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2
    ? true
    : false;
  const assertTrue = <_T extends true>(): void => {};

  // (a) execute return type is PRESERVED as Promise<string> (not Promise<unknown>).
  assertTrue<Equals<ReturnType<typeof wrapped.execute>, Promise<string>>>();

  // (b) optional/defaulted input is PRESERVED: callable with ONLY the required
  // field (defaulted `count` omitted). With a widened ModelTool<S> the input
  // would be z.infer<S> (z.output → `count` REQUIRED) and this would error.
  void (() => wrapped.execute({ prompt: "hi" }, undefined));

  // (c) the wrapped const's TYPE is identical to the unwrapped const's type.
  assertTrue<Equals<typeof wrapped, typeof concreteTool>>();

  // @ts-expect-error — execute return is concretely Promise<string>, NOT number.
  const _badReturn: number = (null as unknown as ReturnType<typeof wrapped.execute>);
  void _badReturn;
}

// Constraint still validates the ModelTool SHAPE. We build each malformed
// value first, then pass it — so the type error lands on the `defineModelTool(…)`
// call expression directly under the `@ts-expect-error` (an inline literal would
// report the error on an inner property line, missing the directive).
{
  const missingName = {
    description: "no name",
    parameters: z.object({ x: z.string() }),
    execute: async (_a: { x: string }, _c: unknown): Promise<string> => "ok",
  };
  // @ts-expect-error — rejected: missing required `name`.
  defineModelTool(missingName);

  const badParams = {
    name: "bad_params",
    description: "params not a ZodObject",
    parameters: z.string(), // not a ZodObject
    execute: async (_a: unknown, _c: unknown): Promise<string> => "ok",
  };
  // @ts-expect-error — rejected: `parameters` is not a ZodObject.
  defineModelTool(badParams);
}
describe("defineModelTool (pure pass-through factory)", () => {
  const parameters = z.object({
    prompt: z.string().describe("The prompt"),
    count: z.number().optional().default(5),
  });

  const execute = async (input: z.infer<typeof parameters>, _ctx: unknown) => {
    return `ok:${input.prompt}`;
  };

  const tool: ModelTool<typeof parameters> = {
    name: "demo_tool",
    description: "A demo tool",
    parameters,
    execute,
  };

  it("returns the SAME object reference (no clone)", () => {
    const result = defineModelTool(tool);
    expect(result).toBe(tool);
  });

  it("returns an object deep-equal to its input", () => {
    const result = defineModelTool(tool);
    expect(result).toEqual(tool);
  });

  it("preserves name and description", () => {
    const result = defineModelTool(tool);
    expect(result.name).toBe("demo_tool");
    expect(result.description).toBe("A demo tool");
  });

  it("keeps the SAME parameters zod instance (no clone/transform)", () => {
    const result = defineModelTool(tool);
    expect(result.parameters).toBe(parameters);
  });

  it("keeps the SAME execute reference", () => {
    const result = defineModelTool(tool);
    expect(result.execute).toBe(execute);
  });

  it("does not mutate the input tool", () => {
    const snapshot = { ...tool };
    defineModelTool(tool);
    expect(tool).toEqual(snapshot);
    expect(tool.parameters).toBe(snapshot.parameters);
    expect(tool.execute).toBe(snapshot.execute);
  });
});
