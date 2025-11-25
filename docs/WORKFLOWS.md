# Workflow System

Build complex multi-step AI orchestrations with YAML/JSON. Chain unlimited tools, pass outputs between steps, and create powerful automated reasoning processes.

## Table of Contents

- [What are Workflows?](#what-are-workflows)
- [Is This Just Agent Chaining?](#is-this-just-agent-chaining)
- [Complete Workflow Schema](#complete-workflow-schema)
- [Basic Workflow Structure](#basic-workflow-structure)
- [Variable Interpolation](#variable-interpolation)
- [Parallel Execution](#parallel-execution)
- [Advanced Features](#advanced-features)
  - [Token Limits & Cost Control](#token-limits--cost-control)
  - [Conditional Execution](#conditional-execution)
  - [Global Variables](#global-variables)
  - [Auto-Synthesis (MCP Token Limit Protection)](#auto-synthesis-mcp-token-limit-protection)
- [Example Workflow Patterns](#example-workflow-patterns)
- [Real-Time Verification](#real-time-verification)
- [Workflow Management Tools](#workflow-management-tools)
- [Best Practices](#best-practices)

## What are Workflows?

Workflows let you chain multiple AI tools together into automated sequences. Each step can use outputs from previous steps, run in parallel, or branch conditionally. Think of them as recipes for collective intelligence.

## Is This Just Agent Chaining?

**No, it's MORE sophisticated than simple chaining.** Here's the difference:

### Simple Agent Chaining (Basic)
```
Step 1 → Step 2 → Step 3 → Step 4

One after another, linear flow.
```

### TachiBot Swarm (Advanced)
```
Step 1: [Model A, Model B, Model C, Model D] ← PARALLEL
         ↓         ↓         ↓         ↓
Step 2: Synchronize all outputs
         ↓
Step 3: Deep collaborative reasoning (5 rounds)
         ↓
Step 4: Adversarial debate (3 rounds)
         ↓
Step 5: Final synthesis
```

### Key Differences

- **Parallel execution** - 4 models run simultaneously, not sequentially
- **Multi-round debates** - Models argue and refine for N rounds
- **Different modes** - Collaborative vs Debate vs Deep-reasoning
- **Synchronization** - Combines outputs intelligently, not just concatenation
- **Adversarial verification** - Models challenge each other's outputs

**Simple chaining:** A→B→C→D (sequential, one model per step)
**TachiBot:** [A,B,C,D in parallel] → Sync → Debate(5 rounds) → Challenge(3 rounds) → Synthesize

## Complete Workflow Schema

### Workflow Configuration

```typescript
interface WorkflowConfig {
  name: string;                    // Workflow identifier (required)
  description?: string;            // Human-readable description
  version?: string;                // Workflow version

  steps: WorkflowStep[];           // Array of workflow steps (required)

  // Optional settings
  settings?: {
    optimization?: {
      enabled?: boolean;           // Enable optimizations
      cacheResults?: boolean;      // Cache identical requests
      compressPrompts?: boolean;   // Compress long prompts
      smartRouting?: boolean;      // Automatic model selection
    };

    autoSynthesis?: {
      enabled?: boolean;           // Enable auto-synthesis (default: true)
      tokenThreshold?: number;     // Trigger at N tokens (default: 20000)
      checkpointInterval?: number; // Checkpoint every N tokens (default: 10000)
      synthesisTool?: string;      // Tool for synthesis (default: 'gemini_analyze_text')
      synthesisMaxTokens?: number; // Max tokens for synthesis (default: 6000)
      maxRetries?: number;         // Retry synthesis on failure (default: 3)
      logLevel?: 'silent' | 'error' | 'warn' | 'info' | 'debug'; // Logging verbosity (default: 'info')
    };
  };

  // Optional global variables
  variables?: Record<string, any>;

  // Optional output configuration
  output?: {
    format?: "detailed" | "summary";
  };
}
```

### Workflow Step Configuration

```typescript
interface WorkflowStep {
  // Basic step configuration
  name?: string;                   // Step name/identifier
  description?: string;            // Step description

  // Execution modes (choose ONE)

  // Option 1: Single tool execution
  tool?: string;                   // Tool name to execute
  params?: Record<string, any>;    // Tool parameters (legacy)
  input?: Record<string, any>;     // Tool parameters (preferred)
  output?: string | OutputConfig;  // Output variable name or config

  // Option 2: Parallel execution with multiple tools
  parallel?: boolean;              // Enable parallel execution
  tools?: ParallelTool[];          // Array of tools to run in parallel

  // Optional configuration
  maxTokens?: number;              // Token limit for this step
  condition?: string;              // JavaScript condition to evaluate
  skip?: boolean;                  // Skip this step if true
}

interface OutputConfig {
  variable: string;                // Variable name to store output
  transform?: string;              // Optional transformation function
}

interface ParallelTool {
  name: string;                    // Tool name (required)
  input: Record<string, any>;      // Tool parameters (required)
  output: {
    variable: string;              // Output variable name (required)
  };
}
```

### Variable Interpolation

Use `${variable_name}` in any string parameter to reference previous outputs:

```yaml
steps:
  - tool: perplexity_research
    params:
      topic: "REST API security"
    output: research_findings

  - tool: grok_reason
    params:
      problem: "Based on ${research_findings}, design secure API"
    output: design
```

## Basic Workflow Structure

Create workflows in YAML or JSON format:

### YAML Example

```yaml
name: my-workflow
description: What this workflow does
version: "1.0"

settings:
  optimization:
    enabled: true

steps:
  - tool: tool_name
    input:
      param1: value1
      param2: value2
    output:
      variable: variable_name
```

### JSON Example

```json
{
  "name": "my-workflow",
  "description": "What this workflow does",
  "version": "1.0",
  "settings": {
    "optimization": {
      "enabled": true
    }
  },
  "steps": [
    {
      "tool": "tool_name",
      "input": {
        "param1": "value1"
      },
      "output": {
        "variable": "variable_name"
      }
    }
  ]
}
```

## Parallel Execution

TachiBot supports explicit parallel execution. Steps marked with `parallel: true` run simultaneously, dramatically reducing execution time.

### Method 1: Group Parallel Steps (Recommended)

Use a single step with `parallel: true` and multiple `tools`:

```yaml
steps:
  # All 4 models run at the same time
  - name: diverse-sensing
    description: "Parallel intelligence gathering"
    parallel: true
    tools:
      - name: gemini_brainstorm
        input:
          prompt: "Creative perspective on: ${query}"
        output:
          variable: gemini_insights

      - name: openai_brainstorm
        input:
          problem: "${query}"
          style: "systematic"
        output:
          variable: openai_analysis

      - name: perplexity_ask
        input:
          query: "${query}"
        output:
          variable: perplexity_facts

      - name: grok_search
        input:
          query: "${query}"
          recency: "week"
        output:
          variable: grok_data

  # This step waits for all parallel steps to complete
  - name: synchronize
    tool: think
    input:
      thought: "Combine: ${gemini_insights}, ${openai_analysis}, ${perplexity_facts}, ${grok_data}"
    output:
      variable: synchronized_result
```

### Method 2: Individual Parallel Steps

Mark individual steps with `parallel: true`. All consecutive parallel steps run together:

```yaml
steps:
  # These 3 steps run in parallel (all have parallel: true)
  - tool: gemini_brainstorm
    params:
      prompt: "Analyze ${query}"
    output: gemini_result
    parallel: true

  - tool: grok_search
    params:
      query: "${query}"
    output: grok_result
    parallel: true

  - tool: perplexity_ask
    params:
      query: "${query}"
    output: perplexity_result
    parallel: true

  # This step waits for all parallel steps above
  - tool: think
    params:
      thought: "Synthesize: ${gemini_result}, ${grok_result}, ${perplexity_result}"
    output: final_result
```

### How Parallel Execution Works

- **Automatic batching** - The workflow engine batches consecutive `parallel: true` steps
- **Wait for completion** - The next non-parallel step waits for all parallel steps to finish
- **Variable access** - Each parallel step outputs to its own variable, accessible in later steps
- **Error handling** - If one parallel step fails, others continue; errors are collected
- **Performance gain** - 4 parallel steps take ~1x time instead of 4x sequential time

**Performance Example:**
- **Sequential:** 4 models × 5 seconds each = 20 seconds total
- **Parallel:** 4 models running simultaneously = ~5 seconds total

## Advanced Features

### Token Limits & Cost Control

**Important:** TachiBot workflows do NOT track or enforce dollar-based cost limits. Cost control is achieved through **token limits only**.

Control API costs by limiting token usage per step:

```yaml
settings:
  optimization:
    enabled: true
    cacheResults: true      # Reuse results to avoid duplicate API calls
    smartRouting: true      # Auto-select cheapest capable model

steps:
  - tool: openai_brainstorm
    input:
      problem: "${query}"
    maxTokens: 500  # Limit output to 500 tokens per step
```

**Why token limits instead of cost limits?**
- Each API provider charges different rates per model
- Token limits directly control API call size
- Model selection (`smartRouting`) automatically picks cheaper models when possible
- Caching reduces redundant API calls

### Conditional Execution

Skip steps based on conditions:

```yaml
steps:
  - name: security-check
    tool: gemini_analyze_code
    input:
      code: "${input}"
      focus: security
    output:
      variable: security_issues
    condition: "${input.includes('password')}"  # Only run if code contains "password"
```

### Global Variables

Define reusable variables:

```yaml
variables:
  severity_threshold: "medium"
  language: "auto-detect"

steps:
  - tool: gemini_analyze_code
    input:
      code: "${input}"
      language: "${language}"  # References global variable
```

### Auto-Synthesis (MCP Token Limit Protection)

**Problem:** Workflows with large outputs can exceed the 25,000 token MCP response limit, causing failures.

**Solution:** Auto-synthesis automatically generates an executive summary when:
- Total accumulated tokens exceed threshold (default: 20,000)
- Any step uses `saveToFile: true` (indicating large outputs)
- Workflow completes without an existing synthesis step

**How it works:**
1. **Detection**: After each step, checks if synthesis should trigger
2. **Generation**: Creates synthesis step using `gemini_analyze_text` (2M token context)
3. **Execution**: Summarizes all previous outputs into <2000 words
4. **Result**: Returns concise summary to Claude Code, full outputs saved to files

**Configuration:**

```yaml
name: my-large-workflow
settings:
  autoSynthesis:
    enabled: true                # Default: true (auto-enabled)
    tokenThreshold: 20000        # Trigger at 20k tokens (default)
    synthesisTool: gemini_analyze_text  # Tool for synthesis (default)
    synthesisMaxTokens: 6000     # Max tokens for summary (default)
    maxRetries: 3                # Retry on failure (default)
    logLevel: info               # silent|error|warn|info|debug
    checkpointInterval: 10000    # Save checkpoint every 10k tokens

steps:
  - name: deep-analysis
    tool: perplexity_research
    saveToFile: true  # Triggers auto-synthesis
    input:
      topic: "${query}"
      depth: deep
    output:
      variable: research

  - name: detailed-reasoning
    tool: grok_reason
    saveToFile: true
    input:
      problem: "${research}"
    output:
      variable: reasoning

  # Auto-synthesis step automatically added here!
  # - name: auto-synthesis
  #   tool: gemini_analyze_text
  #   input:
  #     text: "${research}\n\n${reasoning}"
  #     task: "Synthesize into executive summary..."
```

**Output:**

```
✅ STEP 1/2 COMPLETE: deep-analysis
[Full 50k token output...]

✅ STEP 2/2 COMPLETE: detailed-reasoning
[Full 40k token output...]

🤖 Auto-synthesis triggered (90000 tokens accumulated)
   Threshold: 20000 tokens
   Tool: gemini_analyze_text

📊 Generating executive summary...
   Steps to synthesize: 2
   Variables available: 2

✅ AUTO-SYNTHESIS COMPLETE
================================================================================
## Executive Summary

**Key Findings:**
1. [Concise finding 1]
2. [Concise finding 2]
3. [Concise finding 3]

**Recommended Next Steps:**
- [Action item 1]
- [Action item 2]

Note: Full outputs saved to workflow-output/my-large-workflow/2025-11-07-Thu-15-30-a1b2c3/
Files:
- deep-analysis.md (50k tokens)
- detailed-reasoning.md (40k tokens)

Use Read tool on saved files for full detailed analysis.
================================================================================
```

**Benefits:**
- ✅ **Prevents failures**: No more 25k token MCP limit errors
- ✅ **Automatic**: No manual synthesis steps needed
- ✅ **Transparent**: Full outputs saved to disk, summary returned
- ✅ **Fault-tolerant**: Checkpoints every 10k tokens, retry on failure
- ✅ **Configurable**: Disable or customize via settings

**Disabling Auto-Synthesis:**

```yaml
settings:
  autoSynthesis:
    enabled: false  # Disable if workflow already has manual synthesis
```

**When to disable:**
- Workflow already has final synthesis step
- All steps produce <5k tokens each
- You need full outputs in MCP response (risky for large workflows)

## Example Workflow Patterns

### Pattern 1: Sequential Research Pipeline

Research → Reason → Verify → Synthesize

```yaml
name: research-pipeline
description: Deep research with verification

steps:
  # Step 1: Initial research
  - tool: perplexity_research
    params:
      topic: "Kubernetes security best practices"
      depth: "deep"
    output: research_results

  # Step 2: Reasoning on research
  - tool: grok_reason
    params:
      problem: "Based on ${research_results}, what are the top 5 priorities?"
      approach: "systematic"
    output: priorities

  # Step 3: Verify with multiple sources
  - tool: verifier
    params:
      query: "Verify these priorities: ${priorities}"
      variant: "fact_check"
      includeSources: true
    output: verified_priorities

  # Step 4: Final synthesis
  - tool: think
    params:
      thought: "Synthesize ${research_results}, ${priorities}, ${verified_priorities} into actionable recommendations"
    output: final_recommendations
```

### Pattern 2: Parallel Intelligence Gathering

Multiple models run simultaneously for diverse perspectives:

```yaml
name: parallel-analysis
description: Gather insights from multiple sources in parallel

steps:
  # All 4 tools run simultaneously
  - name: diverse-sensing
    description: "Multi-source intelligence gathering"
    parallel: true
    tools:
      - name: perplexity_ask
        input:
          query: "Latest GraphQL trends 2025"
          searchRecency: "month"
          searchDomain: "general"
        output:
          variable: perplexity_trends

      - name: grok_search
        input:
          query: "GraphQL best practices 2025"
          recency: "week"
          max_search_results: 20
          sources:
            - type: "web"
              allowed_websites: ["github.com", "stackoverflow.com", "graphql.org"]
        output:
          variable: grok_code_insights

      - name: gemini_analyze_text
        input:
          text: "GraphQL vs REST in 2025"
          type: "general"
        output:
          variable: gemini_comparison

      - name: openai_brainstorm
        input:
          problem: "GraphQL architecture patterns"
          style: "systematic"
          quantity: 5
          model: "gpt-5.1-codex-mini"
        output:
          variable: openai_patterns

  # Synchronization step (waits for all parallel steps)
  - tool: think
    params:
      thought: "Combine insights from: ${perplexity_trends}, ${grok_code_insights}, ${gemini_comparison}, ${openai_patterns}"
    output: unified_analysis
```

### Pattern 3: Adversarial Debate & Challenge

Models debate and challenge each other to improve quality:

```yaml
name: debate-workflow
description: Multi-round debate for robust conclusions

steps:
  # Step 1: Initial proposal
  - tool: openai_brainstorm
    params:
      problem: "Design a distributed caching system"
      style: "innovative"
      quantity: 3
      model: "gpt-5.1-codex-mini"
    output: initial_design

  # Step 2: Challenge the design
  - tool: challenger
    params:
      context: "Challenge this caching design: ${initial_design}"
      thoroughness: "standard"
    output: challenges

  # Step 3: Collaborative refinement
  - tool: focus
    params:
      query: "Improve the design considering these challenges: ${challenges}"
      mode: "architecture-debate"
      domain: "backend"
      models: ["gpt-5.1-codex-mini", "gemini-2.5-pro", "grok-4"]
      rounds: 5
      pingPongStyle: "debate"
      temperature: 0.7
    output: refined_design

  # Step 4: Final verification
  - tool: verifier
    params:
      query: "Verify this refined design addresses the challenges: ${refined_design}"
      variant: "code_verify"
      models: ["gpt-5.1-codex-mini", "gemini-2.5-pro"]
    output: final_verdict
```

### Pattern 4: Code Analysis & Generation

Analyze requirements, generate code, review, and optimize:

```yaml
name: code-pipeline
description: Full code generation and review pipeline

steps:
  # Step 1: Research best practices
  - tool: scout
    params:
      query: "FastAPI authentication middleware best practices"
      variant: "code_scout"
      searchProvider: "both"
    output: best_practices

  # Step 2: Generate code
  - tool: qwen_coder
    params:
      task: "generate"
      language: "python"
      requirements: "Create FastAPI auth middleware based on: ${best_practices}"
    output: generated_code

  # Step 3: Parallel code review
  - parallel: true
    tools:
      - name: gemini_analyze_code
        input:
          code: "${generated_code}"
          focus: "security"
        output:
          variable: security_review

      - name: gemini_analyze_code
        input:
          code: "${generated_code}"
          focus: "performance"
        output:
          variable: performance_review

  # Step 4: Optimize based on reviews
  - tool: qwen_coder
    params:
      task: "optimize"
      code: "${generated_code}"
      requirements: "Address security (${security_review}) and performance (${performance_review}) issues"
    output: optimized_code
```

### Pattern 5: Swarm Intelligence (Complete Example)

The ultimate example combining all features:

```yaml
name: swarm-think
description: Tachikoma-style swarm intelligence with diverse sensing, synchronization, and synthesis

steps:
  # Step 1: Diverse Sensing (parallel perspectives)
  - tool: gemini_brainstorm
    params:
      prompt: "${query} - provide creative perspective"
      maxRounds: 1
    output: gemini_perspective

  - tool: openai_brainstorm
    params:
      problem: "${query}"
      style: "systematic"
      quantity: 3
      model: "gpt-5.1-codex-mini"
    output: gpt_perspective

  - tool: perplexity_ask
    params:
      query: "${query}"
      searchDomain: "general"
    output: perplexity_facts

  - tool: qwen_coder
    params:
      task: "explain"
      requirements: "${query} - provide technical analysis"
    output: qwen_technical

  # Step 2: Synchronization
  - tool: think
    params:
      thought: "Synchronizing perspectives: Gemini=${gemini_perspective}, GPT=${gpt_perspective}, Perplexity=${perplexity_facts}, Qwen=${qwen_technical}. Extract common patterns and unique insights."
    output: sync_analysis

  # Step 3: Real-time Data Enhancement
  - tool: grok_search
    params:
      query: "${query} latest information"
      recency: "week"
    output: latest_data

  # Step 4: Deep Processing (collaborative reasoning)
  - tool: focus
    params:
      query: "Based on synchronized analysis (${sync_analysis}) and latest data (${latest_data}), provide comprehensive answer to: ${query}"
      mode: "deep-reasoning"
      models: ["gpt-5.1-codex-mini", "gemini-2.5-pro", "perplexity"]
      rounds: 5
      pingPongStyle: "collaborative"
    output: deep_analysis

  # Step 5: Adversarial Challenge (debate mode)
  - tool: focus
    params:
      query: "Challenge and improve this analysis: ${deep_analysis}"
      mode: "architecture-debate"
      models: ["gpt-5.1-codex-mini", "gemini-2.5-pro", "grok-4"]
      rounds: 3
      pingPongStyle: "debate"
    output: challenged_analysis

  # Step 6: Final Synthesis
  - tool: think
    params:
      thought: |
        FINAL SYNTHESIS:

        Original perspectives:
        - Gemini: ${gemini_perspective}
        - GPT: ${gpt_perspective}
        - Perplexity: ${perplexity_facts}
        - Qwen: ${qwen_technical}

        Latest data: ${latest_data}

        Deep analysis: ${deep_analysis}

        Challenged analysis: ${challenged_analysis}

        Combine all perspectives with confidence levels and final recommendation.
    output: final_answer
```

## Real-Time Verification

TachiBot workflows can verify outputs against real-time information using Perplexity or Grok live search. This prevents hallucinations by grounding AI responses in actual, up-to-date data.

### Why Perplexity & Grok for Live Search?

TachiBot uses Perplexity and Grok for real-time verification because they provide **explicit, parameterized recency filters**:

- **Perplexity AI:** Supports structured recency filters ("day," "week," "month," "year") and precise publication date ranges via both UI and API
- **Grok:** Offers "Deep Search" and "Deeper Search" modes with recency-focused filtering, emphasizing latest/trending information
- **Gemini:** Supports time-based filtering through prompts (e.g., "last 6 months") but lacks explicit API parameters
- **Claude:** No explicit recency filter UI/API - relies on prompt instructions only
- **ChatGPT/OpenAI:** No documented recency filter parameters - prompt engineering can guide but not enforce strict date constraints

**Bottom line:** Perplexity and Grok provide reliable, programmatic control over search recency, making them ideal for fact-checking workflows that require up-to-date information.

### Verification Pattern

```yaml
steps:
  # Step 1: Models generate initial analysis
  - tool: openai_brainstorm
    params:
      problem: "Best practices for API authentication in 2025"
    output: initial_ideas

  # Step 2: Verify with real-time web search (Perplexity)
  - tool: perplexity_ask
    params:
      query: "API authentication best practices 2025"
      searchRecency: "month"
      searchDomain: "general"
    output: current_facts

  # Step 3: Verify with live web search (Grok)
  - tool: grok_search
    params:
      query: "API security recommendations 2025"
      recency: "week"
      max_search_results: 20
    output: latest_trends

  # Step 4: Compare initial ideas against verified facts
  - tool: verifier
    params:
      query: "Verify these ideas (${initial_ideas}) against current facts (${current_facts}) and trends (${latest_trends})"
      variant: "fact_check"
    output: verified_recommendations
```

### Why This Matters

- **Prevents hallucinations** - Models can't make up outdated information
- **Real-time accuracy** - Get information from the past week, day, or hour
- **Cross-verification** - Compare multiple search sources (Perplexity + Grok)
- **Fact-checking** - Use `verifier` tool to validate claims against search results
- **Recency filters** - Perplexity and Grok both support time-based filtering

**Best Practice:** For critical decisions, use this pattern: **Generate → Search → Verify → Synthesize**. Models brainstorm ideas, live search provides facts, verifier checks accuracy, then final synthesis combines both.

## Workflow Management Tools

### 1. `workflow` - Execute a workflow

Execute a workflow from config:

```typescript
workflow({
  name: string;           // Workflow name to execute (REQUIRED)
  query: string;          // The query/context for the workflow (REQUIRED)
  projectPath?: string;   // Path to project for custom workflows
})

// Example
workflow({
  name: "swarm-think",
  query: "What are the security implications of GraphQL?"
})
```

### 2. `list_workflows` - List available workflows

List all available workflows:

```typescript
list_workflows({
  projectPath?: string;   // Path to project for custom workflows
})

// Example
list_workflows()  // Lists all built-in workflows
```

### 3. `create_workflow` - Create a custom workflow

Create a workflow from template or custom YAML/JSON:

```typescript
create_workflow({
  name: string;                 // Name for the new workflow (REQUIRED)
  type: "code-review"           // Type of workflow (REQUIRED)
      | "brainstorm"
      | "debug"
      | "research"
      | "custom";
  steps?: string;               // Custom steps as YAML or JSON
})

// Example: Create from template
create_workflow({
  name: "my-api-review",
  type: "code-review"
})

// Example: Create custom workflow
create_workflow({
  name: "my-research-flow",
  type: "custom",
  steps: `
steps:
  - tool: perplexity_research
    params:
      topic: "\${query}"
    output: research
  - tool: think
    params:
      thought: "Summarize: \${research}"
    output: summary
`
})
```

### 4. `visualize_workflow` - Show workflow structure

Visualize the structure of a workflow:

```typescript
visualize_workflow({
  name: string;           // Workflow name to visualize (REQUIRED)
})

// Example
visualize_workflow({
  name: "swarm-think"
})

// Returns ASCII diagram showing:
// - All steps in order
// - Parallel execution groups
// - Variable dependencies
// - Tool usage
```

### Running Workflows (CLI)

```bash
# Run a workflow with a query
tachibot workflow run swarm-think "What are best practices for microservices?"

# List available workflows
tachibot workflow list

# Create custom workflow from template
tachibot workflow create my-workflow --type brainstorm
```

## Best Practices

### Workflow Design

1. **Start with diverse perspectives** - Use multiple models in parallel
2. **Add synchronization steps** - Combine insights intelligently
3. **Include challenge/debate steps** - Improve quality through adversarial testing
4. **End with synthesis** - Create final recommendations
5. **Name variables clearly** - Use `research_findings` not `r1`
6. **Use parallel execution** - When inputs don't depend on each other

### Performance Optimization

1. **Parallel over sequential** - Run independent steps simultaneously
2. **Enable caching** - Reuse identical requests
3. **Set token limits** - Control costs per step
4. **Use smart routing** - Let TachiBot choose the cheapest capable model

### Error Handling

1. **Use conditional execution** - Skip steps when appropriate
2. **Set `failOnError: false`** - Continue workflow on non-critical failures
3. **Add verification steps** - Validate outputs with `verifier` tool

### Cost Management

**Note:** TachiBot workflows do NOT enforce dollar-based cost limits. Control costs through token limits and smart model selection.

1. **Set maxTokens per step** - Limit output tokens to control API costs
2. **Use appropriate models** - Don't use GPT-5 for simple tasks, enable `smartRouting`
3. **Enable optimizations** - Caching reduces duplicate API calls
4. **Monitor token usage** - Track token consumption per step to estimate costs

## Where to Store Workflows

TachiBot auto-discovers workflows from:

- `workflows/` - **Recommended default** (plain folder)
- `.tachi/workflows/` - Alternative hidden config location

Create your workflow files in either location and TachiBot instantly recognizes them. No boilerplate, no complex setup.

## Next Steps

- [Complete Tools Reference](TOOLS_REFERENCE.md) - All available tools with schemas
- [Configuration Guide](CONFIGURATION.md) - Environment variables and settings
- [API Keys Setup](API_KEYS.md) - Get API keys for providers
- [Tool Profiles](../TOOL_PROFILES.md) - Token-optimized tool profiles

## Real-World Workflow Examples

The `workflows/` directory contains production-ready examples:

- **`code-review.yaml`** - Multi-perspective code review
- **`brainstorm.json`** - Creative brainstorming with research
- **`debug-helper.yaml`** - Debug assistance workflow
- **`test-search-tools.yaml`** - Search tools demo with Grok live search

Use these as starting points for your custom workflows!
