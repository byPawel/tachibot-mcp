/**
 * Central tool registry — the single place that decides WHICH tools are
 * registered with the MCP server, mirroring the EXACT registration that lived
 * inline in `server.ts` before Task 2.1 of the tool-standardization codemod.
 *
 * BEHAVIOR-PRESERVATION CONTRACT (hard requirement — zero behavior change):
 *   `getAllTools()` returns a flat, ordered list of tool definitions that the
 *   server must hand to `safeAddTool(...)`. It evaluates the SAME
 *   `is*Available()` availability guards, in the SAME order, with the SAME
 *   async dynamic-import timing that `server.ts` previously used. The emitted
 *   `tools/list` payload and the conditional registration across every API-key
 *   scenario are therefore identical to the pre-refactor server.
 *
 * WHAT THIS REGISTRY DOES NOT OWN (deliberately, to preserve behavior):
 *   - The inline tools defined as `safeAddTool({...})` literals in server.ts
 *     (`think`, `focus`, `nextThought`, `usage_stats`, `continue_focus`). They
 *     close over server-local singletons (orchestrator, focusToolService,
 *     focusExecutionService, collaborativeOrchestrator). Rather than thread all
 *     of those dependencies through the registry, server.ts passes them in via
 *     the `inlineTools` argument so they flow through the SAME single
 *     `for (const t of getAllTools(...)) safeAddTool(t)` loop, at the front of
 *     the order. Their definitions are unchanged.
 *   - `registerWorkflowTools(server)` registers directly onto the FastMCP
 *     server (NOT via safeAddTool / not as a `{name, parameters, execute}`
 *     definition we can return), so it stays an explicit call in server.ts in
 *     its original position. It is intentionally OUT of `getAllTools()`.
 *
 * Availability guards preserved here (same env-time semantics as before):
 *   - isPerplexityAvailable()  → Perplexity tools
 *   - isGrokAvailable()        → Grok tools
 *   - isOpenAIAvailable()      → OpenAI tools (getter also self-guards → [])
 *   - isGeminiAvailable()      → Gemini tool array + Jury tool
 *   - isOpenRouterAvailable()  → Qwen/QwQ/Kimi/MiniMax + planner tools
 *   - areAdvancedModesAvailable() → advanced-mode tools (unconditional `true`)
 *   - local_query, workflow validators, tachi tools, prompt-technique tools →
 *     unconditional (profile membership still enforced downstream by
 *     safeAddTool/isToolEnabled, exactly as before).
 */

import type { z } from "zod";

import { getAllPerplexityTools, isPerplexityAvailable } from "./perplexity-tools.js";
import { getAllGrokTools, isGrokAvailable } from "./grok-tools.js";
import { isOpenAIAvailable, getAllOpenAITools } from "./openai-tools.js";
import {
  isGeminiAvailable,
  geminiBrainstormTool,
  geminiAnalyzeCodeTool,
} from "./gemini-tools.js";
import { isOpenRouterAvailable } from "./openrouter-tools.js";
import { getAllAdvancedTools, areAdvancedModesAvailable } from "./advanced-modes.js";
import { getTachiTools } from "./tachi-tool.js";
import { getPromptTechniqueTools } from "./prompt-technique-tools.js";
import { validateWorkflowTool, validateWorkflowFileTool } from "./workflow-validator-tool.js";

/**
 * Structural shape every registered tool satisfies — identical to server.ts's
 * `MCPTool` and `factory/define-model-tool.ts`'s `ModelTool`. Kept permissive
 * (`parameters: z.ZodType<any>`, `execute: (...args: any) => Promise<any>`) so
 * the union of every provider's concrete tool type assigns without widening any
 * tool definition. We do NOT touch the tools — only collect them.
 */
export interface RegistryTool {
  name: string;
  description: string;
  parameters: z.ZodType<any>;
  execute: (...args: any[]) => Promise<any>;
}

/**
 * Returns the full, ordered union of tools to register via `safeAddTool`, with
 * the SAME availability conditions and async import timing the server used
 * inline. Async because several provider blocks (gemini extras + jury,
 * openrouter + planner, local) were previously loaded via dynamic `import()`
 * inside `initializeServer()`; that timing is preserved here.
 *
 * @param inlineTools server-local inline tools (think/focus/nextThought/...)
 *        that close over server singletons; injected so they share the single
 *        registration loop. Pass `[]` (or omit) to register only provider tools.
 */
export async function getAllTools(
  inlineTools: RegistryTool[] = [],
): Promise<RegistryTool[]> {
  const tools: RegistryTool[] = [];

  // 0) Inline server.ts tools first — preserves their original (earliest)
  //    registration position. (think, focus, nextThought, usage_stats,
  //    continue_focus.)
  tools.push(...inlineTools);

  // --- Synchronous provider blocks (mirrors server.ts top-level order) -------

  // 1) Perplexity (custom API). Guard identical to server.ts.
  if (isPerplexityAvailable()) {
    tools.push(...(getAllPerplexityTools() as unknown as RegistryTool[]));
  }

  // 2) Grok (custom API).
  if (isGrokAvailable()) {
    tools.push(...(getAllGrokTools() as unknown as RegistryTool[]));
  }

  // 3) OpenAI (GPT-5 suite). NB: getAllOpenAITools() ALSO self-guards (returns
  //    [] when unavailable); the outer guard is kept to mirror server.ts 1:1.
  if (isOpenAIAvailable()) {
    tools.push(...(getAllOpenAITools() as unknown as RegistryTool[]));
  }

  // --- Async-import provider blocks (mirrors initializeServer() order) -------

  // 4) Gemini select tools + Jury (only when Gemini is available). The async
  //    import timing matches the original `await import(...)` inside
  //    initializeServer().
  if (isGeminiAvailable()) {
    const { geminiAnalyzeTextTool, geminiJudgeTool, geminiSearchTool } =
      await import("./gemini-tools.js");
    const geminiTools = [
      geminiBrainstormTool, // Creative brainstorming
      geminiAnalyzeCodeTool, // Code analysis
      geminiAnalyzeTextTool, // Text analysis (sentiment, summary, etc.)
      geminiJudgeTool, // Multi-perspective evaluation & synthesis
      geminiSearchTool, // Web search with Google Search grounding
    ];
    tools.push(...(geminiTools as unknown as RegistryTool[]));

    // Jury tool (multi-model panel with Gemini judge) — gated on Gemini, as before.
    const { juryTool } = await import("./jury-tool.js");
    tools.push(juryTool as unknown as RegistryTool);
  }

  // 5) OpenRouter (Qwen/QwQ/Kimi/MiniMax/DeepSeek/GLM/StepFun/ERNIE) + planner
  //    tools — gated on OpenRouter.
  if (isOpenRouterAvailable()) {
    const {
      qwenCoderTool,
      qwenAlgoTool,
      qwqReasoningTool,
      qwenCompetitiveTool,
      kimiThinkingTool,
      kimiCodeTool,
      kimiDecomposeTool,
      kimiLongContextTool,
      qwenReasonTool,
      minimaxCodeTool,
      minimaxAgentTool,
      deepseekReasonTool,
      deepseekAlgoTool,
      glmReasonTool,
      stepfunReasonTool,
      ernieReasonTool,
    } = await import("./openrouter-tools.js");

    tools.push(
      ...([
        qwenCoderTool,
        qwenAlgoTool,
        qwqReasoningTool, // QwQ-32B — multi-perspective deliberation (free tier)
        qwenCompetitiveTool,
        kimiThinkingTool,
        kimiCodeTool, // SWE-focused code (Kimi K2.5 - 76.8% SWE-Bench)
        kimiDecomposeTool, // Task decomposition (Kimi K2.5 Agent Swarm)
        kimiLongContextTool, // Long-context analysis (Kimi K2.5 - 256K)
        qwenReasonTool, // Heavy reasoning (Qwen3-Max-Thinking >1T params)
        minimaxCodeTool, // MiniMax M2.7 - SWE-Pro 56.22%
        minimaxAgentTool, // MiniMax M2.7 - agentic workflows
        deepseekReasonTool, // DeepSeek V4 Pro — frontier reasoning/math (open-weight)
        deepseekAlgoTool, // DeepSeek V4 Pro — algorithmic code review (top AIME/CodeElo)
        glmReasonTool, // Zhipu GLM-5.1 — agentic reasoning (SWE-Bench Pro leader)
        stepfunReasonTool, // StepFun Step 3.7 Flash — efficient reasoning
        ernieReasonTool, // Baidu ERNIE 4.5 VL — broad-knowledge reasoning
      ] as unknown as RegistryTool[]),
    );

    // Planner tools (multi-model council for plan creation/execution) — gated
    // on OpenRouter, as before.
    const { plannerMakerTool, plannerRunnerTool, listPlansTool } = await import(
      "./planner-tools.js"
    );
    tools.push(
      ...([plannerMakerTool, plannerRunnerTool, listPlansTool] as unknown as RegistryTool[]),
    );
  }

  // 6) Local-model tools (Ollama / LM Studio / llama.cpp / vLLM). Registered
  //    unconditionally; profile membership enforced downstream by
  //    safeAddTool/isToolEnabled. Dynamic import preserves original timing.
  //    getAllLocalTools() is used so tools added via `npm run add-tool` are
  //    automatically included without touching registry.ts (Task 2.3 fix).
  const { getAllLocalTools } = await import("./local-tools.js");
  tools.push(...(getAllLocalTools() as unknown as RegistryTool[]));

  // NOTE: registerWorkflowTools(server) is intentionally NOT here — it
  // registers directly onto the FastMCP server, not via safeAddTool. It stays
  // an explicit call in server.ts.

  // 7) Workflow validator tools (unconditional).
  tools.push(validateWorkflowTool as unknown as RegistryTool);
  tools.push(validateWorkflowFileTool as unknown as RegistryTool);

  // 8) Advanced-mode tools (Verifier, Challenger, Scout, ...). Guard preserved
  //    (areAdvancedModesAvailable() is unconditional `true` today).
  if (areAdvancedModesAvailable()) {
    tools.push(...(getAllAdvancedTools() as unknown as RegistryTool[]));
  }

  // 9) Tachi tools (smart auto-routing AI assistant) — unconditional.
  tools.push(...(getTachiTools() as unknown as RegistryTool[]));

  // 10) Prompt-technique tools (transparent prompt engineering) — unconditional.
  tools.push(...(getPromptTechniqueTools() as unknown as RegistryTool[]));

  return tools;
}
