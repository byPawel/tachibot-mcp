# Bundle Skills into TachiBot Extension - Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Ship Claude Code skills (`/judge`, `/think`, `/focus`, `/breakdown`, `/decompose`, `/prompt`, `/tachi`) inside the tachibot-mcp extension so users get orchestration recipes out of the box.

**Architecture:** Create a `skills/` directory in the repo root with all 7 skill files. Update `/judge` and `/breakdown` to gracefully degrade when API keys are missing. Add `/decompose` (split into sub-problems, then sequential deep-dive on each). Add `/tachi` help skill for discoverability. Update `install.sh` and `package-extension.sh` to deploy skills to `~/.claude/skills/`. Update README to lead with skills.

**Tech Stack:** Claude Code skills (Markdown), Bash (install scripts), existing tachibot-mcp tools

---

### Task 1: Create skills directory with existing skills

**Files:**
- Create: `skills/think/SKILL.md`
- Create: `skills/focus/SKILL.md`
- Create: `skills/prompt/SKILL.md`

**Step 1: Create skills directory**

```bash
mkdir -p skills/think skills/focus skills/prompt
```

**Step 2: Copy generic skills as-is**

These three skills are already generic and need no changes. Copy from `~/.claude/skills/`:

`skills/think/SKILL.md`:
```markdown
---
name: think
description: Chain-of-thought reasoning with optional multi-model execution using nextThought
user-invocable: true
---

# Sequential Think

Step-by-step reasoning chains with model execution.

## Usage
```
/think [problem]
/think [model] [problem]
/think [model1,model2] [problem]
```

## Available Models
`grok`, `gemini`, `openai`, `perplexity`, `kimi`, `qwen`

## Instructions

When user invokes `/think`:

### Single model:
```
mcp__tachibot-mcp__nextThought({
  thought: "[problem]",
  model: "[model]",
  executeModel: true,
  contextWindow: "all",
  nextThoughtNeeded: false
})
```

### Multi-model chain:
```
// First model (fresh)
nextThought({ thought: "Analyze: [problem]", model: "[model1]", executeModel: true, contextWindow: 0, nextThoughtNeeded: true })

// Second model (sees previous)
nextThought({ thought: "Build on analysis", model: "[model2]", executeModel: true, contextWindow: "all", nextThoughtNeeded: false })
```

### Default (no model specified):
Use `gemini` as default model.

## Examples
- `/think why is my WebSocket disconnecting`
- `/think gemini optimize this query`
- `/think grok,kimi,gemini design a rate limiter`
```

`skills/focus/SKILL.md`:
```markdown
---
name: focus
description: Multi-model reasoning with modes like deep-reasoning, architecture-debate, research, analyze
user-invocable: true
---

# Focus Mode

Structured multi-model reasoning via TachiBot.

## Usage
```
/focus [query]
/focus [mode] [query]
```

## Available Modes
| Mode | Use Case |
|------|----------|
| `deep-reasoning` | Complex analysis (default) |
| `architecture-debate` | System design decisions |
| `research` | Information gathering |
| `analyze` | Systematic breakdown |
| `code-brainstorm` | Implementation ideas |

## Instructions

When user invokes `/focus`:

1. Parse mode (if specified) and query
2. Call focus tool:
```
mcp__tachibot-mcp__focus({
  query: "[query]",
  mode: "[mode or deep-reasoning]",
  models: ["grok", "gemini", "kimi"],
  rounds: 3
})
```

3. Present multi-model synthesis

## Examples
- `/focus how to handle 10k concurrent connections`
- `/focus architecture-debate Redis vs Memcached`
- `/focus research React 19 new features`
```

`skills/prompt/SKILL.md`:
```markdown
---
name: prompt
description: Apply 22 prompt engineering techniques like first_principles, tree_of_thoughts, judge
user-invocable: true
---

# Prompt Technique

Apply research-backed prompt engineering patterns.

## Usage
```
/prompt [technique] [query]
/prompt list
```

## Techniques by Category

| Category | Techniques |
|----------|------------|
| Creative | `what_if`, `alt_view`, `innovate` |
| Analytical | `analyze`, `first_principles`, `feasibility` |
| Reasoning | `chain_of_thought`, `tree_of_thoughts`, `graph_of_thoughts` |
| Verification | `self_consistency`, `constitutional` |
| Debate | `adversarial`, `persona_simulation` |
| Judgment | `council_of_experts` (alias: `judge`) |

## Instructions

### For `/prompt list`:
```
mcp__tachibot-mcp__list_prompt_techniques({ filter: "all" })
```

### For `/prompt [technique] [query]`:

**Step 1 - Preview** (always do this first):
```
mcp__tachibot-mcp__preview_prompt_technique({
  technique: "[technique]",
  tool: "grok_reason",  // or gemini_brainstorm for creative
  query: "[query]"
})
```

Show the user the **original query** vs **enhanced prompt** side by side, plus the technique name and target tool.

**Step 2 - Confirm**: Ask the user if they want to execute, tweak the query, or pick a different technique.

**Step 3 - Execute** (only after approval):
```
mcp__tachibot-mcp__execute_prompt_technique({
  execution_token: "last"  // uses the most recent preview
})
```

Note: Tokens expire after 5 minutes. If expired, re-preview first.

## Examples
- `/prompt first_principles why do users abandon checkout`
- `/prompt tree_of_thoughts implement caching`
- `/prompt judge microservices vs monolith`
```

**Step 3: Verify files exist**

Run: `ls -la skills/think/SKILL.md skills/focus/SKILL.md skills/prompt/SKILL.md`
Expected: All 3 files present

**Step 4: Commit**

```bash
git add skills/
git commit -m "feat: add bundled skills (think, focus, prompt)"
```

---

### Task 2: Create fallback-aware `/judge` skill

The original `/judge` hardcodes specific models and breaks if API keys are missing. This version gracefully degrades.

**Files:**
- Create: `skills/judge/SKILL.md`

**Step 1: Write the fallback-aware judge skill**

`skills/judge/SKILL.md`:
```markdown
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

### Step 3: First Judge

Use the FIRST available from this priority list:
1. `mcp__tachibot-mcp__openai_reason` (GPQA 87.7%)
2. `mcp__tachibot-mcp__gemini_analyze_text` (1M context)
3. `mcp__tachibot-mcp__grok_reason` (strong reasoning)

Prompt: Extract key insights from each expert, identify consensus and conflicts, provide preliminary verdict.

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
```

**Step 2: Verify file exists**

Run: `ls -la skills/judge/SKILL.md`
Expected: File present

**Step 3: Commit**

```bash
git add skills/judge/
git commit -m "feat: add fallback-aware /judge skill - adapts to available API keys"
```

---

### Task 3: Create fallback-aware `/breakdown` skill

Same treatment as `/judge` - graceful degradation.

**Files:**
- Create: `skills/breakdown/SKILL.md`

**Step 1: Write the fallback-aware breakdown skill**

`skills/breakdown/SKILL.md`:
```markdown
---
name: breakdown
description: Break down complex problems before implementation using multi-model reasoning and prompt techniques
user-invocable: true
---

# Breakdown - Problem Decomposition

Decompose complex tasks using first principles, pattern analysis, and multi-model reasoning before implementation. Adapts to your available API keys.

## Usage
```
/breakdown [problem or task description]
```

## When to Use

- Before implementing non-trivial features
- When requirements are unclear or ambiguous
- When facing multiple possible approaches
- Before major refactoring or architectural changes

## Instructions

When user invokes `/breakdown [problem]`:

### Step 0: Check Available Tools

The pipeline adapts to available tools. Each step lists a priority chain - use the FIRST available tool.

### Step 1: First Principles (Atomic Truths)

Use the FIRST available:
1. `mcp__tachibot-mcp__execute_prompt_technique({ technique: "first_principles", tool: "grok_reason", query: "[problem]" })`
2. `mcp__tachibot-mcp__execute_prompt_technique({ technique: "first_principles", tool: "openai_reason", query: "[problem]" })`
3. `mcp__tachibot-mcp__execute_prompt_technique({ technique: "first_principles", tool: "gemini_analyze_text", query: "[problem]" })`

If `execute_prompt_technique` is unavailable, call the reasoning tool directly with the prompt: "Apply first principles thinking to: [problem]. Strip to fundamental truths, challenge assumptions, identify atomic units."

**Extract**: Core truths, assumptions to challenge, atomic units.

### Step 2: Decompose (Sub-problems & Dependencies)

Use the FIRST available:
1. `mcp__tachibot-mcp__execute_prompt_technique({ technique: "decompose", tool: "kimi_thinking", query: "..." })`
2. `mcp__tachibot-mcp__execute_prompt_technique({ technique: "decompose", tool: "kimi_decompose", query: "..." })`
3. `mcp__tachibot-mcp__execute_prompt_technique({ technique: "decompose", tool: "gemini_analyze_text", query: "..." })`
4. `mcp__tachibot-mcp__execute_prompt_technique({ technique: "decompose", tool: "openai_reason", query: "..." })`

Feed step 1 output into the query.

**Extract**: Sub-tasks, dependency graph, execution order.

### Step 3: Patterns (Causality & Cycles)

Use the FIRST available:
1. `mcp__tachibot-mcp__execute_prompt_technique({ technique: "patterns", tool: "gemini_analyze_text", query: "..." })`
2. `mcp__tachibot-mcp__execute_prompt_technique({ technique: "patterns", tool: "grok_reason", query: "..." })`
3. `mcp__tachibot-mcp__execute_prompt_technique({ technique: "patterns", tool: "openai_reason", query: "..." })`

Feed step 2 output into the query.

**Extract**: Hidden connections, recurring themes, potential cycles/loops.

### Step 4: Feasibility (Reality Check)

Use the FIRST available:
1. `mcp__tachibot-mcp__execute_prompt_technique({ technique: "feasibility", tool: "grok_reason", query: "..." })`
2. `mcp__tachibot-mcp__execute_prompt_technique({ technique: "feasibility", tool: "openai_reason", query: "..." })`
3. `mcp__tachibot-mcp__execute_prompt_technique({ technique: "feasibility", tool: "gemini_analyze_text", query: "..." })`

**Extract**: Blockers, risks, mitigations, go/no-go.

### Step 5: Synthesize Output

Present structured breakdown:

```markdown
## Problem
[One sentence]

## First Principles
- [Truth 1]
- [Truth 2]
- Challenged assumption: [X]

## Sub-Tasks
1. **[Task A]** - [purpose]
   - Depends on: none
   - Risk: low

2. **[Task B]** - [purpose]
   - Depends on: Task A
   - Risk: medium

## Patterns Found
- Causality: [X causes Y]
- Cycle: [A -> B -> C -> A]
- Anomaly: [unexpected finding]

## Execution Order
1. [First] - no deps, low risk
2. [Second] - deps on 1
...

## Feasibility
| Aspect | Status | Notes |
|--------|--------|-------|
| Technical | OK | [details] |
| Time | Warning | [constraint] |
| Resources | OK | [details] |

## Risks & Mitigations
| Risk | Likelihood | Mitigation |
|------|------------|------------|
| [Risk 1] | Medium | [approach] |

## Verdict
[Go / No-go / Needs more info]
```

## Examples

- `/breakdown implement OAuth authentication with refresh tokens`
- `/breakdown refactor monolith payment module to microservice`
- `/breakdown add real-time collaboration to document editor`
```

**Step 2: Verify file exists**

Run: `ls -la skills/breakdown/SKILL.md`
Expected: File present

**Step 3: Commit**

```bash
git add skills/breakdown/
git commit -m "feat: add fallback-aware /breakdown skill - adapts to available API keys"
```

---

### Task 4: Create `/decompose` skill - split then deep-dive each piece

Different from `/breakdown` (strategic overview). `/decompose` splits the problem into sub-problems, then runs a sequential `nextThought` chain on EACH sub-problem to build deep understanding.

**Files:**
- Create: `skills/decompose/SKILL.md`

**Step 1: Write the decompose skill**

`skills/decompose/SKILL.md`:
```markdown
---
name: decompose
description: Decompose problems into sub-problems, then deep-dive each one with sequential multi-model reasoning
user-invocable: true
---

# Decompose - Split & Deep-Dive

Break a problem into sub-problems, then analyze each one in depth using sequential reasoning chains. Unlike `/breakdown` (strategic overview), `/decompose` gives you deep understanding of every piece.

## Usage
```
/decompose [problem]
/decompose [depth] [problem]
```

Depth: 1-5 (default 3). Higher = more granular sub-problems.

## When to Use

- When you need to UNDERSTAND each part, not just list them
- Before implementing something you don't fully grasp
- When sub-problems might have hidden complexity
- When you need to find where the real difficulty lives

## `/decompose` vs `/breakdown`

| | `/breakdown` | `/decompose` |
|---|---|---|
| Strategy | Breadth-first: overview pipeline | Depth-first: split then drill each |
| Steps | first_principles → decompose → patterns → feasibility | decompose → deep-dive each → synthesize |
| Output | Go/no-go assessment | Deep understanding per piece |
| Cost | 4 API calls | 1 + (N sub-problems × 2) calls |
| When | "Should we do this?" | "How does each part actually work?" |

## Instructions

When user invokes `/decompose [problem]`:

### Step 1: Decompose into Sub-Problems

Parse optional depth (default 3). Call:

```
mcp__tachibot-mcp__kimi_decompose({
  task: "[problem]",
  depth: [depth],
  outputFormat: "dependencies",
  context: "Break into distinct sub-problems. Each should be independently analyzable."
})
```

If `kimi_decompose` is unavailable, fall back to:
```
mcp__tachibot-mcp__nextThought({
  thought: "Decompose this problem into 3-7 distinct sub-problems with dependencies:\n\n[problem]\n\nFor each sub-problem provide: ID, name, description, depends_on, estimated complexity (low/medium/high)",
  model: "gemini",
  executeModel: true,
  contextWindow: "none",
  nextThoughtNeeded: true
})
```

**Present** the sub-problem tree to the user before diving in:

```
Found [N] sub-problems:
1. [Sub-problem A] (complexity: medium)
2. [Sub-problem B] → depends on A (complexity: high)
3. [Sub-problem C] (complexity: low)
...

Diving into each one...
```

### Step 2: Deep-Dive Each Sub-Problem (Sequential)

For EACH sub-problem (in dependency order), run a 2-step nextThought chain:

**Analysis step** (fresh context per sub-problem):
```
mcp__tachibot-mcp__nextThought({
  thought: "Deep-dive analysis of sub-problem: [sub-problem name]\n\nDescription: [sub-problem description]\n\nFull problem context: [original problem]\n\nAnalyze:\n1. What exactly needs to happen here?\n2. What are the edge cases?\n3. What could go wrong?\n4. What are the key decisions to make?\n5. What patterns or prior art exist?",
  model: "grok",
  executeModel: true,
  contextWindow: "none",
  nextThoughtNeeded: true
})
```

Model selection for analysis - use FIRST available:
1. `grok` - strong first-principles reasoning
2. `gemini` - broad analytical capability
3. `openai` - structured analysis
4. `kimi` - step-by-step depth

**Synthesis step** (sees the analysis):
```
mcp__tachibot-mcp__nextThought({
  thought: "Synthesize the deep-dive on: [sub-problem name]\n\nDistill to:\n- Core insight (1 sentence)\n- Key decisions needed\n- Risks identified\n- Recommended approach\n- Estimated effort: trivial / small / medium / large",
  model: "gemini",
  executeModel: true,
  contextWindow: "recent",
  nextThoughtNeeded: true
})
```

Model selection for synthesis - use a DIFFERENT model than analysis. Priority:
1. `gemini` - great at synthesis
2. `openai` - structured output
3. `kimi` - thorough summarization

### Step 3: Final Synthesis

After all sub-problems are analyzed, one final thought connecting everything:

```
mcp__tachibot-mcp__nextThought({
  thought: "Final synthesis of all [N] deep-dives:\n\n[List each sub-problem + its core insight]\n\nSynthesize:\n1. Where does the REAL complexity live? (which sub-problems are hardest)\n2. What connections exist between sub-problems that weren't obvious?\n3. What's the critical path?\n4. What should be tackled first and why?\n5. Are there sub-problems that could be eliminated or simplified?",
  model: "gemini",
  executeModel: true,
  contextWindow: "all",
  nextThoughtNeeded: false
})
```

### Step 4: Present Results

Format:

```markdown
## Decomposition: [problem]

### Sub-Problems ([N] found)

#### 1. [Sub-problem A] - [complexity]
**Insight:** [1 sentence core finding]
**Key decisions:** [what needs deciding]
**Risks:** [what could go wrong]
**Approach:** [recommended path]
**Effort:** [trivial/small/medium/large]

#### 2. [Sub-problem B] - [complexity]
...

### Where the Real Complexity Lives
[Which sub-problems are hardest and why]

### Hidden Connections
[Dependencies and interactions not obvious from the surface]

### Critical Path
1. [First] - [why first]
2. [Second] - [why second]
...

### Simplification Opportunities
[Sub-problems that could be eliminated or combined]
```

## Examples

- `/decompose implement a real-time collaborative editor`
- `/decompose 4 migrate monolith to microservices`
- `/decompose why is our CI pipeline taking 45 minutes`
- `/decompose design an API rate limiter that handles burst traffic`
```

**Step 2: Verify file exists**

Run: `ls -la skills/decompose/SKILL.md`
Expected: File present

**Step 3: Commit**

```bash
git add skills/decompose/
git commit -m "feat: add /decompose skill - split problems then deep-dive each with nextThought chains"
```

---

### Task 5: Create `/tachi` help & discovery skill

New skill for discoverability. Shows users what's available.

**Files:**
- Create: `skills/tachi/SKILL.md`

**Step 1: Write the tachi help skill**

`skills/tachi/SKILL.md`:
```markdown
---
name: tachi
description: TachiBot help - see available skills, tools, and configured API keys
user-invocable: true
---

# TachiBot Help

Show available TachiBot skills, tools, and API key status.

## Usage
```
/tachi
/tachi stats
```

## Instructions

When user invokes `/tachi`:

### Show Available Skills

Present this overview:

```
## TachiBot - Multi-Model AI Orchestration

### Skills (slash commands)

| Skill | What it does | Example |
|-------|-------------|---------|
| `/judge` | Multi-model council - parallel analysis + synthesis | `/judge how to implement auth` |
| `/think` | Sequential reasoning chain with any model | `/think grok,gemini design a cache` |
| `/focus` | Mode-based reasoning (debate, research, analyze) | `/focus architecture-debate SQL vs NoSQL` |
| `/breakdown` | Strategic overview: first principles + feasibility | `/breakdown add real-time collaboration` |
| `/decompose` | Split into pieces, deep-dive each one | `/decompose implement auth system` |
| `/prompt` | Apply prompt engineering techniques | `/prompt first_principles why users churn` |
| `/tachi` | This help screen | `/tachi` |

### Quick Start

1. Pick a skill based on your task:
   - **Need an answer?** → `/judge`
   - **Need to reason through something?** → `/think`
   - **Need to debate approaches?** → `/focus architecture-debate`
   - **Need a strategic overview?** → `/breakdown`
   - **Need to understand each piece deeply?** → `/decompose`
   - **Need a specific thinking technique?** → `/prompt list`

2. Or use tools directly: `grok_search`, `gemini_brainstorm`, `qwen_coder`, etc.
```

### Check API Key Status

Call the usage_stats tool to show what's configured:

```
mcp__tachibot-mcp__usage_stats({ action: "view", scope: "current", format: "table" })
```

Then summarize which providers are active based on whether their tools appear in available MCP tools.

### If `/tachi stats`:

Call usage stats with full scope:
```
mcp__tachibot-mcp__usage_stats({ action: "view", scope: "all", format: "table" })
```

Present the usage data with insights about most-used tools and cost efficiency.
```

**Step 2: Verify file exists**

Run: `ls -la skills/tachi/SKILL.md`
Expected: File present

**Step 3: Commit**

```bash
git add skills/tachi/
git commit -m "feat: add /tachi help skill for discoverability"
```

---

### Task 6: Update install.sh to deploy skills

The install script needs to copy skills to `~/.claude/skills/` so they're available globally.

**Files:**
- Modify: `install.sh:56-60` (after build, before success message)

**Step 1: Add skills deployment to install.sh**

After the `npm run build` line and before the success message, add:

```bash
# Install Claude Code skills
SKILLS_DIR="$HOME/.claude/skills"
echo "📝 Installing Claude Code skills..."

if [ -d "$INSTALL_DIR/skills" ]; then
    mkdir -p "$SKILLS_DIR"
    for skill_dir in "$INSTALL_DIR/skills"/*/; do
        skill_name=$(basename "$skill_dir")
        target_dir="$SKILLS_DIR/$skill_name"

        if [ -d "$target_dir" ]; then
            echo "   Updating: /$skill_name"
        else
            echo "   Installing: /$skill_name"
        fi

        mkdir -p "$target_dir"
        cp "$skill_dir"SKILL.md "$target_dir/SKILL.md"
    done
    echo "✅ Skills installed! Available: /judge, /think, /focus, /breakdown, /decompose, /prompt, /tachi"
else
    echo "⚠️  No skills directory found, skipping skill installation"
fi
```

Also update the final "Next steps" section to mention skills:

```bash
echo "💡 Try these skills in Claude Code:"
echo "   /judge how to implement auth?"
echo "   /think gemini optimize this query"
echo "   /breakdown add real-time collaboration"
echo "   /tachi (show all available skills)"
```

**Step 2: Test the install script skill deployment logic**

Run: `bash -n install.sh`
Expected: No syntax errors

**Step 3: Commit**

```bash
git add install.sh
git commit -m "feat: install.sh deploys skills to ~/.claude/skills/"
```

---

### Task 7: Update package-extension.sh to include skills

The `.mcpb` extension package needs to include the `skills/` directory.

**Files:**
- Modify: `scripts/package-extension.sh:29-42`

**Step 1: Add skills/ to the zip command**

Update the zip command to include the `skills/` directory:

```bash
zip -r "$PACKAGE_NAME" \
    manifest.json \
    dist/ \
    node_modules/ \
    package.json \
    smithery.yaml \
    tools.config.json \
    profiles/ \
    workflows/ \
    skills/ \
    README.md \
    LICENSE \
    .env.example \
    docs/ \
    -x "*.DS_Store" "*/__tests__/*" "*.test.js" "*.spec.js" "*/.git/*"
```

Also add a post-install note in the instructions section:

```bash
echo "📝 Skills included: /judge, /think, /focus, /breakdown, /decompose, /prompt, /tachi"
echo "   Copy skills/ to ~/.claude/skills/ for Claude Code slash commands"
```

**Step 2: Verify script syntax**

Run: `bash -n scripts/package-extension.sh`
Expected: No syntax errors

**Step 3: Commit**

```bash
git add scripts/package-extension.sh
git commit -m "feat: include skills/ directory in .mcpb extension package"
```

---

### Task 8: Update package.json files field

The npm package should include the skills directory too.

**Files:**
- Modify: `package.json` (files array)

**Step 1: Add skills/ to files array**

Add `"skills/"` to the `"files"` array in `package.json`, after `"workflows/"`:

```json
"files": [
    "dist/",
    "profiles/",
    "workflows/",
    "skills/",
    "docs/",
    "tools.config.json",
    ...
]
```

**Step 2: Verify package.json is valid JSON**

Run: `node -e "require('./package.json')"`
Expected: No errors

**Step 3: Commit**

```bash
git add package.json
git commit -m "feat: include skills/ in npm package distribution"
```

---

### Task 9: Add npm postinstall script for skill deployment

When users install via `npm install -g tachibot-mcp`, automatically deploy skills.

**Files:**
- Create: `scripts/install-skills.sh`
- Modify: `package.json` (add postinstall script)

**Step 1: Create the install-skills script**

`scripts/install-skills.sh`:
```bash
#!/bin/bash

# TachiBot MCP - Skill Installer
# Deploys Claude Code skills to ~/.claude/skills/

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SKILLS_SOURCE="$SCRIPT_DIR/../skills"
SKILLS_TARGET="$HOME/.claude/skills"

if [ ! -d "$SKILLS_SOURCE" ]; then
    exit 0  # No skills to install, skip silently
fi

mkdir -p "$SKILLS_TARGET"

installed=0
for skill_dir in "$SKILLS_SOURCE"/*/; do
    [ -d "$skill_dir" ] || continue
    skill_name=$(basename "$skill_dir")
    target_dir="$SKILLS_TARGET/$skill_name"

    mkdir -p "$target_dir"
    cp "$skill_dir"SKILL.md "$target_dir/SKILL.md"
    installed=$((installed + 1))
done

if [ "$installed" -gt 0 ]; then
    echo "TachiBot: $installed skills installed to $SKILLS_TARGET"
    echo "  Available: /judge, /think, /focus, /breakdown, /decompose, /prompt, /tachi"
fi
```

**Step 2: Make it executable**

Run: `chmod +x scripts/install-skills.sh`

**Step 3: Add postinstall to package.json**

Add to the `"scripts"` section:

```json
"postinstall": "bash scripts/install-skills.sh 2>/dev/null || true"
```

The `2>/dev/null || true` ensures it never breaks installation even if skills deployment fails.

**Step 4: Test the script**

Run: `bash scripts/install-skills.sh`
Expected: Prints number of skills installed

**Step 5: Commit**

```bash
git add scripts/install-skills.sh package.json
git commit -m "feat: auto-deploy skills on npm install via postinstall hook"
```

---

### Task 10: Update README to lead with skills

The README should show skills first - they're the user-facing product.

**Files:**
- Modify: `README.md` (add Skills section near top, after Quick Start)

**Step 1: Read current README structure**

Read: `README.md` to understand current section order.

**Step 2: Add Skills section after Quick Start**

Insert after the existing Quick Start section (or near the top):

```markdown
## Skills (Claude Code)

TachiBot ships with 7 slash commands for Claude Code. These orchestrate the tools into powerful workflows:

| Skill | What it does | Example |
|-------|-------------|---------|
| `/judge` | Multi-model council - parallel analysis with synthesis | `/judge how to implement rate limiting` |
| `/think` | Sequential reasoning chain with any model | `/think grok,gemini design a cache layer` |
| `/focus` | Mode-based reasoning (debate, research, analyze) | `/focus architecture-debate Redis vs Pg` |
| `/breakdown` | Strategic decomposition with feasibility check | `/breakdown add OAuth with refresh tokens` |
| `/decompose` | Split into sub-problems, deep-dive each one | `/decompose implement collaborative editor` |
| `/prompt` | Apply 22 prompt engineering techniques | `/prompt first_principles why users churn` |
| `/tachi` | Help - see available skills, tools, key status | `/tachi` |

Skills automatically adapt to your configured API keys. Even with just 1-2 providers, all skills work.

> **Getting started?** Type `/tachi` to see what's available.
```

**Step 3: Commit**

```bash
git add README.md
git commit -m "docs: add Skills section to README - lead with user-facing orchestration"
```

---

### Task 11: Update CLAUDE.md skills section

The CLAUDE.md should reference the bundled skills so Claude knows about them.

**Files:**
- Modify: `CLAUDE.md` (update Claude Code Skills section)

**Step 1: Read current CLAUDE.md skills section**

The current CLAUDE.md has a minimal skills section that only mentions `/judge`. Update it to cover all 6:

**Step 2: Replace the Claude Code Skills section**

Find the `## Claude Code Skills` section and replace with:

```markdown
## Claude Code Skills (Bundled)

TachiBot ships 6 skills in the `skills/` directory. These are deployed to `~/.claude/skills/` on install.

| Skill | Description | Key Tools Used |
|-------|------------|----------------|
| `/judge` | Multi-model council with fallback awareness | grok_search, perplexity_ask, grok_reason, kimi_thinking, openai_reason, gemini_analyze_text |
| `/think` | Sequential reasoning chains | nextThought |
| `/focus` | Mode-based multi-model reasoning | focus |
| `/breakdown` | Strategic decomposition pipeline (breadth-first) | execute_prompt_technique (first_principles, decompose, patterns, feasibility) |
| `/decompose` | Split into sub-problems, deep-dive each (depth-first) | kimi_decompose, nextThought chains |
| `/prompt` | Prompt engineering techniques | preview_prompt_technique, execute_prompt_technique |
| `/tachi` | Help & discovery | usage_stats |

All skills adapt to available API keys - no skill requires all providers.
```

**Step 3: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: update CLAUDE.md with all 6 bundled skills"
```

---

### Task 12: Verify everything works end-to-end

**Step 1: Check all skill files exist**

Run: `ls -la skills/*/SKILL.md`
Expected: 7 files (think, focus, prompt, judge, breakdown, decompose, tachi)

**Step 2: Test install-skills script**

Run: `bash scripts/install-skills.sh`
Expected: "7 skills installed"

**Step 3: Verify skills have correct frontmatter**

Run: `head -4 skills/*/SKILL.md`
Expected: Each has `name`, `description`, `user-invocable: true`

**Step 4: Test package-extension script syntax**

Run: `bash -n scripts/package-extension.sh`
Expected: No syntax errors

**Step 5: Test install.sh syntax**

Run: `bash -n install.sh`
Expected: No syntax errors

**Step 6: Verify package.json is valid**

Run: `node -e "JSON.parse(require('fs').readFileSync('package.json','utf8'))"`
Expected: No errors

**Step 7: Final commit (if any remaining changes)**

```bash
git add -A
git status
# Only commit if there are changes
```
