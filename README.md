<div align="center">

# TachiBot MCP

### Multi-Model AI Orchestration Platform

[![Version](https://img.shields.io/badge/version-2.23.2-blue.svg)](https://www.npmjs.com/package/tachibot-mcp)
[![Tools](https://img.shields.io/badge/tools-57_active-brightgreen.svg)](#-tool-ecosystem-57-tools)
[![License](https://img.shields.io/badge/license-AGPL--3.0-green.svg)](LICENSE)
[![Node](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen.svg)](https://nodejs.org)
[![MCP](https://img.shields.io/badge/MCP-Compatible-purple.svg)](https://modelcontextprotocol.io)

**57 AI tools. 12 providers. One protocol.**

Orchestrate Perplexity, Grok, GPT-5.5, Gemini, Qwen, Kimi K2.7-Code, and MiniMax M3
from Claude Code, Claude Desktop, Cursor, or any MCP client.

[Get Started](#-quick-start) &#183; [View Tools](#-tool-ecosystem-57-tools) &#183; [Documentation](https://tachibot.com/docs)

<br>

**If TachiBot helps your workflow, a** [**star**](https://github.com/byPawel/tachibot-mcp) **goes a long way.**

[![GitHub stars](https://img.shields.io/github/stars/byPawel/tachibot-mcp?style=social)](https://github.com/byPawel/tachibot-mcp)
[![npm downloads](https://img.shields.io/npm/dm/tachibot-mcp?label=npm%20downloads&color=cyan)](https://www.npmjs.com/package/tachibot-mcp)

</div>

---

## What's New in v2.15.0

### `/blueprint` Skill &mdash; Multi-Model Implementation Planning
New skill that creates bite-sized TDD implementation plans using a 7-step multi-model council:
```
/blueprint add OAuth with refresh tokens
```
Pipeline: Grok search → Qwen+Kimi analysis → Kimi decompose → GPT pre-mortem critique → Gemini final judgment → **bite-sized TDD output** (exact files, test-first steps, commit points).

Bridges `planner_maker`'s multi-model intelligence with the `writing-plans` execution format.

### 31 Prompt Engineering Techniques (was 22)
Added 9 research-backed techniques for coding and decision-making:

| Technique | Source | Category |
|-----------|--------|----------|
| `reflexion` | Shinn et al. 2023 | Engineering |
| `react` (ReAct) | Yao et al. 2022 | Engineering |
| `rubber_duck` | Hunt & Thomas 2008 | Engineering |
| `test_driven` | Beck 2003 | Engineering |
| `scot` (Structured CoT) | Li et al. 2025 (+13.79% HumanEval) | Structured Coding |
| `pre_post` (Contracts) | Empirical SE 2025 | Structured Coding |
| `bdd_spec` (Given/When/Then) | BDD 2025 | Structured Coding |
| `least_to_most` | Zhou et al. 2022 | Research |
| `pre_mortem` | Klein 2007 | Decision |

Techniques are embedded directly in tool system prompts for automatic application.

### MiniMax M2.5 Upgrade
- `minimax_code` &mdash; SWE-Bench **80.2%**, per-task TECHNIQUE tags (SCoT, reflexion, rubber_duck), per-task temperatures
- `minimax_agent` &mdash; ReAct + least-to-most decomposition protocol, HALT criteria

### Enhanced Skills
- `/breakdown` &mdash; now uses `least_to_most` ordering + `pre_mortem` failure analysis
- `/judge` &mdash; first judge now runs pre-mortem ("assume this FAILED")
- `/decompose` &mdash; deep-dives include pre/post contracts per sub-problem
- `/prompt` &mdash; auto-recommend flow with 30-intent matching guide, 13 categories

---

## Skills (Claude Code)

TachiBot ships with 12 slash commands for Claude Code. These orchestrate the tools into powerful workflows:

| Skill | What it does | Example |
|-------|-------------|---------|
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
| `/tachi` | Help - see available skills, tools, key status | `/tachi` |

Skills automatically adapt to your configured API keys. Even with just 1-2 providers, all skills work.

> **Getting started?** Type `/tachi` to see what's available.

---

## Key Features

### Multi-Model Intelligence
- **57 AI Tools** across 12 providers &mdash; Perplexity, Grok, GPT-5, Gemini, Qwen, Kimi, MiniMax, DeepSeek, GLM (Zhipu), StepFun, ERNIE (Baidu), plus free local models (Ollama / LM Studio / llama.cpp / vLLM)
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
| **Minimal** | 12 | Quick tasks, low token budget |
| **Research Power** | 35 | Deep investigation, multi-source |
| **Code Focus** | 34 | Software development, SWE tasks |
| **Balanced** | 45 | General-purpose, mixed workflows |
| **Heavy Coding** (default) | 50 | Max code tools + agentic workflows |
| **Full** | 57 | Everything enabled |

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

### Setup

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

## Tool Ecosystem (57 Tools)

### Research & Search (6)
`perplexity_ask` &#183; `perplexity_research` &#183; `perplexity_reason` &#183; `grok_search` &#183; `openai_search` &#183; `gemini_search`

### Reasoning & Planning (13)
`grok_reason` &#183; `openai_reason` &#183; `qwen_reason` &#183; `qwq_reason` &#183; `kimi_thinking` &#183; `kimi_decompose` &#183; `deepseek_reason` &#183; `glm_reason` &#183; `stepfun_reason` &#183; `ernie_reason` &#183; `planner_maker` &#183; `planner_runner` &#183; `list_plans`

### Code Intelligence (9)
`kimi_code` &#183; `grok_code` &#183; `grok_debug` &#183; `qwen_coder` &#183; `qwen_algo` &#183; `qwen_competitive` &#183; `deepseek_algo` &#183; `minimax_code` &#183; `minimax_agent`

### Analysis & Judgment (11)
`gemini_analyze_text` &#183; `gemini_analyze_code` &#183; `gemini_judge` &#183; `jury` &#183; `gemini_brainstorm` &#183; `openai_brainstorm` &#183; `openai_code_review` &#183; `openai_explain` &#183; `grok_brainstorm` &#183; `grok_architect` &#183; `kimi_long_context`

### Meta & Orchestration (5)
`think` &#183; `nextThought` &#183; `focus` &#183; `tachi` &#183; `usage_stats`

### Workflows (9)
`workflow` &#183; `workflow_start` &#183; `continue_workflow` &#183; `list_workflows` &#183; `create_workflow` &#183; `visualize_workflow` &#183; `workflow_status` &#183; `validate_workflow` &#183; `validate_workflow_file`

### Prompt Engineering (3)
`list_prompt_techniques` &#183; `preview_prompt_technique` &#183; `execute_prompt_technique`

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
