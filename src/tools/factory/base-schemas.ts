/**
 * Shared Zod base schema partials — Task 0.3.
 *
 * Each export is a plain object meant to be SPREAD into a `z.object({...})`.
 * Spreading creates a fresh `ZodObject` whose shape owns a copy of each
 * field reference; two tools that spread the same partial do NOT alias a
 * single mutable ZodObject — they each get an independent schema instance.
 *
 * SELECTION CRITERIA (grep-verified across all src/tools/*-tools.ts):
 *   A field is factored HERE only if its FULL definition
 *   (type + .describe() text + optionality) is **byte-identical** across
 *   every use site (outliers with different describe text stay inline).
 *
 * ─────────────────────────────────────────────────────────────────────────
 * filesField
 *   30 of 31 occurrences across gemini/grok/openai/openrouter/perplexity/
 *   planner tools share this exact definition. The one outlier
 *   (openrouter-tools.ts line ~758) has a different describe text and stays
 *   inline in its tool.
 *
 * reasoningContextField
 *   7 occurrences across openai/openrouter/perplexity tools share this exact
 *   definition. The remaining ~7 context fields have different describe text
 *   (e.g. "Additional context for the problem", "Additional context about the
 *   environment or conditions", "Additional context") and stay inline.
 *
 * REJECTED CANDIDATES (non-identical definitions — do NOT factor here):
 *   temperature  — 3 defs, all differ (defaults 0.4 vs 0.7, z.coerce.number
 *                  vs z.number, different describe text).
 *   query        — many defs with varying describe text across tools.
 *   problem      — varying describe text.
 *   prompt       — varying describe text.
 * ─────────────────────────────────────────────────────────────────────────
 */

import { z } from "zod";

/**
 * `files` — file-paths-as-code-context field.
 *
 * Identical across 30 tool definitions (verified by grep, Task 0.3 recon).
 * Spread into z.object({...filesField, ...}) to include this field.
 */
export const filesField = {
  files: z
    .array(z.string())
    .optional()
    .describe(
      "File paths to read as code context. Supports line ranges: 'src/foo.ts:100-200'. Model sees ACTUAL CODE.",
    ),
} as const;

/**
 * `context` — additional reasoning context field.
 *
 * Identical across 7 tool definitions in openai/openrouter/perplexity tools
 * (verified by grep, Task 0.3 recon). Context fields with different describe
 * text stay inline in their respective tools.
 * Spread into z.object({...reasoningContextField, ...}) to include this field.
 */
export const reasoningContextField = {
  context: z
    .string()
    .optional()
    .describe("Additional context for the reasoning task"),
} as const;
