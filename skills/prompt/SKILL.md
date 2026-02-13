---
name: prompt
description: Choose and apply the right prompt engineering technique for any problem — recommends techniques based on your intent
user-invocable: true
---

# Prompt — Find the Right Thinking Technique

Helps you pick the best prompt engineering technique for your problem, then applies it.

## Usage
```
/prompt [query]                    — recommends technique based on your intent
/prompt [technique] [query]        — applies a specific technique
/prompt list                       — show all 22 techniques
/prompt [category]                 — list techniques in a category
```

## Instructions

### For `/prompt list`:
```
mcp__tachibot-mcp__list_prompt_techniques({ filter: "all" })
```

### For `/prompt [category]` (e.g. `/prompt creative`):
```
mcp__tachibot-mcp__list_prompt_techniques({ filter: "[category]" })
```
Categories: `creative`, `research`, `analytical`, `reflective`, `reasoning`, `verification`, `meta`, `debate`, `judgment`

### For `/prompt [query]` (NO technique specified — RECOMMEND one):

This is the key flow. Analyze the user's intent and recommend a technique:

**Intent Matching Guide:**

| User intent | Best technique | Why |
|---|---|---|
| "Why does X happen?" / understand root cause | `first_principles` | Strip to atomic truths |
| "How should I build X?" / explore approaches | `tree_of_thoughts` | Branch 3 paths, evaluate each |
| "What if X?" / speculative | `what_if` | Wild exploration without limits |
| "Compare X vs Y" / trade-offs | `adversarial` | Argue FOR then AGAINST |
| "Break down X" / complex problem | `decompose` | Sub-problems + dependencies |
| "Is X feasible?" / reality check | `feasibility` | Technical/time/cost/risk |
| "Review X" / check my work | `self_consistency` | 3 solutions, compare, vote best |
| "Research X" / investigate | `investigate` | 5W1H analysis |
| "Improve X" / creative ideas | `innovate` | 3+ unconventional solutions |
| "What am I missing?" / blind spots | `alt_view` | 5 perspectives: child, scientist, artist, strategist, futurist |
| "Find patterns in X" | `patterns` | Themes, causality, cycles, anomalies |
| "Synthesize X" / connect findings | `integrate` | Convergent themes, meta-patterns |
| "Best approach for X?" / need consensus | `council_of_experts` | Multi-model judge council |
| "Step by step, how?" | `chain_of_thought` | Identify, breakdown, logic, conclude |
| "Map connections in X" | `graph_of_thoughts` | Nodes=ideas, edges=connections |
| "Is this safe/ethical?" | `constitutional` | Critique against principles, revise |
| "Make my prompt better" | `meta_prompting` | Write better prompt, then solve |
| "Prove/disprove X" | `evidence` | Support, contradict, cases, stats |
| "What went well/wrong?" | `reflect` | Patterns, surprises, gaps, next steps |
| "Debate X" / multiple experts | `persona_simulation` | Simulated expert debate |
| "Apply X idea to Y domain" | `creative_use` | Cross-domain applications |

**Present 2-3 choices, then judge which is best:**

1. Pick 2-3 techniques that could work for the query
2. For each, preview the enhanced prompt (call `preview_prompt_technique` for each)
3. Compare the previews — which enhanced prompt best captures what the user needs?
4. Present your recommendation with reasoning:

```
I found 3 techniques that fit. Here's how each would approach your question:

### Option 1: **[technique1]** ([alias])
> [Show the enhanced prompt preview — how it reframes the query]
Strength: [why this angle works]

### Option 2: **[technique2]** ([alias])
> [Show the enhanced prompt preview]
Strength: [why this angle works]

### Option 3: **[technique3]** ([alias])
> [Show the enhanced prompt preview]
Strength: [why this angle works]

**My pick: Option [N] — [technique]**
[1-2 sentences on why this framing will get the best result for your specific question]

Go with this, or prefer another?
```

Wait for user confirmation before executing.

### For `/prompt [technique] [query]` (technique specified):

**Step 1 — Preview** (always do this first):
```
mcp__tachibot-mcp__preview_prompt_technique({
  technique: "[technique]",
  tool: "grok_reason",  // or gemini_brainstorm for creative techniques
  query: "[query]"
})
```

Show the user the **original query** vs **enhanced prompt** side by side, plus the technique name and target tool.

**Step 2 — Confirm**: Ask the user if they want to execute, tweak the query, or pick a different technique.

**Step 3 — Execute** (only after approval):
```
mcp__tachibot-mcp__execute_prompt_technique({
  execution_token: "last"  // uses the most recent preview
})
```

Note: Tokens expire after 5 minutes. If expired, re-preview first.

### Tool Selection for Preview

Match the tool to the technique category:

| Category | Best tool | Fallback |
|---|---|---|
| Creative | `gemini_brainstorm` | `grok_brainstorm` |
| Research | `perplexity_ask` | `grok_search` |
| Analytical | `grok_reason` | `openai_reason` |
| Reflective | `gemini_analyze_text` | `kimi_thinking` |
| Reasoning | `kimi_thinking` | `openai_reason` |
| Verification | `openai_reason` | `grok_reason` |
| Debate | `grok_reason` | `openai_reason` |
| Judgment | `gemini_analyze_text` | `openai_reason` |

## Examples
- `/prompt why do users abandon checkout` — recommends `first_principles`
- `/prompt first_principles why do users abandon checkout` — applies directly
- `/prompt how should I implement caching` — recommends `tree_of_thoughts`
- `/prompt list` — shows all 22 techniques
- `/prompt creative` — shows creative techniques only
