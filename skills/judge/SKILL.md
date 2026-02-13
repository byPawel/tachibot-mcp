---
name: judge
description: Multi-model council with parallel analysis and synthesis - adapts to your available API keys
user-invocable: true
---

# Judge - Council of Experts

Multi-model council for comprehensive analysis. Adapts to whichever API keys you have configured.

## Usage
```
/judge [your question or code]
```

## Instructions

When user invokes `/judge [query]`:

### Step 0: Check Available Tools

Before calling any tool, check which tachibot-mcp tools are available in this session by looking at the loaded MCP tools. The pipeline adapts:

- **Has Grok?** Use `grok_search` + `grok_reason`
- **Has Perplexity?** Use `perplexity_ask` for search
- **Has OpenAI?** Use `openai_reason` as first judge
- **Has Gemini?** Use `gemini_analyze_text` as final judge
- **Has Qwen?** Use `qwen_coder` for code analysis
- **Has Kimi?** Use `kimi_thinking` for step-by-step

Minimum viable council: **any 2 models** from different providers.
If only 1 model available: run it directly (no council needed).

### Step 1: Ground Truth Search (PARALLEL)

Call ALL available search tools in parallel:
- `mcp__tachibot-mcp__grok_search` (preferred - real-time)
- `mcp__tachibot-mcp__perplexity_ask` (citations, academic)
- `mcp__tachibot-mcp__openai_search` (GPT grounding)
- `mcp__tachibot-mcp__gemini_search` (Google grounding)

Skip any that aren't available. If NO search tools available, proceed without search grounding and note it.

### Step 2: Parallel Analysis (all available)

Call ALL available analysis tools in parallel:

**Reasoning** (pick all available):
- `mcp__tachibot-mcp__grok_reason` - first principles analysis
- `mcp__tachibot-mcp__kimi_thinking` - step-by-step, edge cases

**Code** (if query involves code):
- `mcp__tachibot-mcp__qwen_coder` - code review and bugs
- `mcp__tachibot-mcp__qwen_algo` - algorithm optimization

### Step 3: First Judge (with Pre-Mortem)

Use the FIRST available from this priority list:
1. `mcp__tachibot-mcp__openai_reason` (GPQA 87.7%)
2. `mcp__tachibot-mcp__gemini_analyze_text` (1M context)
3. `mcp__tachibot-mcp__grok_reason` (strong reasoning)

Prompt: "Extract key insights from each expert, identify consensus and conflicts. Then apply PRE-MORTEM: assume the recommended approach FAILED — what were the top 3 causes? Are those causes addressed in the analysis? Provide preliminary verdict with failure risks."

### Step 4: Final Synthesis

Use a DIFFERENT model from Step 3. Priority:
1. `mcp__tachibot-mcp__gemini_analyze_text` (if not used in step 3)
2. `mcp__tachibot-mcp__openai_reason` (if not used in step 3)
3. Skip if only 1 model available (step 3 IS the final answer)

Prompt: Review first judgment, synthesize best elements from ALL analyses, resolve conflicts, provide final answer with confidence level.

### Step 5: Present Results

Format:
- **Answer**: 1-2 sentence summary
- **Models Used**: [list which were available]
- **Expert Insights**: Key finding per model
- **Consensus**: Agreed points
- **Conflicts Resolved**: How settled
- **Recommendation**: Next steps
- **Confidence**: High/Medium/Low

## Examples
- `/judge how to implement rate limiting`
- `/judge analyze this code: [paste]`
- `/judge microservices vs monolith for 10M users`
