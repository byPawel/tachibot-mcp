---
name: triage
description: Use when the user hits an error, exception, or stack trace and the cause isn't obvious — returns RANKED root-cause hypotheses with the cheapest discriminating check for each, via debug_triage
user-invocable: true
---

# /triage — Ranked Bug Triage

1. Collect the error/stack trace verbatim into `error`. Never trim the trace.
2. Gather cheap context: repro steps and recent changes (`context`), runtime/versions (`runtime`), and the implicated source (`files` with line ranges around the frames, e.g. 'src/app.ts:30-60').
3. Call `debug_triage`.
4. Relay the ranked hypotheses with their likelihoods, then run (or offer to run) the TOP hypothesis's discriminating check — logs, a breakpoint, a one-liner — before touching any fix.
5. If the check kills the top hypothesis, promote the named runner-up and check that one; only implement the minimal fix once a hypothesis is CONFIRMED. Then add the locking test the tool suggested.

Requires GROK_API_KEY (or XAI_API_KEY). If the tool returns its missing-key error, relay it and suggest /setup.
