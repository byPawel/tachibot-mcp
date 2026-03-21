---
name: blueprint
description: Multi-model implementation planning — creates bite-sized TDD plans using planner_maker's council pipeline with goal-oriented checkpoints
user-invocable: true
---

# Blueprint — Multi-Model Implementation Planning

Creates implementation plans using a multi-model council (Grok search, Qwen/Kimi analysis, GPT critique with pre-mortem, Gemini final judgment). Output is in bite-sized TDD format: exact files, test-first steps, commit points.

## Usage
```
/blueprint [task description]
/blueprint [task] --goal [success criteria]
/blueprint [task] --context [additional context]
/blueprint [task] --code [paste relevant code]
/blueprint [task] --ux                          — include UX/accessibility review
/blueprint [task] --responsive                  — include responsive design review
/blueprint [task] --debate                      — include pro/con debate steps
/blueprint [task] --issue [path/to/issue.md]    — load spec from file
```

## When to Use

- Before implementing non-trivial features
- When you need a structured plan with exact files and steps
- When you want multi-model perspectives before coding
- When requirements are complex or ambiguous

## Prompt Template

Structure your input for best results. Each field feeds the right model:

```
Task:        [One sentence. Action verb. What you're building.]
Goal:        [2-4 measurable success criteria. What "done" looks like.]
Context:     [Domain facts, prior decisions, current architecture, scale.]
Subtasks:    [Break the task into 3-5 chunks for the models to chew on.]
Constraints: [Tech stack, budget, platform limits, compliance.]
Metrics:     [How you'll know it worked. Numbers, not vibes.]
Reference:   [One short example of a similar approach + what to change.]
```

**Example — good vs bad:**

BAD:  `/blueprint Add analytics to the app`

GOOD:
```
/blueprint Add PostHog analytics with admin opt-out toggle
  --goal "Track page views + feature usage, admin can disable per-site, fail-closed (if toggle errors analytics OFF), GDPR compliant"
  --context "Forge Custom UI app, existing KVS for settings"
```

The layered structure feeds each model what it needs — Grok gets searchable context, Qwen gets structured subtasks to design against, Kimi gets constraints and metrics to critique with.

## Pipeline (what happens under the hood)

```
Step 1: Grok Search      — ground truth, latest docs
Step 2: Qwen Analysis    — technical deep-dive
Step 3: Kimi Analysis    — step-by-step edge cases
Step 4: Kimi Decompose   — subtasks + dependencies
Step 5: GPT Critique     — pre-mortem (assume it failed, find why)
Step 6: Qwen Draft       — synthesize into draft plan
Step 7: Gemini Final     — bite-sized TDD output format
```

Optional steps: debate (pro/con), UX review, responsive review.

## Instructions

When user invokes `/blueprint [task]`:

### Step 1: Parse Input

Extract from user message:
- **task** — the main task description
- **goal** — any `--goal` value, or extract success criteria from task/context. If ambiguous, ask user: "What does done look like?"
- **context** — any `--context` value, or surrounding conversation context
- **codeContext** — any `--code` value, or if user mentions specific files, read them and paste contents
- **flags** — `--ux`, `--responsive`, `--debate`, `--issue`

### Step 2: Start the Pipeline

```
mcp__tachibot-mcp__planner_maker({
  task: "[task]",
  goal: "[success criteria — what must be true when done]",
  context: "[context if any]",
  codeContext: "[code if any]",
  mode: "start",
  ux: [true if --ux],
  responsive: [true if --responsive],
  debate: [true if --debate],
  issueFile: "[path if --issue]"
})
```

This returns the FIRST tool to call and its parameters.

### Step 3: Execute the Coordinator Loop

The planner_maker uses a **coordinator pattern** — it returns ONE tool to execute at a time:

```
Loop:
  1. planner_maker returns { nextTool: { tool, params }, step, phase }
  2. Execute the returned tool with given params
  3. Call planner_maker again with mode: "continue", step: next, prior: { [stepId]: result }
  4. Repeat until isComplete: true
```

**Important**: Pass results back in the `prior` object using the step ID as key. The planner accumulates context server-side.

Show progress to user between steps:
```
Blueprint: [phase] (step N/M)...
```

### Step 4: Present the Final Plan

The last step (`judge_final`) outputs the plan in bite-sized TDD format:

```markdown
### Task N: [Component Name]
**Files:** Create: path/to/file | Modify: path/to/file:lines | Test: path/to/test
**Step 1:** Write the failing test (show test code)
**Step 2:** Run test to verify it fails (exact command + expected output)
**Step 3:** Write minimal implementation (show code)
**Step 4:** Run test to verify it passes (exact command)
**Step 5:** Commit (exact git command with message)
```

Present the full plan to the user. Then offer:

```
Blueprint complete. Options:

1. **Execute with planner_runner** (recommended) — Step-by-step execution with goal checkpoints at 50/80/100%
2. **Execute inline** — I'll implement the plan task by task in this session
3. **Save to file** — Save as docs/plans/YYYY-MM-DD-[feature].md for later
4. **Refine** — Adjust specific tasks or add more detail
```

### If User Chooses "Execute with planner_runner" (recommended)

Start the runner with the plan and goal:
```
planner_runner({
  plan: "[full plan text]",
  goal: "[goal from planner_maker]",
  mode: "start"
})
```

Then follow the coordinator pattern — execute each step, run checkpoints at 50/80/100%:
- **50%**: GPT judges progress + goal alignment → ON_TRACK or DRIFTING
- **80%**: Kimi decomposes remaining work, checks goal alignment
- **100%**: Gemini final judge → scores quality, completeness, goal alignment /10 → APPROVED or NEEDS_REVISION

### If User Chooses "Execute inline"

Work through each task in the plan sequentially:
1. Follow the exact steps (test-first, commit after each task)
2. Show progress after each task
3. Pause for feedback every 3 tasks

### If User Chooses "Save to file"

Save the plan with this header:
```markdown
# [Feature Name] Implementation Plan

> **For Claude:** Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** [Goal statement]
**Architecture:** [2-3 sentences]
**Generated by:** planner_maker (multi-model council)
**Models used:** Grok, Qwen, Kimi, GPT, Gemini

---
[plan content]
```

## Examples

- `/blueprint add OAuth authentication with refresh tokens --goal "secure token rotation, 15min access TTL, 7d refresh TTL"`
- `/blueprint refactor payment module to microservice --debate`
- `/blueprint add real-time collaboration --ux --responsive`
- `/blueprint implement rate limiter --code [paste current code]`
- `/blueprint redesign user dashboard --issue docs/specs/dashboard-v2.md --goal "load under 2s, mobile-first"`
