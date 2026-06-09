---
name: tot
description: Tree-of-Thought reasoning — branch a problem into multiple solution paths, explore each, score and prune branches via a model jury, then synthesize the best. Non-linear reasoning that can backtrack
user-invocable: true
---

# ToT - Tree-of-Thought

Explore a problem as a TREE of solution paths instead of one linear chain. Branch into distinct approaches, develop each, score them, prune the weak ones, and merge the best elements. Unlike linear chain-of-thought (`/think`), ToT can backtrack and recombine — which wins on problems with multiple viable strategies or where the first idea is often a trap.

## Usage
```
/tot [problem]
/tot [branches] [problem]      (branches default 3)
```

## When to Use

- Multiple plausible approaches and it's unclear which wins
- Design/architecture decisions with real trade-offs
- Problems where the first/obvious path is often wrong
- You want breadth BEFORE committing to depth

## `/tot` vs `/think` vs `/judge`

| | `/tot` | `/think` | `/judge` |
|---|---|---|---|
| Shape | Tree: branch → score → prune → merge | Linear chain | Parallel vote |
| Strength | Explore + backtrack + recombine | Step-by-step depth | Diverse opinions |
| Use when | "Many ways to do this" | "Walk me through this" | "Which is best?" |

## Instructions

When user invokes `/tot [problem]` (parse optional leading branch count, default 3):

### Step 1: Branch into distinct paths

```
mcp__tachibot-mcp__execute_prompt_technique({
  technique: "tree_of_thoughts",
  tool: "deepseek_reason",
  query: "[problem] — branch into [N] genuinely DISTINCT solution paths. For each path give: the core idea, how it would work, and its main risk."
})
```

`deepseek_reason` is a strong brancher; fall back to `grok_reason` or `gemini_analyze_text`.

**Present** the branches to the user before scoring.

### Step 2: Score & prune the branches (jury)

Get independent scoring so you don't fall in love with one branch:

```
mcp__tachibot-mcp__jury({
  question: "Score these solution paths for [problem] on feasibility, risk, and expected payoff (1–10 each). Rank them and say which to prune.\n\nPaths:\n[the N branches from Step 1]",
  jurors: "deepseek,grok,kimi",
  mode: "rank"
})
```

Prune the lowest-ranked branches. Keep the top 1–2.

### Step 3: Deepen the surviving branch(es)

For each survivor, develop it with a focused reasoning pass:

```
mcp__tachibot-mcp__nextThought({
  thought: "Develop the winning path for [problem]: [branch]\n\nFlesh out: concrete steps, the hardest sub-part, how to de-risk it, and what would make it fail.",
  model: "deepseek",
  executeModel: true,
  contextWindow: "recent",
  nextThoughtNeeded: true
})
```

### Step 4: Synthesize (merge best elements)

```
mcp__tachibot-mcp__nextThought({
  thought: "Synthesize the final answer for [problem].\n\nWinning path(s): [...]\nJury scores/rationale: [...]\n\nMerge the best elements across branches into ONE recommendation. State: the approach, why it beat the pruned branches, and the top risk to watch.",
  model: "gemini",
  executeModel: true,
  contextWindow: "all",
  nextThoughtNeeded: false
})
```

If `jury` is unavailable, score branches with a single `nextThought` judge (`contextWindow: "all"`). If `execute_prompt_technique` is unavailable, branch with `nextThought` (`contextWindow: "none"`) asking for N distinct paths.

### Step 5: Present Results

```markdown
## Tree-of-Thought: [problem]

### Branches Explored ([N])
1. [Path A] — score [x/10] — [kept/pruned]
2. [Path B] — score [x/10] — [kept/pruned]
...

### Recommendation
[The synthesized approach]

### Why It Won
[How it beat the pruned branches]

### Top Risk
[What to watch]
```

## Examples

- `/tot how should we shard this 10TB table?`
- `/tot 4 design a caching strategy for a read-heavy API with bursty writes`
- `/tot pick a migration path from REST to GraphQL with zero downtime`
