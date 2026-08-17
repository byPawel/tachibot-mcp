/**
 * blog_writer — researched long-form in one call.
 *
 * Composes the `storm` and `re3` techniques rather than copying their text. Those
 * templates live in PromptEngineerLite and are the single source of truth; a private
 * copy here would drift the moment either template is edited, and the drift would be
 * silent because both paths still produce well-formed prose.
 */
import { z } from "zod";
import { defineModelTool } from "./factory/define-model-tool.js";
import { callOpenRouter, OpenRouterModel } from "./openrouter-tools.js";
import { withHeartbeat } from "../utils/streaming-helper.js";
import { PromptEngineerLite } from "../prompt-engineer-lite.js";

const engine = new PromptEngineerLite();

export interface BlogWriterArgs {
  topic: string;
  wordCount?: number;
  research?: boolean;
  audience?: string;
}

export function buildBlogWriterPrompt(args: BlogWriterArgs): string {
  const { topic, wordCount, research = true, audience } = args;

  const parts: string[] = [];

  if (research) {
    parts.push(engine.applyTechnique("blog_writer", "storm", topic));
    parts.push(
      "Having completed the research above, now write the piece using the four-pass method below. Use only the 3 surprising answers as the spine.",
    );
  }

  parts.push(engine.applyTechnique("blog_writer", "re3", topic));

  if (wordCount) {
    parts.push(
      `TOTAL LENGTH: about ${wordCount} words. Distribute this across the sections unevenly — the section that carries the argument gets the most.`,
    );
  }
  if (audience) {
    parts.push(
      `AUDIENCE: ${audience}. Assume they know the basics; do not explain what they already know.`,
    );
  }

  return parts.join("\n\n---\n\n");
}

export const blogWriterTool = defineModelTool({
  name: "blog_writer",
  description:
    "Write a researched long-form post: interview four personas for the angle, then plan/draft/restructure/line-edit in separate passes. Put the SUBJECT in the 'topic' parameter.",
  parameters: z.object({
    topic: z.string().describe("What the post is about (REQUIRED - put your subject here)"),
    wordCount: z.number().optional().describe("Target length in words"),
    research: z.boolean().optional().default(true).describe("Run the persona-interview research stage first (default true)"),
    audience: z.string().optional().describe("Who it is for, e.g. 'backend engineers'"),
  }),
  execute: async (args: BlogWriterArgs, { reportProgress }: any) => {
    const prompt = buildBlogWriterPrompt(args);
    const reportFn = reportProgress ?? (async () => {});
    // Timeout inherited from getOpenRouterModelTimeout() — Kimi -> 600s, plenty of
    // headroom for the combined research + four-pass write in one call.
    return withHeartbeat(
      () =>
        callOpenRouter(
          [{ role: "user", content: prompt }],
          OpenRouterModel.KIMI_K3,
          0.7,
          8000,
        ),
      reportFn,
      10000,
    );
  },
});
