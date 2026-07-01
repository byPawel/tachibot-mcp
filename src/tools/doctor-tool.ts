/**
 * Doctor Tool — zero-cost diagnostic for "why am I only seeing N tools?"
 *
 * Tools self-gate registration on API keys (src/tools/registry.ts), so a user
 * with one key silently sees a fraction of the full set with no explanation.
 * `doctor` makes the gating legible: detected keys, which tools are hidden and
 * why, the active profile and where it came from, and a concrete first step.
 *
 * Registers UNCONDITIONALLY (no API-key gate) — it costs nothing and is most
 * useful precisely when no keys are set.
 */

import { z } from "zod";
import { defineModelTool } from "./factory/define-model-tool.js";
import {
  hasGrokApiKey,
  hasOpenAIApiKey,
  hasPerplexityApiKey,
  hasGeminiApiKey,
  hasOpenRouterApiKey,
  hasLocalLLM,
} from "../utils/api-keys.js";
import { getActiveProfile, getProfileSource } from "../utils/tool-config.js";
import { toolRouter } from "./tool-router.js";
import { PROVIDER_GROUPS } from "./provider-catalog.js";

const RULE = "─".repeat(48);

/** One line per key provider: ✓/✗ plus the env var(s) that set it. */
function renderKeyStatus(): string {
  const rows = PROVIDER_GROUPS.map((g) => {
    const ok = g.available();
    const mark = ok ? "✓" : "✗";
    const label = g.label.padEnd(16);
    const hint = ok ? g.envHint : `set ${g.envHint}`;
    const note = g.note ? `  — ${g.note}` : "";
    return `  ${mark} ${label} (${hint})${note}`;
  });
  return rows.join("\n");
}

/**
 * "Try this first" — pick a concrete entry point from the keys that ARE set,
 * so the suggestion always actually works for this user.
 */
function suggestFirstStep(): string {
  const gemini = hasGeminiApiKey();
  const openrouter = hasOpenRouterApiKey();
  const grok = hasGrokApiKey();
  const perplexity = hasPerplexityApiKey();
  const openai = hasOpenAIApiKey();
  const local = hasLocalLLM();

  const anyKey = gemini || openrouter || grok || perplexity || openai || local;
  if (!anyKey) {
    return [
      "  No API keys detected — external tools can't run yet.",
      "  Add ONE key to your .env, then restart the MCP server:",
      "    • OPENROUTER_API_KEY unlocks the most tools (Qwen/Kimi/DeepSeek/GLM/…)",
      "    • or GOOGLE_API_KEY / XAI_API_KEY / OPENAI_API_KEY / PERPLEXITY_API_KEY",
      "  (think, focus, nextThought, tachi and doctor work with no key.)",
    ].join("\n");
  }

  // A Gemini judge + at least one juror-capable key = the jury is the best demo.
  if (gemini && (openrouter || grok || openai || perplexity)) {
    return '  jury  question="What\'s the best way to X?"   (parallel panel → Gemini synthesis)';
  }
  if (grok) {
    return '  tachi  query="how does X work?"   (auto-routes to Grok live search)';
  }
  if (perplexity) {
    return '  perplexity_ask  query="..."   (web-grounded answer with sources)';
  }
  if (openrouter) {
    return '  deepseek_reason  query="..."   (frontier open-weight reasoning)';
  }
  if (openai) {
    return '  openai_reason  query="..."   (GPT-5.5 deep reasoning)';
  }
  if (gemini) {
    return '  gemini_brainstorm  query="..."   (fast ideation)';
  }
  // local only
  return '  local_query  query="..."   (offline, zero-cost via your local server)';
}

export const doctorTool = defineModelTool({
  name: "doctor",
  description:
    "Diagnose your TachiBot setup: which API keys are detected, which tools are available vs hidden (and why), the active profile, and a suggested first step. Zero-cost, needs no API key. Call it when tools seem missing.",
  parameters: z.object({}),
  execute: async (_args: Record<string, never>, context: any): Promise<string> => {
    context?.log?.info?.("Running TachiBot doctor diagnostic");

    // (a) API keys
    const keys = renderKeyStatus();

    // (b) Tool availability report from the router (available vs hidden + why)
    const routerStatus = toolRouter.getStatus();

    // Also summarize the key-gated tool count across ALL providers (the router
    // only covers a subset of categories), so the "hidden" story is complete.
    let gatedTotal = 0;
    let gatedHidden = 0;
    const hiddenByProvider: string[] = [];
    for (const g of PROVIDER_GROUPS) {
      gatedTotal += g.tools.length;
      if (!g.available()) {
        gatedHidden += g.tools.length;
        hiddenByProvider.push(`  ✗ ${g.label}: ${g.tools.length} tool(s) hidden (set ${g.envHint})`);
      }
    }
    const gatedVisible = gatedTotal - gatedHidden;
    const hiddenSummary =
      hiddenByProvider.length > 0
        ? hiddenByProvider.join("\n")
        : "  All key-gated providers are configured — nothing hidden by missing keys.";

    // (c) Active profile + where it was resolved from
    const profile = getActiveProfile();
    const profileName = profile?.name ?? "default";
    const profileDesc = profile?.description ? `\n  ${profile.description}` : "";
    const profileFrom = getProfileSource();

    // (d) Try-this-first suggestion, tailored to available keys
    const suggestion = suggestFirstStep();

    return [
      "TACHIBOT DOCTOR",
      "═".repeat(48),
      "",
      "API KEYS DETECTED",
      RULE,
      keys,
      "",
      "KEY-GATED TOOLS",
      RULE,
      `  Visible: ${gatedVisible}/${gatedTotal}  (${gatedHidden} hidden by missing keys)`,
      hiddenSummary,
      "  Note: think, focus, nextThought, tachi, doctor + workflow/prompt tools",
      "  are always on (no key needed); profile membership still applies.",
      "",
      "ACTIVE PROFILE",
      RULE,
      `  Profile: ${profileName}   (source: ${profileFrom})${profileDesc}`,
      "  Switch with TACHIBOT_PROFILE=<name> or activeProfile in tools.config.json.",
      "  Profiles: minimal, code_focus, research_power, balanced, heavy_coding, full.",
      "",
      "TOOL ROUTER STATUS",
      RULE,
      routerStatus,
      "",
      "TRY THIS FIRST",
      RULE,
      suggestion,
      "",
      "Run tachi (no query) for the full tool + skill catalog.",
    ].join("\n");
  },
});

/** Export for central registry (mirrors getTachiTools). */
export function getDoctorTools() {
  return [doctorTool];
}
