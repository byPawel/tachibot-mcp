---
name: setup
description: Use when TachiBot tools seem missing, a provider isn't working, or the user asks to set up/configure TachiBot or its API keys — runs doctor and walks through fixing the gaps
user-invocable: true
---

# /setup — Guided TachiBot Configuration

1. Call the `doctor` tool. Relay: which keys are detected, how many tools are visible vs hidden, and the active profile.
2. For each MISSING key the user wants, tell them exactly where to get it (OpenRouter: openrouter.ai/keys — unlocks the most tools; Perplexity: perplexity.ai; Google AI Studio; OpenAI platform; xAI console) and how to add it for their client: Claude Code → `claude mcp add` with `--env` flags (or edit the tachibot entry in ~/.claude.json); Claude Desktop → extension settings or claude_desktop_config.json env block.
3. If they want fewer tools/tokens, explain profiles: full (63, default), balanced (52), code_focus (41), minimal (13) — set via TACHIBOT_PROFILE env in the same config.
4. After they update config, remind them to restart the client (or /mcp reconnect in Claude Code), then re-run `doctor` to confirm the delta.
5. Suggest a first call that exercises their newest key (e.g. jury for Gemini+any, grok_search for Grok).
