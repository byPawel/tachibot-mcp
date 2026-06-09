---
name: lens
description: Long-context analysis — examine a large document or codebase under a focused lens using active retrieval over Kimi's 256K window, surfacing insights, relations, and inconsistencies
user-invocable: true
---

# Lens - Long-Context Analysis

Deeply analyze a large document, codebase, or transcript that's too big to reason about by skimming. Uses ACTIVE RETRIEVAL (map → query → synthesize) over Kimi K2.6's 256K window instead of dumping everything in at once — which avoids the "lost in the middle" failure mode of naive long-context prompting.

## Usage
```
/lens [target + what you want to know]
/lens [files...] [question]
```

## When to Use

- A document/codebase/log is too large to hold in your head
- You need specific insights, not a generic summary
- You suspect inconsistencies or hidden relationships across sections
- Naive "read it all" would blow context or miss the middle

## `/lens` vs alternatives

| | `/lens` | `/decompose` | `gemini_analyze_text` |
|---|---|---|---|
| Input | Large existing content (≤256K) | A problem to split | A single argument/text |
| Strategy | Map → query sections → synthesize | Split into sub-problems | Rhetoric/bias dissection |
| Use when | "Understand this big thing" | "Break this problem down" | "Analyze this claim" |

## Instructions

When user invokes `/lens [target]`:

### Step 1: Map the structure first (don't dump)

Identify the target (file paths or pasted content). Get a structural map BEFORE deep analysis:

```
mcp__tachibot-mcp__kimi_long_context({
  content: "[paste content here, OR a one-line note if using files below]",
  files: ["path/to/file1", "path/to/dir/**"],
  task: "summarize",
  outputFormat: "structured",
  query: "Map the structure: list the major sections/modules/themes and what each covers. Do NOT analyze yet — just produce the table of contents."
})
```

**Present** the map to the user: "Found [N] sections: ... Diving into the relevant ones."

### Step 2: Targeted analysis (active retrieval)

For the user's actual question, query specific aspects rather than re-reading everything:

```
mcp__tachibot-mcp__kimi_long_context({
  content: "[content]",
  files: ["..."],
  task: "analyze",
  outputFormat: "detailed",
  query: "[the user's specific question, scoped to the relevant sections found in Step 1]"
})
```

Use `task: "extract"` to pull specific facts, `"find"` to locate something, `"compare"` to contrast sections.

### Step 3: Cross-check for inconsistencies (if the content makes claims)

If the content argues or claims things, get an independent second read on the key parts:

```
mcp__tachibot-mcp__gemini_analyze_text({
  text: "[the key claims/sections surfaced in Step 2]",
  type: "key-points"
})
```

### Step 4: Synthesize

```
mcp__tachibot-mcp__nextThought({
  thought: "Synthesize the long-context analysis of [target].\n\nFindings:\n[Step 2 + Step 3 results]\n\nProduce:\n1. Direct answer to the user's question\n2. Key insights (ranked)\n3. Relations/dependencies across sections\n4. Inconsistencies or gaps found\n5. What to look at next",
  model: "gemini",
  executeModel: true,
  contextWindow: "all",
  nextThoughtNeeded: false
})
```

If `kimi_long_context` is unavailable, fall back to `gemini_analyze_text` (1M context) using the `files` parameter for the analysis steps.

### Step 5: Present Results

```markdown
## Lens: [target]

### Answer
[Direct answer to the question]

### Key Insights
1. [ranked insight]
...

### Relations / Dependencies
[How sections connect — what depends on what]

### Inconsistencies & Gaps
[Contradictions or missing pieces found]

### Look At Next
[Where to dig further]
```

## Examples

- `/lens src/**/*.ts how does auth flow through this codebase?`
- `/lens [paste 80-page spec] what contradictions exist between sections 3 and 7?`
- `/lens server.log find the root-cause chain for the 02:14 outage`
- `/lens compare these two RFCs and tell me where they disagree`
