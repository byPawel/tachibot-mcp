---
name: algo
description: Algorithm analysis with parallel multi-model reasoning — qwen_algo, qwen_reason, and minimax_code tackle your problem from different angles
user-invocable: true
---

# Algo — Multi-Model Algorithm Analysis

Three specialized models attack your algorithm problem in parallel, then synthesize the best approach.

## Usage
```
/algo [problem or code]
/algo [focus] [problem or code]
```

Focus: `optimize`, `complexity`, `data-structure`, `memory`, `correctness`, `competitive`, `cache`, `general` (default)

## When to Use

- Algorithm design or optimization
- Competitive programming problems
- Complexity analysis (time/space)
- Data structure selection
- Code performance profiling
- "Is there a better approach?"

## Instructions

When user invokes `/algo [problem]`:

### Step 1: Parse Input

Extract:
- **Focus** — if specified (e.g. `/algo optimize [code]`), use it. Default: `general`
- **Problem** — the algorithm question or code
- **Constraints** — if user mentions N size, time limits, memory limits, extract them

### Step 2: Parallel Analysis (3 models)

Call ALL THREE in parallel:

**qwen_algo** — Algorithm specialist (complexity, data structures, competitive patterns):
```
mcp__tachibot-mcp__qwen_algo({
  problem: "[problem/code]",
  focus: "[focus]",
  constraints: "[constraints if any]",
  context: "[any additional context]"
})
```

**qwen_reason** — Mathematical reasoning (proofs, correctness, edge cases):
```
mcp__tachibot-mcp__qwen_reason({
  problem: "Analyze this algorithm problem mathematically:\n\n[problem/code]\n\nFocus on:\n1. Correctness proof or counterexample\n2. Edge cases that break the solution\n3. Tight bound analysis (best/worst/average)\n4. Mathematical invariants",
  approach: "mathematical"
})
```

**minimax_code** — Implementation review (SWE-Bench 80.2%, cheap second opinion):
```
mcp__tachibot-mcp__minimax_code({
  task: "[optimize if code given, generate if problem only]",
  code: "[code if provided]",
  language: "[language if detectable]",
  requirements: "[problem description + focus]"
})
```

If any tool is unavailable, proceed with the remaining ones. Minimum: any 1 model.

### Step 3: Synthesize

Compare all three responses. Look for:
- **Agreement** — all 3 suggest the same approach? High confidence.
- **Conflict** — different approaches? Compare complexity bounds, pick the one with tighter guarantees.
- **Unique insights** — did one model catch something the others missed?

### Step 4: Present Results

Format:

```markdown
## Algorithm Analysis: [problem summary]

### Recommended Approach
**Algorithm:** [name/type]
**Time:** O([complexity])
**Space:** O([complexity])
**Why:** [1-2 sentences]

### Analysis Breakdown

#### Algorithmic Analysis (Qwen Algo)
[Key findings — complexity, data structure choice, optimization tiers]

#### Mathematical Reasoning (Qwen Reason)
[Correctness, edge cases, tight bounds, invariants]

#### Implementation (MiniMax)
[Code suggestions, practical optimizations, SWE perspective]

### Consensus
[What all models agreed on]

### Key Insight
[The most valuable finding — often from just one model]

### Edge Cases to Watch
1. [edge case 1]
2. [edge case 2]

### Alternative Approaches
| Approach | Time | Space | Trade-off |
|----------|------|-------|-----------|
| [Current] | O(...) | O(...) | [balanced] |
| [Alternative 1] | O(...) | O(...) | [faster but more memory] |
| [Alternative 2] | O(...) | O(...) | [simpler but slower] |
```

## Examples
- `/algo implement LRU cache with O(1) operations`
- `/algo optimize this sorting function: [paste code]`
- `/algo competitive find longest palindromic subsequence, N<=5000`
- `/algo complexity what's the tight bound for this recursive function`
- `/algo data-structure best structure for range queries with updates`
