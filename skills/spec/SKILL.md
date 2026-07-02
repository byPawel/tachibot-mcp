---
name: spec
description: Use when a feature request is loose or ambiguous and needs a reviewable spec before planning — turns "add X somehow" into user stories, acceptance criteria, out-of-scope, and open questions via spec_writer
user-invocable: true
---

# /spec — Request → Reviewable Spec

1. Collect the request verbatim (do not pre-polish it — ambiguity is input, spec_writer preserves it as open questions).
2. Gather context: what exists today (read the relevant code if pointed at it), constraints, user base. Pass file paths via `files`.
3. Call `spec_writer` with `request`, `context`, `files`, and `format` if the user prefers user_story or gherkin (default both).
4. Relay the spec. Lead with the OPEN QUESTIONS — those are the decisions the user must make; the rest is for review.
5. Once the user answers/edits, offer the next step: feed the approved spec to `planner_maker` (or /blueprint) to plan the HOW.

Requires OPENAI_API_KEY. If the tool returns its missing-key error, relay it and suggest /setup.
