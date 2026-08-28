---
name: jury
description: Quick multi-model jury — parallel jurors + Gemini synthesis in one call. Default entry point for judgment tasks.
user-invocable: true
---

# Jury — Quick Multi-Model Verdict

Single-call multi-model jury for fast decisions. Uses the `jury` MCP tool which runs jurors in parallel, then Gemini synthesizes.

## Usage
```
/jury [question or comparison]
/jury --mode rank [options to rank]
/jury --mode resolve [conflict to settle]
```

## When to Use
- A-vs-B comparisons, quick opinions, design choices
- Validating an approach before implementing
- Any question where speed matters more than deep research
- **This is the DEFAULT tier** — use this first, escalate to `/judge` or `/council` only when needed

## When to Escalate
- Use `/judge` when you need **search grounding** (facts, citations, current data)
- Use `/council` when you need **deep debate** (architecture decisions, complex tradeoffs)

---

## Instructions

When user invokes `/jury [query]`:

### Step 1: Determine Mode

Check the query for mode hints:
- **Ranking** ("rank these", "order by", "best to worst") → `mode: "rank"`
- **Conflict** ("disagree about", "settle this", "A says X but B says Y") → `mode: "resolve"`
- **Scoring** ("evaluate", "score", "rate") → `mode: "evaluate"`
- **Default** (everything else) → `mode: "synthesize"`

If user explicitly passes `--mode`, use that mode.

### Step 1.5: Gather Code Context (if applicable)

If the query involves specific code, files, or codebase components:
1. Read the relevant source files
2. Pass file paths to tools that support the `files` parameter
3. This ensures models see **actual code**, not Claude's summary

### Step 2: Call jury() Tool

```
mcp__tachibot-mcp__jury({
  question: "[user's query with full context]",
  mode: "[detected mode]",
  context: "[any additional context from conversation]"
})
```

**Omit `jurors` unless you have a reason to override.** The tool default is
`grok,deepseek,kimi,openai` — chosen for LAB diversity (xAI / DeepSeek / Moonshot /
OpenAI). Diversity of weights is what makes a jury beat a single judge; four jurors from
two labs are closer to two votes than four.

**Juror lineup:** grok (first principles), deepseek (frontier reasoning/math),
kimi (long-horizon agentic reasoning), openai (structured analysis).

**For algorithm/correctness questions**, `deepseek` is already the strongest juror in the
default set — no override needed. For implementation and code-quality questions, swap one
juror rather than adding a fifth:
```
jurors: "grok,deepseek,qwen,openai"    // qwen = qwen3-coder-next, code specialist
```

**The judge sees the jurors anonymized** (JUROR A/B/C with their lens, not their vendor)
so it weighs reasoning rather than brand. The name→letter mapping is printed back to you
in the JURY PANEL header, along with any juror that was dropped for a provider error.

### Step 3: Handle Failures

**Partial panels need no action.** The tool now detects jurors that returned a provider
error string (`[Grok error: ...]`, `[OpenRouter timeout: ...]`) and drops them before
synthesis, tells the judge how many are missing so it does not over-claim consensus, and
reports `JURY PANEL (2/4 responded)` in the header. Read that ratio — a 2/4 verdict
deserves less weight than a 4/4 one, and you should say so when presenting.

**If jury() returns `[Jury failed: all N jurors errored...]` or times out:**
1. Tell the user: "Jury tool failed. Running manual jury with individual model calls."
2. Call these in PARALLEL as fallback:
   ```
   mcp__tachibot-mcp__grok_reason({ problem: "[query]", approach: "first-principles", context: "[conversation context]", files: ["relevant/file.ts:1-100"] })
   mcp__tachibot-mcp__kimi_thinking({ problem: "[query]", approach: "step-by-step", context: "[conversation context]", files: ["relevant/file.ts:1-100"] })
   mcp__tachibot-mcp__openai_reason({ query: "[query]", mode: "analytical", context: "[conversation context]" })
   ```
3. Synthesize the three responses yourself (Claude acts as synthesis engine)

**If individual fallback calls also fail:**
- Use whichever responses you got (even 1 of 3 is better than nothing)
- Label the output as "partial jury" and recommend `/judge` for higher confidence

### Step 4: Present Results

Format the output as:

```
## Jury Verdict

**[Mode]**: [synthesize/evaluate/rank/resolve]
**Jurors**: [list the actual jurors used] + Gemini synthesis

### Verdict
[1-2 sentence clear answer]

### Key Points
- [Consensus point 1]
- [Consensus point 2]
- [Any dissent or minority view]

### Confidence
[High/Medium/Low] — [brief justification]

---
Need deeper analysis? Use `/judge` (with search) or `/council` (architecture debate)
```

### Step 5: Check for Escalation Need

After presenting results, assess if escalation is warranted:

**Auto-recommend /judge if:**
- The verdict mentions needing "more research" or "current data"
- Confidence is Low
- The question involves facts that could be verified with search

**Auto-recommend /council if:**
- The question involves architecture, system design, or multi-constraint tradeoffs
- Multiple valid approaches exist with non-obvious tradeoffs

Do NOT auto-escalate. Just recommend. User decides.

---

## Examples

- `/jury` should we use RTK Query or raw thunks for this endpoint?
- `/jury --mode rank` React state libs: Redux, Zustand, Jotai, Recoil
- `/jury --mode resolve` team disagrees on monorepo vs polyrepo
- `/jury` is this SQL query safe from injection?
