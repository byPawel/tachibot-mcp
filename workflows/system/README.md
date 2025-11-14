# System Workflows

Multi-step AI orchestration workflows with file-based chaining to bypass MCP token limits.

---

## Available Workflows

### 1. **verifier** - Multi-Model Consensus Verification

**Purpose:** Verify claims, statements, or facts using 5 different AI models and analyze consensus.

**Architecture:**
- 7 steps total (5 verification + 1 consensus + 1 formatting)
- Each model gets 10k tokens (saved to disk)
- Total capacity: **58k tokens** (vs 25k MCP limit)

**Usage:**
```bash
# Via workflow tool
mcp call workflow --name verifier --query "Claim to verify"

# Or use workflow runner directly
workflow verifier --query "Python is faster than JavaScript for all use cases"
```

**Models Used:**
1. GPT-5 Mini (openai_compare)
2. Gemini 2.5 (gemini_analyze_text)
3. Grok 4 (grok_code)
4. Qwen Coder (qwen_coder)
5. Perplexity Reasoning (perplexity_reason)

**Output Structure:**
```
workflow-output/verifier/{timestamp}/
  ├── verify_gpt5_mini.md     (10k tokens)
  ├── verify_gemini.md        (10k tokens)
  ├── verify_grok.md          (10k tokens)
  ├── verify_qwen.md          (10k tokens)
  ├── verify_perplexity.md    (10k tokens)
  ├── consensus_analysis.md   (8k tokens)
  ├── format_report.md        (4k tokens - final output)
  └── manifest.json           (execution metadata)
```

**When to Use:**
- Fact-checking controversial claims
- Technical accuracy verification
- Multi-perspective validation
- High-stakes decision support

---

### 2. **scout** - Intelligent Information Gathering

**Purpose:** Deep research and information gathering with temporal context and multi-source analysis.

**Architecture:**
- 6 steps total (2 search + 2 analysis + 1 synthesis + 1 formatting)
- Web research: 20k tokens per source
- Total capacity: **90k tokens**

**Usage:**
```bash
workflow scout --query "Latest developments in quantum computing"

# Or for technical topics
workflow scout --query "Rust async runtime comparison: tokio vs async-std"
```

**Steps:**
1. **Perplexity Deep Research** (20k tokens) - Academic and web sources
2. **Grok Live Search** (20k tokens) - X/Twitter integration, real-time data
3. **Gemini Analysis** (15k tokens) - Pattern recognition, temporal context
4. **Qwen Technical Analysis** (15k tokens) - Code, architecture, implementation
5. **GPT-5 Mini Reasoning Synthesis** (12k tokens) - Combined reasoning
6. **Format Scout Report** (8k tokens) - Structured output

**Output Includes:**
- Executive summary
- Key findings with confidence levels
- Temporal context (current/recent/emerging)
- Source reliability assessment
- Technical deep-dive (if applicable)
- Knowledge gaps and uncertainties
- Actionable recommendations

**When to Use:**
- Research new technologies or topics
- Market/competitive analysis
- Technical feasibility studies
- Literature review needs
- "What's the current state of X?" questions

---

### 3. **challenger** - Devil's Advocate Critical Analysis

**Purpose:** Challenge assumptions, find alternative perspectives, and strengthen arguments by exploring counter-positions.

**Architecture:**
- 6 steps total (claim extraction + counter-args + research + evidence + verification + synthesis)
- Total capacity: **64k tokens**

**Usage:**
```bash
workflow challenger --query "Remote work is always better than office work"

# For business decisions
workflow challenger --query "We should migrate our entire infrastructure to Kubernetes"
```

**Steps:**
1. **Extract Claims** (5k tokens) - Identify all assertions and assumptions
2. **Generate Counter-Arguments** (10k tokens) - Creative brainstorming of challenges
3. **Research Alternatives** (15k tokens) - Find opposing viewpoints and precedents
4. **Find Counter-Evidence** (12k tokens) - Data and examples that contradict
5. **Verify Counter-Arguments** (10k tokens) - Multi-model validation
6. **Synthesis Report** (12k tokens) - Comprehensive challenge analysis

**Output Includes:**
- Original position summary
- Identified claims and assumptions
- Counter-arguments by strength
- Alternative perspectives
- "What if we're backwards?" analysis
- Third-way options (synthesis positions)
- Strongest and weakest challenges
- Recommended modifications

**When to Use:**
- Pre-mortem analysis for decisions
- Strengthen proposals before presentation
- Find blindspots in strategy
- Challenge groupthink
- Risk assessment
- Debate preparation

---

## File-Based Chaining Technology

### How It Works

**Traditional Workflow (Hits Token Limit):**
```
Step 1 → 8k tokens in memory
Step 2 → 8k tokens in memory
Step 3 → 8k tokens in memory
Total: 24k tokens → ❌ Exceeds 25k MCP limit!
```

**File-Based Workflow (No Limit):**
```yaml
- name: step1
  saveToFile: true       # Saves full output to disk
  maxTokens: 20000       # Can be huge!

- name: step2
  saveToFile: true
  maxTokens: 20000

- name: synthesis
  loadFiles: ["step1", "step2"]  # Loads full content from disk
  input:
    text: "${step1}"             # Full 20k tokens available
```

**Memory Usage:**
- Step 1: 20k tokens → saved to `step1.md` → only 200-char summary in memory
- Step 2: 20k tokens → saved to `step2.md` → only 200-char summary in memory
- Step 3: Loads both files (40k tokens) → processes → saves result → summary in memory
- **Final MCP response:** "Workflow complete, see workflow-output/"

### Key Features

**1. `saveToFile: true`**
```yaml
- name: research
  tool: perplexity_research
  saveToFile: true        # ← Saves to workflow-output/
  maxTokens: 20000        # ← Can use high limits
```

**2. `loadFiles: [...]`**
```yaml
- name: analysis
  loadFiles: ["research", "search"]  # ← Loads from disk
  tool: gemini_analyze_text
  input:
    text: "${research}"              # ← Full content available
```

**3. Variable Interpolation**
```yaml
output:
  variable: my_result    # Creates ${my_result} variable

# Later steps can use:
input: "${my_result}"
```

**4. File Structure**
```
workflow-output/{workflow-name}/{timestamp-id}/
  ├── step1.md              # Full output with metadata
  ├── step2.md
  ├── step3.md
  └── manifest.json         # Execution tracking
```

---

## Comparison: Tools vs Workflows

### TypeScript Tools (Quick & Simple)

**Available as MCP tools:**
- `verifier` - Call TypeScript function directly
- `scout` - Call TypeScript function directly
- `challenger` - Call TypeScript function directly
- `auditor`, `architect`, `commit_guardian` - Also available

**Pros:**
- ✅ Single function call
- ✅ Fast for simple queries
- ✅ Returns results immediately
- ✅ Lower latency

**Cons:**
- ❌ Opaque (can't see internal model calls)
- ❌ Not configurable (hardcoded logic)
- ❌ Hits 25k token limit easily
- ❌ Can't inspect intermediate steps

**Usage:**
```javascript
// From within workflow
- name: verify
  tool: verifier
  input: "Claim to verify"
  maxTokens: 4000
```

### YAML Workflows (Powerful & Transparent)

**Available in `workflows/system/`:**
- `verifier.yaml` - 7 steps, 58k token capacity
- `scout.yaml` - 6 steps, 90k token capacity
- `challenger.yaml` - 6 steps, 64k token capacity

**Pros:**
- ✅ Transparent (see all steps)
- ✅ Configurable (modify YAML)
- ✅ No token limits (file-based)
- ✅ Inspectable outputs
- ✅ Can reuse intermediate results
- ✅ Fork and customize easily

**Cons:**
- ❌ Multiple API calls (slower)
- ❌ More complex setup
- ❌ Higher cost (more model calls)

**Usage:**
```bash
workflow verifier --query "Claim to verify"
# or
workflow scout --query "Research topic"
```

---

## When to Use Which

### Use TypeScript Tools When:
- Quick one-off queries
- Simple verification needs
- Speed is priority
- Output under 25k tokens
- Don't need to see intermediate steps

### Use YAML Workflows When:
- Complex multi-step analysis needed
- Want to see how conclusion was reached
- Need more than 25k tokens of output
- Want to inspect/debug each step
- Want to customize the process
- Research/analysis is mission-critical

---

## Customization Guide

### Fork and Modify

**Example: Custom verifier with only 3 models**

1. Copy workflow:
```bash
cp workflows/system/verifier.yaml workflows/my-quick-verifier.yaml
```

2. Edit YAML:
```yaml
steps:
  - name: verify_gpt5_mini
    # ... keep this

  - name: verify_gemini
    # ... keep this

  - name: verify_grok
    # ... keep this

  # Remove verify_qwen and verify_perplexity

  - name: consensus_analysis
    loadFiles: ["verify_gpt5_mini", "verify_gemini", "verify_grok"]
    # Update to only load 3 files
```

3. Run custom workflow:
```bash
workflow my-quick-verifier --query "Test"
```

### Adjust Token Limits

```yaml
# Lower for cost savings
maxTokens: 5000

# Higher for comprehensive analysis
maxTokens: 20000
```

### Change Models

```yaml
# Replace any tool
- name: verify_alternative
  tool: grok_brainstorm     # Use different tool
  # or
  tool: gemini_analyze_code # Different provider
```

---

## Cost Estimation

### verifier.yaml
- 5 verification calls @ 10k tokens each = ~50k tokens
- 1 consensus @ 8k tokens
- 1 formatting @ 4k tokens
- **Total:** ~62k tokens (~$0.15 - $0.30 depending on models)

### scout.yaml
- 2 search calls @ 20k tokens = 40k tokens
- 2 analysis calls @ 15k tokens = 30k tokens
- 1 synthesis @ 12k tokens
- 1 formatting @ 8k tokens
- **Total:** ~90k tokens (~$0.20 - $0.40)

### challenger.yaml
- 6 steps totaling ~64k tokens
- **Total:** ~$0.15 - $0.35

**Settings can limit costs:**
```yaml
settings:
  maxCost: 0.25  # Workflow stops if cost exceeds $0.25
```

---

## Troubleshooting

### "Variable not found"
Make sure step has `output.variable` set:
```yaml
- name: step1
  output:
    variable: my_var  # Creates ${my_var}
```

### "File not found"
Ensure `saveToFile: true` on earlier step:
```yaml
- name: step1
  saveToFile: true   # Required for loadFiles

- name: step2
  loadFiles: ["step1"]  # Now works
```

### "Tool not found"
Check tool name matches registered MCP tool:
```bash
# List available tools
mcp list-tools
```

---

## See Also

- [Workflow Documentation](../../docs/WORKFLOWS.md)
- [File Output Guide](../../docs/WORKFLOW_OUTPUT.md)
- [Tool Reference](../../docs/TOOLS_REFERENCE.md)
- [TypeScript Mode Implementations](../../src/modes/)
