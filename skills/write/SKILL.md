---
name: write
description: Use when writing a blog post, article, doc, or report that must be fact-grounded and not generic — live research feeds blog_writer, then separate verify (claims vs retrieved passages) and de-generic (voice) gates. Fail-closed with a claim ledger.
user-invocable: true
---

# Write — Grounded Long-Form With Acceptance Gates

One draft call, two non-rewriting gates. The skill grounds `blog_writer` with live search it doesn't have, then certifies the result: every material claim mapped to a retrieved passage that entails it, every generic section flagged and patched. Fails closed with an audit trail instead of shipping fluent fiction.

## Usage
```
/write [topic]
/write [topic] words:1200 audience:"backend engineers"
/write [topic] --jury      # add a multi-model rubric score before ship (advisory)
/write [topic] --quick     # single blog_writer call, no gates — output labeled UNVERIFIED
```

## When to Use
- Blog posts, articles, docs, reports where facts must hold and prose must earn its reader
- Anything published under your own name

## When NOT to Use
- Quick internal draft → call `blog_writer` directly (or `--quick`)
- Pure opinion/fiction with no factual claims → `execute_prompt_technique` with `re3` alone
- Editing an existing draft → run only Steps 3–5 on the provided text (skip ground + draft)

## Why this shape (council-decided 2026-08-28)

`blog_writer` runs on Kimi K3 with **no live search**: its STORM stage simulates persona
interviews from parametric memory, and audits of STORM-style pipelines find ~15% of
sentences unsupported by their own citations. This skill closes that gap — strictly
AROUND the tool, never inside it:

- `blog_writer` is called **exactly once**; STORM/Re3 internals are never re-orchestrated
- verify-facts and sharpen-voice are **separate, ordered passes** — combined "improve
  this" passes over-smooth and erase voice
- gates do not rewrite; repairs are targeted, bounded to **one repair loop**, fail closed
- the raw draft is an **immutable checkpoint** — every later stage writes a new file
- no mandatory jury: correlated model consensus is advisory, the gates certify

---

## Instructions

When user invokes `/write [topic]`:

### Step 0: Angle Contract (no tools)

Parse: topic (required), `words:N`, `audience:"..."`, `--jury`, `--quick`.

`--quick` path: call `blog_writer({ topic, wordCount, audience })`, save to
`writing-output/<slug>/final.md` with an `> UNVERIFIED — /write --quick, no gates ran`
banner at the top, and stop.

Otherwise write the **angle contract** — the thing every later gate protects:
- **Thesis** — one arguable sentence (not a topic restatement)
- **Central tension** — what genuinely pulls against the thesis
- **Must-keep moves** — 2–3 specific claims, examples, or turns that make the piece worth reading
- **Must-cover facts** — anything the user explicitly supplied

Show the contract to the user in ≤6 lines and proceed immediately (don't block for
approval — they can interrupt). Only if the topic could produce two entirely different
articles, ask ONE clarifying question first.

`<slug>` = kebab-cased topic (≤6 words). All output goes to `writing-output/<slug>/`.

### Step 1: Ground (parallel — one message, both calls)

Queries derive from the **thesis and tension**, not the bare topic:

```
mcp__tachibot-mcp__grok_search({ query: "[recent developments / discourse / counter-evidence around the tension]", recency: "month" })
mcp__tachibot-mcp__perplexity_ask({ query: "[facts, numbers, dates, named sources bearing on the thesis]", searchRecency: "year" })
```

Build the **source pack**: 5–15 entries, each `fact — URL — date`. Discard anything
undated or unattributed. Save as `sources.md`.

**Gate G0**: ≥3 independent sources (not one vendor's narrative). If a search returns an
error string (`[Grok error: ...]` / `[Perplexity error: ...]`), treat that angle as
missing. If BOTH fail: proceed to draft, skip Step 3 (nothing to entail against), and put
an `> UNGROUNDED — live search unavailable, claims unverified` banner on `final.md`.
Never degrade silently.

### Step 2: Draft (`blog_writer`, exactly once)

The `topic` parameter is the only free-text channel — compose the brief into it:

```
mcp__tachibot-mcp__blog_writer({
  topic: "[subject].\n\nANGLE CONTRACT (binding): thesis: [...]. central tension: [...]. must-keep moves: [...].\n\nSOURCE PACK — the only permitted factual basis. Build on these; mark any factual claim beyond them with [UNSOURCED]:\n- [fact — URL — date]\n- [...]",
  wordCount: [words if given],
  research: true,
  audience: "[audience if given]"
})
```

Write the result to `writing-output/<slug>/draft.md` **immediately** — this is the
immutable rollback checkpoint; it is never edited in place.

If `blog_writer` errors: **stop and report**. It is the core dependency — there is no
degraded drafting path.

### Step 3: Gate G1 — Verify (facts only; voice untouched)

1. With fresh eyes, extract the draft's **material claims**: numbers, dates, named
   entities, causal and superlative assertions, plus anything marked `[UNSOURCED]`.
   Opinions and analysis are not claims. Number them into a ledger.
2. **Disprove-oriented** re-check, batched — 2–4 search calls TOTAL, claims clustered
   by subject:

```
mcp__tachibot-mcp__perplexity_ask({ query: "Verify or refute, with sources: (1) [claim] (2) [claim] (3) [claim]. For each: TRUE / FALSE / OUTDATED, and QUOTE the specific passage that shows it." })
```

   Fast-moving/recent claims → `grok_search` instead.
3. **Entailment rule**: a claim is SUPPORTED only if a retrieved passage entails it —
   quote that passage into the ledger. A bare URL, or "sources agree", is NOT support.
4. **Entailment check (Jev)** — one call, one named `noul` question per claim, so the
   entailment rule is scored by a calibrated model instead of eyeballed (~$0.00002/call):

```
mcp__tachibot-mcp__jev_decide({
  state: {
    c1: { claim: "[claim 1]", passage: "[quoted passage for claim 1]" },
    c2: { claim: "[claim 2]", passage: "[quoted passage for claim 2]" }
  },
  questions: {
    c1: { type: "noul", instructions: "Does c1.passage entail c1.claim — every number, date and name in the claim stated or directly implied by the passage?" },
    c2: { type: "noul", instructions: "Does c2.passage entail c2.claim — every number, date and name in the claim stated or directly implied by the passage?" }
  }
})
```

   Read `answers.cN.noul`. Claims with no quoted passage skip Jev (they are WEAK at best).
   Batch ≤ 15 claims per call.
5. Status each claim: `SUPPORTED` (passage quoted AND Jev ≥ 0.7) / `WEAK` (plausible,
   no entailing passage, or Jev 0.3–0.7) / `CONTRADICTED` (search says FALSE/OUTDATED,
   or Jev < 0.3 on a passage that addresses the same fact). Record the Jev value in the
   ledger. If Jev errors, fall back to the manual entailment rule and note it.
6. Repairs — minimal, fact-only edits: CONTRADICTED → correct from the passage or cut
   the sentence. WEAK → hedge explicitly ("reportedly", "as of [date]") or cut.
   Surrounding prose style is not touched in this pass.

Save the ledger as `claims.md` (`# | claim | status | jev | quoted passage | URL`).
**G1 passes when zero CONTRADICTED remain.**

### Step 4: Gate G2 — Sharpen (voice only; facts frozen)

Fresh context, and a **different model family than the drafter** (Kimi drafted, so Grok
critiques — decorrelates the edits):

```
mcp__tachibot-mcp__execute_prompt_technique({
  technique: "de_generic",
  tool: "grok_reason",
  query: "[the full verified draft text]"
})
```

Fallback tool: `gemini_analyze_text`. If both fail, skip G2 and note it in `revisions.md`.

The critique flags sections and gives directives. Apply **targeted patches to flagged
sections only** — every unflagged sentence stays byte-identical.

**Hard constraint**: this pass may not introduce any new number, date, name, or causal
claim. Diff each patch; if a new fact appears, drop that edit — sharpening must not
invent.

**G2 passes when**: no section could be published unchanged by a competitor, AND the
angle contract survived — thesis in the lead, tension actually developed, must-keep
moves intact.

### Step 5: Ship (fail closed)

- **One repair loop total** across G1+G2. If a gate still fails after its repair: stop
  polishing, ship the best draft with an explicit `## Open issues` section listing
  exactly what failed and why.
- If `--jury`:

```
mcp__tachibot-mcp__jury({
  question: "Score this piece 1-10 on each: accuracy, originality, specificity, structure. One sentence of justification per score, then the single weakest paragraph.",
  context: "[final text]"
})
```

  Advisory only — report the scores, never loop on them.

Final artifacts in `writing-output/<slug>/`:

| File | Contents |
|------|----------|
| `draft.md` | immutable `blog_writer` output |
| `final.md` | shipped piece (+ Open issues / UNGROUNDED banner when applicable) |
| `claims.md` | claim ledger: claim, status, quoted passage, URL |
| `sources.md` | source pack: fact, URL, date |
| `revisions.md` | per pass: gate, what changed, why |

Report to the user: thesis, gate results (G0/G1/G2 with claim counts), open issues if
any, and the file paths.

---

## Fallbacks

| Failure | Action |
|---------|--------|
| Both Step 1 searches error | Draft anyway; skip G1; UNGROUNDED banner on final.md |
| `blog_writer` errors | Stop and report — no degraded drafting path |
| `de_generic` tool errors | Retry with `gemini_analyze_text`; then skip G2 with a note |
| `jev_decide` errors | Manual entailment rule only; note "Jev unavailable" in `revisions.md` |
| `jury` errors (`--jury`) | Note and ship — it was advisory |

## Model roles

| Stage | Tool | Why |
|-------|------|-----|
| Ground | `grok_search` + `perplexity_ask` | the live facts blog_writer cannot fetch |
| Draft | `blog_writer` (Kimi K3) | STORM+Re3 stay internal, called once |
| Verify | `perplexity_ask` / `grok_search` | disprove-oriented, passage retrieval |
| Entailment | `jev_decide` (noul per claim) | calibrated claim→passage score, near-free |
| Sharpen | `grok_reason` via `de_generic` | different lab than drafter — decorrelated critique |
| Score (opt-in) | `jury` | advisory; the gates certify, consensus doesn't |

## Examples

- `/write why MCP servers should ship acceptance gates, not more tools`
- `/write words:1500 audience:"CTOs" the real cost of multi-model orchestration`
- `/write --jury our v2.33 release announcement`
- `/write --quick internal changelog summary for the writing family`
