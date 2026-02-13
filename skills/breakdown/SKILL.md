---
name: breakdown
description: Break down complex problems before implementation using multi-model reasoning and prompt techniques
user-invocable: true
---

# Breakdown - Problem Decomposition

Decompose complex tasks using first principles, pattern analysis, and multi-model reasoning before implementation. Adapts to your available API keys.

## Usage
```
/breakdown [problem or task description]
```

## When to Use

- Before implementing non-trivial features
- When requirements are unclear or ambiguous
- When facing multiple possible approaches
- Before major refactoring or architectural changes

## Instructions

When user invokes `/breakdown [problem]`:

### Step 0: Check Available Tools

The pipeline adapts to available tools. Each step lists a priority chain - use the FIRST available tool.

### Step 1: First Principles (Atomic Truths)

Use the FIRST available:
1. `mcp__tachibot-mcp__execute_prompt_technique({ technique: "first_principles", tool: "grok_reason", query: "[problem]" })`
2. `mcp__tachibot-mcp__execute_prompt_technique({ technique: "first_principles", tool: "openai_reason", query: "[problem]" })`
3. `mcp__tachibot-mcp__execute_prompt_technique({ technique: "first_principles", tool: "gemini_analyze_text", query: "[problem]" })`

If `execute_prompt_technique` is unavailable, call the reasoning tool directly with the prompt: "Apply first principles thinking to: [problem]. Strip to fundamental truths, challenge assumptions, identify atomic units."

**Extract**: Core truths, assumptions to challenge, atomic units.

### Step 2: Decompose (Sub-problems & Dependencies)

Use the FIRST available:
1. `mcp__tachibot-mcp__execute_prompt_technique({ technique: "decompose", tool: "kimi_thinking", query: "..." })`
2. `mcp__tachibot-mcp__execute_prompt_technique({ technique: "decompose", tool: "kimi_decompose", query: "..." })`
3. `mcp__tachibot-mcp__execute_prompt_technique({ technique: "decompose", tool: "gemini_analyze_text", query: "..." })`
4. `mcp__tachibot-mcp__execute_prompt_technique({ technique: "decompose", tool: "openai_reason", query: "..." })`

Feed step 1 output into the query.

**Extract**: Sub-tasks, dependency graph, execution order.

### Step 3: Patterns (Causality & Cycles)

Use the FIRST available:
1. `mcp__tachibot-mcp__execute_prompt_technique({ technique: "patterns", tool: "gemini_analyze_text", query: "..." })`
2. `mcp__tachibot-mcp__execute_prompt_technique({ technique: "patterns", tool: "grok_reason", query: "..." })`
3. `mcp__tachibot-mcp__execute_prompt_technique({ technique: "patterns", tool: "openai_reason", query: "..." })`

Feed step 2 output into the query.

**Extract**: Hidden connections, recurring themes, potential cycles/loops.

### Step 4: Feasibility (Reality Check)

Use the FIRST available:
1. `mcp__tachibot-mcp__execute_prompt_technique({ technique: "feasibility", tool: "grok_reason", query: "..." })`
2. `mcp__tachibot-mcp__execute_prompt_technique({ technique: "feasibility", tool: "openai_reason", query: "..." })`
3. `mcp__tachibot-mcp__execute_prompt_technique({ technique: "feasibility", tool: "gemini_analyze_text", query: "..." })`

**Extract**: Blockers, risks, mitigations, go/no-go.

### Step 5: Synthesize Output

Present structured breakdown:

```markdown
## Problem
[One sentence]

## First Principles
- [Truth 1]
- [Truth 2]
- Challenged assumption: [X]

## Sub-Tasks
1. **[Task A]** - [purpose]
   - Depends on: none
   - Risk: low

2. **[Task B]** - [purpose]
   - Depends on: Task A
   - Risk: medium

## Patterns Found
- Causality: [X causes Y]
- Cycle: [A -> B -> C -> A]
- Anomaly: [unexpected finding]

## Execution Order
1. [First] - no deps, low risk
2. [Second] - deps on 1
...

## Feasibility
| Aspect | Status | Notes |
|--------|--------|-------|
| Technical | OK | [details] |
| Time | Warning | [constraint] |
| Resources | OK | [details] |

## Risks & Mitigations
| Risk | Likelihood | Mitigation |
|------|------------|------------|
| [Risk 1] | Medium | [approach] |

## Verdict
[Go / No-go / Needs more info]
```

## Examples

- `/breakdown implement OAuth authentication with refresh tokens`
- `/breakdown refactor monolith payment module to microservice`
- `/breakdown add real-time collaboration to document editor`
