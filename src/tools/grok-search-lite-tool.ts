/**
 * Grok Search Lite — cost-optimized live web search.
 *
 * Same xAI live-search path as grok_search, but on grok-4-1-fast
 * (tool-calling optimized, 2M context, $0.20/$0.50 — ~10x cheaper than the
 * grok-4.5 flagship). Use for high-volume lookups, jury/council fan-outs, and
 * quick fact checks; use grok_search when synthesis quality matters most.
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
    "Cheap web search (grok-4-1-fast, ~10x cheaper than grok_search). Put your QUERY in the 'query' parameter.",
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
      `Grok Search Lite: ${max_search_results} sources, recency: ${recency} (using grok-4-1-fast, $0.20/$0.50)`
    );

    // Extract domains from sources if specified
    const domains =
      sources
        ?.filter((s: any) => s.allowed_websites)
        ?.flatMap((s: any) => s.allowed_websites) || [];

    const result = await callGrokEnhanced(messages, {
      model: GrokModel.GROK_4_1_FAST, // Tool-calling optimized cheap tier — the whole point of this tool
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
