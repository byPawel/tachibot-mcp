# Changelog

All notable changes to TachiBot MCP will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.22.0] - 2026-06-10

### Added
- **Four new reasoning providers** via OpenRouter: **DeepSeek V4 Pro** (`deepseek_reason`, `deepseek_algo` — open-weight frontier math/CP, top AIME/CodeElo), **Zhipu GLM-5.1** (`glm_reason` — SWE-Bench Pro leader, agentic tool-use), **StepFun Step 3.7 Flash** (`stepfun_reason` — efficient reasoning at flash-tier cost), **Baidu ERNIE 4.5 VL** (`ernie_reason` — broad knowledge, human-preference strength). Each with quota fallbacks and 600s reasoning timeouts.
- **Local model provider** (`local_query`): any OpenAI-compatible server — Ollama, LM Studio, llama.cpp, vLLM. Ollama gets the native `/api/chat` endpoint so `num_ctx` is honored; failures raise a typed `LocalLLMError`. Configure via `LOCAL_LLM_BASE_URL` / `LOCAL_LLM_MODEL` / `LOCAL_LLM_NUM_CTX`.
- **Jury roster expansion**: new jurors `deepseek`, `glm`, `stepfun`, `ernie`, `hermes`, `local` (13 total). New lab-diverse default panel: `grok, deepseek, kimi, openai`. Offline jurors are dropped (not error-leaked) when the local server is down.
- **Three new Claude Code skills**: `/lens` (long-context analysis over Kimi's 256K window), `/reflect` (grounded reflexion loop against external evidence), `/tot` (Tree-of-Thought with jury-based branch pruning). 12 skills total.
- `deepseek_algo` is now the lead model in `/algo` (strongest algorithmic review).

### Changed
- Profile counts: minimal 12, code_focus 34, research_power 35, balanced 45, heavy_coding 50, full 57.
- Merged the `local-models-ollama` release line (v2.21.3–v2.21.5): Gemini 3.5 Flash search tier, Grok 4.3 default, Kimi K2.6 repoints.

## [2.21.5] - 2026-06-04

### Fixed
- **Kimi tools were calling a retired model.** All Kimi call sites hardcoded `moonshotai/kimi-k2.5`, which OpenRouter no longer serves — every `kimi_*` request failed with a JSON/timeout error (surfaced as "Kimi down"). The model config (`KIMI_MODELS.K2_6`) was already correct but unused by the tools. Repointed all 5 call sites — `kimi_thinking`, `kimi_code`, `kimi_decompose`, `kimi_long_context` (`openrouter-tools.ts`) and the Kimi juror (`jury-tool.ts`) — to `moonshotai/kimi-k2.6`.
- Fixed the `MODEL_FALLBACKS` entry for `KIMI_K2_6`, which pointed at the retired `KIMI_K2_5`; it now falls back to `KIMI_K2_THINKING` (`moonshotai/kimi-k2-thinking`, still live).

### Notes
- The `KIMI_K2_5` enum value is retained for back-compat but is marked do-not-call; `moonshotai/kimi-k2.5` is no longer a valid OpenRouter model ID.

## [2.21.4] - 2026-06-01

### Changed
- **Grok bumped `grok-4.20` → `grok-4.3`** (xAI's Apr 30 2026 flagship). All Grok roles (`grok_reason`, `grok_code`, `grok_debug`, `grok_brainstorm`, `grok_search`, `grok_architect`) now resolve to `grok-4.3`: 1M context, lowest hallucination rate, and **cheaper** ($1.25/$2.50 vs 4.20's $2/$6). Pricing entry dropped `0.004` → `0.001875`.
- `grok-4.3` is a single model ID with **configurable reasoning effort** (replacing 4.20's reasoning/non-reasoning/multi-agent split). `callGrok` now (a) treats `grok-4.3` as a long-timeout flagship (180s) and (b) forwards `reasoning.effort` for `grok-4.3` as well as multi-agent — so `grok_architect` keeps its `high`-effort behaviour.
- Repointed `CURRENT_MODELS.grok`, `MODELS.GROK`, workflow `model-router` routing, `ModelProviderRegistry` alias, and `config.ts` available-models list to `grok-4.3`.

### Added
- `GROK_MODELS._4_3` / `GROK_MODELS._BUILD` constants (+ `GrokModel.GROK_4_3`, `GROK_4_3_LATEST`, `GROK_BUILD`). `grok-build-0.1` (May 29 2026 coding specialist, 256k ctx) added as a constant for future wiring.
- Display name, pricing, OpenRouter-gateway mapping (`x-ai/grok-4.3`), cost-monitor entry, and ANSI terminal labels (all 4 style maps) for `grok-4.3`.

### Notes
- Legacy `GROK_4_20_*` enum keys are retained (now resolving to `grok-4.3`) for back-compat; grok-4.20 itself was **not** retired by xAI and remains a valid fallback.

## [2.21.3] - 2026-05-29

### Added
- **Gemini 3.5 Flash** (`gemini-3.5-flash`) — went GA at Google I/O on 2026-05-19. Now the Flash/search tier: `gemini_query` (`flash`), `gemini_search` grounding, and `tool-mapper` `flash` routing all resolve to it via `GEMINI_MODELS.FLASH`. Agentic/coding focus, 1M context, $1.50/$9 per M tokens. SWE-bench Verified 78.8%, Terminal-bench 76.2%.
- Display name + pricing for `gemini-3.5-flash`; ANSI terminal labels in all 4 style maps.

### Changed
- `GEMINI_MODELS.FLASH` alias bumped `gemini-3-flash-preview` → `gemini-3.5-flash`. The legacy `GEMINI_3_FLASH` constant is retained for `model-router.ts` cost tiers.

### Notes
- **Reasoning default unchanged** — `gemini.default` stays `gemini-3.1-pro-preview`. Gemini 3.5 **Pro** is not yet released (announced at I/O, expected June 2026, no API model ID). Swap the default to 3.5 Pro once it ships.
- No OpenAI change: GPT-5.5 (Apr 23) remains the latest flagship; no GPT-5.6 exists.

## [2.21.2] - 2026-05-04

### Fixed
- Test suite: dropped stray `vitest` import in `strip-markdown` test (project uses Jest).

### Docs
- Backfilled CHANGELOG entries for v2.20.0 and v2.21.0.

## [2.21.1] - 2026-04-26

### Changed
- **OpenAI: gpt-5.4 → gpt-5.5** (released 2026-04-23). Agentic-focused, 1.1M context, omnimodal. Pricing $5/$30 per M tokens. `gpt-5.5-pro` ($30/$180) for premium tier. `gpt-5.4-mini` retained for `code`/`explain` tools (no `gpt-5.5-mini` released yet).
- **Kimi: kimi-k2.5 → kimi-k2.6** (released 2026-04-20). 1T MoE, leads SWE-bench Pro for long-horizon coding. Pricing ~$0.74/$4.65 per M tokens. K2.5 retained as fallback.

### Added
- **Qwen3.6-Plus** (`qwen/qwen3.6-plus`) registered in `QWEN_MODELS.PLUS_3_6`. New April 2026 general-purpose flagship at $0.325/$1.95 per M. Not yet wired as default — `qwen3-coder-next` (coder) and `qwen3-235b-thinking-2507` (reason) remain primary; awaiting `qwen3.6-coder` variant.
- Display names + pricing for `gpt-5.5`, `gpt-5.5-pro`, `kimi-k2.6`, `qwen3.6-plus`, `qwen3-235b-a22b-thinking-2507`.
- Auto-fallback: `kimi-k2.6` → `kimi-k2.5` on quota errors.

### Notes
- Grok 5 not released (Q2 2026 expected). Keeping `grok-4.20-0309-reasoning`.
- Gemini 3.5 in preview, GA expected at Google I/O May 2026. Keeping `gemini-3.1-pro-preview`.
- Verified all model IDs against live OpenAI `/v1/models` and OpenRouter `/v1/models` endpoints before release.

## [2.21.0] - 2026-04-13

### Added
- **Auto-alias param names** — `z.preprocess()` hook in `safeAddTool` remaps `query` ↔ `problem` ↔ `prompt` ↔ `question` ↔ `topic` before Zod validation. LLMs that reach for the wrong synonym now succeed instead of hard-failing with `-32602 InvalidParams`.
- **Zero per-tool changes** — single source of truth in `src/utils/param-aliases.ts`; every tool benefits automatically.
- **11 unit tests** in `src/utils/__tests__/param-aliases.test.ts` covering directional aliasing, primary-wins precedence, and missing-key behavior.

### Notes
- Primary param value always wins when both primary and alias are provided.
- Aliasing is transparent to tool implementations — the Zod schema sees the canonical key.

## [2.20.0] - 2026-04-10

### Changed
- **Grok 4 → 4.20** — all defaults moved to flagship.
  - `grok_reason` / `grok_search` → `grok-4.20-0309-reasoning` (low hallucination, 2M context)
  - `grok_architect` → `grok-4.20-multi-agent-0309` (4–16 parallel agents)
  - `grok_code` / `grok_debug` / `grok_brainstorm` → `grok-4.20-0309-non-reasoning` (fast turn-around)
- **Smart timeout defaults bumped** — OpenAI 20→60s base, Grok max 90→120s.

### Added
- **AbortController on OpenAI** — 90s default, 180s for high-reasoning. No more hung calls.
- **AbortController on Grok** — 60–180s based on model.
- **`reasoning` param** on `callGrok` for multi-agent invocation; unified `GrokModel` enum.

### Fixed
- Stale `gpt-4-mini` → `gpt-5.4-mini` in architect + workflows.
- Hardcoded `grok-4-0709` references across 6 scattered files (OpenRouter gateway, ANSI badges, model-router, tool-mapper).

### Docs
- Updated `docs/API_KEYS.md` and `docs/TOOL_PARAMETERS.md` for Grok 4.20.

## [2.19.3] - 2026-03-21

### Fixed
- **Section header regex** — now matches mixed case + optional dashes (works across all providers, not just Gemini)
- **Planner 5/1 bug** — `parsePlanSteps` now matches `### Task [T-ID]:` format (was only matching `### Step N:`)
- **Planner mismatch warning** — surfaces parse failures instead of masking with `Math.max`

## [2.19.2] - 2026-03-21

### Added
- **Rotating pastel section headers** — 6 colors cycle per response: lavender, mauve, powder blue, sand, mint, peach
- **Indigo tool name badge** — replaces gray summary badge with soft indigo (61) + nerd font icon
- **Rounded corner tables** — markdown tables rendered as aligned ASCII with `╭─┬─╮ │ │ ╰─┴─╯` box-drawing
- **Color-coded verdicts** — pastel 256-color: sage green (151) pass, soft yellow (186) partial, rose (174) fail
- **Tables in FORMAT_INSTRUCTION** — models now allowed to use `| table |` format
- **Spacing** — blank line between badge bar and first section header

### Changed
- **Emoji palette** — verdict 👩‍⚖️, sections use 🧠

## [2.19.0] - 2026-03-21

### Added
- **Sparse render mode** (`RENDER_OUTPUT=sparse`) — lightweight output formatting with ~72 tokens overhead per response
- **ANSI model badges** — colored background badges for model name (provider color) + tool name (charcoal bg)
- **Pastel section headers** — emoji section headers (`🧠 HEADER ───`) rendered as teal bg + dark bold text badges
- **Color-coded verdicts** — `✅ pass` (sage green), `🫠 partial` (soft yellow), `💀 fail` (rose) with colored bg badges
- **Summary badge** — tool name displayed as bold charcoal badge next to model badge
- **`stripMarkdown` options** — `{ boldHeaders: true }` converts markdown/emoji headers to ANSI-styled badges
- **Empty input guard** on `stripMarkdown` — early return for empty/whitespace input
- **Strip markdown headers** — `##` prefixes and `───` decorators removed from output
- **8 unit tests** for `stripMarkdown` covering headers, bold, bullets, code blocks, HR, empty input

### Fixed
- **ANSI truncation corruption** — truncate raw content BEFORE applying ANSI badges (prevents mid-escape code corruption)
- **Summary badge without model** — tools returning null from `inferModelFromTool` (think, focus) still show tool name badge
- **Unused imports** — cleaned up 10+ unused imports/variables in server.ts

### Changed
- **Emoji palette** — analysis 🧠, insight 🔮, key 🗝, verdict 👩‍⚖️ (replaced 🔍🧿🪩🎯)
- **Auditor/Challenger** — use `EMOJI_PALETTE` constants instead of hardcoded emoji
- **Planner** — topological task ordering with T-ID preservation and Dependencies metadata

## [2.18.0] - 2026-03-21

### Added
- **Goal-oriented checkpoints** — `planner_maker` and `planner_runner` now accept `goal` parameter for success criteria tracking
- **6 checkpoint gates** with 5 different models (no adjacent repeats): step1 (Gemini Sherlock), 10% (Grok), 25% (GPT + amendment protocol), 50% (Qwen), 80% (Kimi decompose), 100% (GPT+Gemini dual judge)
- **Reflexion Lite** — at 100%, Gemini reflects on what worked/failed, lesson saved to devlog
- **Amendment protocol** — at 25%, structured plan revision (evidence + proposed changes + impact) with human gate
- **Unblinded checkpoints** — `diff`, `testResults`, `modifiedFiles` params replace blind `code.substring(0,1500)` with real evidence
- **`files` param on all analysis tools** — 39 tools across 9 files can now read ACTUAL CODE from disk via `readFilesIntoContext()`
- **Shared `src/utils/file-reader.ts`** — reusable file reader with line range support (`file.ts:100-200`), size limits, directory expansion
- **Blueprint skill updated** — `goal` param, prompt template, `planner_runner` as default execution path

### Fixed
- **Step index reset bug** — filtered arrays used local index instead of original step number (found by 3-model consensus: Kimi + Gemini + Qwen reading actual code)
- **Truncation indicators** — `code.substring()` now adds `[truncated]` so judge models know they're seeing partial code

## [2.17.2] - 2026-03-21

### Added
- **`files` parameter on 13+ more tools** — grok_architect, grok_brainstorm, grok_reason_v4, openai_explain, kimi_code, kimi_long_context, gemini_judge, gemini_brainstorm, gemini_query, gemini_summarize, qwq_reason, qwen_competitive, qwen_general (38 tools now support `files`)
- **Directory expansion in file reader** — pass `src/tools/` to read all code files in a directory (non-recursive, capped at 20 files)
- **Smart char budget** — multi-file reads distribute token budget across files to prevent context overflow

## [2.17.1] - 2026-03-21

### Fixed
- **kimi_decompose readability overhaul** — output now uses OVERVIEW/STRUCTURE/DETAILS/RISKS sections instead of dense inline metadata
- **Reasoning leak stripped** — Kimi K2.5 dumps CoT into content; now extracted via `<output>` tags with OVERVIEW fallback
- **Conflicting FORMAT_INSTRUCTION removed** — emoji headers and verdict lines no longer clash with decomposition formatting
- **Heartbeat interval fixed** — was incorrectly set to 240s instead of default 5s; network timeout now correctly passed to callOpenRouter (360s)
- **Type safety** — args typed from zod schema, unused `log` removed, `||` replaced with `??`

### Changed
- **Smart decomposition** — model now infers context, constraints, risks, and measurable criteria even when user doesn't state them
- **Tuned for format adherence** — temperature 0.3 (was 0.5), maxTokens 4500 (was 6000), timeout 360s (was 180s default)

## [2.17.0] - 2026-03-21

### Changed
- **GPT-5.4-mini added** — new fast/efficient coding model (400k context, $0.75/$4.50 per 1M tokens, SWE-Bench 54.4%)
- **Code tasks use gpt-5.4-mini** — replaces `gpt-5.3-codex` for `openai_code_review` and explain tasks (94% of flagship quality, 70% cheaper)
- **GPT-5.3 series retired** — `gpt-5.3-codex` and `gpt-5.3` removed from all registries; coding capabilities absorbed into `gpt-5.4`
- **Model lineup simplified** — now just `gpt-5.4` (flagship), `gpt-5.4-mini` (coding/fast), `gpt-5.4-pro` (expert)

### Added
- Display name, pricing, fallback chain, model router, and ANSI style entries for `gpt-5.4-mini`
- `gpt-5.4-mini` falls back to `gpt-5.4` if unavailable

### Removed
- `gpt-5.3-codex` and `gpt-5.3` from all model registries, OpenRouter mappings, provider configs, and style themes (backward-compat aliases preserved)

## [2.16.1] - 2026-03-06

### Changed
- **Gemini 3.1 Pro migration** — switched from `gemini-3-pro-preview` to `gemini-3.1-pro-preview` before March 9 retirement (1M context, enhanced reasoning)
- Removed stale `gemini-3-pro-preview` entries from display names and pricing tables

## [2.16.0] - 2026-03-06

### Changed
- **GPT-5.4 upgrade** — default OpenAI model bumped from `gpt-5.2` to `gpt-5.4` (most capable, Mar 2026, $2.50/$15 per 1M tokens)
- **GPT-5.4-pro** — expert model upgraded from `gpt-5.2-pro` to `gpt-5.4-pro` ($30/$180 per 1M tokens)
- **GPT-5.3-codex** — new agentic coding model for `openai_code_review` (Feb 2026)
- **GPT-5.3** — new fast instant model available as option
- **Gemini 3.1 Flash-Lite** — added as option (released Mar 3, fastest/cheapest in 3.1 series)
- **Token limits bumped** — GPT-5.4 reasoning tokens eat into `max_output_tokens`, so all OpenAI tools bumped (reason: 8000, brainstorm: 6000, code_review: 6000, explain: 4000, search: 8000)
- **Brainstorm min floor** — enforces 4000 token minimum to prevent truncation from reasoning overhead
- **Pricing updated** — all model pricing tables updated with actual March 2026 rates

### Fixed
- **`openai_brainstorm` "No response from OpenAI"** — eliminated fragile `callOpenAIWithCustomParams` duplicate; brainstorm now uses `callOpenAI` with retry/fallback logic like all other OpenAI tools
- **`isGPT52` → `isGPT5`** — model detection now matches all `gpt-5.x` models, not just 5.2

### Removed
- **`callOpenAIWithCustomParams`** — duplicate of `callOpenAI` without retry logic; was the root cause of brainstorm failures

## [2.15.6] - 2026-02-26

### Fixed
- **Full audit: 6 tools had required enum anti-pattern** — Claude couldn't fill required enums correctly, causing MCP -32602 errors. Fixed `usage_stats`, `openrouter_multi`, `gemini_judge`, `planner_maker`, `planner_runner`, `create_workflow`
- **`gemini_judge`** — had zero required params. Made `perspectives` required as primary content param
- **`openrouter_multi`** — `model` enum now optional (default: `qwen-coder`)
- **`planner_maker` / `planner_runner`** — `mode` enum missing `.optional()` before `.default()`
- **`create_workflow`** — `type` enum now optional (default: `custom`)
- **`usage_stats`** — `action` enum now optional (default: `view`), added `query` param

### Changed
- **`perplexity_reason` downgraded** — `sonar-pro` ($3/$15/M) → `sonar-reasoning` ($1/$5/M), 3x cheaper
- **`perplexity_research` removed** — `sonar-deep-research` ($5/$25/M) was burning $12 in 3 days

## [2.15.5] - 2026-02-26

### Fixed
- **`qwen_coder` parameter validation** — Claude was putting queries in `task` enum or omitting it. Added `query` as required primary param, made `task` optional (default: `analyze`). Removes `requirements` param
- **`kimi_code` parameter validation** — same fix: added `query` as required primary param, made `task` optional (default: `review`)
- **`minimax_code` parameter validation** — same fix: added `query` as required primary param, made `task` optional (default: `review`)
- **`kimi_long_context` parameter validation** — made `task` enum optional (default: `analyze`), `content` remains the required primary param
- **Updated callers** — `prompt-technique-tools.ts` and `qwen-wrapper.ts` adapted to new `query` param

### Changed
- **Gemini 3.1 → 3.0 Pro rollback** — reverted from `gemini-3.1-pro-preview` to stable `gemini-3-pro-preview` (3.1 has widespread timeout/503 issues)
- **Gemini timeout 30s → 90s** — Pro models need longer than Flash, bumped default

## [2.15.2] - 2026-02-19

### Changed
- **Gemini 3 → 3.1 Pro** — upgraded from `gemini-3-pro-preview` to `gemini-3.1-pro-preview` across all tools, model router, cost tables, and display names
- **Gemini 30s timeout** — added AbortController timeout to `callGemini()` and `gemini_search` to prevent hanging requests

### Fixed
- **`gemini_judge` parameter validation crash** — `perspectives` param now accepts `query` or `text` as fallbacks. AI clients that pass content in the wrong parameter no longer get MCP -32602 errors

## [2.14.7] - 2026-02-05

### Added
- **`gemini_judge` tool** — dedicated LLM-as-a-Judge evaluation tool backed by science (Gu et al., arXiv:2411.15594). 4 modes: synthesize, evaluate, rank, resolve. Integrates chain-of-thought, first-principles, tree-of-thoughts, and adversarial reasoning techniques
- **`jury` tool** — multi-model jury panel. Runs configurable jurors (grok, openai, qwen, kimi, perplexity, minimax, qwen_reason) in parallel, then Gemini judge synthesizes a unified verdict. Based on "Replacing Judges with Juries" (Cohere, arXiv:2404.18796)
- **`gemini_search`** added to tools.config.json (was missing)

### Changed
- **Perplexity models fixed** — `SONAR_PRO` now correctly uses `"sonar-pro"` (200K ctx) instead of `"sonar"` (was using the lightweight model by mistake). Removed deprecated `SONAR_SMALL`. Added `SONAR_REASONING` enum
- **`perplexity_research` upgraded to `sonar-deep-research`** — single call to Perplexity's exhaustive research model (synthesizes hundreds of sources) instead of 5-7 parallel `sonar-pro` calls. 10-min timeout for deep reports
- **Smart routing updated** — judge keywords now route to `gemini_judge` instead of `gemini_analyze_text`
- **`general-judge.yaml` workflow** — uses `gemini_judge` tool with proper `perspectives`/`question`/`mode` params
- **ModelProviderRegistry** — added `gemini-judge` mapping with aliases `gemini-synthesize`, `gemini-verdict`
- **Profile tool counts** — full: 50, heavy_coding: 44, balanced: 38, research_power: 30

## [2.14.6] - 2026-02-05

### Changed
- **qwen_coder upgraded to Qwen3-Coder-Next** — replaced `qwen/qwen3-coder` (480B MoE) with `qwen/qwen3-coder-next` (80B/3B MoE, 262K context, SWE-Bench >70%). 3x cheaper ($0.07/$0.30 per M tokens), 2x context window, better benchmarks. Hybrid attention architecture (Gated DeltaNet + Attention) optimized for agentic coding
- **Auto-fallback** — Coder-Next falls back to legacy 480B coder on provider failure
- **Updated model defaults** — Scout, Challenger, Verifier now route Qwen queries through Coder-Next
- `qwen_algo` (QwQ-32B) and `qwen_reason` (235B-Thinking) unchanged

## [2.14.5] - 2026-02-02

### Added
- **Tool annotations** — all 35+ tools now have MCP-standard annotations (`title`, `readOnlyHint`, `openWorldHint`, `streamingHint`). Improves `/mcp` display and tool discovery via ToolSearch
- **`src/utils/tool-annotations.ts`** — centralized annotation registry
- **`src/utils/stream-distill.ts`** — `truncateSmart()` for paragraph-boundary-aware truncation; distillation logic ready for future use when Claude Code supports display/context separation
- **25K character safety net** — responses capped with smart truncation to prevent Claude Code's 30K background task truncation

### Changed
- **ANSI rendering removed from tool results** — replaced `renderOutput()` with `stripMarkdown()` in `safeAddTool()`. Claude Code CLI does not render markdown in tool result blocks, so decorative formatting (`**bold**`, `*italic*`, `` `code` ``) is now stripped while structural elements (`#` headers, `-` bullets, numbered lists, `>` blockquotes, `|` tables, code block content) are preserved
- **`stripMarkdown()` rewritten** — code blocks protected via placeholder extraction (prevents corrupting code samples); `*` bullets normalized to `-` before italic stripping; `_italic_` skip added to avoid mangling `snake_case` identifiers
- **`kimi_decompose` prompt improved** — dependency graph now uses box-drawing characters (`├─ └─ ──►`) for visual clarity; task cards use indented tree format with acceptance criteria
- **Heavy Coding profile** — enabled `openai_code_review` and `openai_explain` (40 → 42 tools)
- **Wildcard permission** — replaced 30 individual `mcp__tachibot-mcp__*` entries in `~/.claude/settings.json` with single `mcp__tachibot-mcp__*` wildcard

### Fixed
- **Token overhead reduced to ~x1** — removed ANSI escape code overhead (~x1.5-2x) and Ink rendering overhead (~x12x). Tool results now return clean plain text at baseline token cost
- **`truncateSmart()` marker overflow** — marker length now subtracted from cap before truncating, ensuring output never exceeds the specified limit

## [2.13.0] - 2026-01-30

### Removed
- **@types/yaml** — stub package; `yaml` ships its own TypeScript definitions
- **ink-box** — deprecated; use Ink's built-in `<Box>` component
- **js-yaml** + **@types/js-yaml** — redundant YAML parser; consolidated on `yaml` v2
- **cli-highlight** — unmaintained (5 years); replaced with `highlight.js` wrapper
- **ts-node** — stalling ESM support; replaced with `tsx`

### Added
- **highlight.js** — direct dependency replacing cli-highlight for syntax highlighting
- **tsx** — modern TypeScript execution for ESM projects (devDependency)
- `src/utils/syntax-highlight.ts` — lightweight highlight.js-to-ANSI wrapper with default theme and function-based theme support

### Changed
- **Node engine requirement** bumped from `>=20.19.0` to `>=22.0.0` (Node 22 active LTS)
- `src/validators/syntax-validator.ts` — migrated from `js-yaml.load()` to `yaml.parse()`
- `src/utils/ansi-renderer.ts` — switched to local syntax-highlight utility
- `src/utils/ink-markdown-renderer.tsx` — switched to local syntax-highlight utility

## [2.12.1] - 2026-01-29

### Changed
- **Heavy Coding** is now the default profile (40 tools) — ships as `activeProfile` in `tools.config.json`
- Updated profile description and README to reflect default status
- Updated `tools.config.json` available tools list with new Kimi tools and `list_plans`

## [2.12.0] - 2026-01-29

### Added
- **Kimi K2.5 Suite** — 3 new tools expanding Kimi from 1 to 4 tools:
  - `kimi_code` — SWE-focused code generation/fixing (SWE-Bench 76.8%), temp=0.3, 240s timeout
  - `kimi_decompose` — Structured task decomposition with Agent Swarm reasoning, dependency graphs, parallel subtask identification, acceptance criteria. Output formats: tree, flat, dependencies
  - `kimi_long_context` — Long-context document analysis (best-effort 256K context window), 5 task types (summarize/extract/analyze/compare/find), 300s timeout
- **Planner: kimi_decompose integration** — `planner_maker` now includes a Decomposition phase using `kimi_decompose` to break tasks into subtasks with dependency ordering before synthesis
- **Planner: 80% checkpoint** — `planner_runner` now supports 50%, 80%, and 100% verification checkpoints. The 80% checkpoint uses `kimi_decompose` to decompose remaining work into granular subtasks, ensuring nothing is missed before the final push

### Fixed
- **z.number() coercion bug** — MCP clients send numbers as strings (e.g., `maxSteps: "3"`), causing Zod validation failures. Replaced `z.number()` with `z.coerce.number()` at 3 parameter locations (temperature, maxSteps, steps). Added `.int().min().max()` constraints for maxSteps and steps

### Changed
- All 6 profiles updated with new Kimi tools (enabled in all except minimal)
- Profile tool counts: Minimal 12, Research Power 28, Code Focus 28, Balanced 36, Heavy Coding 40, Full 48
- `planner_maker` synthesis steps now include task decomposition output for better-structured plans
- `planner_runner` description updated to document 80% checkpoint and kimi_decompose integration
- Server registration updated: "Qwen, Kimi x4, MiniMax"

## [2.3.1] - 2025-12-28

### Fixed
- **gemini_analyze_text** and **gemini_analyze_code** now work via nextThought
  - Added missing cases in ToolExecutionService switch statement
  - Added parameter mapping (`text:` and `code:` params)
- **TACHIBOT_FINAL_JUDGE** env var now properly resolves as default judge

### Changed
- **balanced profile** now includes `gemini_analyze_text: true`
- Removed noisy memory save hint from nextThought output

### Added
- **TACHIBOT_FINAL_JUDGE** env var - Set default final judge model (e.g., `gemini`)

## [2.3.0] - 2025-12-28

### Added
- **Context Window String Aliases** - Use `"none"`, `"recent"`, `"all"` instead of magic numbers (0, 3, -1)
- **finalJudge** - Auto-call a judge model when session completes with `nextThoughtNeeded: false`
- **Context Distillation** - Compress 8000+ tokens to ~500 with `distillContext: "light" | "aggressive"`
- **Memory Provider Hints** - Pluggable memory system (devlog, mem0) returns hints for Claude to execute
- **usage_stats Tool** - Track tool usage with ASCII bar charts, per-repo statistics
- **general-judge Workflow** - Multi-model council (Grok, Perplexity, Qwen, Kimi) with Gemini extraction + GPT synthesis
- `src/utils/memory-provider.ts` - Hint-only formatter for memory MCPs
- `src/utils/model-availability.ts` - Centralized model availability checks

### Enhanced
- **nextThought** now supports:
  - `contextWindow: "none" | "recent" | "all"` (clearer than 0/3/-1)
  - `finalJudge: "gemini"` - Auto-executes judge with ALL context
  - `distillContext: "light"` - 5x token savings
  - `memoryProvider: { provider: "devlog" }` - Session persistence hints

### Example Usage
```typescript
// With string aliases and finalJudge
nextThought({
  thought: "Analyze the problem",
  model: "kimi",
  executeModel: true,
  contextWindow: "recent",  // Last 3 thoughts
  nextThoughtNeeded: true
})

nextThought({
  thought: "Final verdict",
  model: "grok",
  executeModel: true,
  contextWindow: "all",     // Full history
  finalJudge: "gemini",     // Auto-called!
  nextThoughtNeeded: false
})
```

## [2.2.7] - 2025-12-28

### Added
- **Enhanced nextThought with multi-model execution**
- **Multi-Model Judgment Protocols** in CLAUDE.md:
  - Protocol 1: Parallel Council (subagents for context isolation)
  - Protocol 2: Sequential Pipeline (progressive refinement)
  - Protocol 3: Adversarial Debate (pro vs con)
  - Protocol 4: Architecture Decision (focus modes)
- Model name normalization (spaces/underscores → hyphens)
- Model aliases in registry: `grok-search`, `grok-reason`, `gemini-judge`, etc.

## [2.0.3] - 2025-11-18

### Changed
- Updated OpenAI models from GPT-5 to GPT-5.1 series
- Updated default model to `gpt-5.1-codex-mini` for better code generation
- Added GPT-5.1 reasoning effort levels (none, low, medium, high)
- Changed default active profile from `research_power` to `full`
- Improved model configuration in workflows and tool mapper
- Updated model constants and defaults throughout codebase

### Fixed
- Model references in iterative-problem-solver workflow
- Model references in scout workflow
- Model references in ultra-creative-brainstorm workflow

## [2.0.2] - 2025-11-15

### Fixed
- OpenAI GPT-5.1 API integration
- License correction from MIT to AGPL-3.0 in package.json

## [2.0.1] - 2025-11-10

### Changed
- Updated README with comprehensive API key documentation
- Added missing GEMINI_API_KEY and OPENROUTER_API_KEY to installation examples
- Improved documentation clarity

## [2.0.0] - 2025-10-15

### Added
- Complete rewrite with 12 essential tools (reduced from 80+)
- Multi-model orchestration with GPT-5, Gemini, Grok, and more
- Tool profiles system (minimal, research_power, code_focus, balanced, full)
- Perplexity integration for web search and reasoning
- Grok-4 integration with live search capabilities
- Workflow system for multi-step tool sequences
- Challenger tool for critical thinking and verification
- Scout tool for hybrid intelligence gathering
- Verifier tool for multi-model consensus
- PingPong collaborative brainstorming
- Cost optimization and tracking features
- Session management with logging and export
- Comprehensive .env.example with all configuration options
- GitHub Actions workflows for CI/CD
- Community health files (CONTRIBUTING, CODE_OF_CONDUCT, SECURITY)

### Changed
- Simplified from 80+ tools to 12 essential ones
- Improved token efficiency (2.6k tokens vs 30k+)
- Better environment variable handling
- Deferred API key loading for better performance
- Modular architecture for easier maintenance
- Cleaned up workflows to use only existing tools

### Fixed
- Environment variable loading in MCP context
- API key configuration issues
- Build errors with missing personality module

### Security
- No hardcoded API keys in source code
- All sensitive data in environment variables
- Security policy and responsible disclosure process

## [1.0.0] - 2024-12-01

### Initial Release
- Original version with 80+ tools
- Basic multi-model support
- Initial MCP server implementation

---

Note: This is a side project maintained in spare time. Updates may be irregular.