import { z } from "zod";
import { defineModelTool, ModelTool } from "../../src/tools/factory/define-model-tool.js";

/**
 * BOTTLENECK guard: defineModelTool MUST be a pure pass-through.
 * The whole codemod's safety model depends on the emitted JSON schema being
 * byte-for-byte identical — so the factory must NOT clone/transform anything.
 */
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
