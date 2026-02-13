---
name: prompt
description: Apply 22 prompt engineering techniques like first_principles, tree_of_thoughts, judge
user-invocable: true
---

# Prompt Technique

Apply research-backed prompt engineering patterns.

## Usage
```
/prompt [technique] [query]
/prompt list
```

## Techniques by Category

| Category | Techniques |
|----------|------------|
| Creative | `what_if`, `alt_view`, `innovate` |
| Analytical | `analyze`, `first_principles`, `feasibility` |
| Reasoning | `chain_of_thought`, `tree_of_thoughts`, `graph_of_thoughts` |
| Verification | `self_consistency`, `constitutional` |
| Debate | `adversarial`, `persona_simulation` |
| Judgment | `council_of_experts` (alias: `judge`) |

## Instructions

### For `/prompt list`:
```
mcp__tachibot-mcp__list_prompt_techniques({ filter: "all" })
```

### For `/prompt [technique] [query]`:

**Step 1 - Preview** (always do this first):
```
mcp__tachibot-mcp__preview_prompt_technique({
  technique: "[technique]",
  tool: "grok_reason",
  query: "[query]"
})
```

Show the user the **original query** vs **enhanced prompt** side by side, plus the technique name and target tool.

**Step 2 - Confirm**: Ask the user if they want to execute, tweak the query, or pick a different technique.

**Step 3 - Execute** (only after approval):
```
mcp__tachibot-mcp__execute_prompt_technique({
  execution_token: "last"
})
```

Note: Tokens expire after 5 minutes. If expired, re-preview first.

## Examples
- `/prompt first_principles why do users abandon checkout`
- `/prompt tree_of_thoughts implement caching`
- `/prompt judge microservices vs monolith`
