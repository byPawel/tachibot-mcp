/**
 * Centralized Model Names and Constants
 * Named by PROVIDER (not model version) for consistency and future-proofing
 * Use these constants instead of hardcoded strings in workflows and tools
 */

// =============================================================================
// OPENAI MODELS (provider-based naming)
// =============================================================================
// GPT-6 Astra released Sep 3, 2026 - CURRENT DEFAULT. `gpt-6-astra`: $10/$50 (cached $1),
//   1.05M ctx, 128K out. Verified live Sep 14, 2026 against /v1/models and /v1/responses:
//   reasoning.effort accepts ONLY low|medium|high|xhigh|max ("none"/"minimal" are a 400, so
//   callOpenAI maps them to "low"), and temperature must stay at the default — sending 0.7 is
//   a 400. `gpt-6-astra-pro` / `gpt-astra-latest` exist on OpenRouter only (404 on the direct API).
//   Rolled out to a limited set of orgs first, so callOpenAI falls back astra -> sol -> terra.
// GPT-5.6 (Jul 9, 2026) - three tiers kept as explicit picks and as Astra's runtime fallback:
//   sol (flagship $5/$30) / terra (balanced $2/$12) / luna (fast $0.20/$1.20). 1.05M ctx, 128K out.
//   Jul 30, 2026 price cut: luna -80%, terra -20%, sol unchanged. Verified Aug 12, 2026.
//   No Codex-specific API model exists (no gpt-5.6-codex / codex-max) — the CODEX* aliases
//   below are legacy names repointed onto current tiers.
// "Pro" is not an API model: flagship + reasoning.effort (the $30/$180 gpt-5.5-pro tier is gone).
// GPT-5.5 (Apr 23, 2026) kept as fallback. OpenRouter uses prefix: openai/gpt-6-astra etc.
export const OPENAI_MODELS = {
  // GPT-6 Astra (Sep 3, 2026 - CURRENT)
  DEFAULT: "gpt-6-astra",           // Flagship: computer use, coding, science. $10/$50 (2x sol input)
  ASTRA: "gpt-6-astra",             // Explicit alias

  // GPT-6 mid/budget tiers (Sep 2026). No gpt-6-terra exists — TERRA stays on 5.6.
  SOL: "gpt-6.1-sol",               // GPT-6.1 mid tier (Sep 29, 2026 DevDay): $2/$10, replaced gpt-6-sol. Astra's first fallback
  SOL_6_0: "gpt-6-sol",             // Previous mid tier (Sep 14, 2026): $2/$10 — 6.1-sol's fallback
  TERRA: "gpt-5.6-terra",           // Balanced: gpt-5.5-level at $2/$12 (Jul 30, 2026 cut: -20%)
  LUNA: "gpt-6-luna",               // GPT-6 budget tier (Sep 14, 2026): $0.10/$0.50 (was gpt-5.6-luna $0.20/$1.20).
                                    // Now ~9x cheaper than terra, not 2.5x — worth routing to it
                                    // far more aggressively. (Weak long-context recall: avoid huge inputs.)
  MINI: "gpt-6-luna",             // "mini" tier successor (was gpt-5.4-mini)
  PRO: "gpt-6-astra",               // No pro API model — Astra + reasoning.effort xhigh/max (was gpt-5.5-pro $30/$180)

  // GPT-5.5 (Apr 2026) - fallback
  FALLBACK_5_5: "gpt-5.5",

  // Aliases for backward compatibility
  THINKING: "gpt-6-astra",          // "Thinking" = flagship with high reasoning effort
  FULL: "gpt-6-astra",              // Map old FULL to DEFAULT
  CODEX: "gpt-5.6-terra",           // Coding workhorse tier
  CODEX_MINI: "gpt-6-luna",       // Cheapest tier
  CODEX_MAX: "gpt-6-astra",         // Map old codex-max to flagship (use high effort)
  INSTANT: "gpt-6-luna",          // Fast tier
} as const;

// OpenRouter model ID mapping (add prefix when using OpenRouter gateway)
export const OPENROUTER_PREFIX_MAP: Record<string, string> = {
  "gpt-6-astra": "openai/",
  "gpt-6.1-sol": "openai/",
  "gpt-6-sol": "openai/",
  "gpt-6-luna": "openai/",
  "gpt-5.6-sol": "openai/",
  "gpt-5.6-terra": "openai/",
  "gpt-5.6-luna": "openai/",
  "gpt-5.5": "openai/",
  "gpt-5.5-pro": "openai/",
  "gpt-5.4-mini": "openai/",
} as const;

// OpenAI Reasoning Effort Levels (for models that support it)
// All three GPT-5.6 tiers (sol/terra/luna) accept the full range; medium is the API default.
// gpt-6-astra rejects NONE (and "minimal") with a 400 — callOpenAI sends LOW instead.
export const OPENAI_REASONING = {
  NONE: "none",     // No extra reasoning (fastest, allows temperature)
  LOW: "low",       // Light reasoning — right for grounded web-search lookups
  MEDIUM: "medium", // Balanced reasoning (API default)
  HIGH: "high",     // Strong reasoning ("thinking" mode)
  XHIGH: "xhigh",   // Very thorough
  MAX: "max",       // Ceiling (verified Aug 12, 2026 against OpenAI model docs — this tier
                    // was missing here, so nothing in the codebase could request it and the
                    // "premium" path topped out one level below what sol actually offers).
                    // Reserve for hardest quality-first tasks; compare against xhigh first.
} as const;


// =============================================================================
// GEMINI MODELS (Google)
// =============================================================================
// Gemini 4 Argon GA'd Oct 13, 2026 — the new PRO/reasoning/judge default (verified live 2026-10-14:
// chat + google_search grounding). $2/$10 intro through Nov 30, 2026, then $4/$20 (thinking tokens bill
// as output). 1M ctx in, but only 32K out (3.x Pro/Flash allow 65K) — no current caller asks for >18K.
// Swap back without a code change: TACHI_GEMINI_PRO_MODEL=gemini-3.1-pro-preview (read lazily, so the
// value from .env is honored even though this module loads before dotenv runs).
// Gemini 3.7 Flash GA'd Aug 13, 2026 — the new workhorse/FLASH/search tier, 1M ctx,
// $0.75/$3.75 intro pricing through Dec 31, 2026 (then $1.50/$7.50). 3.6 Flash
// (Jul 21, 2026, $1.50/$7.50) stays live as the fallback. Gemini 3.5 Flash-Lite
// shipped the same day ($0.30/$2.50) and replaces 3.1-flash-lite as the cheap tier.
// Gemini 3.5 Pro STILL has not shipped (missed its June window; "testing with partners",
// Gemini 4 pre-training underway — reverified via ai.google.dev Aug 29, 2026), so the
// reasoning default stayed on gemini-3.1-pro-preview until Argon (it is Argon's fallback now).
export const GEMINI_PRO_DEFAULT = "gemini-4-argon";
/** Active Gemini Pro-tier model: TACHI_GEMINI_PRO_MODEL override, else Gemini 4 Argon. */
export function getGeminiProModel(): string {
  return process.env.TACHI_GEMINI_PRO_MODEL?.trim() || GEMINI_PRO_DEFAULT;
}
export const GEMINI_MODELS = {
  // Pro tier — getters so the env override is read at call time, not at import time
  get GEMINI_3_PRO(): string { return getGeminiProModel(); }, // Legacy key name: "the default Pro model"
  GEMINI_4_ARGON: "gemini-4-argon",            // Oct 13, 2026 GA: frontier reasoning, 1M in / 32K out, $2/$10 → $4/$20 Dec 1
  GEMINI_3_1_PRO: "gemini-3.1-pro-preview",   // Previous Pro default (Mar 2026), 65K out — Argon's fallback
  GEMINI_3_8_FLASH: "gemini-3.8-flash",        // Sep 2, 2026 - CURRENT flash/search tier, 1M ctx, $0.75/$3.75 (verified 2026-09-29)
  GEMINI_3_7_FLASH: "gemini-3.7-flash",        // GA Aug 13, 2026 - previous flash tier (fallback), $0.75/$3.75 intro
  GEMINI_3_6_FLASH: "gemini-3.6-flash",        // GA Jul 21, 2026 - previous flash tier (fallback), $1.50/$7.50
  GEMINI_3_5_FLASH: "gemini-3.5-flash",        // GA May 19, 2026 - previous flash tier (fallback)
  GEMINI_3_FLASH: "gemini-3-flash-preview",    // Legacy fast frontier (kept for model-router)
  GEMINI_3_5_FLASH_LITE: "gemini-3.5-flash-lite", // Jul 21, 2026 - cheapest tier, $0.30/$2.50
  GEMINI_3_1_FLASH_LITE: "gemini-3.1-flash-lite", // Mar 3, 2026 - previous cheap tier (legacy)

  // Aliases
  get PRO(): string { return getGeminiProModel(); },
  FLASH: "gemini-3.8-flash",                   // Bumped: 3.7-flash -> 3.8-flash (Sep 2, 2026)
  FLASH_LITE: "gemini-3.5-flash-lite",         // Bumped: 3.1-flash-lite -> 3.5-flash-lite (Jul 21, 2026)
} as const;

// Perplexity Models
export const PERPLEXITY_MODELS = {
  SONAR: "sonar", // Lightweight search (cheapest)
  SONAR_PRO: "sonar-pro", // Advanced search
  SONAR_REASONING: "sonar-reasoning-pro", // Reasoning model (expensive - avoid)
} as const;

// Grok Models (xAI) - Re-verified 2026-08-14 against GET /v1/models: Grok 4.6 has shipped and is
// the current latest. Catalog: grok-4.20-0309-* (x3), grok-4.3, grok-4.5, grok-4.6, grok-build-0.1,
// plus grok-imagine image/video. Re-checked 2026-09-29: grok-4.7 is live (launched Sep 21); grok-5 does not exist.
// Also verified absent: grok-code-fast-2 (unannounced) and grok-build-0.2 (docs still list 0.1 only).
export const GROK_MODELS = {
  // Grok 4.6 (Aug 2026) - CURRENT LATEST — verified against /v1/models on 2026-08-14.
  // 500K ctx, $2/$6 (same as 4.5), cached input $0.50/M (vs 4.5's $0.30/M). No `-latest` alias yet.
  // CRITICAL for search: 4.6 actually invokes web_search on the Agent Tools API; 4.5 does NOT
  // (returns ungrounded training-data answers with zero web_search_call entries).
  // Grok 4.7 (Sep 21, 2026; /v1/models `created` says Sep 2 — pre-launch timestamp) - CURRENT FLAGSHIP,
  // verified 2026-09-29 (chat + search). $2/$6, doubled above 200K prompt tokens. Search paths
  // stay on 4.6: same query gave 1 citation on 4.7 vs 18 on 4.6.
  _4_7: "grok-4.7",                                      // Flagship: 500K ctx, $2/$6, reasoning_effort
  _4_6: "grok-4.6",                                      // Search: 500K ctx, $2/$6, cached $0.50/M

  // Grok 4.5 (Jul 8, 2026) - previous flagship ("Opus-class")
  // 500K context (SMALLER than 4.3's 1M — fine for tools, mind huge inputs), $2/$6,
  // configurable reasoning effort. EU API access landed Jul 17, 2026 — 4.3 kept as quota/region fallback.
  // WARNING: does not invoke web_search on /v1/responses — do not pin search paths to it.
  _4_5: "grok-4.5",                                      // Flagship: 500K ctx, $2/$6, reasoning.effort low|high

  // Grok 4.3 (Apr 30, 2026) - previous flagship, kept as FALLBACK
  // 1M context, $1.25/$2.50, lowest verified hallucination rate.
  _4_3: "grok-4.3",                                      // Fallback: 1M ctx, $1.25/$2.50, reasoning.effort low|high
  _4_3_LATEST: "grok-4.3-latest",                        // Rolling alias for newest 4.3 snapshot
  _BUILD: "grok-build-0.1",                              // Coding specialist (May 29, 2026): 256k ctx, fast agentic coding

  // Grok 4.20 models (Mar 10, 2026) - LEGACY keys. Deprecated keys now resolve to the current flagship (4.5).
  _4_20_REASONING: "grok-4.7",                           // [deprecated key] → grok-4.7 (was grok-4.20-0309-reasoning)
  _4_20_NON_REASONING: "grok-4.7",                       // [deprecated key] → grok-4.7 (was grok-4.20-0309-non-reasoning)
  _4_20_MULTI_AGENT: "grok-4.7",                         // [deprecated key] → grok-4.7 (architect uses high reasoning.effort)

  // Grok 4.1 fast models (Nov 2025) - BEST VALUE (10x cheaper)
  // RETIRED by xAI — verified Aug 12, 2026. DO NOT WIRE THESE TO ANYTHING.
  // The retirement is invisible at runtime: xAI answers a request for these ids with
  // HTTP 200 and silently serves grok-4.3, disclosing the swap only in the response
  // body's `model` field. Nothing throws, so no fallback or try/catch can detect it —
  // you just quietly pay grok-4.3 rates ($1.25/$2.50) while believing you pay $0.20/$0.50.
  // Kept only so existing references resolve to a real (substituted) model rather than
  // breaking; grok_search_lite was moved off them and onto _4_3 explicitly.
  _4_1_FAST_REASONING: "grok-4-1-fast-reasoning",         // [RETIRED → serves grok-4.3]
  _4_1_FAST_NON_REASONING: "grok-4-1-fast-non-reasoning", // [RETIRED → serves grok-4.3]

  // Grok 4 fast models (2025) - Still good
  CODE_FAST: "grok-code-fast-1",              // Coding specialist: 256K→2M, $0.20/$1.50, 92 tok/sec
  _4_FAST_REASONING: "grok-4-fast-reasoning", // Cheap reasoning: 2M→4M, $0.20/$0.50
  _4_FAST: "grok-4-fast-non-reasoning",       // Fast general: 2M→4M, $0.20/$0.50

  // Expensive/specialized (use sparingly)
  _4_HEAVY: "grok-4-0709",                    // Multi-agent: 256K→2M, $3/$15 (expensive!)
  _3: "grok-3",                               // Legacy with search: 256K→2M
} as const;

// Kimi Models (Moonshot AI via OpenRouter)
// K3 released Jul 16, 2026 - 2.8T open-weight MoE, largest open model shipped; 1M ctx, native multimodal,
//   long-horizon agentic coding (beats Opus 4.8 / GPT-5.5 on coding+agent benchmarks). $3/$15 per M.
//   NOTE: 4x the price of K2.7-Code — quality-over-cost per repo strategy, but mind cheap/bulk call sites.
// K2.7-Code released Jun 12, 2026 - coding-specialized (built on K2.6), 262K ctx, $0.75/$3.50 (fallback)
// K2.6 released Apr 20, 2026 - 1T MoE, leads SWE-bench Pro for long-horizon coding (fallback)
// K2.5 released Jan 27, 2026 - kept as legacy
export const KIMI_MODELS = {
  K3: "moonshotai/kimi-k3",                     // CURRENT (Jul 16, 2026): 2.8T MoE, 1M ctx, multimodal, $3/$15
  K2_THINKING: "moonshotai/kimi-k2-thinking",   // 1T MoE, 32B active - agentic reasoning (256k context)
  K2_7_CODE: "moonshotai/kimi-k2.7-code",       // Previous (Jun 12, 2026): coding-specialized, 262K ctx, $0.75/$3.50 (fallback)
  K2_6: "moonshotai/kimi-k2.6",                 // Older (Apr 2026): 1T MoE, SWE-Pro leader (fallback)
  K2_5: "moonshotai/kimi-k2.5",                 // Legacy: multimodal + agent swarm
} as const;

// MiniMax Models (MiniMax via OpenRouter)
// M3 released May 31, 2026 - 1M ctx, MSA sparse attention (~1/20 compute at 1M), native multimodal
export const MINIMAX_MODELS = {
  M3: "minimax/minimax-m3",                     // 1M ctx, MSA sparse attention, multimodal, agentic/coding, $0.30/$1.20
  M2_7: "minimax/minimax-m2.7",                 // 2300B/100B MoE, 200K ctx, SWE-Pro 56.22%, Multi-SWE #1 (fallback)
  M2_5: "minimax/minimax-m2.5",                 // SWE-Bench 80.2%, 37% faster than M2.1 (legacy)
} as const;

// Jev (TypeSafe via OpenRouter) — typed decisions, NOT a chat model. Served only on
// OpenRouter's System One endpoint (/api/v1/systemone) and absent from /api/v1/models,
// so never route these through callOpenRouter. ~$0.04/M input, output free, ~0.3s.
// Verified live 2026-10-14: jev-1.13 answers (served as jev-1.13-20260917);
// jev-latest is a 400. typesafe/jev-router is a chat-completions meta-router — not wired.
export const JEV_MODELS = {
  JEV_1_13: "typesafe/jev-1.13",               // noul / choice / score questions over a state
} as const;

// Qwen Models (Alibaba via OpenRouter)
// Qwen3 235B Thinking (July 2025) - Largest reasoning model available
// Qwen3-Coder-Next (Feb 2026) - Agentic coding specialist, 80B/3B MoE, 262K context
export const QWEN_MODELS = {
  MAX_3_8: "qwen/qwen3.8-max-0902",                 // Aug 3, 2026: CURRENT flagship reasoning model — 1M ctx, multimodal (text+image+video), reasoning_effort, $2/$6
  MAX_3_7: "qwen/qwen3.7-max",                 // May 21, 2026: previous flagship, 1M ctx, agent-centric, $1.475/$4.425 (fallback)
  PLUS_3_7: "qwen/qwen3.7-plus",               // Jun 3, 2026: general-purpose flagship, 1M ctx, multimodal, $0.32/$1.28
  PLUS_3_6: "qwen/qwen3.6-plus",               // Apr 2026: previous general-purpose flagship (legacy)
  CODER_NEXT: "qwen/qwen3-coder-next",         // 80B/3B MoE, 262K ctx, SWE-Bench >70%, $0.14/$0.80 (still PRIMARY coder — no 3.6-coder yet)
  CODER_PLUS: "qwen/qwen3-coder-plus",         // GONE from OpenRouter (verified 2026-10-14) — key kept for back-compat, do NOT call
  CODER: "qwen/qwen3-coder",                   // Legacy coder - 480B MoE, SWE-Bench 69.6%
  DENSE_3_8_27B: "qwen/qwen3.8-27b",           // Aug 14, 2026: dense 27B reasoning, 1M ctx, reasoning_effort, $0.21/$2.55 — powers qwq_reason
  QWQ_32B: "qwen/qwq-32b",                     // RETIRED from OpenRouter (404 "No endpoints found", Sep 14, 2026) — do NOT call
  MAX_THINKING: "qwen/qwen3-235b-a22b-thinking-2507", // 235B MoE (22B active) thinking mode - heavy reasoning
} as const;

// =============================================================================
// OPENROUTER MODELS (Unified - all models accessible via OpenRouter)
// =============================================================================
export const OPENROUTER_MODELS = {
  // Qwen models
  ...QWEN_MODELS,
  // Kimi models
  ...KIMI_MODELS,
  // MiniMax models
  ...MINIMAX_MODELS,
} as const;

// =============================================================================
// PROVIDERS - All provider constants in one place
// =============================================================================
export const PROVIDERS = {
  openai: OPENAI_MODELS,
  google: GEMINI_MODELS,
  xai: GROK_MODELS,
  perplexity: PERPLEXITY_MODELS,
  openrouter: OPENROUTER_MODELS,
} as const;

// All models combined for validation
export const ALL_MODELS = {
  ...OPENAI_MODELS,
  ...GEMINI_MODELS,
  ...PERPLEXITY_MODELS,
  ...GROK_MODELS,
  ...KIMI_MODELS,
  ...QWEN_MODELS,
  ...MINIMAX_MODELS,
  ...JEV_MODELS,
} as const;

// Type for any valid model name
export type ModelName = (typeof ALL_MODELS)[keyof typeof ALL_MODELS];

// Common workflow settings
export const DEFAULT_WORKFLOW_SETTINGS = {
  maxTokens: 2000,
  temperature: 0.7,
  retries: 3,
  timeout: 70000, // 70 seconds (Gemini 3.1 Pro Preview needs longer)
} as const;

// ============================================================================
// CURRENT_MODELS - SINGLE BUMP POINT FOR MODEL VERSIONS
// ============================================================================
// When new models release, update ONLY this section!
// All tools automatically use the new models.
// ============================================================================
// UPDATED Oct 14, 2026: Gemini Pro 3.1-pro-preview -> gemini-4-argon (Oct 13 GA; env-switchable);
//   OpenAI SOL gpt-6-sol -> gpt-6.1-sol (Sep 29); openai_search terra -> 6.1-sol; grok_search 4.6 -> 4.7;
//   StepFun 3.7-flash -> step-5-preview (Oct 8); ERNIE removed (Baidu left OpenRouter Oct 8).
// UPDATED Sep 14, 2026: OpenAI default gpt-5.6-sol -> gpt-6-astra (Sep 3);
//   qwq_reason qwen/qwq-32b (retired from OpenRouter) -> qwen/qwen3.8-27b.
// UPDATED Jul 26, 2026 (full provider audit):
//   Kimi K2.7-Code -> K3 (Jul 16) · Gemini Flash 3.5 -> 3.6 + Flash-Lite 3.1 -> 3.5 (Jul 21)
// Re-verified as still-current, NOT bumped: GPT-5.6 tiers (Jul 9), Grok 4.5 (Jul 8),
//   Gemini 3.1 Pro (no 3.5 Pro shipped), DeepSeek V4 Pro (GA Jul 20), GLM-5.2, MiniMax M3,
//   StepFun 3.7, ERNIE 4.5 VL, Qwen Coder-Next, Perplexity Sonar.
export const CURRENT_MODELS = {
  openai: {
    default: OPENAI_MODELS.DEFAULT,       // gpt-6-astra - flagship (Sep 3, 2026), $10/$50
    reason: OPENAI_MODELS.DEFAULT,        // Deep reasoning (astra + effort=xhigh)
    brainstorm: OPENAI_MODELS.DEFAULT,    // Creative ideation (astra + effort=medium)
    code: OPENAI_MODELS.TERRA,            // Code tasks (gpt-5.6-terra - 5.5-level at $2/$12)
    explain: OPENAI_MODELS.SOL,           // openai_explain pins gpt-6.1-sol at low effort ($2/$10)
    search: OPENAI_MODELS.SOL,            // Web search: $10/1k call fee is flat across tiers; gpt-6.1-sol
                                          // ($2/$10) beat terra on a fresh-news query (2026-10-14).
    // Premium: the 5.5-pro tier ($30/$180) is gone — astra + effort=max replaces it at $10/$50
    premium: OPENAI_MODELS.PRO,           // Expert mode (gpt-6-astra + reasoning.effort=max)
  },
  grok: {
    reason: GROK_MODELS._4_7,            // grok-4.7 (Sep 21, 2026 flagship, reasoning effort)
    code: GROK_MODELS._4_7,              // grok-4.7 (flagship quality, tool-calling)
    debug: GROK_MODELS._4_7,             // grok-4.7 (flagship debugging)
    brainstorm: GROK_MODELS._4_7,        // grok-4.7 (500K context)
    search: GROK_MODELS._4_7,            // grok-4.7: re-verified 2026-10-14 over 3 queries — 19/79/2 unique
                                         // citations vs 4.6's 2/4/2, and found the newer facts. (Sep 29 it
                                         // lost 1 vs 18; xAI has since fixed 4.7's search.) 4.5 never grounds.
    search_lite: GROK_MODELS._4_3,       // grok-4.3: $1.25/$2.50, 1M ctx — ~1.6x/2.4x cheaper than
                                         // grok-4.5 search. Was _4_1_FAST_NON_REASONING until that id
                                         // was retired (xAI silently served 4.3 for it anyway).
    architect: GROK_MODELS._4_7,         // grok-4.7 with high reasoning.effort (agentic swarm behaviour)
  },
  gemini: {
    get default(): string { return GEMINI_MODELS.GEMINI_3_PRO; }, // gemini-4-argon unless TACHI_GEMINI_PRO_MODEL
  },
  perplexity: {
    search: PERPLEXITY_MODELS.SONAR,           // $1/$1 per M (cheapest)
    reason: PERPLEXITY_MODELS.SONAR_REASONING, // sonar-reasoning-pro $2/$8 per M
  },
  openrouter: {
    kimi: KIMI_MODELS.K3,                  // K3 (Jul 16, 2026): 2.8T MoE, 1M ctx, multimodal, agentic coding
    qwen: QWEN_MODELS.CODER_NEXT,          // Qwen3-Coder-Next: 80B/3B MoE, 262K ctx, SWE >70% (no 3.6-coder yet)
    qwen_reason: QWEN_MODELS.MAX_3_8,      // Qwen3.8 Max (Aug 3, 2026): flagship reasoning, 1M ctx, high reasoning effort
    minimax: MINIMAX_MODELS.M3,            // M3: 1M ctx, MSA sparse attention, agentic/coding
  }
} as const;

// Tool-specific defaults - References CURRENT_MODELS for easy bumping
export const TOOL_DEFAULTS = {
  // OpenAI tools (GPT-5.4 reasoning tokens eat into max_output_tokens, so set higher)
  openai_reason: {
    model: CURRENT_MODELS.openai.reason,
    reasoning_effort: OPENAI_REASONING.HIGH,
    maxTokens: 8000,
    temperature: 0.7,
  },
  openai_brainstorm: {
    model: CURRENT_MODELS.openai.brainstorm,
    reasoning_effort: OPENAI_REASONING.MEDIUM,
    maxTokens: 6000,
    temperature: 0.9,
  },
  openai_code_review: {
    model: CURRENT_MODELS.openai.code,
    reasoning_effort: OPENAI_REASONING.MEDIUM,
    maxTokens: 6000,
    temperature: 0.3,
  },
  openai_explain: {
    model: CURRENT_MODELS.openai.explain,
    reasoning_effort: OPENAI_REASONING.LOW,
    maxTokens: 4000,
    temperature: 0.7,
  },
  openai_search: {
    model: CURRENT_MODELS.openai.search,
    reasoning_effort: OPENAI_REASONING.LOW,
    maxTokens: 8000,
    temperature: 0.3,
  },

  // Gemini tools
  gemini_brainstorm: {
    get model(): string { return CURRENT_MODELS.gemini.default; }, // live: follows TACHI_GEMINI_PRO_MODEL
    maxTokens: 2048,
    temperature: 0.9,
  },
  gemini_analyze_code: {
    get model(): string { return CURRENT_MODELS.gemini.default; }, // live: follows TACHI_GEMINI_PRO_MODEL
    maxTokens: 2048,
    temperature: 0.3,
  },
  gemini_analyze_text: {
    get model(): string { return CURRENT_MODELS.gemini.default; }, // live: follows TACHI_GEMINI_PRO_MODEL
    maxTokens: 2048,
    temperature: 0.5,
  },

  // Perplexity tools
  perplexity_ask: {
    model: CURRENT_MODELS.perplexity.search,
    maxTokens: 2000,
    temperature: 0.7,
  },
  perplexity_reason: {
    model: CURRENT_MODELS.perplexity.reason,
    maxTokens: 4000,
    temperature: 0.7,
  },
  perplexity_research: {
    model: CURRENT_MODELS.perplexity.search,
    maxTokens: 3000,
    temperature: 0.7,
  },

  // Grok tools
  grok_reason: {
    model: CURRENT_MODELS.grok.reason,
    maxTokens: 8000,
    temperature: 0.7,
  },
  grok_code: {
    model: CURRENT_MODELS.grok.code,
    maxTokens: 4000,
    temperature: 0.3,
  },
  grok_search: {
    model: CURRENT_MODELS.grok.search,
    maxTokens: 3000,
    temperature: 0.7,
  },
  grok_search_lite: {
    model: CURRENT_MODELS.grok.search_lite,
    maxTokens: 3000,
    temperature: 0.3,
  },
  grok_brainstorm: {
    model: CURRENT_MODELS.grok.brainstorm,
    maxTokens: 4000,
    temperature: 0.9,
  },
  grok_architect: {
    model: CURRENT_MODELS.grok.architect,
    maxTokens: 4000,
    temperature: 0.6,
  },
  grok_debug: {
    model: CURRENT_MODELS.grok.debug,
    maxTokens: 3000,
    temperature: 0.3,
  },

  // OpenRouter tools
  qwen_coder: {
    maxTokens: 4000,
    temperature: 0.5,
  },
  qwen_algo: {
    model: QWEN_MODELS.MAX_3_8,           // Qwen3.8 Max at reasoning_effort "medium" (default effort ≈ high ≈ 5min)
    maxTokens: 12000,                     // Raised from 8000 — headroom for the visible answer
    temperature: 0.2,
  },
  qwen_reason: {
    model: QWEN_MODELS.MAX_3_8,           // Qwen3.8 Max at reasoning_effort "medium" (default effort ≈ high ≈ 5min)
    maxTokens: 12000,                     // Raised from 8000 — headroom for the visible answer
    temperature: 0.3,                      // Lower for precise reasoning
  },
  kimi_thinking: {
    model: KIMI_MODELS.K3,                // K3 (Jul 2026): 2.8T MoE, 1M ctx, long-horizon agentic reasoning
    maxTokens: 16000,
    temperature: 0.7,
  },
  // MiniMax tools - VERY CHEAP, open source
  minimax_code: {
    model: MINIMAX_MODELS.M3,             // 1M ctx, MSA sparse attention, agentic/coding
    maxTokens: 4000,
    temperature: 0.3,                      // Lower for precise code
  },
  minimax_agent: {
    model: MINIMAX_MODELS.M3,             // 1M ctx, multimodal, long-horizon agentic work
    maxTokens: 4000,
    temperature: 0.5,                      // Balanced for agentic tasks
  },

  // Meta tools
  think: {
    model: CURRENT_MODELS.openai.reason,
    reasoning_effort: OPENAI_REASONING.HIGH,
    maxTokens: 4000,
    temperature: 0.7,
  },
  focus: {
    model: CURRENT_MODELS.openai.code,
    reasoning_effort: OPENAI_REASONING.LOW,
    maxTokens: 2000,
    temperature: 0.8,
  },
} as const;

// Default tool to use in workflows if not specified
export const DEFAULT_WORKFLOW_TOOL = "openai_brainstorm";

// =============================================================================
// MODEL DISPLAY NAMES - Single source of truth for UI display
// =============================================================================
// Used in tool outputs, usage stats, logs - keeps display consistent
export const MODEL_DISPLAY_NAMES: Record<string, string> = {
  // OpenAI
  "gpt-6-astra": "gpt-6-astra",
  "gpt-6.1-sol": "gpt-6.1-sol",
  "gpt-6-sol": "gpt-6-sol",
  "gpt-6-luna": "gpt-6-luna",
  "gpt-5.6-sol": "gpt-5.6-sol",
  "gpt-5.6-terra": "gpt-5.6-terra",
  "gpt-5.6-luna": "gpt-5.6-luna",
  "gpt-5.6": "gpt-5.6-sol",
  "gpt-5.5": "gpt-5.5",
  "gpt-5.5-pro": "gpt-5.5-pro",
  "gpt-5.4": "gpt-5.4",
  "gpt-5.4-mini": "gpt-5.4-mini",
  "gpt-5.4-pro": "gpt-5.4-pro",

  // Gemini
  "gemini-4-argon": "gemini-4-argon",
  "gemini-3.1-pro-preview": "gemini-3.1-pro",
  "gemini-3.7-flash": "gemini-3.7-flash",
  "gemini-3.6-flash": "gemini-3.6-flash",
  "gemini-3.5-flash-lite": "gemini-3.5-flash-lite",
  "gemini-3.5-flash": "gemini-3.5-flash",
  "gemini-3-flash-preview": "gemini-3-flash",
  "gemini-3.1-flash-lite": "gemini-3.1-flash-lite",

  // Grok (xAI)
  "grok-4.5": "grok-4.5",
  "grok-4.3": "grok-4.3",
  "grok-4.3-latest": "grok-4.3",
  "grok-build-0.1": "grok-build",
  "grok-4.20-0309-reasoning": "grok-4.20",
  "grok-4.20-0309-non-reasoning": "grok-4.20-fast",
  "grok-4.20-multi-agent-0309": "grok-4.20-multi",
  "grok-4-1-fast-reasoning": "grok-4.1",
  "grok-4-1-fast-non-reasoning": "grok-4.1-fast",
  "grok-4-fast-reasoning": "grok-4",
  "grok-4-fast-non-reasoning": "grok-4-fast",
  "grok-code-fast-1": "grok-code",
  "grok-4-0709": "grok-4-heavy",
  "grok-3": "grok-3",

  // Perplexity
  "sonar-pro": "perplexity",
  "sonar-reasoning-pro": "perplexity-reason",

  // Kimi (Moonshot)
  "moonshotai/kimi-k3": "kimi-k3",
  "moonshotai/kimi-k2-thinking": "kimi-k2",
  "moonshotai/kimi-k2.7-code": "kimi-k2.7-code",
  "moonshotai/kimi-k2.6": "kimi-k2.6",
  "moonshotai/kimi-k2.5": "kimi-k2.5",
  "moonshotai/kimi-k2.5-thinking": "kimi-k2.5",

  // Qwen (Alibaba)
  "qwen/qwen3.7-plus": "qwen3.7-plus",
  "qwen/qwen3.6-plus": "qwen3.6-plus",
  "qwen/qwen3-coder-next": "qwen-coder-next",
  "qwen/qwen3-coder-plus": "qwen-coder",
  "qwen/qwen3-coder": "qwen-coder",
  "qwen/qwq-32b": "qwq-32b",
  "qwen/qwen3.8-27b": "qwen3.8-27b",
  "qwen/qwen3-max-thinking": "qwen-max",
  "qwen/qwen3-235b-a22b-thinking-2507": "qwen-235b-thinking",

  // MiniMax
  "minimax/minimax-m3": "minimax-m3",
  "minimax/minimax-m2.7": "minimax-m2.7",
  "minimax/minimax-m2.5": "minimax-m2.5",
  "minimax/minimax-m2.1": "minimax-m2.1",
} as const;

// Helper to get display name (falls back to model ID if not mapped)
export function getModelDisplayName(modelId: string): string {
  return MODEL_DISPLAY_NAMES[modelId] || modelId;
}

// Model pricing per 1K tokens (input/output average) for cost tracking
export const MODEL_PRICING: Record<string, number> = {
  // OpenAI
  "gpt-6-astra": 0.030,         // ($10 + $50) / 2 / 1000 (Sep 3, 2026 - current default)
  "gpt-6.1-sol": 0.006,         // ($2 + $10) / 2 / 1000 (Sep 29, 2026 - SOL tier)
  "gpt-6-sol": 0.006,           // ($2 + $10) / 2 / 1000 (Sep 14, 2026 - fallback)
  "gpt-6-luna": 0.0003,         // ($0.10 + $0.50) / 2 / 1000 (Sep 14, 2026 - LUNA/MINI tier)
  "gpt-5.6-sol": 0.0175,        // ($5 + $30) / 2 / 1000 (unchanged in the Jul 30 cut)
  "gpt-5.6-terra": 0.007,       // ($2 + $12) / 2 / 1000 (Jul 30, 2026 cut: -20%)
  "gpt-5.6-luna": 0.0007,       // ($0.20 + $1.20) / 2 / 1000 (Jul 30, 2026 cut: -80%)
  "gpt-5.5": 0.0175,            // ($5 + $30) / 2 / 1000 (Apr 23, 2026 - fallback)
  "gpt-5.5-pro": 0.105,         // ($30 + $180) / 2 / 1000 (Apr 23, 2026 - tier removed in 5.6)
  "gpt-5.4": 0.00875,           // ($2.50 + $15) / 2 / 1000 (Mar 2026 - legacy)
  "gpt-5.4-mini": 0.002625,     // ($0.75 + $4.50) / 2 / 1000 (Mar 17, 2026)
  "gpt-5.4-pro": 0.105,         // ($30 + $180) / 2 / 1000 (Mar 2026)

  // Gemini
  "gemini-4-argon": 0.006,        // ($2 + $10) / 2 / 1000 intro through Nov 30, 2026 — $4/$20 (0.012) from Dec 1
  "gemini-3.1-pro-preview": 0.007, // ($2 + $12) / 2 / 1000
  "gemini-3.7-flash": 0.00225,           // ($0.75 + $3.75) / 2 / 1000 intro through Dec 31, 2026 (then $1.50/$7.50)
  "gemini-3.6-flash": 0.0045,            // ($1.50 + $7.50) / 2 / 1000 (GA Jul 21, 2026 - fallback)
  "gemini-3.5-flash-lite": 0.0014,       // ($0.30 + $2.50) / 2 / 1000 (Jul 21, 2026)
  "gemini-3.5-flash": 0.00525,           // ($1.50 + $9) / 2 / 1000 (GA May 19, 2026 - fallback)
  "gemini-3-flash-preview": 0.00175,     // ($0.50 + $3) / 2 / 1000 (legacy)
  "gemini-3.1-flash-lite": 0.001,       // Cheapest/fastest in 3.1 series (Mar 2026)

  // Grok
  "grok-4.5": 0.004,                        // ($2 + $6) / 2 / 1000 (Jul 8, 2026 flagship)
  "grok-4.3": 0.001875,                     // ($1.25 + $2.50) / 2 / 1000 (Apr 30, 2026 - fallback)
  "grok-4.3-latest": 0.001875,
  "grok-build-0.1": 0.001875,               // Coding specialist (estimate, same tier)
  "grok-4.20-0309-reasoning": 0.004,        // ($2 + $6) / 2 / 1000 (legacy)
  "grok-4.20-0309-non-reasoning": 0.004,    // ($2 + $6) / 2 / 1000 (legacy)
  "grok-4.20-multi-agent-0309": 0.004,      // ($2 + $6) / 2 / 1000 (legacy)
  "grok-4-1-fast-reasoning": 0.00035,
  "grok-4-1-fast-non-reasoning": 0.00035,
  "grok-4-fast-reasoning": 0.00035,
  "grok-4-fast-non-reasoning": 0.00035,
  "grok-code-fast-1": 0.00085,
  "grok-4-0709": 0.009,          // expensive
  "grok-3": 0.00035,

  // Perplexity
  "sonar": 0.001,                  // cheapest search
  "sonar-pro": 0.006,
  "sonar-reasoning-pro": 0.006,   // avoid - expensive reasoning tokens

  // OpenRouter models - Kimi
  "moonshotai/kimi-k3": 0.009,           // ($3 + $15) / 2 / 1000 (Jul 16, 2026)
  "moonshotai/kimi-k2-thinking": 0.002,
  "moonshotai/kimi-k2.7-code": 0.002125, // ($0.75 + $3.50) / 2 / 1000 (Jun 12, 2026)
  "moonshotai/kimi-k2.6": 0.0027,      // ($0.74 + $4.65) / 2 / 1000 (Apr 2026)
  "moonshotai/kimi-k2.5": 0.003,
  "moonshotai/kimi-k2.5-thinking": 0.003,

  // OpenRouter models - Qwen
  "qwen/qwen3.7-plus": 0.0008,         // ($0.32 + $1.28) / 2 / 1000 (Jun 3, 2026 - promo pricing)
  "qwen/qwen3.6-plus": 0.001138,       // ($0.325 + $1.95) / 2 / 1000 (Apr 2026 - legacy)
  "qwen/qwen3-coder-next": 0.00047,    // ($0.14 + $0.80) / 2 / 1000 (verified via OpenRouter Apr 2026)
  "qwen/qwen3-coder-plus": 0.0005,
  "qwen/qwen3-coder": 0.0003,
  "qwen/qwq-32b": 0.001,
  "qwen/qwen3.8-27b": 0.001382, // ($0.214 + $2.55) / 2 / 1000 (Aug 14, 2026)
  "qwen/qwen3-max-thinking": 0.005,
  "qwen/qwen3-235b-a22b-thinking-2507": 0.000822, // ($0.15 + $1.50) / 2 / 1000

  // OpenRouter models - MiniMax (VERY CHEAP!)
  "minimax/minimax-m3": 0.00075,          // ($0.30 + $1.20) / 2 / 1000 - flagship (promo pricing)
  "minimax/minimax-m2.7": 0.00075,        // ($0.30 + $1.20) / 2 / 1000 - fallback
  "minimax/minimax-m2.5": 0.000685,       // legacy
  "minimax/minimax-m2.1": 0.000685,       // legacy
} as const;
