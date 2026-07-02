# Tool Parameters Documentation

Cross-cutting parameter conventions shared across TachiBot's 61 tools. For the full parameter schema of a specific tool, see [TOOLS_REFERENCE.md](TOOLS_REFERENCE.md) — this document covers patterns that repeat across many tools so you don't have to re-learn them per tool.

Generated against the wire contract (`test/golden/__snapshots__/tool-contracts.json`).

## Table of Contents

- [The `files` Parameter](#the-files-parameter)
- [Model-Reasoning Tools: `problem` + `approach` + `context`](#model-reasoning-tools-problem--approach--context)
- [Code Tools: `task` + `code`/`query`](#code-tools-task--codequery)
- [Analysis Tools: `focus`](#analysis-tools-focus)
- [Coordinator-Pattern Tools](#coordinator-pattern-tools)
- [API Requirements](#api-requirements)
- [Error Handling](#error-handling)
- [Testing](#testing)

---

## The `files` Parameter

37 of the 61 tools accept a `files: string[]` parameter that reads real source code server-side rather than relying on you to paste it into the prompt. Any reasoning, code, brainstorming, or review tool that takes a `problem`/`code`/`query` string also accepts `files`.

```typescript
{
  files: string[];   // File paths, optionally with line ranges
}
```

**Supports line ranges** so you can scope to exactly the lines under discussion instead of sending a whole file:

```typescript
deepseek_algo({
  problem: "Review this Dijkstra implementation for correctness and Big-O",
  files: ["src/lib/shortest-path.ts:40-120"]
})
```

Tools with `files`: `deepseek_algo`, `deepseek_reason`, `diff_review`, `ernie_reason`, `gemini_analyze_code`, `gemini_analyze_text`, `gemini_brainstorm`, `gemini_judge`, `glm_reason`, `grok_architect`, `grok_brainstorm`, `grok_code`, `grok_debug`, `grok_reason`, `kimi_code`, `kimi_decompose`, `kimi_long_context`, `kimi_thinking`, `minimax_agent`, `minimax_code`, `openai_brainstorm`, `openai_code_review`, `openai_explain`, `openai_reason`, `perplexity_ask`, `perplexity_reason`, `plan_critique`, `planner_maker`, `planner_runner`, `qwen_algo`, `qwen_coder`, `qwen_competitive`, `qwen_reason`, `qwq_reason`, `security_review`, `stepfun_reason`, `testgen`.

**Why prefer `files` over pasting code:** the model sees the actual current file content, not a snapshot you may have summarized or mis-copied. For diff-scoped review use `diff_review` or `security_review`'s `diff` parameter instead — those take `git diff` output directly.

---

## Model-Reasoning Tools: `problem` + `approach` + `context`

The single-model reasoning tools (`grok_reason`, `deepseek_reason`, `glm_reason`, `stepfun_reason`, `ernie_reason`, `qwen_reason`, `qwq_reason`, `kimi_thinking`, `perplexity_reason`) share a common shape:

```typescript
{
  problem: string;      // REQUIRED — the question or problem
  approach?: string;    // Free-text hint, e.g. "analytical", "first-principles", "step-by-step"
  context?: string;     // Additional background
  files?: string[];     // Optional code context (see above)
}
```

`approach` is **not a fixed enum** for most of these tools — it's a free-text steering hint with a per-tool default (`grok_reason` has no default; `deepseek_reason`/`ernie_reason`/`stepfun_reason` default to `"analytical"`; `qwen_reason` defaults to `"mathematical"`; `kimi_thinking` defaults to `"step-by-step"`; `qwq_reason` defaults to `"multi-perspective"` and is closer to an enum in practice: `multi-perspective | mathematical | logical | creative`). Check the specific tool's entry in TOOLS_REFERENCE.md for its default.

Model-specific extras: `grok_reason` has `useHeavy: boolean` (Grok 4 Heavy, $3/$15, for hard problems); `kimi_thinking` has `maxSteps: integer (1-10, default 3)`.

**Choosing among the reasoning tools** — see CLAUDE.md's Model Configuration table for current model IDs/pricing. As a rule of thumb: `deepseek_reason` for open-weight frontier math/reasoning, `qwen_reason` for the heaviest math (HMMT-grade), `qwq_reason` when you want 4-perspective debate instead of a single answer, `kimi_thinking`/`glm_reason` for agentic/tool-use planning, `stepfun_reason` for cheaper-but-strong AIME/SWE reasoning, `ernie_reason` for broad-knowledge/arena-style answers.

---

## Code Tools: `task` + `code`/`query`

The code-manipulation tools share a `task` enum plus either a `code` or `query` field:

| Tool | `task` enum | Primary input | Default task |
|------|-------------|----------------|--------------|
| `qwen_coder` | `generate \| review \| optimize \| debug \| refactor \| explain \| analyze` | `query` (required) + `code` | `analyze` |
| `kimi_code` | `generate \| fix \| review \| optimize \| debug \| refactor` | `query` (required) + `code` | `review` |
| `minimax_code` | `generate \| fix \| review \| optimize \| debug \| refactor` | `query` (required) + `code` | `review` |
| `grok_code` | free-text (e.g. analyze/optimize/debug/review/refactor) | `code` (required) + `task` (required) | — |

**Important convention:** for `grok_code`, `gemini_analyze_code`, and `openai_code_review`, the actual source goes in the `code` parameter — NOT in `task`/`focus`/`focusAreas`. Several tool descriptions explicitly warn about this because it's an easy mistake (`"Put the CODE in the 'code' parameter, NOT in 'task'"`).

`minimax_agent` and `planner_maker`/`planner_runner` use `task`/`plan` differently — they're multi-step orchestrators, not single-pass code tools (see [Coordinator-Pattern Tools](#coordinator-pattern-tools)).

---

## Analysis Tools: `focus`

Four tools use a `focus` parameter to steer the angle of analysis:

| Tool | `focus` options | Default |
|------|------------------|---------|
| `deepseek_algo` | `correctness, complexity, optimize, data-structure, edge-cases, general` | `general` |
| `qwen_algo` | `optimize, complexity, data-structure, memory, correctness, competitive, cache, general` | `general` |
| `gemini_analyze_code` | free-text (e.g. `quality, security, performance, bugs, general`) | `general` |
| `diff_review` | `security \| perf \| correctness \| style \| all` | `all` |

For algorithmic/correctness/Big-O/edge-case/competitive-programming review, `deepseek_algo` is the strongest pick (see CLAUDE.md); `qwen_algo` and `qwq_reason` are the runners-up.

---

## Coordinator-Pattern Tools

`planner_maker` and `planner_runner` don't return a final answer in one call — they return the **next tool to execute**, and you call back in with the result. This lets a multi-model council run without the orchestrating model needing to hold every intermediate result in its own context.

```typescript
planner_maker({ task: "Add auth", mode: "start" })
// → { nextTool: { tool: "grok_search", params: {...} }, step: 1 }

// [Execute grok_search yourself]

planner_maker({ task: "Add auth", mode: "continue", step: 2, prior: { search: "..." } })
// → { nextTool: { tool: "qwen_coder", params: {...} }, step: 2 }
// ... continue until isComplete: true
```

`planner_runner` follows the same `start` → `step` → `verify` pattern, with `verify` checkpoints at `step1`, `10%`, `25%`, `50%`, `80%`, `100%` — each checkpoint uses a different model so no two adjacent checks share a model. Feed it real evidence (`diff`, `testResults`, `modifiedFiles`) rather than letting it verify blind; the tool description explicitly frames these as parameters that "unblind" the checkpoints.

`focus` has a lighter version of the same idea: pass `saveSession: true`, then resume with `continue_focus({ sessionId })`.

---

## API Requirements

Configure these in your `.env` file (full setup guide: [API_KEYS.md](API_KEYS.md)):

```bash
PERPLEXITY_API_KEY=...       # perplexity_ask, perplexity_reason
GROK_API_KEY=...             # or XAI_API_KEY — grok_* tools
OPENAI_API_KEY=...           # openai_* tools
GEMINI_API_KEY=...           # gemini_* tools, jury synthesis
OPENROUTER_API_KEY=...       # qwen_*, kimi_*, minimax_*, deepseek_*, glm_*, stepfun_*, ernie_* tools
```

`local_query` and the `jury` tool's `local` juror need no API key — they call any OpenAI-compatible local server (Ollama, LM Studio, llama.cpp, vLLM). See CLAUDE.md's "Connecting Local Models" section.

Tools whose provider key is missing simply don't register — call `doctor` to see exactly which keys are detected and which tools that unlocks or hides.

### Model Routing

- `perplexity*`, `sonar*` → Perplexity API
- `grok*` → xAI API
- `openai*`, `gpt*` → OpenAI API
- `gemini*` → Google API
- `qwen*`, `qwq*`, `kimi*`, `minimax*`, `deepseek*`, `glm*`, `stepfun*`, `ernie*` → OpenRouter

---

## Error Handling

- Tools that call multiple models in parallel (`jury`, `diff_review`, `planner_runner` checkpoints) exclude failed models from synthesis rather than failing the whole call.
- `local_query` and the jury's `local` juror throw a typed `LocalLLMError` on failure so the jury silently drops that juror instead of leaking an error blob into the synthesized verdict.
- Quota/rate-limit failures on OpenRouter models fall back automatically per `MODEL_FALLBACKS` in `src/tools/openrouter-tools.ts` (e.g. GLM-5.2 → GLM-5.1 → GLM-5).

---

## Testing

```bash
npm test                    # All tests
npm test -- --watch         # Watch mode
npm test -- jury            # Single test file, e.g. jury, planner, workflow
```

The wire contract used to generate this documentation and TOOLS_REFERENCE.md is itself a golden snapshot test — `test/golden/__snapshots__/tool-contracts.json` — regenerated whenever a tool's schema changes, so it stays the authoritative source of truth for what's actually registered.

---

## See Also

- [Tools Reference](TOOLS_REFERENCE.md) - Full per-tool schemas and examples
- [Tool Profiles](TOOL_PROFILES.md) - Pre-configured tool sets
- [API Keys Guide](API_KEYS.md) - Where to get API keys
- [Configuration Guide](CONFIGURATION.md) - Complete configuration reference
