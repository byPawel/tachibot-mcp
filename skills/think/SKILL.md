---
name: think
description: Chain-of-thought reasoning with optional multi-model execution using nextThought
user-invocable: true
---

# Sequential Think

Step-by-step reasoning chains with model execution.

## Usage
```
/think [problem]
/think [model] [problem]
/think [model1,model2] [problem]
```

## Available Models
`grok`, `gemini`, `openai`, `perplexity`, `kimi`, `qwen`

## Instructions

When user invokes `/think`:

### Single model:
```
mcp__tachibot-mcp__nextThought({
  thought: "[problem]",
  model: "[model]",
  executeModel: true,
  contextWindow: "all",
  nextThoughtNeeded: false
})
```

### Multi-model chain:
```
// First model (fresh)
nextThought({ thought: "Analyze: [problem]", model: "[model1]", executeModel: true, contextWindow: 0, nextThoughtNeeded: true })

// Second model (sees previous)
nextThought({ thought: "Build on analysis", model: "[model2]", executeModel: true, contextWindow: "all", nextThoughtNeeded: false })
```

### Default (no model specified):
Use `gemini` as default model.

## Examples
- `/think why is my WebSocket disconnecting`
- `/think gemini optimize this query`
- `/think grok,kimi,gemini design a rate limiter`
