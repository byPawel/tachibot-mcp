---
name: redteam
description: Adversarial plan red-team — multi-model pre-mortem, hidden-assumption audit, ranked risks with mitigations, and concrete edits for any plan you paste or point at
user-invocable: true
---

# /redteam — Adversarial Plan Critique

Red-team a plan with the `plan_critique` tool.

## Steps

1. Collect the plan. If the user pasted it, use it verbatim. If they pointed at a file (a plan doc, an issue, a PLAN.md), read it and use its contents. If neither, ask for the plan and stop.
2. Extract the goal and constraints from the user's message or the plan's own header; pass them as `goal` and `constraints` when present.
3. Call `plan_critique` with `plan`, plus `goal`/`constraints`/`files` when available (`files` = code the plan touches, for grounding).
4. Relay the verdict. Lead with SOUND / SOUND WITH EDITS / RETHINK, then the top risks with mitigations and the numbered plan edits. Note which concerns multiple critics converged on — convergence is signal.
5. Offer to apply the plan edits to the plan document.

## Requirements

Needs GEMINI (judge) plus OPENROUTER, GROK, or OPENAI keys (critics self-drop). If the tool returns a "no critics available" error, show the user its message.
