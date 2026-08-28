---
name: council
description: Deep multi-model council with research, adversarial debate, sequential reasoning, and final synthesis. For architecture decisions and complex tradeoffs.
user-invocable: true
---

# Council — Deep Multi-Model Deliberation

4-phase deep pipeline: research → adversarial debate → sequential reasoning → final resolution. For decisions that deserve thorough analysis.

## Usage
```
/council [architecture question or complex tradeoff]
```

## When to Use
- Architecture decisions (microservices vs monolith, storage strategy, async patterns)
- Complex tradeoffs with multiple valid approaches
- Decisions that affect the codebase for months/years
- When `/judge` confidence was Medium/Low and you need deeper analysis

## When NOT to Use
- Quick A-vs-B → use `/jury` instead
- Questions needing search grounding → use `/judge` instead
- Time-sensitive decisions → this takes 2-5 minutes

## Tier Context
- **Quick**: `/jury` — single-call, <15s
- **Standard**: `/judge` — search + analysis + judging, 30-60s
- **This**: `/council` — deep research + debate + reasoning, 2-5min

---

## Instructions

When user invokes `/council [query]`:

### Step 0: Set Expectations

Tell the user:
> "Running deep council deliberation. This will take 2-5 minutes across 4 phases: Research → Debate → Reasoning → Resolution. I'll show a checkpoint after each phase."

### Step 1: Research (decomposed, parallel)

Do NOT fire one broad search. Decompose the query into 3 angles first, then search each
in parallel — a single query returns one framing of the problem, three return the
tensions between framings, which is what Phase 2 debates.

Decompose into:
1. **Mechanism** — how does the approach actually work, what does it require?
2. **Tradeoffs/risks** — what breaks, at what scale, and what does it cost?
3. **Evidence** — who has run this in production, and what happened?

Run these in PARALLEL (one message, multiple tool calls). Split across both providers so
a single provider's quota limit cannot take out the whole research phase:
```
mcp__tachibot-mcp__grok_search({ query: "[angle 1 — mechanism]", recency: "month" })
mcp__tachibot-mcp__perplexity_ask({ query: "[angle 2 — tradeoffs/risks]", searchRecency: "month" })
mcp__tachibot-mcp__grok_search({ query: "[angle 3 — production evidence]", recency: "year" })
```

For a question needing analysis rather than facts, swap one call for
`mcp__tachibot-mcp__perplexity_reason({ query: "..." })`.

**NOTE:** `perplexity_research` does NOT exist — it is unregistered dead code in
`src/tools/perplexity-tools.ts:159` and absent from every profile, including `full`.
Calling it fails 100% of the time. The parallel searches above are the primary path.

**If a search returns an error string** (`[Grok error: ...]`, `[Perplexity error: ...]`),
treat that angle as missing, not as a finding — the providers return errors as text
rather than throwing.

**If all three fail:** Proceed with user-provided context only. Note explicitly:
"Research phase skipped — proceeding with provided context, confidence capped at Medium."

**Checkpoint 1 — show the user:**
```
### Phase 1: Research Complete
**Sources**: [count] sources analyzed
**Key findings**:
- [Finding 1]
- [Finding 2]
- [Finding 3]
**Open questions for debate**: [list 2-3 tensions or tradeoffs found]
```

### Step 1.5: Gather Code Context (if applicable)

If the query involves specific code, files, or codebase components:
1. Read the relevant source files
2. Collect file paths (with optional line ranges like `src/foo.ts:100-200`)
3. Pass these as the `files` parameter on reasoning tools — models see **actual code from disk**, not Claude's summary

### Step 2: Adversarial Debate (focus tool)

```
mcp__tachibot-mcp__focus({
  query: "[query]\n\nResearch context:\n[Phase 1 results summary]\n\nDebate the tradeoffs. Challenge assumptions. Find flaws in the obvious approach.",
  mode: "architecture-debate",
  pingPongStyle: "competitive",
  rounds: 3,
  domain: "architecture",
  models: ["grok", "kimi", "openai"],
  executeNow: true,
  saveSession: true
})
```

**If focus times out:**
Fall back to parallel individual reasoning calls:
```
mcp__tachibot-mcp__grok_reason({
  problem: "[query] — Argue FOR the proposed approach. What are the strongest reasons?",
  approach: "first-principles",
  context: "[Phase 1 results]",
  files: ["path/to/relevant/file.ts"]  // when code involved
})
```
```
mcp__tachibot-mcp__kimi_thinking({
  problem: "[query] — Argue AGAINST. What are the risks, edge cases, and failure modes?",
  approach: "step-by-step",
  context: "[Phase 1 results]",
  maxSteps: 5
})
```
```
mcp__tachibot-mcp__openai_reason({
  query: "[query] — Synthesize both sides. What's the pragmatic middle ground?",
  mode: "analytical",
  context: "[Phase 1 results]"
})
```

**Checkpoint 2 — show the user:**
```
### Phase 2: Debate Complete
**Rounds**: [3 or fallback mode]
**Proposer** (strongest arguments FOR):
- [Argument 1]
- [Argument 2]
**Critic** (strongest arguments AGAINST):
- [Counter 1]
- [Counter 2]
**Key tension**: [the core tradeoff that needs resolution]
```

### Step 3: Sequential Reasoning (nextThought chain)

Run a 3-5 step nextThought chain to build toward a resolution:

**Thought 1: Frame the decision**
```
mcp__tachibot-mcp__nextThought({
  thought: "DECISION FRAMEWORK for: [query]\n\nResearch found: [key findings]\nDebate revealed: [key tensions]\n\nStep 1a: ENUMERATE the candidate options — include any the debate surfaced that the original question did not name, plus the do-nothing option.\nStep 1b: Name the decision criteria (performance, cost, complexity, maintainability, team capability) and WEIGHT them for this specific situation. Unweighted criteria let every option tie.",
  model: "grok",
  executeModel: true,
  nextThoughtNeeded: true,
  objective: "[query] — architecture decision",
  thoughtNumber: 1,
  totalThoughts: 4
})
```

**Thought 2: Evaluate options against criteria**
```
mcp__tachibot-mcp__nextThought({
  thought: "Step 2: Score each option against the criteria from Step 1. Use the research evidence and debate arguments.",
  model: "kimi",
  executeModel: true,
  contextWindow: "all",
  nextThoughtNeeded: true,
  objective: "[query] — architecture decision",
  thoughtNumber: 2,
  totalThoughts: 4
})
```

**Thought 3: Risk analysis**
```
mcp__tachibot-mcp__nextThought({
  thought: "Step 3: For the leading option(s), what are the top 3 risks? How can each be mitigated? What's the cost of being wrong?",
  model: "openai",
  executeModel: true,
  contextWindow: "all",
  nextThoughtNeeded: true,
  objective: "[query] — architecture decision",
  thoughtNumber: 3,
  totalThoughts: 4
})
```

**Thought 4: Final verdict (with Gemini as judge)**
```
mcp__tachibot-mcp__nextThought({
  thought: "Step 4: Deliver the final recommendation. State: recommended approach, key reasons, implementation sequence, risks accepted, and confidence level.",
  model: "gemini",
  executeModel: true,
  contextWindow: "all",
  finalJudge: "gemini",
  nextThoughtNeeded: false,
  objective: "[query] — architecture decision",
  thoughtNumber: 4,
  totalThoughts: 4,
  memoryProvider: { provider: "devlog", saveToMemory: true }
})
```

**If any nextThought step times out:** Skip that step and continue the chain. The finalJudge step (Thought 4) is critical — if Gemini times out there, fall back:
```
mcp__tachibot-mcp__openai_reason({
  query: "[compile all prior thoughts into a final verdict request]",
  mode: "analytical",
  context: "[all prior nextThought outputs]"
})
```

**Checkpoint 3 — show the user:**
```
### Phase 3: Reasoning Complete
**Chain**: [N] thoughts across [models used]
**Decision criteria identified**: [list]
**Leading option**: [the frontrunner with score]
**Top risk**: [biggest concern and its mitigation]
```

### Step 4: Final Resolution (gemini_judge)

```
mcp__tachibot-mcp__gemini_judge({
  question: "[original query]",
  perspectives: "COUNCIL RESOLUTION\n\n## Research (Phase 1)\n[summary]\n\n## Debate (Phase 2)\n[pro vs con summary]\n\n## Reasoning Chain (Phase 3)\n[criteria, scores, risks]\n\n## Resolution Task\n1. Deliver a definitive recommendation\n2. Explain WHY this option wins (not just that it scores higher)\n3. List concrete implementation steps (first 3 actions)\n4. State what would change your recommendation\n5. Confidence: High/Medium/Low with justification",
  mode: "resolve"
})
```

**If gemini_judge times out:**
```
mcp__tachibot-mcp__openai_reason({
  query: "[same resolution prompt]",
  mode: "analytical",
  context: "[all prior phase outputs]"
})
```

**If openai also fails:** Synthesize the resolution yourself using Phase 3 outputs. Label as "Claude synthesis (external resolvers timed out)."

### Step 5: Present Final Results

```
## Council Decision

**Pipeline**: Research → Debate (3 rounds) → Reasoning Chain → Resolution
**Models**: [all models that contributed]
**Duration**: [approximate time]
**Fallbacks used**: [none / list]

### Recommendation
[Clear, decisive recommendation in 2-3 sentences]

### Why This Wins
[The core reasoning — not just scores, but the insight]

### Implementation Steps
1. [First concrete action]
2. [Second action]
3. [Third action]

### Debate Summary
**For**: [strongest pro arguments]
**Against**: [strongest con arguments]
**Resolution**: [how the tension was resolved]

### Risk Register
| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| [Risk 1] | [H/M/L] | [H/M/L] | [How to handle] |

### What Would Change This Decision
- [Condition 1 that would flip the recommendation]
- [Condition 2]

### Confidence
[High/Medium/Low] — [based on research quality + expert agreement + risk profile]

---
Quick check: `/jury`. Standard analysis: `/judge`.
```

### Step 6: Auto-Save to Devlog

**Always save council sessions** (they represent significant deliberation):

Write to `devlog/sessions/YYYY-MM-DD-HHhmm-council-[topic-slug].md` with:
- Original query
- Research summary
- Debate highlights (pro/con)
- Reasoning chain outputs
- Final recommendation
- Models used and fallbacks triggered
- Confidence level

Tell the user: "Council verdict saved to devlog/sessions/[filename]"

---

## Model Assignments

### Research Phase
| Tool | Role | Fallback |
|------|------|----------|
| `grok_search` ×2 + `perplexity_ask` (parallel, one angle each) | Decomposed research | Drop failed angles, cap confidence at Medium |

### Debate Phase
| Tool | Role | Fallback |
|------|------|----------|
| `focus` (architecture-debate, competitive, 3 rounds) | Adversarial debate | Parallel: grok_reason + kimi_thinking + openai_reason |

### Reasoning Phase
| Tool | Steps | Fallback |
|------|-------|----------|
| `nextThought` chain | 3-4 steps (grok → kimi → openai → gemini) | Skip timed-out steps |

### Resolution Phase
| Tool | Role | Fallback |
|------|------|----------|
| `gemini_judge` (resolve mode) | Final resolution | openai_reason → Claude synthesis |

---

## Examples

- `/council` microservices vs monolith for our 10M-user platform
- `/council` should we migrate from Entity Storage to KV Storage?
- `/council` React Server Components vs current SPA for our Forge app
- `/council` event sourcing vs CRUD for the bulk operations pipeline
