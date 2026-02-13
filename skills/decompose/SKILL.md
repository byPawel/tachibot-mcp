---
name: decompose
description: Decompose problems into sub-problems, then deep-dive each one with sequential multi-model reasoning
user-invocable: true
---

# Decompose - Split & Deep-Dive

Break a problem into sub-problems, then analyze each one in depth using sequential reasoning chains. Unlike `/breakdown` (strategic overview), `/decompose` gives you deep understanding of every piece.

## Usage
```
/decompose [problem]
/decompose [depth] [problem]
```

Depth: 1-5 (default 3). Higher = more granular sub-problems.

## When to Use

- When you need to UNDERSTAND each part, not just list them
- Before implementing something you don't fully grasp
- When sub-problems might have hidden complexity
- When you need to find where the real difficulty lives

## `/decompose` vs `/breakdown`

| | `/breakdown` | `/decompose` |
|---|---|---|
| Strategy | Breadth-first: overview pipeline | Depth-first: split then drill each |
| Steps | first_principles -> decompose -> patterns -> feasibility | decompose -> deep-dive each -> synthesize |
| Output | Go/no-go assessment | Deep understanding per piece |
| Cost | 4 API calls | 1 + (N sub-problems x 2) calls |
| When | "Should we do this?" | "How does each part actually work?" |

## Instructions

When user invokes `/decompose [problem]`:

### Step 1: Decompose into Sub-Problems

Parse optional depth (default 3). Call:

```
mcp__tachibot-mcp__kimi_decompose({
  task: "[problem]",
  depth: [depth],
  outputFormat: "dependencies",
  context: "Break into distinct sub-problems. Each should be independently analyzable."
})
```

If `kimi_decompose` is unavailable, fall back to:
```
mcp__tachibot-mcp__nextThought({
  thought: "Decompose this problem into 3-7 distinct sub-problems with dependencies:\n\n[problem]\n\nFor each sub-problem provide: ID, name, description, depends_on, estimated complexity (low/medium/high)",
  model: "gemini",
  executeModel: true,
  contextWindow: "none",
  nextThoughtNeeded: true
})
```

**Present** the sub-problem tree to the user before diving in:

```
Found [N] sub-problems:
1. [Sub-problem A] (complexity: medium)
2. [Sub-problem B] -> depends on A (complexity: high)
3. [Sub-problem C] (complexity: low)
...

Diving into each one...
```

### Step 2: Deep-Dive Each Sub-Problem (Sequential)

For EACH sub-problem (in dependency order), run a 2-step nextThought chain:

**Analysis step** (fresh context per sub-problem):
```
mcp__tachibot-mcp__nextThought({
  thought: "Deep-dive analysis of sub-problem: [sub-problem name]\n\nDescription: [sub-problem description]\n\nFull problem context: [original problem]\n\nAnalyze:\n1. What exactly needs to happen here?\n2. What are the edge cases?\n3. What could go wrong?\n4. What are the key decisions to make?\n5. What patterns or prior art exist?",
  model: "grok",
  executeModel: true,
  contextWindow: "none",
  nextThoughtNeeded: true
})
```

Model selection for analysis - use FIRST available:
1. `grok` - strong first-principles reasoning
2. `gemini` - broad analytical capability
3. `openai` - structured analysis
4. `kimi` - step-by-step depth

**Synthesis step** (sees the analysis):
```
mcp__tachibot-mcp__nextThought({
  thought: "Synthesize the deep-dive on: [sub-problem name]\n\nDistill to:\n- Core insight (1 sentence)\n- Key decisions needed\n- Risks identified\n- Recommended approach\n- Estimated effort: trivial / small / medium / large",
  model: "gemini",
  executeModel: true,
  contextWindow: "recent",
  nextThoughtNeeded: true
})
```

Model selection for synthesis - use a DIFFERENT model than analysis. Priority:
1. `gemini` - great at synthesis
2. `openai` - structured output
3. `kimi` - thorough summarization

### Step 3: Final Synthesis

After all sub-problems are analyzed, one final thought connecting everything:

```
mcp__tachibot-mcp__nextThought({
  thought: "Final synthesis of all [N] deep-dives:\n\n[List each sub-problem + its core insight]\n\nSynthesize:\n1. Where does the REAL complexity live? (which sub-problems are hardest)\n2. What connections exist between sub-problems that weren't obvious?\n3. What's the critical path?\n4. What should be tackled first and why?\n5. Are there sub-problems that could be eliminated or simplified?",
  model: "gemini",
  executeModel: true,
  contextWindow: "all",
  nextThoughtNeeded: false
})
```

### Step 4: Present Results

Format:

```markdown
## Decomposition: [problem]

### Sub-Problems ([N] found)

#### 1. [Sub-problem A] - [complexity]
**Insight:** [1 sentence core finding]
**Key decisions:** [what needs deciding]
**Risks:** [what could go wrong]
**Approach:** [recommended path]
**Effort:** [trivial/small/medium/large]

#### 2. [Sub-problem B] - [complexity]
...

### Where the Real Complexity Lives
[Which sub-problems are hardest and why]

### Hidden Connections
[Dependencies and interactions not obvious from the surface]

### Critical Path
1. [First] - [why first]
2. [Second] - [why second]
...

### Simplification Opportunities
[Sub-problems that could be eliminated or combined]
```

## Examples

- `/decompose implement a real-time collaborative editor`
- `/decompose 4 migrate monolith to microservices`
- `/decompose why is our CI pipeline taking 45 minutes`
- `/decompose design an API rate limiter that handles burst traffic`
