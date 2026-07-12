# Tool Profiles Guide

## Quick Start

Switch between tool profiles by editing `tools.config.json`:

```json
{
  "activeProfile": "full"
}
```

Or via environment variable:

```bash
TACHIBOT_PROFILE=research_power npm start
```

Restart the server for changes to take effect.

## Available Profiles

Counts below are generated from `src/profiles/*.ts` via `npm run build:profiles` — see `profiles/*.json` for the exact tool lists.

| Profile | Tools | Description |
|---------|-------|-------------|
| `minimal` | 13 | Minimal essential tools for basic tasks |
| `research_power` | 36 | Research-focused with Grok search + all Perplexity + brainstorming |
| `code_focus` | 42 | Code-heavy work with debugging and analysis |
| `balanced` | 54 | Balanced set for general use |
| `heavy_coding` | 58 | Heavy coding with all reasoning & code tools |
| `full` | 65 | **Default profile** — every tool enabled |

---

### 1. `minimal` (13 tools)

Minimal essential tools for basic tasks.

**Tools:**
- Meta: `think`, `focus`, `tachi`, `doctor`, `nextThought`, `usage_stats`
- Research: `perplexity_ask`
- Reasoning: `grok_reason`
- Creative: `gemini_brainstorm`
- Code: `qwen_coder`, `minimax_code`
- Workflow: `workflow`
- Prompt engineering: `list_prompt_techniques`

**Best for:** Quick tasks, token budget constraints, learning TachiBot.

---

### 2. `research_power` (36 tools)

Research-focused with Grok search + all Perplexity + brainstorming + the full reasoning/planning suite.

**Tools:**
- Meta: `think`, `focus`, `tachi`, `doctor`, `nextThought`, `usage_stats`
- Research: `perplexity_ask`, `perplexity_reason`, `grok_search`, `grok_search_lite`, `openai_search`, `gemini_search`
- Reasoning: `grok_reason`, `qwq_reason`, `qwen_reason`, `kimi_thinking`, `kimi_decompose`, `deepseek_reason`, `glm_reason`, `stepfun_reason`, `ernie_reason`
- Judgment: `gemini_judge`, `jury`
- Creative: `openai_brainstorm`, `gemini_brainstorm`
- Code: `qwen_coder`, `kimi_code`, `kimi_long_context`, `minimax_agent`
- Planning: `planner_maker`, `planner_runner`, `list_plans`
- Workflow: `workflow`
- Prompt engineering: `list_prompt_techniques`, `preview_prompt_technique`, `execute_prompt_technique`

**Best for:** Deep research, fact-checking, multi-source verification, brainstorming sessions.

**Key tools for research:**
- `grok_search` / `openai_search` / `gemini_search` — live web search, three different engines (`grok_search_lite` = same Grok search on grok-4-1-fast, ~10x cheaper for high-volume lookups)
- `jury` — multi-model consensus (parallel jurors + Gemini synthesis)
- `gemini_judge` — evaluate/synthesize/rank/resolve multiple perspectives into one verdict

---

### 3. `code_focus` (42 tools)

Code-heavy work with debugging and analysis.

**Tools:**
- Meta: `think`, `focus`, `tachi`, `doctor`, `nextThought`, `usage_stats`
- Research: `perplexity_ask`
- Reasoning: `grok_reason`, `qwq_reason`, `kimi_thinking`, `kimi_decompose`, `deepseek_reason`, `glm_reason`, `stepfun_reason`
- Code: `grok_code`, `grok_debug`, `openai_code_review`, `gemini_analyze_code`, `qwen_coder`, `qwen_algo`, `kimi_code`, `kimi_long_context`, `minimax_code`, `deepseek_algo`, `debug_triage`
- Creative: `gemini_brainstorm`
- Local: `local_query`
- Planning: `planner_maker`, `planner_runner`, `list_plans`, `spec_writer`
- Workflow: `workflow`, `list_workflows`, `validate_workflow`
- Prompt engineering: `list_prompt_techniques`, `preview_prompt_technique`, `execute_prompt_technique`, `refine_prompt`
- Quality: `testgen`, `security_review`, `diff_review`, `plan_critique`

**Best for:** Software development, debugging, code review, refactoring, security-conscious changes.

---

### 4. `balanced` (54 tools)

Balanced set for general use — nearly everything except the deepest niche reasoning/creative extras.

**Tools:**
- Meta: `think`, `focus`, `tachi`, `doctor`, `nextThought`, `usage_stats`
- Research: `perplexity_ask`, `perplexity_reason`, `grok_search`, `grok_search_lite`, `openai_search`, `gemini_search`
- Reasoning: `grok_reason`, `qwq_reason`, `qwen_reason`, `kimi_thinking`, `kimi_decompose`, `deepseek_reason`, `glm_reason`, `stepfun_reason`, `ernie_reason`
- Code: `grok_code`, `qwen_coder`, `qwen_algo`, `kimi_code`, `kimi_long_context`, `minimax_code`, `minimax_agent`, `deepseek_algo`, `debug_triage`
- Judgment: `gemini_judge`, `jury`
- Creative: `openai_brainstorm`, `gemini_brainstorm`
- Analysis: `gemini_analyze_code`, `gemini_analyze_text`
- Local: `local_query`
- Planning: `planner_maker`, `planner_runner`, `list_plans`, `spec_writer`
- Workflow: `workflow`, `list_workflows`, `create_workflow`, `visualize_workflow`
- Prompt engineering: `list_prompt_techniques`, `preview_prompt_technique`, `execute_prompt_technique`, `refine_prompt`
- Quality: `testgen`, `security_review`, `diff_review`, `plan_critique`
- Reasoning (OpenAI): `openai_reason`

**Best for:** General-purpose work, daily tasks, mixed research + code.

---

### 5. `heavy_coding` (58 tools)

Heavy coding with the full reasoning & code toolset, minus the general workflow-management tools.

**Tools:**
- Meta: `think`, `focus`, `tachi`, `doctor`, `nextThought`, `usage_stats`
- Research: `perplexity_ask`, `perplexity_reason`, `grok_search`, `grok_search_lite`, `openai_search`, `gemini_search`
- Reasoning: `grok_reason`, `openai_reason`, `qwq_reason`, `qwen_reason`, `kimi_thinking`, `kimi_decompose`, `deepseek_reason`, `glm_reason`, `stepfun_reason`
- Code: `grok_code`, `grok_debug`, `grok_architect`, `openai_code_review`, `openai_explain`, `gemini_analyze_code`, `qwen_coder`, `qwen_algo`, `kimi_code`, `kimi_long_context`, `minimax_code`, `minimax_agent`, `deepseek_algo`, `debug_triage`
- Judgment: `gemini_judge`, `jury`
- Creative: `grok_brainstorm`, `openai_brainstorm`, `gemini_brainstorm`
- Analysis: `gemini_analyze_text`
- Local: `local_query`
- Planning: `planner_maker`, `planner_runner`, `list_plans`, `spec_writer`
- Workflow: `workflow`, `list_workflows`, `workflow_start`, `continue_workflow`
- Prompt engineering: `list_prompt_techniques`, `preview_prompt_technique`, `execute_prompt_technique`, `refine_prompt`
- Quality: `testgen`, `security_review`, `diff_review`, `plan_critique`

**Best for:** Coding marathons, large refactors, when you want every code-intelligence tool available but don't need custom workflow authoring.

**Not included** (present only in `full`): `ernie_reason`, `qwen_competitive`, `create_workflow`, `visualize_workflow`, `workflow_status`, `validate_workflow`, `validate_workflow_file`.

---

### 6. `full` (65 tools) — default

All tools enabled for maximum capability. This is the profile set in `tools.config.json`'s `activeProfile` by default.

**Tools:** every tool listed in [TOOLS_REFERENCE.md](TOOLS_REFERENCE.md), including the niche/conditional ones not in any other profile: `ernie_reason`, `qwen_competitive`, `create_workflow`, `visualize_workflow`, `workflow_status`, `validate_workflow`, `validate_workflow_file`.

**Best for:** Maximum flexibility, specialized tasks, demonstrations.

**Note:** tools still self-gate on API keys — with no `OPENROUTER_API_KEY`, the Qwen/Kimi/MiniMax/DeepSeek/GLM/StepFun/ERNIE tools won't register even under `full`. Run `doctor` to see exactly what's active. `continue_focus` is always registered regardless of profile (see [TOOLS_REFERENCE.md](TOOLS_REFERENCE.md#continue_focus)) and isn't counted in the 65.

---

## Custom Profile

Create your own subset:

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
      "jury": true
    }
  }
}
```

When `customProfile.enabled` is `true`, it overrides `activeProfile`. Every tool in `src/profiles/types.ts`'s `ToolsConfig` interface must be present (as `true`/`false`) for the profile to be valid — copy the `full` profile's tool list from `profiles/full.json` as a starting template and flip the ones you don't want.

---

## Profile Switching Tips

1. **Start with `balanced`** if unsure.
2. **Use `research_power`** for heavy research sessions.
3. **Use `code_focus`** or **`heavy_coding`** for coding marathons (the latter adds architecture/debug/explain/brainstorm on top).
4. **Use `minimal`** when hitting token limits.
5. **Use `full`** (the default) when you want everything and don't mind the token overhead.

---

## Environment Variable Overrides

Force-enable/disable individual tools regardless of profile:

```bash
# Enable a specific tool
ENABLE_TOOL_QWEN_COMPETITIVE=true npm start

# Disable a specific tool
DISABLE_TOOL_GROK_SEARCH=true npm start

# Disable all tools (testing)
DISABLE_ALL_TOOLS=true npm start
```

Priority: `ENV vars` > `customProfile` > `activeProfile` > default (enabled).

---

## Troubleshooting

### Profile not loading
1. Check JSON syntax in `tools.config.json`.
2. Restart the server.
3. Run `doctor` — it reports the active profile and why any tool is hidden.

### Tool still appears / still hidden
1. Confirm the tool is `true`/`false` in the active profile (`profiles/<name>.json` after a build, or `src/profiles/<name>.ts` in source).
2. Check for an `ENABLE_TOOL_*` / `DISABLE_TOOL_*` environment override.
3. Confirm the tool's provider API key is set — some tools (Qwen/Kimi/MiniMax/DeepSeek/GLM/StepFun/ERNIE) need `OPENROUTER_API_KEY` regardless of profile.

### Custom profile not working
1. Set `"enabled": true` in `customProfile`.
2. Restart the server.
3. Run `doctor` to confirm it reports "custom profile" as active.

### Profiles out of sync with this document
After editing `src/profiles/*.ts`, run `npm run build` to regenerate the JSON in `profiles/` — this document's counts and tool lists are generated from that build output.

---

## See Also

- [Tools Reference](TOOLS_REFERENCE.md) - Full per-tool schemas and examples
- [Tool Parameters](TOOL_PARAMETERS.md) - Cross-cutting parameter conventions
- [Configuration Guide](CONFIGURATION.md) - Complete configuration reference
