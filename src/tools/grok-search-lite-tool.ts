/**
 * Grok Search Lite — cost-optimized live web search.
 *
 * Same xAI live-search path as grok_search, but on grok-4.3 (1M context,
 * $1.25/$2.50) instead of the grok-4.5 flagship ($2/$6) — roughly 1.6x cheaper
 * on input and 2.4x on output. Use for high-volume lookups, jury/council
 * fan-outs, and quick fact checks; use grok_search when synthesis quality
 * matters most.
 *
 * WAS grok-4-1-fast-non-reasoning ($0.20/$0.50, advertised as "10x cheaper").
 * That id was retired by xAI, and the retirement is INVISIBLE at runtime: a
 * request for it returns HTTP 200 and xAI silently serves grok-4.3, disclosing
 * the swap only in the response body's `model` field. Verified Aug 12, 2026:
 *
 *   requested grok-4-1-fast-non-reasoning -> HTTP 200, served "grok-4.3"
 *   requested grok-4.5                    -> HTTP 200, served "grok-4.5"  (control)
 *
 * So no error was ever raised, no fallback ever fired, and this tool billed at
 * grok-4.3 rates while advertising grok-4-1-fast rates. Pointing at grok-4.3
 * explicitly changes nothing about what runs — it just stops the tool lying
 * about its own cost.
 */

import { z } from "zod";
import { callGrokEnhanced, GrokModel } from "./grok-enhanced.js";
import { defineModelTool } from "./factory/define-model-tool.js";
import { link } from "../utils/ansi-renderer.js";
import { stripFormatting } from "../utils/format-stripper.js";
import { FORMAT_INSTRUCTION } from "../utils/format-constants.js";

/** Pure prompt builder — exported for tests. */
export function buildGrokSearchLitePrompt(
  query: string,
  maxSearchResults: number,
  recency: string
): string {
  const recencyPrompt =
    recency !== "all" ? `Focus on information from the last ${recency}.` : "";

  return `You are Grok with live search (fast tier). Search for: "${query}".
${recencyPrompt}
Provide concise, factual results with sources.
Limit search to ${maxSearchResults} sources for cost control.
${FORMAT_INSTRUCTION}`;
}

export const grokSearchLiteTool = defineModelTool({
  name: "grok_search_lite",
  description:
    "Cheap web search (Grok, cheaper tier than grok_search). Prefer this for routine lookups; use grok_search when answer quality matters more than cost. Put your QUERY in the 'query' parameter.",
  parameters: z.object({
    query: z.string(),
    sources: z
      .array(
        z.object({
          type: z.enum(["web", "news", "x", "rss"]),
          country: z.string().optional(),
          allowed_websites: z.array(z.string()).optional(),
        })
      )
      .optional(),
    max_search_results: z.number().optional(),
    recency: z.enum(["all", "day", "week", "month", "year"]).optional(),
  }),
  execute: async (args: any, { log }: any) => {
    const {
      query,
      sources = [{ type: "web" }],
      max_search_results = 20,
      recency = "all",
    } = args;

    const messages = [
      {
        role: "system",
        content: buildGrokSearchLitePrompt(query, max_search_results, recency),
      },
      {
        role: "user",
        content: `Search for: ${query}`,
      },
    ];

    log?.info(
      `Grok Search Lite: ${max_search_results} sources, recency: ${recency} (using grok-4.3, $1.25/$2.50)`
    );

    // Extract domains from sources if specified
    const domains =
      sources
        ?.filter((s: any) => s.allowed_websites)
        ?.flatMap((s: any) => s.allowed_websites) || [];

    const result = await callGrokEnhanced(messages, {
      model: GrokModel.GROK_4_3, // Cheapest surviving general tier (see header note on the retired 4-1-fast id)
      enableLiveSearch: true,
      searchSources: max_search_results,
      searchDomains: domains,
      temperature: 0.3, // Low temperature for factual search
      maxTokens: 3000,
    });

    // Format sources with ANSI links (same shape as grok_search output)
    let output = result.content;
    if (result.sources && result.sources.length > 0) {
      const sourcesText = result.sources
        .slice(0, 10)
        .map((s: any, i: number) => {
          const title = s.title || "Source";
          const url = s.url || "";
          return `  ${link(url, `[${i + 1}] ${title}`)}`;
        })
        .join("\n");
      output += `\n\nSources:\n${sourcesText}`;
    }

    // Add cost info
    const estimatedCost = (max_search_results / 1000) * 0.025;
    output += `\n\nSearch used up to ${max_search_results} sources (~$${estimatedCost.toFixed(4)})`;

    return stripFormatting(output);
  },
});
