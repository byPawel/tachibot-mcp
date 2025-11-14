# Tool Profiles Guide

## Quick Start

Switch between tool profiles by editing `tools.config.json`:

```json
{
  "activeProfile": "research_power"
}
```

Restart the server for changes to take effect.

## Available Profiles

### 1. **minimal** (~4-5k tokens, 8 tools)
Minimal tool set for basic tasks.

**Tools:**
- Core: think, focus, nextThought
- Research: perplexity_ask
- Reasoning: grok_reason
- Creative: gemini_brainstorm
- Code: qwen_coder
- Workflow: workflow

**Best for:** Quick tasks, token budget constraints, learning TachiBot

---

### 2. **research_power** (~9-10k tokens, 15 tools) ⭐ YOUR PROFILE
Research-focused with Grok search + all Perplexity + brainstorming.

**Tools:**
- Core: think, focus, nextThought
- Perplexity: perplexity_ask, perplexity_reason, perplexity_research
- Grok: grok_search, grok_reason
- Creative: openai_brainstorm, gemini_brainstorm
- Advanced: scout, verifier
- Code: qwen_coder
- Workflow: workflow, list_workflows

**Best for:** Deep research, fact-checking, multi-source verification, brainstorming sessions

**Key differences from perplexity_ask:**
- **scout**: Hybrid orchestrator (can use Perplexity + Grok-4 live search, multiple strategies)
- **grok_search**: Grok-4 with live web search (costs extra, but very powerful)
- **verifier**: Multi-model consensus (runs same query on multiple models, synthesizes)

---

### 3. **code_focus** (~8-9k tokens, 13 tools)
Code-heavy work with debugging and analysis.

**Tools:**
- Core: think, focus, nextThought
- Research: perplexity_ask
- Grok: grok_reason, grok_code, grok_debug
- Gemini: gemini_analyze_code, gemini_brainstorm
- Code: qwen_coder
- Advanced: verifier
- Workflow: workflow, list_workflows

**Best for:** Software development, debugging, code review, refactoring

---

### 4. **balanced** (~10-11k tokens, 17 tools)
Balanced set for general use.

**Tools:**
- Core: think, focus, nextThought
- Perplexity: perplexity_ask, perplexity_reason
- Grok: grok_reason, grok_code
- OpenAI: openai_brainstorm
- Gemini: gemini_brainstorm, gemini_analyze_code
- Code: qwen_coder
- Advanced: verifier, scout
- Workflow: workflow, list_workflows
- Collaborative: pingpong

**Best for:** General-purpose work, daily tasks, mixed research + code

---

### 5. **full** (~18-19k tokens, 26 tools)
All tools enabled for maximum capability.

**Tools:** All 26 tools (except hunter, qwen_competitive)

**Best for:** Maximum flexibility, specialized tasks, demonstrations

**Warning:** High token usage, may impact Claude Code performance

---

## Custom Profile

Create your own profile:

```json
{
  "customProfile": {
    "description": "My custom research profile",
    "enabled": true,
    "tools": {
      "think": true,
      "focus": true,
      "perplexity_ask": true,
      "grok_search": true,
      "scout": true
    }
  }
}
```

When `customProfile.enabled` is `true`, it overrides `activeProfile`.

---

## Tool Comparison: Research Tools

| Tool | Purpose | Tokens | Speed | Cost |
|------|---------|--------|-------|------|
| **perplexity_ask** | Single web search | ~300 | Fast | $ |
| **perplexity_research** | Deep multi-query research | ~700 | Slow | $$$ |
| **grok_search** | Grok-4 live web search | ~500 | Medium | $$ |
| **scout** | Hybrid orchestrator (Perplexity + Grok) | ~600 | Medium | $$-$$$ |
| **verifier** | Multi-model consensus | ~500 | Medium | $$ |

### When to use each:

- **Quick fact check**: `perplexity_ask`
- **Deep research report**: `perplexity_research`
- **Real-time data**: `grok_search` (Grok-4 with live web)
- **Comprehensive research**: `scout` (uses both Perplexity + Grok)
- **Verify conflicting info**: `verifier` (runs multiple models, finds consensus)

---

## Profile Switching Tips

1. **Start with balanced** if unsure
2. **Use research_power** for heavy research sessions
3. **Use code_focus** for coding marathons
4. **Use minimal** when hitting token limits
5. **Use full** only when you need everything

---

## Environment Variable Overrides

Force-enable/disable tools regardless of profile:

```bash
# Enable a specific tool
ENABLE_TOOL_HUNTER=true npm start

# Disable a specific tool
DISABLE_TOOL_GROK_SEARCH=true npm start

# Disable all tools (testing)
DISABLE_ALL_TOOLS=true npm start
```

Priority: `ENV vars` > `customProfile` > `activeProfile` > `Default (enabled)`

---

## Monitoring

On startup, you'll see:

```
🎯 Active profile: research_power
   Research-focused with Grok search + all Perplexity + brainstorming (~9-10k tokens, 15 tools)
🚀 TachiBot MCP Server v5.0
Tools registered: 15 active
```

---

## Troubleshooting

### Profile not loading
1. Check JSON syntax in `tools.config.json`
2. Restart the server
3. Check startup logs for profile name

### Tool still appears
1. Make sure tool is set to `false` in active profile
2. Check for environment variable overrides
3. Verify profile name matches exactly

### Custom profile not working
1. Set `"enabled": true` in `customProfile`
2. Restart server
3. Check logs show "Using custom profile"

---

## Your Research Power Profile

**Recommended for:**
- Academic research
- Fact-checking and verification
- Multi-source investigations
- Creative brainstorming with research backing
- Competitive intelligence

**Additional tools you might want:**

1. **pingpong** - Multi-model conversations for complex debates
   - Add if you want models to argue/collaborate on topics

2. **challenger** - Critical thinking and echo chamber prevention
   - Add if you want counter-arguments to your research

3. **gemini_analyze_text** - Text analysis (sentiment, entities)
   - Add if you're analyzing documents/articles

**To add these**, update your profile:

```json
"research_power": {
  "tools": {
    // ... existing tools ...
    "pingpong": true,
    "challenger": true,
    "gemini_analyze_text": true
  }
}
```

This would bring you to **18 tools, ~11-12k tokens** - still well under your target!
