/**
 * Parameter Alias Resolution
 *
 * LLMs frequently confuse parameter names across tools — passing "problem"
 * to a tool that expects "query", or "prompt" instead of "problem", etc.
 *
 * This module wraps any tool's Zod schema with z.preprocess() to resolve
 * aliases BEFORE validation. The original schema stays unchanged — aliases
 * are transparently remapped to the primary field.
 * Zero changes needed in individual tool files.
 */
import { z } from "zod";

/**
 * Names that LLMs treat as interchangeable for "the main text input".
 * Order doesn't matter — the tool's own required field always wins.
 */
const MAIN_INPUT_ALIASES = [
  "query",
  "problem",
  "prompt",
  "question",
  "input",
  "request",
  "topic",
] as const;

/**
 * Wraps a tool definition so its primary text input accepts common aliases.
 *
 * Uses z.preprocess() to remap aliases BEFORE Zod validation:
 * 1. Finds the REQUIRED string field whose name is in MAIN_INPUT_ALIASES.
 * 2. Wraps parameters with z.preprocess() that copies alias → primary.
 * 3. Original schema validates as normal (strips unknown keys).
 *
 * If the tool has no recognizable primary input, or parameters isn't a ZodObject,
 * returns it unchanged.
 */
export function withParamAliases<T extends { name: string; parameters: z.ZodType<any>; execute: (...args: any[]) => any; [key: string]: any }>(tool: T): T {
  // Only works on ZodObject schemas (has .shape)
  const params = tool.parameters as any;
  if (!params?.shape) return tool;

  const shape = params.shape;

  // Find the required primary input field
  const primaryInput = MAIN_INPUT_ALIASES.find(alias => {
    const field = shape[alias];
    if (!field) return false;
    // Check if it's a required string (not optional)
    return !field.isOptional?.() && field instanceof z.ZodString;
  });

  if (!primaryInput) return tool; // No recognized primary input — skip

  // Wrap with preprocess: remap aliases → primary field BEFORE Zod validates
  const preprocessed = z.preprocess((raw: unknown) => {
    if (raw && typeof raw === "object" && !Array.isArray(raw)) {
      const input = raw as Record<string, unknown>;
      if (!input[primaryInput]) {
        for (const alias of MAIN_INPUT_ALIASES) {
          if (alias !== primaryInput && typeof input[alias] === "string") {
            return { ...input, [primaryInput]: input[alias] };
          }
        }
      }
    }
    return raw;
  }, tool.parameters);

  return { ...tool, parameters: preprocessed };
}
