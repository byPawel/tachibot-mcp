---
name: test
description: Use when the user wants tests generated for code or a diff — enumerates edge cases and failure modes first, then emits runnable test code via testgen
user-invocable: true
---

# /test — Generate Tests

Generate runnable tests for code with the `testgen` tool (a coding-specialized model that lists edge cases before writing tests).

## Steps

1. Collect the code under test. If the user pointed at files, pass them via `files` (use `path:start-end` line ranges for large files). Otherwise take the pasted `code`.
2. Infer the test framework from the project (jest / vitest / pytest / go test / …) or ask, and pass it as `framework`. If there are existing tests nearby, paste one via `existingTests` so the generated tests match your conventions.
3. Pick the coverage focus from intent: `edge` (boundaries + failure modes), `happy` (main paths), `regression` (lock current behavior), or `all` (default).
4. Call `testgen({ code | files, framework?, coverage?, existingTests? })`.
5. Relay the generated test file, then offer to write it to the right path and run it.

Requires OPENROUTER_API_KEY. If the tool returns its missing-key error, relay it and suggest /setup.
