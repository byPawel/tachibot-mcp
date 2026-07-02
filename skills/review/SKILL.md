---
name: review
description: Use when code changes are ready for review — a diff exists, the user says "review my changes/PR", or a commit is about to happen. Multi-model diff review (Kimi, DeepSeek, GPT-5.5 panel + Gemini judge) with a MERGEABLE verdict
user-invocable: true
---

# /review — Multi-Model Diff Review

Review the user's current change with the `diff_review` tool.

## Steps

1. Collect the diff. If the user gave one, use it. Otherwise run `git diff` (unstaged), falling back to `git diff HEAD` (all uncommitted) — if both are empty, use `git diff main...HEAD` (branch changes). If still empty, tell the user there is nothing to review and stop.
2. Infer the intent: from the user's words, or from the branch name and recent commit messages (`git log --oneline -5`).
3. Call `diff_review` with: `diff` (the collected diff), `intent`, `focus` if the user named one (security | perf | correctness | style), and `files` for any file the diff touches heavily (use `path:start-end` ranges around the hunks).
4. Relay the verdict. Lead with the MERGEABLE / MERGEABLE WITH FIXES / DO NOT MERGE line, then the findings at severity `major` and above; mention how many minor/nit findings were omitted.
5. Offer to apply the top fix.

## Requirements

Needs GEMINI (judge) plus OPENROUTER and/or OPENAI keys (reviewers self-drop). If the tool returns a "no reviewers available" error, show the user its message — it names the missing keys.
