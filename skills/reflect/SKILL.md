---
name: reflect
description: Iterative reflexion loop — generate, critique against EXTERNAL evidence (real tests, search), then revise until it converges. Grounded self-correction, not sycophantic self-review
user-invocable: true
---

# Reflect - Grounded Reflexion Loop

Harden an answer or solution through cycles of generate → critique → revise — but ground each critique in EXTERNAL evidence (run the tests, search the facts) rather than letting the model grade its own homework. Pure self-critique is prone to sycophancy (the model agreeing with its own errors); external grounding is where the real gains are (roughly +30 percentage points on coding tasks).

## Usage
```
/reflect [solution or claim to harden]
/reflect [rounds] [target]      (rounds default 2, max 3)
```

## When to Use

- A draft solution/answer needs hardening before you ship it
- Correctness matters AND you can actually verify it (tests, types, facts)
- One-shot output feels plausible but you're not sure it's right

## `/reflect` vs `/judge`

| | `/reflect` | `/judge` |
|---|---|---|
| Shape | Iterative: critique → fix → re-check (one actor) | Parallel: many models vote once |
| Grounding | EXTERNAL (tests, build, search) | Model opinions |
| Use when | "Harden THIS solution" | "Which approach is best?" |

## Instructions

When user invokes `/reflect [target]` (parse optional leading round count, default 2, max 3):

### Step 1: Generate the initial solution + critique frame

```
mcp__tachibot-mcp__execute_prompt_technique({
  technique: "reflexion",
  tool: "deepseek_reason",
  query: "[target]"
})
```

`deepseek_reason` is the actor (strong reasoner); fall back to `grok_reason` or `kimi_thinking` if unavailable.

### Step 2: EXTERNAL verification (the key step — never skip)

Ground the critique in OBJECTIVE evidence, not the model's self-opinion. Use whatever applies to the target:

- **Code change?** Actually run it via Bash: `npm test`, build, typecheck, lint. Capture the real output.
- **Factual claim?** `mcp__tachibot-mcp__grok_search({ query: "..." })` or `mcp__tachibot-mcp__perplexity_ask({ query: "..." })` to confirm against reality.
- **Edge cases?** Construct a concrete failing input and run it.

Collect the objective results. THESE drive the next step — not "does the model think it's good?"

### Step 3: Revise against the evidence

```
mcp__tachibot-mcp__nextThought({
  thought: "Revise the solution using EXTERNAL evidence (not self-opinion).\n\nCurrent solution: [current]\nExternal findings: [test output / search results / failing input]\n\nFix the SPECIFIC issues the evidence revealed. State exactly what changed and why.",
  model: "deepseek",
  executeModel: true,
  contextWindow: "all",
  nextThoughtNeeded: true
})
```

(Models: `deepseek`, `grok`, `kimi` — use a strong reasoner.)

### Step 4: Loop or converge

Repeat Steps 2–3 until EITHER the external checks pass (tests green / search confirms / no new failing input) OR you hit the round limit. Each round must use FRESH external evidence — if you're just re-reading the model's own opinion, stop and run a real check.

### Step 5: Final verdict

```
mcp__tachibot-mcp__nextThought({
  thought: "Final reflexion verdict for [target]:\n- What the solution is now\n- What external checks confirm it (cite the actual evidence: test output, search result)\n- Remaining risks NOT yet verified\n- Confidence (high/medium/low) + why",
  model: "gemini",
  executeModel: true,
  contextWindow: "all",
  nextThoughtNeeded: false
})
```

## Examples

- `/reflect this rate-limiter implementation` (runs the tests as the critique evidence)
- `/reflect 3 my claim that switching to BigInt fixes the overflow`
- `/reflect harden this SQL migration before I run it on prod`
