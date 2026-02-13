---
name: tachi
description: TachiBot help - see available skills, tools, and configured API keys
user-invocable: true
---

# TachiBot Help

Show available TachiBot skills, tools, and API key status.

## Usage
```
/tachi
/tachi stats
```

## Instructions

When user invokes `/tachi`:

### Show Available Skills

Present this overview:

```
## TachiBot - Multi-Model AI Orchestration

### Skills (slash commands)

| Skill | What it does | Example |
|-------|-------------|---------|
| `/judge` | Multi-model council - parallel analysis + synthesis | `/judge how to implement auth` |
| `/think` | Sequential reasoning chain with any model | `/think grok,gemini design a cache` |
| `/focus` | Mode-based reasoning (debate, research, analyze) | `/focus architecture-debate SQL vs NoSQL` |
| `/breakdown` | Strategic overview: first principles + feasibility | `/breakdown add real-time collaboration` |
| `/decompose` | Split into pieces, deep-dive each one | `/decompose implement auth system` |
| `/prompt` | Apply prompt engineering techniques | `/prompt first_principles why users churn` |
| `/tachi` | This help screen | `/tachi` |

### Quick Start

1. Pick a skill based on your task:
   - **Need an answer?** -> `/judge`
   - **Need to reason through something?** -> `/think`
   - **Need to debate approaches?** -> `/focus architecture-debate`
   - **Need a strategic overview?** -> `/breakdown`
   - **Need to understand each piece deeply?** -> `/decompose`
   - **Need a specific thinking technique?** -> `/prompt list`

2. Or use tools directly: `grok_search`, `gemini_brainstorm`, `qwen_coder`, etc.
```

### Check API Key Status

Call the usage_stats tool to show what's configured:

```
mcp__tachibot-mcp__usage_stats({ action: "view", scope: "current", format: "table" })
```

Then summarize which providers are active based on whether their tools appear in available MCP tools.

### If `/tachi stats`:

Call usage stats with full scope:
```
mcp__tachibot-mcp__usage_stats({ action: "view", scope: "all", format: "table" })
```

Present the usage data with insights about most-used tools and cost efficiency.
