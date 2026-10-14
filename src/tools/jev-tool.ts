/**
 * jev_decide — typed decisions via TypeSafe's Jev (System One model) on OpenRouter.
 * Jev does NOT generate text: it takes a `state` plus named typed questions and
 * returns calibrated values — `noul` (yes/no probability), `choice` (option +
 * per-option probabilities), `score` (value on an ordered scale + confidence).
 * Chat-completions does not serve it; it lives on OpenRouter's System One
 * endpoint. Cheap (~$0.04/M input, output free) and fast (~0.3s) — meant for
 * bounded judgments: routing, groundedness/eval gates, risk scoring.
 */
import { z } from "zod";
import { defineModelTool } from "./factory/define-model-tool.js";
import { getOpenRouterApiKey } from "../utils/api-keys.js";
import { JEV_MODELS } from "../config/model-constants.js";

export const JEV_API_URL = "https://openrouter.ai/api/v1/systemone";
export const JEV_DEFAULT_MODEL: string = JEV_MODELS.JEV_1_13;
const JEV_TIMEOUT_MS = 30000;

const questionSchema = z.object({
  type: z.enum(["noul", "choice", "score"]).describe("noul = yes/no probability; choice = pick one option; score = rate on an ordered scale"),
  instructions: z.string().describe("The question Jev should answer about the state"),
  criteria: z
    .union([z.record(z.string(), z.string()), z.array(z.string())])
    .optional()
    .describe("choice: {option: description} map. score: ordered levels, lowest first (e.g. ['low','medium','high']). Omit for noul."),
});

export type JevQuestion = z.infer<typeof questionSchema>;

/**
 * Pure request builder. Returns the System One body, or an error string when a
 * question's criteria don't match its type (the API rejects these with an
 * opaque zod dump, so fail early with a readable message instead).
 */
export function buildJevRequest(args: {
  state: string | Record<string, unknown>;
  questions: Record<string, JevQuestion>;
  model?: string;
}): { body: Record<string, unknown> } | { error: string } {
  const names = Object.keys(args.questions || {});
  if (names.length === 0) return { error: "Error: provide at least one question in 'questions'." };

  for (const name of names) {
    const q = args.questions[name];
    if (q.type === "choice" && (!q.criteria || Array.isArray(q.criteria) || Object.keys(q.criteria).length < 2)) {
      return { error: `Error: question '${name}' is 'choice' — 'criteria' must be an {option: description} map with at least 2 options.` };
    }
    if (q.type === "score" && (!Array.isArray(q.criteria) || q.criteria.length < 2)) {
      return { error: `Error: question '${name}' is 'score' — 'criteria' must be an array of at least 2 ordered levels.` };
    }
  }

  const questions: Record<string, JevQuestion> = {};
  for (const name of names) {
    const { type, instructions, criteria } = args.questions[name];
    questions[name] = type === "noul" ? { type, instructions } : { type, instructions, criteria };
  }
  return { body: { model: args.model || JEV_DEFAULT_MODEL, state: args.state, questions } };
}

export const jevDecideTool = defineModelTool({
  name: "jev_decide",
  description:
    "Typed decisions from TypeSafe Jev via OpenRouter — no prose. Send a 'state' plus named questions (noul = yes/no probability, choice = pick an option, score = rate on a scale); get calibrated probabilities back as JSON. Fast and near-free: use for routing, eval/groundedness gates, and risk scoring, not for writing or open-ended reasoning.",
  parameters: z.object({
    state: z
      .union([z.string(), z.record(z.string(), z.unknown())])
      .describe("The context to judge — text or an object (e.g. {request, policy, trace, answer})"),
    questions: z
      .record(z.string(), questionSchema)
      .describe("Named questions, e.g. {refund: {type:'noul', instructions:'Is a refund requested?'}}"),
    model: z.string().optional().describe("OpenRouter model id (default: typesafe/jev-1.13)"),
  }),
  execute: async (args) => {
    const built = buildJevRequest(args);
    if ("error" in built) return built.error;

    const apiKey = getOpenRouterApiKey();
    if (!apiKey) return "[OpenRouter API key not configured. Add OPENROUTER_API_KEY to .env file]";

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), JEV_TIMEOUT_MS);
    try {
      const response = await fetch(JEV_API_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          "HTTP-Referer": "https://tachibot-mcp.local",
          "X-Title": "Tachibot MCP Server",
        },
        body: JSON.stringify(built.body),
        signal: controller.signal,
      });
      if (!response.ok) {
        const errorText = await response.text();
        return `[Jev error: ${response.status} ${response.statusText} - ${errorText.slice(0, 1500)}]`;
      }
      const data = (await response.json()) as any;
      if (!data?.answers) return `[Jev error: response had no answers - ${JSON.stringify(data).slice(0, 500)}]`;
      return JSON.stringify({ model: data.model, answers: data.answers, usage: data.usage }, null, 2);
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        return `[Jev timeout: request exceeded ${JEV_TIMEOUT_MS / 1000}s]`;
      }
      return `[Jev error: ${error instanceof Error ? error.message : String(error)}]`;
    } finally {
      clearTimeout(timeoutId);
    }
  },
});

export function getAllJevTools() {
  return [jevDecideTool] as const;
}
