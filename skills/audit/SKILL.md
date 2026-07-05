---
name: audit
description: Use when the user wants a security review of code or a diff — OWASP/CWE findings with severity, taint/data-flow analysis, and concrete fixes via security_review
user-invocable: true
---

# /audit — Security Review

Run a dedicated security audit with the `security_review` tool — it carries an attacker mental model (taint/data-flow, OWASP/CWE), not a generic code review.

## Steps

1. Scope the review: a diff (paste it, or `git diff`) to check changed code only, or `code` / `files` for a whole component.
2. Add what sharpens it: `language`/framework, and `context` for the trust boundaries (e.g. "public internet-facing API", "internal service behind VPN", "handles untrusted uploads").
3. Choose `standard`: `owasp`, `cwe`, or `both` (default).
4. Call `security_review({ code | diff | files, language?, context?, standard? })`.
5. Relay findings led by the highest severity — each has a CWE/OWASP ref, a short exploitability sketch, and a concrete fix. Offer to apply the top fix.

For code you are authorized to review. Requires OPENROUTER_API_KEY. If the tool returns its missing-key error, relay it and suggest /setup.
