---
name: prompt
description: Use when a task would benefit from a structured thinking technique but you're not sure which — recommends the right prompt technique for the intent (debug, spec, refactor, decision, design) and applies it
user-invocable: true
---

# Prompt — Find and Apply the Right Thinking Technique

Picks the best prompt-engineering technique for a problem, then applies it. The
`preview_prompt_technique` tool with `technique="auto"` is the single source of
truth for recommendations — don't maintain a parallel list here.

## Usage
```
/prompt [query]                 — recommend a technique for the intent, then apply
/prompt [technique] [query]     — apply a specific technique
/prompt refine [query]          — opt-in: rewrite the raw query into a brief via refine_prompt
/prompt list                    — the ~9 core techniques (default)
/prompt all                     — all 31 techniques
/prompt [category]              — one category in full
```

## Instructions

### `/prompt list`, `/prompt all`, `/prompt [category]`
- list: `list_prompt_techniques({})` — core techniques (the ones that still help 2026 reasoning models).
- all: `list_prompt_techniques({ all: true })`.
- category: `list_prompt_techniques({ filter: "[category]" })` — categories: creative, research, research_advanced, analytical, reflective, reasoning, verification, meta, debate, judgment, engineering, structured_coding, decision.

### `/prompt [query]` — recommend, then apply

1. Ask the tool, don't guess: `preview_prompt_technique({ technique: "auto", query: "[query]" })`. It returns the top techniques for the intent with a reason and a kind tag (contract = imposes output structure, safe on reasoning models; scaffold = mainly helps weaker/routed models).
2. Write a goal-first brief IN CONTEXT (free — you're already a frontier model; do NOT add a paid rewrite step). Turn the raw query into: goal, constraints, deliverable, and how you'll know it's right. Preserve the user's ambiguity — surface it as an open question rather than resolving it silently. If the query is long/messy or the user explicitly asks to improve their prompt, offer the opt-in tool instead: `refine_prompt({ query, goal?, context? })` — relay its REFINED PROMPT + WHAT CHANGED + OPEN QUESTIONS and get approval before using the brief. Never call it automatically.
3. Preview the top recommended technique against a sensible tool (see mapping below): `preview_prompt_technique({ technique: "[top pick]", tool: "[tool]", query: "[the brief]" })`.
4. Show the user the original query vs the enhanced prompt, name the technique + why, and list the runner-up techniques the auto step returned in case they prefer a different angle.
5. On approval: `execute_prompt_technique({ execution_token: "last" })`.

### `/prompt [technique] [query]` — apply a named technique
1. `preview_prompt_technique({ technique: "[technique]", tool: "[tool]", query: "[query]" })` — show original vs enhanced.
2. Confirm with the user.
3. `execute_prompt_technique({ execution_token: "last" })` (tokens expire after a few minutes — re-preview if stale).

### `/prompt refine [query]` — opt-in prompt rewrite
Calls `refine_prompt({ query })` directly (add `goal`/`context` if the user gave them) and relays its three sections verbatim: REFINED PROMPT, WHAT CHANGED, OPEN QUESTIONS. This is the explicit, user-requested path — unlike step 2 above, it always calls the tool since the user asked for it by name.

## Tool selection for preview

Match the target tool to the technique's category:

| Category | Best tool | Fallback |
|---|---|---|
| Creative | `gemini_brainstorm` | `grok_brainstorm` |
| Research | `perplexity_ask` | `grok_search` |
| Analytical | `grok_reason` | `openai_reason` |
| Reflective | `gemini_analyze_text` | `kimi_thinking` |
| Reasoning | `kimi_thinking` | `openai_reason` |
| Verification | `openai_reason` | `grok_reason` |
| Debate / Decision | `grok_reason` | `openai_reason` |
| Judgment | `gemini_judge` | `jury` |
| Engineering / Structured Coding | `qwen_coder` | `minimax_code` |
| Research Advanced | `perplexity_reason` | `kimi_long_context` |

## Examples
- `/prompt there's a null-pointer crash on checkout` — auto recommends `rubber_duck` / `react`
- `/prompt should we use Redis or Postgres for the queue` — auto recommends `adversarial` / `pre_mortem`
- `/prompt refactor the payment module safely` — auto recommends `pre_post` / `scot` / `test_driven`
- `/prompt scot implement a rate limiter` — applies structured-CoT directly
- `/prompt bdd_spec user registration flow` — Given/When/Then before code
- `/prompt list` — the core techniques · `/prompt all` — all 31
