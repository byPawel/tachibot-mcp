<div align="center">

# TachiBot MCP

### Multi-Model AI Orchestration Platform

[![Version](https://img.shields.io/badge/version-2.26.0-blue.svg)](https://www.npmjs.com/package/tachibot-mcp)
[![Tools](https://img.shields.io/badge/tools-64_active-brightgreen.svg)](#-tool-ecosystem-64-tools)
[![License](https://img.shields.io/badge/license-AGPL--3.0-green.svg)](LICENSE)
[![Node](https://img.shields.io/badge/node-%3E%3D22.0.0-brightgreen.svg)](https://nodejs.org)
[![MCP](https://img.shields.io/badge/MCP-Compatible-purple.svg)](https://modelcontextprotocol.io)

**64 AI tools. 12 providers. One protocol.**

Orchestrate Perplexity, Grok, GPT-5.5, Gemini, Qwen, Kimi K2.7-Code, and MiniMax M3
from Claude Code, Claude Desktop, Cursor, or any MCP client.

[Get Started](#-quick-start) &#183; [View Tools](#-tool-ecosystem-64-tools) &#183; [Documentation](https://tachibot.com/docs)

<br>

**If TachiBot helps your workflow, a** [**star**](https://github.com/byPawel/tachibot-mcp) **goes a long way.**

[![GitHub stars](https://img.shields.io/github/stars/byPawel/tachibot-mcp?style=social)](https://github.com/byPawel/tachibot-mcp)
[![npm downloads](https://img.shields.io/npm/dm/tachibot-mcp?label=npm%20downloads&color=cyan)](https://www.npmjs.com/package/tachibot-mcp)

</div>

---

## What's New in v2.26.0

### Prompt stack, modernized
- **`refine_prompt`** (new tool) &mdash; opt-in prompt improver on a cheap/fast model: raw query → goal-first brief + **what changed** + **open questions**. Never auto-fires, never executes anything — you review, then use the brief. In Claude Code, `/prompt refine` presents the open questions as clickable choices and merges your answers into a final brief.
- **Curated technique list** &mdash; `list_prompt_techniques` now defaults to the ~9 core techniques that still help 2026 reasoning models (output contracts like `scot`, `pre_mortem`, `bdd_spec`); `all=true` for the full 31.
- **`technique="auto"`** &mdash; `preview_prompt_technique` recommends the right technique for your task, with reasons. Ask `tachi` "improve my prompt" for the symptom-based menu.

### Setup, de-mystified
- **`tachibot init`** (new CLI wizard) &mdash; detects your API keys and clients, prints the exact config for Claude Code and Claude Desktop. Never writes or echoes keys.
- **One-click Claude Desktop install** &mdash; download the `.mcpb` from the latest release and double-click. No JSON editing.
- **`doctor`** &mdash; shows which keys are set, which tools are visible vs hidden and why, and what to try first.

### New tools & skills (64 tools · 19 skills)
- `debug_triage` &mdash; ranked root-cause hypotheses with the cheapest discriminating check for each (Grok 4.3)
- `spec_writer` &mdash; loose request → reviewable spec: user stories, Given/When/Then, out-of-scope, open questions (GPT-5.5)
- `diff_review` / `plan_critique` / `testgen` / `security_review` &mdash; multi-model diff review, adversarial plan red-team, test generation, OWASP/CWE audit
- Skills: `/review`, `/redteam`, `/spec`, `/triage`, `/setup`

### Fixes
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
| `/prompt` | Recommend the right thinking technique (31 available) | `/prompt why do users churn` |
| `/algo` | Algorithm analysis with 4 specialized models (DeepSeek lead) | `/algo optimize LRU cache O(1)` |
| `/lens` | Long-context analysis over Kimi's 256K window | `/lens find inconsistencies in this spec` |
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
- **64 AI Tools** across 12 providers &mdash; Perplexity, Grok, GPT-5, Gemini, Qwen, Kimi, MiniMax, DeepSeek, GLM (Zhipu), StepFun, ERNIE (Baidu), plus free local models (Ollama / LM Studio / llama.cpp / vLLM)
- **Gemini 3.5 Flash** (`gemini-3.5-flash`, GA May 19 2026) &mdash; Flash/search tier; reasoning default stays `gemini-3.1-pro-preview`
- **Multi-Model Council** &mdash; planner_maker synthesizes plans from 5+ models into bite-sized TDD steps
- **Smart Routing** &mdash; Automatic model selection for optimal results
- **OpenRouter Gateway** &mdash; Optional single API key for all providers

### Advanced Workflows
- **YAML-Based Workflows** &mdash; Multi-step AI processes with dependency graphs
- **Prompt Engineering** &mdash; 31 research-backed techniques (including SCoT, ReAct, Reflexion)
- **Verification Checkpoints** &mdash; 50% / 80% / 100% with automated quality scoring
- **Parallel Execution** &mdash; Run multiple models simultaneously

### Tool Profiles
| Profile | Tools | Best For |
|---------|-------|----------|
| **Minimal** | 13 | Quick tasks, low token budget |
| **Research Power** | 35 | Deep investigation, multi-source |
| **Code Focus** | 42 | Software development, SWE tasks |
| **Balanced** | 53 | General-purpose, mixed workflows |
| **Heavy Coding** | 57 | Max code tools + agentic workflows |
| **Full** (default) | 64 | Everything enabled |

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

## Tool Ecosystem (64 Tools)

### Research & Search (5)
`perplexity_ask` &#183; `perplexity_reason` &#183; `grok_search` &#183; `openai_search` &#183; `gemini_search`

### Reasoning & Planning (14)
`grok_reason` &#183; `openai_reason` &#183; `qwen_reason` &#183; `qwq_reason` &#183; `kimi_thinking` &#183; `kimi_decompose` &#183; `deepseek_reason` &#183; `glm_reason` &#183; `stepfun_reason` &#183; `ernie_reason` &#183; `planner_maker` &#183; `planner_runner` &#183; `list_plans` &#183; `spec_writer`

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
