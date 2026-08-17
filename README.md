<div align="center">

# TachiBot MCP

### Multi-Model AI Orchestration Platform

[![Version](https://img.shields.io/badge/version-2.30.1-blue.svg)](https://www.npmjs.com/package/tachibot-mcp)
[![Tools](https://img.shields.io/badge/tools-67_active-brightgreen.svg)](#-tool-ecosystem-67-tools)
[![License](https://img.shields.io/badge/license-AGPL--3.0-green.svg)](LICENSE)
[![Node](https://img.shields.io/badge/node-%3E%3D22.0.0-brightgreen.svg)](https://nodejs.org)
[![MCP](https://img.shields.io/badge/MCP-Compatible-purple.svg)](https://modelcontextprotocol.io)

**67 AI tools. 12 providers. One protocol.**

Orchestrate Perplexity, Grok 4.6, GPT-5.6, Gemini, Qwen, Kimi K3, and MiniMax M3
from Claude Code, Claude Desktop, Cursor, or any MCP client.

[Get Started](#-quick-start) &#183; [View Tools](#-tool-ecosystem-67-tools) &#183; [Documentation](https://tachibot.com/docs)

<br>

**If TachiBot helps your workflow, a** [**star**](https://github.com/byPawel/tachibot-mcp) **goes a long way.**

[![GitHub stars](https://img.shields.io/github/stars/byPawel/tachibot-mcp?style=social)](https://github.com/byPawel/tachibot-mcp)
[![npm downloads](https://img.shields.io/npm/dm/tachibot-mcp?label=npm%20downloads&color=cyan)](https://www.npmjs.com/package/tachibot-mcp)

</div>

---

## What's New

### v2.30.1
- **Tool descriptions no longer name-drop model versions.** 19 descriptions were rewritten to name the provider and the task instead of pinned strings like "GPT-5.2", "Kimi K3" or "424B MoE" — those silently rot on every model bump and then actively mislead the routing model. Two were outright wrong: `openai_reason` and `openai_search` advertised "GPT-5.2" while the code calls the current OpenAI flagship tier.
- **`grok_search` finally says why to pick it.** Its entire description was "Web search" — no way to choose it over the four other search tools. It now states its live X/news grounding edge and cross-references `grok_search_lite` as the cheaper path. The five OpenRouter reasoners (`deepseek_reason`, `glm_reason`, `stepfun_reason`, `ernie_reason`, `qwen_reason`) likewise differed only by vendor trivia; each now carries an actual routing rule for when to pick it.
- **Claude Desktop manifest corrected** — it advertised 65 tools (actual: 66), omitted the `heavy_coding` profile from the `TACHIBOT_PROFILE` help, and its `OPENAI_API_KEY` hint claimed that key powers the Qwen and QwQ tools (those route via OpenRouter).
- **Packaging no longer breaks the working tree.** `scripts/package-extension.sh` ran `npm install --production`, pruning devDependencies and leaving `tsc` unable to build afterward. It now restores the full dependency tree when it finishes.
- **The server introduced itself as v2.0.0.** `serverInfo.version` was hardcoded from a 12-tool era ~28 minor versions ago, so Claude Desktop's connector panel misidentified every install. It now reads the real version from `package.json`. The `/setup` wizard's profile sizes were stale in the same way and now match the six real profiles.
- **Correction to v2.30.0: `grok_search_lite` is not broken, and is staying.** That release claimed `grok-4.3` "does not invoke web search either" — which would have made the cheap search tier pointless. Re-probed Aug 15 asking today's date: **grok-4.3 ran 2 web searches and returned a citation in 10.4s; grok-4.6 did the same in 36.4s.** Lite is grounded, cheaper, and 3–4x faster — prefer it for high-volume lookups. `grok-4.5` is still the one that doesn't ground. The cheap tier now has its own grounding test, since nothing previously covered it.
- No tools added or removed — the count stays 66.

### v2.30.0
- **`grok_search` was not searching.** It ran on `grok-4.5`, which never invokes the `web_search` tool on xAI's Agent Tools API — so it answered from training data while still rendering a source footer and a "Search used up to N sources" cost line computed locally from `max_search_results`, not from real usage. Probed Aug 14: asked today's date, `grok-4.5` replied *"October 10, 2025"* with zero `web_search_call` entries; **`grok-4.6` replied correctly with two search calls and a citation.** `grok_search` now runs `grok-4.6` (same $2/$6 and 500K context as 4.5). The regression test asserts *grounding* — a `web_search_call` and ≥1 annotation — never the answer text, because a plausible ungrounded answer is precisely what hid this.
- **Correction to the v2.27.0 note below:** `grok_search_lite` never ran on `grok-4-1-fast` at $0.20/$0.50. xAI retired that id and silently served `grok-4.3` — HTTP 200, the swap disclosed only in the response body's `model` field, so nothing threw and no fallback fired. The advertised "~10x cheaper" was really ~1.6x.
- **13 `console.log` calls were corrupting the MCP protocol stream.** stdout is the JSON-RPC channel on a stdio server; diagnostics now go to stderr, guarded by a test that also rejects `console.info`, `console.debug` and `process.stdout.write`.
- **`create_workflow` silently destroyed existing workflow files** — the existence check guarded the *directory*, not the *file*. It now refuses to clobber unless `overwrite: true`, and reports the real `.tachibot/workflows/` path instead of `.tachi/workflows/`.
- **Eight prompt maps injected the literal string `"undefined"`** into system prompts for any unrecognised `approach`/`task`, because the `||` fallback sat *inside* the index. Fixed across `grok_reason`, `grok_code`, `kimi_thinking`, `qwen_reason`, `deepseek_reason`, `glm_reason`, `stepfun_reason`, `ernie_reason`.
- **Workflow steps ran the wrong model** — the `qwen_algo` step called QwQ-32B with a generic prompt instead of Qwen3.8-Max, and `qwq_reason` lost its 4-persona deliberation entirely. Both now delegate to the real tools. Separately, `planner_maker`'s `qwen_coder` step sent a parameter the schema rejects, so every execution of it failed validation.
- Test suite **130 → 158**. The live search probe is now opt-in behind `RUN_LIVE_TESTS=1`, so an ordinary `npm test` no longer makes a billed API call.

### v2.28.0
- **Qwen3.8 Max** (Aug 3, `qwen/qwen3.8-max`) — Alibaba's new flagship, GA the same day, now powers `qwen_algo`, `qwen_reason`, and the `qwen_reason` juror. **1M context (up from 262K)**, multimodal (text+image+video in), and the first Qwen exposing **configurable reasoning effort**. $2/$6 per M.
- **Measured on a range-query algorithm problem**, 3.8 Max was the only one of five Qwen candidates to surface both the offline-vs-online tradeoff and the strict-inequality-with-duplicates edge case. The outgoing `qwen3-235b-a22b-thinking-2507` was correct but shallow; `qwen3.7-max` cost 1.6x for twice the wall time; `qwen3-max-thinking` was rejected outright — it returns zero reasoning tokens.
- **Effort is pinned to `medium`, deliberately.** This model's *default* effort behaves like `high`: 302s and $0.09 on a single `qwen_algo` call. At `medium` the same call answers at equal depth in 18–48s for $0.006–0.018 — cheaper *and* 3.5x faster than the model it replaces, which took 169s and $0.036 for a shorter answer. `low` starts dropping alternatives and is not used.
- **`reasoning_effort` pass-through for OpenRouter** — `callOpenRouter` now forwards the parameter; OpenRouter drops it for models that don't list it, so the quota fallback chain (3.8 Max → 3.7 Max → 235B Thinking) stays safe. Qwen3.8/3.7-Max also join the 600s extended-timeout bucket.
- **`qwen_coder`, `qwen_competitive`, `testgen` stay on Qwen3-Coder-Next** — it is coding-specialized and ~16x cheaper ($0.12/$0.80); 3.8 Max is the reasoning tier, not the codegen tier.

### v2.27.1
- **Kimi K3** (Jul 16, `moonshotai/kimi-k3`) now powers every Kimi tool, the `kimi` juror, and the Kimi seat on `diff_review`. 2.8T open-weight MoE — the largest open model shipped — with a **1M context (up from 262K)**, native multimodal input, and long-horizon agentic coding that beats Opus 4.8 and GPT-5.5 on coding/agent benchmarks. Note the price: **$3/$15 per M, 4x K2.7-Code** — K2.7-Code stays as the automatic fallback (K3 → K2.7-Code → K2.6).
- **Gemini 3.6 Flash** (Jul 21, `gemini-3.6-flash`) is the new search/workhorse tier behind `gemini_search` — 1M context at **$1.50/$7.50, down from $9 output**, and ~17% fewer output tokens than 3.5 Flash. Flash-Lite moves to `gemini-3.5-flash-lite` ($0.30/$2.50).
- **Everything else re-verified, unchanged** — a full provider audit (Jul 26) confirms GPT-5.6, Grok 4.5, DeepSeek V4 Pro, GLM-5.2, MiniMax M3, StepFun 3.7, ERNIE 4.5 VL, Qwen Coder-Next and Perplexity Sonar are all still the newest available. Gemini 3.1 Pro remains the reasoning/judge default: Google shipped three models on Jul 21 and **skipped 3.5 Pro**. xAI's staged rollout finished (EU access Jul 17), so the `grok-4.3` fallback is now quota/region insurance rather than a rollout workaround.

### v2.27.0
- **Grok 4.5** (Jul 8 flagship, "Opus-class") now powers all Grok tools, with automatic fallback to `grok-4.3` while xAI's region-staged rollout completes (EU mid-July) — tools keep working everywhere, and 4.5 activates by itself.
- **`grok_search_lite`** (new tool, 65 total) — the same Grok live search on `grok-4-1-fast` ($0.20/$0.50, 2M ctx), ~10x cheaper than `grok_search`. Use it for high-volume lookups and jury/council fan-outs.
- **GPT-5.6 tiers** — `openai_*` tools move to `gpt-5.6-sol` (flagship, same $5/$30 as 5.5 but stronger), `terra` for code (5.5-level at half price), `luna` for explanations ($1/$6). The $30/$180 `gpt-5.5-pro` tier is replaced by sol + reasoning effort; a permission fallback (sol → terra → 5.5) covers org-gated accounts.

### v2.26.1
- **`/test` and `/audit` skills** (19 skills total) — `/test` generates runnable tests via `testgen`; `/audit` runs an OWASP/CWE security review via `security_review`.
- **Skill install in the wizard** — `tachibot init` now offers to install Claude Code skills with a per-skill skip choice (`[Enter]`=all · `[s]`=choose which to skip · `[n]`=none). Skills are opt-in — `postinstall` no longer writes to `~/.claude` silently (`npm run install-skills` still installs all non-interactively).
- **Fixes** — the one-click `.mcpb` extension now points at a valid entry point (was broken) and tracks the package version; `tachibot init` exits cleanly on non-interactive/CI stdin instead of hanging.

### v2.26.0

#### Prompt stack, modernized
- **`refine_prompt`** (new tool) &mdash; opt-in prompt improver on a cheap/fast model: raw query → goal-first brief + **what changed** + **open questions**. Never auto-fires, never executes anything — you review, then use the brief. In Claude Code, `/prompt refine` presents the open questions as clickable choices and merges your answers into a final brief.
- **Curated technique list** &mdash; `list_prompt_techniques` now defaults to the ~9 core techniques that still help 2026 reasoning models (output contracts like `scot`, `pre_mortem`, `bdd_spec`); `all=true` for the full 31.
- **`technique="auto"`** &mdash; `preview_prompt_technique` recommends the right technique for your task, with reasons. Ask `tachi` "improve my prompt" for the symptom-based menu.

#### Setup, de-mystified
- **`tachibot init`** (new CLI wizard) &mdash; detects your API keys and clients, prints the exact config for Claude Code and Claude Desktop. Never writes or echoes keys.
- **One-click Claude Desktop install** &mdash; download the `.mcpb` from the latest release and double-click. No JSON editing.
- **`doctor`** &mdash; shows which keys are set, which tools are visible vs hidden and why, and what to try first.

#### New tools & skills (66 tools · 19 skills)
- `debug_triage` &mdash; ranked root-cause hypotheses with the cheapest discriminating check for each (Grok 4.3)
- `spec_writer` &mdash; loose request → reviewable spec: user stories, Given/When/Then, out-of-scope, open questions (GPT-5.5)
- `diff_review` / `plan_critique` / `testgen` / `security_review` &mdash; multi-model diff review, adversarial plan red-team, test generation, OWASP/CWE audit
- Skills: `/review`, `/redteam`, `/spec`, `/triage`, `/setup`

#### Fixes
- `focus` orchestration screen: 37 lines of repeated scaffolding → 10 focused lines
- `npm test` exits 0 again (uncancelled race timers leaked past Jest teardown)
- GPT-5.5 high-effort reasoning no longer cut off at 3 minutes (timeout 180s → 600s)

---

## Skills (Claude Code)

TachiBot ships with 19 slash commands for Claude Code. These orchestrate the tools into powerful workflows:

| Skill | What it does | Example |
|-------|-------------|---------|
| `/setup` | Guided configuration — runs doctor, walks through keys/profiles | `/setup` |
| `/spec` | Request → reviewable spec before planning | `/spec add OAuth somehow` |
| `/blueprint` | Multi-model planning → bite-sized TDD steps | `/blueprint add OAuth with refresh tokens` |
| `/judge` | Multi-model council - parallel analysis with synthesis | `/judge how to implement rate limiting` |
| `/think` | Sequential reasoning chain with any model | `/think grok,gemini design a cache layer` |
| `/focus` | Mode-based reasoning (debate, research, analyze) | `/focus architecture-debate Redis vs Pg` |
| `/breakdown` | Strategic decomposition with pre-mortem | `/breakdown refactor payment module` |
| `/decompose` | Split into sub-problems, deep-dive each one | `/decompose implement collaborative editor` |
| `/prompt` | Recommend the right thinking technique (37 available) | `/prompt why do users churn` |
| `/algo` | Algorithm analysis with 4 specialized models (DeepSeek lead) | `/algo optimize LRU cache O(1)` |
| `/lens` | Long-context analysis over Kimi's 1M window | `/lens find inconsistencies in this spec` |
| `/reflect` | Grounded reflexion loop — critique vs external evidence | `/reflect harden this auth middleware` |
| `/tot` | Tree-of-Thought: branch → jury-prune → synthesize | `/tot design a rate limiter` |
| `/review` | Multi-model diff review — panel + Gemini judge verdict | `/review` (or paste a diff) |
| `/redteam` | Adversarial plan red-team — pre-mortem, risks, plan edits | `/redteam <paste plan>` |
| `/triage` | Ranked root-cause bug triage | `/triage <paste stack trace>` |
| `/test` | Generate runnable tests (edge cases first) | `/test src/auth.ts` |
| `/audit` | Security review — OWASP/CWE findings + fixes | `/audit the login handler` |
| `/tachi` | Help - see available skills, tools, key status | `/tachi` |

Skills automatically adapt to your configured API keys. Even with just 1-2 providers, all skills work.

> **Getting started?** Type `/tachi` to see what's available.

---

## Key Features

### Multi-Model Intelligence
- **65 AI Tools** across 12 providers &mdash; Perplexity, Grok, GPT-5, Gemini, Qwen, Kimi, MiniMax, DeepSeek, GLM (Zhipu), StepFun, ERNIE (Baidu), plus free local models (Ollama / LM Studio / llama.cpp / vLLM)
- **Gemini 3.6 Flash** (`gemini-3.6-flash`, GA Jul 21 2026) &mdash; Flash/search tier; reasoning default stays `gemini-3.1-pro-preview` (Google has still not shipped a 3.5 Pro)
- **Multi-Model Council** &mdash; planner_maker synthesizes plans from 5+ models into bite-sized TDD steps
- **Smart Routing** &mdash; Automatic model selection for optimal results
- **OpenRouter Gateway** &mdash; Optional single API key for all providers

### Advanced Workflows
- **YAML-Based Workflows** &mdash; Multi-step AI processes with dependency graphs
- **Prompt Engineering** &mdash; 85 research-backed techniques (including SCoT, ReAct, Reflexion, Chain-of-Note, Spotlighting)
- **Verification Checkpoints** &mdash; 50% / 80% / 100% with automated quality scoring
- **Parallel Execution** &mdash; Run multiple models simultaneously

### Tool Profiles
| Profile | Tools | Best For |
|---------|-------|----------|
| **Minimal** | 14 | Quick tasks, low token budget |
| **Research Power** | 38 | Deep investigation, multi-source |
| **Code Focus** | 43 | Software development, SWE tasks |
| **Balanced** | 56 | General-purpose, mixed workflows |
| **Heavy Coding** | 59 | Max code tools + agentic workflows |
| **Full** (default) | 67 | Everything enabled |

### Developer Experience
- **Claude Code** &mdash; First-class support
- **Claude Desktop** &mdash; Full integration
- **Cursor** &mdash; Works seamlessly
- **TypeScript** &mdash; Fully typed, extensible

---

## Quick Start

### Installation

```bash
npm install -g tachibot-mcp
```

### Setup wizard

```bash
npx -y -p tachibot-mcp tachibot init
```

Detects your keys and clients, then prints the exact config for Claude Code and Claude Desktop.

### Claude Code (one-liner)

```bash
claude mcp add tachibot -- npx -y -p tachibot-mcp tachibot
```

Then verify with `/mcp`. Add API keys with `--env`, e.g. `--env OPENROUTER_API_KEY=sk-or-xxx --env PERPLEXITY_API_KEY=pplx-xxx`.

### Setup (Claude Desktop)

**One-click (easiest):** download [`tachibot-mcp.mcpb`](https://github.com/byPawel/tachibot-mcp/releases/latest) from the latest release and double-click it — Claude Desktop installs the extension with no JSON editing. Add your API keys when prompted (or later via the extension settings).

**Gateway Mode (Recommended)** &mdash; 2 keys, all providers:

```json
{
  "mcpServers": {
    "tachibot": {
      "command": "tachibot",
      "env": {
        "OPENROUTER_API_KEY": "sk-or-xxx",
        "PERPLEXITY_API_KEY": "pplx-xxx",
        "USE_OPENROUTER_GATEWAY": "true"
      }
    }
  }
}
```

**Direct Mode** &mdash; One key per provider:

```json
{
  "mcpServers": {
    "tachibot": {
      "command": "tachibot",
      "env": {
        "PERPLEXITY_API_KEY": "your-key",
        "GROK_API_KEY": "your-key",
        "OPENAI_API_KEY": "your-key",
        "GOOGLE_API_KEY": "your-key",
        "OPENROUTER_API_KEY": "your-key"
      }
    }
  }
}
```

Get keys: [OpenRouter](https://openrouter.ai) | [Perplexity](https://perplexity.ai)

See [Installation Guide](docs/INSTALLATION_BOTH.md) for detailed instructions.

---

## Tool Ecosystem (67 Tools)

### Research & Search (6)
`perplexity_ask` &#183; `perplexity_reason` &#183; `grok_search` &#183; `grok_search_lite` &#183; `openai_search` &#183; `gemini_search`

### Reasoning & Planning (15)
`grok_reason` &#183; `openai_reason` &#183; `qwen_reason` &#183; `qwq_reason` &#183; `kimi_thinking` &#183; `kimi_decompose` &#183; `deepseek_reason` &#183; `glm_reason` &#183; `stepfun_reason` &#183; `ernie_reason` &#183; `planner_maker` &#183; `planner_runner` &#183; `list_plans` &#183; `spec_writer` &#183; `blog_writer`

### Code Intelligence (11)
`kimi_code` &#183; `grok_code` &#183; `grok_debug` &#183; `qwen_coder` &#183; `qwen_algo` &#183; `qwen_competitive` &#183; `deepseek_algo` &#183; `minimax_code` &#183; `minimax_agent` &#183; `testgen` &#183; `debug_triage`

### Analysis & Judgment (14)
`gemini_analyze_text` &#183; `gemini_analyze_code` &#183; `gemini_judge` &#183; `jury` &#183; `diff_review` &#183; `plan_critique` &#183; `gemini_brainstorm` &#183; `openai_brainstorm` &#183; `openai_code_review` &#183; `openai_explain` &#183; `grok_brainstorm` &#183; `grok_architect` &#183; `security_review` &#183; `kimi_long_context`

### Meta & Orchestration (6)
`think` &#183; `nextThought` &#183; `focus` &#183; `tachi` &#183; `doctor` &#183; `usage_stats`

### Workflows (9)
`workflow` &#183; `workflow_start` &#183; `continue_workflow` &#183; `list_workflows` &#183; `create_workflow` &#183; `visualize_workflow` &#183; `workflow_status` &#183; `validate_workflow` &#183; `validate_workflow_file`

### Prompt Engineering (4)
`list_prompt_techniques` &#183; `preview_prompt_technique` &#183; `execute_prompt_technique` &#183; `refine_prompt`

### Local Models (1)
`local_query` &mdash; any OpenAI-compatible local server (Ollama / LM Studio / llama.cpp / vLLM). Zero-cost, offline, private; also available as the `local` jury juror (`hermes` is accepted as a legacy alias). Runs whatever `LOCAL_LLM_MODEL` points at &mdash; e.g. a Nous Hermes build (`ollama pull hermes3`). Note the [Hermes agent](https://hermes-agent.nousresearch.com) itself is model-agnostic &mdash; it runs on 300+ backends (GPT, Claude, Gemini, DeepSeek, or self-hosted Ollama/vLLM) &mdash; so "Hermes" was never a guarantee of distinct weights.

### Advanced Modes (bonus)
- **Challenger** &mdash; Critical analysis with multi-model fact-checking
- **Verifier** &mdash; Multi-model consensus verification
- **Scout** &mdash; Hybrid intelligence gathering

---

## Example Usage

### Multi-Model Planning
```typescript
// Create a plan with multi-model council
planner_maker({ task: "Build a REST API with auth and tests", mode: "start" })
// → Grok searches → Qwen analyzes → Kimi decomposes → GPT critiques → Gemini synthesizes

// Execute with checkpoints
planner_runner({ plan: planContent, mode: "step", stepNum: 1 })
// → Automatic verification at 50%, 80% (kimi_decompose), and 100%
```

### Task Decomposition
```typescript
kimi_decompose({
  task: "Migrate monolith to microservices",
  depth: 3,
  outputFormat: "dependencies"
})
// → Structured subtasks with IDs, parallel flags, acceptance criteria
```

### Code Review
```typescript
kimi_code({
  task: "review",
  code: "function processPayment(amount, card) { ... }",
  language: "typescript"
})
// → SWE-Bench 76.8% quality analysis
```

### Deep Reasoning
```typescript
focus({
  query: "Design a scalable event-driven architecture",
  mode: "deep-reasoning",
  models: ["grok", "gemini", "kimi"],
  rounds: 5
})
```

---

## Documentation

- [Full Documentation](https://tachibot.com/docs)
- [Installation Guide](docs/INSTALLATION_BOTH.md)
- [Configuration](docs/CONFIGURATION.md)
- [Tools Reference](docs/TOOLS_REFERENCE.md)
- [Workflows Guide](docs/WORKFLOWS.md)
- [API Keys Guide](docs/API_KEYS.md)
- [Focus Modes](docs/FOCUS_MODES.md)

### Setup Guides
- [Claude Code Setup](docs/CLAUDE_CODE_SETUP.md)
- [Claude Desktop Setup](docs/CLAUDE_DESKTOP_MANUAL.md)
- [Both Platforms](docs/INSTALLATION_BOTH.md)

---

## Contributing

Contributions welcome! See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

- [Report Issues](https://github.com/byPawel/tachibot-mcp/issues)
- [Request Features](https://github.com/byPawel/tachibot-mcp/issues/new?template=feature_request.md)

---

<div align="center">

### Like what you see?

**[Star on GitHub](https://github.com/byPawel/tachibot-mcp)** &mdash; it helps more than you think.

[![GitHub stars](https://img.shields.io/github/stars/byPawel/tachibot-mcp?style=social)](https://github.com/byPawel/tachibot-mcp)

**[Website](https://tachibot.com)** &#183; **[Docs](https://tachibot.com/docs)** &#183; **[npm](https://www.npmjs.com/package/tachibot-mcp)** &#183; **[Issues](https://github.com/byPawel/tachibot-mcp/issues)**

AGPL-3.0 &mdash; see [LICENSE](LICENSE) for details.

**Made with care by [@byPawel](https://github.com/byPawel)**

*Multi-model AI orchestration, unified.*

</div>
