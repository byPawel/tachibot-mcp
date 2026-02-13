---
name: focus
description: Multi-model reasoning with modes like deep-reasoning, architecture-debate, research, analyze
user-invocable: true
---

# Focus Mode

Structured multi-model reasoning via TachiBot.

## Usage
```
/focus [query]
/focus [mode] [query]
```

## Available Modes
| Mode | Use Case |
|------|----------|
| `deep-reasoning` | Complex analysis (default) |
| `architecture-debate` | System design decisions |
| `research` | Information gathering |
| `analyze` | Systematic breakdown |
| `code-brainstorm` | Implementation ideas |

## Instructions

When user invokes `/focus`:

1. Parse mode (if specified) and query
2. Call focus tool:
```
mcp__tachibot-mcp__focus({
  query: "[query]",
  mode: "[mode or deep-reasoning]",
  models: ["grok", "gemini", "kimi"],
  rounds: 3
})
```

3. Present multi-model synthesis

## Examples
- `/focus how to handle 10k concurrent connections`
- `/focus architecture-debate Redis vs Memcached`
- `/focus research React 19 new features`
