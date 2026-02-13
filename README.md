<div align="center">

# TachiBot MCP

### Multi-Model AI Orchestration Platform

[![Version](https://img.shields.io/badge/version-2.14.7-blue.svg)](https://www.npmjs.com/package/tachibot-mcp)
[![Tools](https://img.shields.io/badge/tools-48_active-brightgreen.svg)](#-tool-ecosystem-48-tools)
[![License](https://img.shields.io/badge/license-AGPL--3.0-green.svg)](LICENSE)
[![Node](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen.svg)](https://nodejs.org)
[![MCP](https://img.shields.io/badge/MCP-Compatible-purple.svg)](https://modelcontextprotocol.io)

**48 AI tools. 7 providers. One protocol.**

Orchestrate Perplexity, Grok, GPT-5, Gemini, Qwen, Kimi K2.5, and MiniMax M2.1
from Claude Code, Claude Desktop, Cursor, or any MCP client.

[Get Started](#-quick-start) &#183; [View Tools](#-tool-ecosystem-48-tools) &#183; [Documentation](https://tachibot.com/docs)

<br>

**If TachiBot helps your workflow, a** [**star**](https://github.com/byPawel/tachibot-mcp) **goes a long way.**

[![GitHub stars](https://img.shields.io/github/stars/byPawel/tachibot-mcp?style=social)](https://github.com/byPawel/tachibot-mcp)
[![npm downloads](https://img.shields.io/npm/dm/tachibot-mcp?label=npm%20downloads&color=cyan)](https://www.npmjs.com/package/tachibot-mcp)

</div>

---

## What's New in v2.14.7

### Gemini Judge &amp; Jury System
- **`gemini_judge`** &mdash; Science-backed LLM-as-a-Judge (arXiv:2411.15594). 4 modes: synthesize, evaluate, rank, resolve
- **`jury`** &mdash; Multi-model jury panel. Configurable jurors (grok, openai, qwen, kimi, perplexity, minimax) run in parallel, Gemini synthesizes the verdict. Based on "Replacing Judges with Juries" (Cohere, arXiv:2404.18796)

### Perplexity Model Fixes
- Fixed `sonar-pro` model ID (was accidentally using lightweight `sonar`)
- `perplexity_research` now uses **`sonar-deep-research`** &mdash; exhaustive multi-source reports in a single call

### Qwen3-Coder-Next
`qwen_coder` now runs on **Qwen3-Coder-Next** (Feb 2026) &mdash; purpose-built for agentic coding:

| | Before (qwen3-coder) | After (qwen3-coder-next) |
|---|---|---|
| **Params** | 480B / ~35B active | 80B / 3B active |
| **Context** | 131K | 262K |
| **SWE-Bench** | 69.6% | >70% |
| **Pricing** | $0.22/$0.88 per M | $0.07/$0.30 per M |

3x cheaper, 2x context, better benchmarks. Falls back to legacy 480B on provider failure.

### Kimi K2.5 Suite (4 tools)
| Tool | Capability | Highlight |
|------|-----------|-----------|
| `kimi_thinking` | Step-by-step reasoning | Agent Swarm architecture |
| `kimi_code` | Code generation & fixing | SWE-Bench 76.8% |
| `kimi_decompose` | Task decomposition | Dependency graphs, parallel subtasks |
| `kimi_long_context` | Document analysis | 256K context window |

### MiniMax M2.1 (2 tools)
- `minimax_code` &mdash; SWE tasks at very low cost (72.5% SWE-Bench)
- `minimax_agent` &mdash; Agentic workflows (77.2% &tau;&sup2;-Bench)

### Qwen Reasoning
- `qwen_reason` &mdash; Heavy reasoning with Qwen3-Max-Thinking (>1T params, 98% HMMT math)

---

## Skills (Claude Code)

TachiBot ships with 7 slash commands for Claude Code. These orchestrate the tools into powerful workflows:

| Skill | What it does | Example |
|-------|-------------|---------|
| `/judge` | Multi-model council - parallel analysis with synthesis | `/judge how to implement rate limiting` |
| `/think` | Sequential reasoning chain with any model | `/think grok,gemini design a cache layer` |
| `/focus` | Mode-based reasoning (debate, research, analyze) | `/focus architecture-debate Redis vs Pg` |
| `/breakdown` | Strategic decomposition with feasibility check | `/breakdown add OAuth with refresh tokens` |
| `/decompose` | Split into sub-problems, deep-dive each one | `/decompose implement collaborative editor` |
| `/prompt` | Apply 22 prompt engineering techniques | `/prompt first_principles why users churn` |
| `/tachi` | Help - see available skills, tools, key status | `/tachi` |

Skills automatically adapt to your configured API keys. Even with just 1-2 providers, all skills work.

> **Getting started?** Type `/tachi` to see what's available.

---

## Key Features

### Multi-Model Intelligence
- **48 AI Tools** across 7 providers &mdash; Perplexity, Grok, GPT-5, Gemini, Qwen, Kimi, MiniMax
- **Multi-Model Council** &mdash; planner_maker synthesizes plans from 5+ models
- **Smart Routing** &mdash; Automatic model selection for optimal results
- **OpenRouter Gateway** &mdash; Optional single API key for all providers

### Advanced Workflows
- **YAML-Based Workflows** &mdash; Multi-step AI processes with dependency graphs
- **Prompt Engineering** &mdash; 14 research-backed techniques built-in
- **Verification Checkpoints** &mdash; 50% / 80% / 100% with automated quality scoring
- **Parallel Execution** &mdash; Run multiple models simultaneously

### Tool Profiles
| Profile | Tools | Best For |
|---------|-------|----------|
| **Minimal** | 12 | Quick tasks, low token budget |
| **Research Power** | 30 | Deep investigation, multi-source |
| **Code Focus** | 28 | Software development, SWE tasks |
| **Balanced** | 38 | General-purpose, mixed workflows |
| **Heavy Coding** (default) | 44 | Max code tools + agentic workflows |
| **Full** | 50 | Everything enabled |

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

## Tool Ecosystem (48 Tools)

### Research & Search (6)
`perplexity_ask` &#183; `perplexity_research` &#183; `perplexity_reason` &#183; `grok_search` &#183; `openai_search` &#183; `gemini_search`

### Reasoning & Planning (8)
`grok_reason` &#183; `openai_reason` &#183; `qwen_reason` &#183; `kimi_thinking` &#183; `kimi_decompose` &#183; `planner_maker` &#183; `planner_runner` &#183; `list_plans`

### Code Intelligence (8)
`kimi_code` &#183; `grok_code` &#183; `grok_debug` &#183; `qwen_coder` &#183; `qwen_algo` &#183; `qwen_competitive` &#183; `minimax_code` &#183; `minimax_agent`

### Analysis & Brainstorming (9)
`gemini_analyze_text` &#183; `gemini_analyze_code` &#183; `gemini_brainstorm` &#183; `openai_brainstorm` &#183; `openai_code_review` &#183; `openai_explain` &#183; `grok_brainstorm` &#183; `grok_architect` &#183; `kimi_long_context`

### Meta & Orchestration (5)
`think` &#183; `nextThought` &#183; `focus` &#183; `tachi` &#183; `usage_stats`

### Workflows (9)
`workflow` &#183; `workflow_start` &#183; `continue_workflow` &#183; `list_workflows` &#183; `create_workflow` &#183; `visualize_workflow` &#183; `workflow_status` &#183; `validate_workflow` &#183; `validate_workflow_file`

### Prompt Engineering (3)
`list_prompt_techniques` &#183; `preview_prompt_technique` &#183; `execute_prompt_technique`

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
