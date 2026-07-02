# TachiBot MCP - Complete Tools Reference

**Complete parameter schemas and example calls for all 63 tools** (64 registered — `continue_focus` is an always-on companion to `focus` outside the profile system; see [Meta & Orchestration](#meta--orchestration)).

Schemas below are generated from the wire contract (`test/golden/__snapshots__/tool-contracts.json`) — the exact JSON Schema the MCP server publishes for each tool.

---

## Table of Contents

- [Research & Search](#research--search) (5): [perplexity_ask](#perplexity_ask) &#183; [perplexity_reason](#perplexity_reason) &#183; [grok_search](#grok_search) &#183; [openai_search](#openai_search) &#183; [gemini_search](#gemini_search)
- [Reasoning & Planning](#reasoning--planning) (14): [grok_reason](#grok_reason) &#183; [openai_reason](#openai_reason) &#183; [qwen_reason](#qwen_reason) &#183; [qwq_reason](#qwq_reason) &#183; [kimi_thinking](#kimi_thinking) &#183; [kimi_decompose](#kimi_decompose) &#183; [deepseek_reason](#deepseek_reason) &#183; [glm_reason](#glm_reason) &#183; [stepfun_reason](#stepfun_reason) &#183; [ernie_reason](#ernie_reason) &#183; [planner_maker](#planner_maker) &#183; [planner_runner](#planner_runner) &#183; [list_plans](#list_plans) &#183; [spec_writer](#spec_writer)
- [Code Intelligence](#code-intelligence) (11): [kimi_code](#kimi_code) &#183; [grok_code](#grok_code) &#183; [grok_debug](#grok_debug) &#183; [qwen_coder](#qwen_coder) &#183; [qwen_algo](#qwen_algo) &#183; [qwen_competitive](#qwen_competitive) &#183; [deepseek_algo](#deepseek_algo) &#183; [minimax_code](#minimax_code) &#183; [minimax_agent](#minimax_agent) &#183; [testgen](#testgen) &#183; [debug_triage](#debug_triage)
- [Analysis & Judgment](#analysis--judgment) (14): [gemini_analyze_text](#gemini_analyze_text) &#183; [gemini_analyze_code](#gemini_analyze_code) &#183; [gemini_judge](#gemini_judge) &#183; [jury](#jury) &#183; [diff_review](#diff_review) &#183; [plan_critique](#plan_critique) &#183; [gemini_brainstorm](#gemini_brainstorm) &#183; [openai_brainstorm](#openai_brainstorm) &#183; [openai_code_review](#openai_code_review) &#183; [openai_explain](#openai_explain) &#183; [grok_brainstorm](#grok_brainstorm) &#183; [grok_architect](#grok_architect) &#183; [security_review](#security_review) &#183; [kimi_long_context](#kimi_long_context)
- [Meta & Orchestration](#meta--orchestration) (7): [think](#think) &#183; [nextThought](#nextthought) &#183; [focus](#focus) &#183; [continue_focus](#continue_focus) &#183; [tachi](#tachi) &#183; [doctor](#doctor) &#183; [usage_stats](#usage_stats)
- [Workflows](#workflows) (9): [workflow](#workflow) &#183; [workflow_start](#workflow_start) &#183; [continue_workflow](#continue_workflow) &#183; [list_workflows](#list_workflows) &#183; [create_workflow](#create_workflow) &#183; [visualize_workflow](#visualize_workflow) &#183; [workflow_status](#workflow_status) &#183; [validate_workflow](#validate_workflow) &#183; [validate_workflow_file](#validate_workflow_file)
- [Prompt Engineering](#prompt-engineering) (3): [list_prompt_techniques](#list_prompt_techniques) &#183; [preview_prompt_technique](#preview_prompt_technique) &#183; [execute_prompt_technique](#execute_prompt_technique)
- [Local Models](#local-models) (1): [local_query](#local_query)

---

## Research & Search

### perplexity_ask

Web search. Put your QUERY in the `query` parameter.

#### Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `query` | `string` | ✅ Yes | - | The search query or question |
| `searchDomain` | `"general" \| "academic" \| "news" \| "social"` | No | - | Search domain filter |
| `searchRecency` | `"hour" \| "day" \| "week" \| "month" \| "year"` | No | - | Recency filter |
| `files` | `string[]` | No | - | File paths to read as code context. Supports line ranges: `src/foo.ts:100-200` |

#### Example

```typescript
perplexity_ask({
  query: "latest AI reasoning benchmarks",
  searchDomain: "academic",
  searchRecency: "month"
})
```

---

### perplexity_reason

Reasoning with search. Put your PROBLEM in the `problem` parameter.

#### Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `problem` | `string` | ✅ Yes | - | The problem to reason about |
| `approach` | `string` | No | - | Reasoning approach (e.g. analytical, creative, systematic, comparative) |
| `context` | `string` | No | - | Additional context for the reasoning task |
| `files` | `string[]` | No | - | File paths to read as code context |

#### Example

```typescript
perplexity_reason({
  problem: "Why is Python slower than C++ for numerical computing?",
  approach: "analytical"
})
```

---

### grok_search

Web search.

#### Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `query` | `string` | ✅ Yes | - | Search query |
| `max_search_results` | `number` | No | - | Max sources searched (costs per 1k) |
| `recency` | `"all" \| "day" \| "week" \| "month" \| "year"` | No | - | Time filter |
| `sources` | `Array<{type: "web"\|"news"\|"x"\|"rss", allowed_websites?: string[], country?: string}>` | No | - | Source configuration |

#### Example

```typescript
grok_search({
  query: "Next.js app router documentation",
  sources: [{ type: "web", allowed_websites: ["nextjs.org"] }],
  recency: "year"
})
```

---

### openai_search

Web search using GPT-5.4 with real-time web access. Put your QUERY in the `query` parameter.

#### Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `query` | `string` | ✅ Yes | - | The search query |
| `searchContextSize` | `"low" \| "medium" \| "high"` | No | `"medium"` | Search depth |
| `city` | `string` | No | - | City for location-aware results |
| `country` | `string` | No | - | Country for location-aware results (e.g. `US`, `UK`) |

#### Example

```typescript
openai_search({
  query: "current mortgage rates",
  searchContextSize: "high",
  country: "US"
})
```

---

### gemini_search

Web search via Gemini with Google Search grounding.

#### Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `query` | `string` | ✅ Yes | - | Search query |
| `mode` | `"dynamic" \| "on" \| "off"` | No | `"on"` | `on` always searches, `dynamic` lets the model decide, `off` disables |
| `dynamicThreshold` | `number` (0-1) | No | `0.7` | Confidence threshold for dynamic mode |
| `recency` | `"hour" \| "day" \| "week" \| "month" \| "year" \| "any"` | No | `"any"` | Prefer results from this time range (enforced via prompt) |

#### Example

```typescript
gemini_search({
  query: "2026 EV tax credit changes",
  recency: "month"
})
```

---

## Reasoning & Planning

### grok_reason

Deep reasoning. Put your PROBLEM or QUESTION in the `problem` parameter.

#### Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `problem` | `string` | ✅ Yes | - | The problem or question to reason about |
| `approach` | `string` | No | - | Reasoning approach (e.g. analytical, creative, systematic, first-principles) |
| `context` | `string` | No | - | Additional context |
| `useHeavy` | `boolean` | No | - | Use expensive Grok 4 Heavy model ($3/$15) for complex tasks |
| `files` | `string[]` | No | - | File paths to read as code context |

#### Example

```typescript
grok_reason({
  problem: "Design a consensus algorithm for distributed systems",
  approach: "first-principles",
  useHeavy: true
})
```

---

### openai_reason

Mathematical reasoning using GPT-5.2-thinking. Put your QUERY in the `query` parameter.

#### Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `query` | `string` | ✅ Yes | - | The question or problem to reason about |
| `mode` | `string` | No | `"analytical"` | Reasoning mode (e.g. mathematical, scientific, logical, analytical) |
| `context` | `string` | No | - | Additional context |
| `files` | `string[]` | No | - | File paths to read as code context |

#### Example

```typescript
openai_reason({
  query: "Prove that the halting problem is undecidable",
  mode: "mathematical"
})
```

---

### qwen_reason

Heavy mathematical reasoning with Qwen3-Max-Thinking (>1T params, 98% HMMT). Put your PROBLEM in the `problem` parameter.

#### Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `problem` | `string` | ✅ Yes | - | The problem to reason about |
| `approach` | `string` | No | `"mathematical"` | Reasoning approach (e.g. mathematical, logical, proof, step-by-step) |
| `context` | `string` | No | - | Additional context |
| `files` | `string[]` | No | - | File paths to read as code context |

#### Example

```typescript
qwen_reason({
  problem: "Prove the AM-GM inequality for n=3",
  approach: "proof"
})
```

---

### qwq_reason

Multi-perspective deliberation: simulate 4 opposing viewpoints (optimist/pessimist/domain-expert/contrarian) then synthesize a balanced verdict. Use when a problem needs debate, not just analysis. Put your PROBLEM in the `problem` parameter.

#### Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `problem` | `string` | ✅ Yes | - | The problem to reason about |
| `approach` | `string` | No | `"multi-perspective"` | `multi-perspective` (default), `mathematical`, `logical`, `creative` |
| `context` | `string` | No | - | Additional context |
| `useFree` | `boolean` | No | `true` | Use free tier model |
| `files` | `string[]` | No | - | File paths to read as code context |

#### Example

```typescript
qwq_reason({
  problem: "Should we adopt a 4-day work week?",
  approach: "multi-perspective"
})
```

---

### kimi_thinking

Kimi K2.7-Code multimodal reasoning (always-thinking). Put your PROBLEM in the `problem` parameter.

#### Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `problem` | `string` | ✅ Yes | - | The problem to reason about |
| `approach` | `string` | No | `"step-by-step"` | Reasoning approach (e.g. step-by-step, analytical, creative, systematic) |
| `maxSteps` | `integer` (1-10) | No | `3` | Maximum reasoning steps |
| `context` | `string` | No | - | Additional context |
| `files` | `string[]` | No | - | File paths to read as code context |

#### Example

```typescript
kimi_thinking({
  problem: "Design a rate limiter for a multi-tenant API",
  maxSteps: 5
})
```

---

### kimi_decompose

Structured task decomposition with Kimi K2.7-Code extended reasoning. Breaks tasks into subtasks with IDs, dependencies, and acceptance criteria.

#### Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `task` | `string` | ✅ Yes | - | The task to decompose |
| `depth` | `integer` (1-5) | No | `3` | Maximum decomposition depth levels |
| `outputFormat` | `"tree" \| "flat" \| "dependencies"` | No | `"tree"` | Output structure |
| `context` | `string` | No | - | Additional context about the project, codebase, or constraints |
| `files` | `string[]` | No | - | File paths to read and include as context |

#### Example

```typescript
kimi_decompose({
  task: "Migrate monolith to microservices",
  depth: 3,
  outputFormat: "dependencies"
})
```

---

### deepseek_reason

Deep reasoning with DeepSeek V4 Pro (open-weight frontier — MLA/GRPO, top AIME/GPQA/math). Put your PROBLEM in the `problem` parameter.

#### Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `problem` | `string` | ✅ Yes | - | The problem to reason about |
| `approach` | `string` | No | `"analytical"` | Reasoning approach (e.g. analytical, mathematical, first-principles, step-by-step) |
| `context` | `string` | No | - | Additional context |
| `files` | `string[]` | No | - | File paths to read as code context |

#### Example

```typescript
deepseek_reason({
  problem: "Optimal strategy for the multi-armed bandit problem",
  approach: "mathematical"
})
```

---

### glm_reason

Agentic reasoning & tool-use planning with Zhipu GLM-5.2 (1M ctx, top open-weights for long-horizon coding). Put your PROBLEM in the `problem` parameter.

#### Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `problem` | `string` | ✅ Yes | - | The problem to reason about |
| `approach` | `string` | No | `"agentic"` | Reasoning approach (e.g. agentic, systematic, analytical, step-by-step) |
| `context` | `string` | No | - | Additional context |
| `files` | `string[]` | No | - | File paths to read as code context |

#### Example

```typescript
glm_reason({
  problem: "Plan a multi-step tool-use sequence to migrate a database schema",
  approach: "agentic"
})
```

---

### stepfun_reason

Efficient deep reasoning with StepFun Step 3.7 Flash (196B — high AIME/SWE-Verified at lower cost). Put your PROBLEM in the `problem` parameter.

#### Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `problem` | `string` | ✅ Yes | - | The problem to reason about |
| `approach` | `string` | No | `"analytical"` | Reasoning approach (e.g. analytical, mathematical, step-by-step) |
| `context` | `string` | No | - | Additional context |
| `files` | `string[]` | No | - | File paths to read as code context |

#### Example

```typescript
stepfun_reason({
  problem: "Fastest way to detect cycles in a large directed graph",
  approach: "analytical"
})
```

---

### ernie_reason

Broad-knowledge reasoning with Baidu ERNIE 4.5 VL (424B MoE — human-preference/arena strength). Put your PROBLEM in the `problem` parameter.

#### Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `problem` | `string` | ✅ Yes | - | The problem to reason about |
| `approach` | `string` | No | `"analytical"` | Reasoning approach (e.g. analytical, systematic, step-by-step) |
| `context` | `string` | No | - | Additional context |
| `files` | `string[]` | No | - | File paths to read as code context |

#### Example

```typescript
ernie_reason({
  problem: "Compare the tradeoffs of REST vs GraphQL for a public API",
  approach: "systematic"
})
```

---

### planner_maker

Multi-model council for creating implementation plans. **Coordinator pattern** — returns one tool to execute at a time.

1. Call with `mode: "start"` to begin.
2. Execute the returned tool.
3. Call with `mode: "continue"` and prior results.
4. Repeat until `isComplete: true`.

#### Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `task` | `string` | ✅ Yes | - | The task/goal to create a plan for |
| `mode` | `"start" \| "continue"` | No | `"start"` | `start`: begin new plan, `continue`: next step |
| `goal` | `string` | No | - | Success criteria for this plan — checked at every checkpoint |
| `step` | `number` | No | - | Current step number (for `continue` mode) |
| `prior` | `Record<string, string>` | No | - | Results from previous steps: `{ search: '...', analyze_qwen: '...' }` |
| `answers` | `string` | No | - | Answers to clarifying questions |
| `codeContext` | `string` | No | - | Actual code from relevant files for analysis |
| `context` | `string` | No | - | Additional context |
| `files` | `string[]` | No | - | File paths to read as code context |
| `issueFile` | `string` | No | - | Path to an issue/spec markdown file, merged into context |
| `debate` | `boolean` | No | `false` | Enable lightweight pro/con debate between Analysis and Critique |
| `responsive` | `boolean` | No | `false` | Enable responsive design review (auto-detected from keywords) |
| `ux` | `boolean` | No | `false` | Enable UX/accessibility review steps (auto-detected from keywords) |
| `dokoro` | `boolean` | No | `true` | Include dokoro hints for sync |

#### Example

```typescript
planner_maker({ task: "Add auth", mode: "start" })
// → { nextTool: { tool: "grok_search", params: {...} }, step: 1 }

// [Execute grok_search]

planner_maker({ task: "Add auth", mode: "continue", step: 2, prior: { search: "..." } })
// → { nextTool: { tool: "qwen_coder", params: {...} }, step: 2 }
// ... continue until isComplete: true
```

---

### planner_runner

Execute implementation plans step-by-step with goal-oriented verification. **Coordinator pattern** — tracks actual plan steps.

1. Call with `mode: "start"` to parse the plan and begin.
2. Call with `mode: "step"` and `stepNum` to work on a specific step.
3. Call with `mode: "verify"` at 50%, 80%, and 100% for checkpoints.

Checkpoints verify goal alignment with 5 different models (no repeats adjacent): step1 Gemini Sherlock gate, 10% Grok early-drift catch, 25% GPT strategy validation, 50% Qwen reason, 80% Kimi decompose remaining work, 100% GPT first judge → Gemini final judge + Reflexion Lite.

#### Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `plan` | `string` | ✅ Yes | - | The implementation plan from `planner_maker` |
| `mode` | `"start" \| "step" \| "verify"` | No | `"start"` | `start`: parse plan, `step`: work on step N, `verify`: checkpoint |
| `checkpoint` | `"step1" \| "10%" \| "25%" \| "50%" \| "80%" \| "100%"` | No | - | Checkpoint for `mode=verify` |
| `stepNum` | `number` | No | - | Step number (1-indexed) for `mode=step` |
| `goal` | `string` | No | - | Success criteria — extracted from plan frontmatter or provided manually |
| `completed` | `number[]` | No | - | List of completed step numbers |
| `diff` | `string` | No | - | Git diff output showing what changed (`git diff`) — most important drift evidence |
| `modifiedFiles` | `string[]` | No | - | Modified files (`git diff --name-only`) — detects scope creep |
| `testResults` | `string` | No | - | Test output (`npm test`) — proof implementation works |
| `code` | `string` | No | - | Current code snapshot for verification |
| `files` | `string[]` | No | - | File paths to read as code context |
| `responsive` | `boolean` | No | `false` | Add responsiveness verification at checkpoints |
| `ux` | `boolean` | No | `false` | Add UX verification at checkpoints |
| `dokoro` | `boolean` | No | `true` | Include dokoro hints for sync |

#### Example

```typescript
planner_runner({ plan: planContent, mode: "step", stepNum: 1 })
planner_runner({ plan: planContent, mode: "verify", checkpoint: "50%", diff: gitDiffOutput })
```

---

### list_plans

List recently created plans from `planner_maker`. Shows plans from the last N days (default 7) with filename, task, and status.

#### Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `days` | `number` | No | `7` | Show plans from last N days |

#### Example

```typescript
list_plans({ days: 14 })
```

---

### spec_writer

Turn a loose feature request into a reviewable spec using GPT-5.5: user stories, Given/When/Then acceptance criteria, non-functional requirements, explicit out-of-scope, and open questions. For sign-off BEFORE planning — feed the approved spec to `planner_maker`.

#### Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `request` | `string` | ✅ Yes | - | The feature request, as loose as it comes — REQUIRED |
| `context` | `string` | No | - | System context (existing behavior, constraints, user base) |
| `files` | `string[]` | No | - | Relevant code/doc paths for grounding. Supports line ranges: `src/foo.ts:100-200` |
| `format` | `"user_story" \| "gherkin" \| "both"` | No | `"both"` | Acceptance-criteria format |

#### Example

```typescript
spec_writer({
  request: "Add real-time notifications when a task is assigned to me",
  context: "Current app uses websockets for live updates",
  format: "gherkin"
})
```

---

## Code Intelligence

### kimi_code

SWE-focused code generation/fixing with Kimi K2.7-Code (coding-specialized). Put your REQUEST in the `query` parameter.

#### Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `query` | `string` | ✅ Yes | - | Your request or question |
| `task` | `"generate" \| "fix" \| "review" \| "optimize" \| "debug" \| "refactor"` | No | `"review"` | Code task type |
| `code` | `string` | No | - | Source code to work with (for fix/review/optimize/debug/refactor) |
| `language` | `string` | No | - | Programming language (e.g. `typescript`, `python`) |
| `files` | `string[]` | No | - | File paths to read as code context |

#### Example

```typescript
kimi_code({
  task: "review",
  query: "Check for race conditions",
  code: "function processPayment(amount, card) { ... }",
  language: "typescript"
})
```

---

### grok_code

Code analysis. Put the CODE in the `code` parameter, NOT in `task`.

#### Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `task` | `string` | ✅ Yes | - | Code task (e.g. analyze, optimize, debug, review, refactor) |
| `code` | `string` | ✅ Yes | - | The actual source code to analyze |
| `language` | `string` | No | - | Programming language |
| `requirements` | `string` | No | - | Specific requirements or focus areas |
| `files` | `string[]` | No | - | File paths to read as code context |

#### Example

```typescript
grok_code({
  task: "optimize",
  code: "SELECT * FROM users WHERE status = 'active'",
  language: "sql",
  requirements: "Table has 10M rows, queried frequently"
})
```

---

### grok_debug

Debug assistance. Describe the ISSUE in the `issue` parameter.

#### Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `issue` | `string` | ✅ Yes | - | Description of the issue or bug |
| `code` | `string` | No | - | Relevant code that has the issue |
| `error` | `string` | No | - | Error message or stack trace |
| `context` | `string` | No | - | Additional context about the environment or conditions |
| `files` | `string[]` | No | - | File paths to read as code context |

#### Example

```typescript
grok_debug({
  issue: "fetch response has no .json() method",
  error: "TypeError: data.json is not a function",
  context: "Using Node.js fetch API"
})
```

---

### qwen_coder

Code generation and analysis with Qwen3-Coder-Next. Put your REQUEST in the `query` parameter.

#### Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `query` | `string` | ✅ Yes | - | Your request or question |
| `task` | `"generate" \| "review" \| "optimize" \| "debug" \| "refactor" \| "explain" \| "analyze"` | No | `"analyze"` | Code task type |
| `code` | `string` | No | - | Source code to work with |
| `language` | `string` | No | - | Programming language |
| `useFree` | `boolean` | No | `false` | Use free tier model instead of premium |
| `files` | `string[]` | No | - | File paths to read as code context |

#### Example

```typescript
qwen_coder({
  task: "generate",
  query: "Binary search tree with insert, delete, and search",
  language: "python"
})
```

---

### qwen_algo

Expert algorithm analysis: complexity profiling, optimization tiers, constraint-driven recommendations, competitive programming patterns. Put PROBLEM/CODE in `problem` parameter.

#### Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `problem` | `string` | ✅ Yes | - | The algorithm problem or code to analyze |
| `focus` | `string` | No | `"general"` | `optimize`, `complexity`, `data-structure`, `memory`, `correctness`, `competitive`, `cache`, `general` |
| `constraints` | `string` | No | - | Input constraints: N size, time/memory limit (e.g. `N≤10^5, 1s, 256MB`) |
| `context` | `string` | No | - | Additional context: current performance, environment, language |
| `files` | `string[]` | No | - | File paths to read as code context |

#### Example

```typescript
qwen_algo({
  problem: "Find the k-th smallest element in a BST",
  focus: "complexity",
  constraints: "N≤10^6, 1s"
})
```

---

### qwen_competitive

Competitive programming. Put the PROBLEM in the `problem` parameter.

#### Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `problem` | `string` | ✅ Yes | - | The competitive programming problem |
| `language` | `"python" \| "cpp" \| "java" \| "javascript" \| "rust"` | No | `"python"` | Target language |
| `constraints` | `string` | No | - | Problem constraints (e.g. `n <= 10^5`) |
| `optimize` | `boolean` | No | `true` | Optimize for time and space complexity |
| `files` | `string[]` | No | - | File paths to read as code context |

**Note:** this tool is only enabled in the `full` profile (off by default in `minimal`/`research_power`/`code_focus`/`balanced`/`heavy_coding`).

#### Example

```typescript
qwen_competitive({
  problem: "Given an array, find the longest increasing subsequence",
  language: "cpp",
  constraints: "n <= 10^5"
})
```

---

### deepseek_algo

Algorithmic code review with DeepSeek V4 Pro (top AIME/CodeElo): correctness, complexity/Big-O, edge cases, data-structure choice, optimization. Put PROBLEM/CODE in `problem`.

#### Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `problem` | `string` | ✅ Yes | - | The algorithm problem or code to review |
| `focus` | `string` | No | `"general"` | `correctness`, `complexity`, `optimize`, `data-structure`, `edge-cases`, `general` |
| `constraints` | `string` | No | - | Input constraints: N size, time/memory limit |
| `context` | `string` | No | - | Additional context: current performance, language, environment |
| `files` | `string[]` | No | - | File paths to read as code context |

**Recommended pick** for algorithmic/correctness/Big-O/edge-case/CP-style review; `qwen_algo` and `qwq_reason` are the runners-up.

#### Example

```typescript
deepseek_algo({
  problem: "Review this Dijkstra implementation for correctness and Big-O",
  files: ["src/lib/shortest-path.ts"]
})
```

---

### minimax_code

Single-pass code operations with MiniMax M3 (1M ctx, strong agentic/coding). Put your REQUEST in the `query` parameter. For multi-step tasks, use `minimax_agent` instead.

#### Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `query` | `string` | ✅ Yes | - | Your request or question |
| `task` | `"generate" \| "fix" \| "review" \| "optimize" \| "debug" \| "refactor"` | No | `"review"` | Code task type |
| `code` | `string` | No | - | Source code to work with |
| `language` | `string` | No | - | Programming language |
| `files` | `string[]` | No | - | File paths to read as code context |

#### Example

```typescript
minimax_code({
  task: "refactor",
  query: "Extract this into smaller functions",
  code: "function handleRequest(req, res) { ... }"
})
```

---

### minimax_agent

Multi-step task decomposition and execution with MiniMax M3: plan, analyze, research, decide. Use when a task needs breakdown into steps before execution. For single-pass code tasks, use `minimax_code` instead. Put TASK in `task` parameter.

#### Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `task` | `string` | ✅ Yes | - | The task to execute |
| `steps` | `integer` (1-20) | No | `5` | Maximum steps to plan |
| `outputFormat` | `"plan" \| "execute" \| "both"` | No | `"both"` | `plan` (just steps), `execute` (just results), `both` |
| `context` | `string` | No | - | Additional context about the environment or constraints |
| `files` | `string[]` | No | - | File paths to read as code context |

#### Example

```typescript
minimax_agent({
  task: "Add rate limiting to the public API",
  steps: 6,
  outputFormat: "both"
})
```

---

### testgen

Generate runnable tests with a coding-specialized model (Qwen3-Coder-Next). Enumerates edge cases first, then emits test code. Provide `code` or `files`.

#### Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `code` | `string` | No* | - | The code to generate tests for (*or use `files`) |
| `files` | `string[]` | No* | - | File paths to read as code-under-test |
| `coverage` | `"edge" \| "happy" \| "regression" \| "all"` | No | `"all"` | Coverage focus |
| `framework` | `string` | No | - | Test framework (e.g. jest, vitest, pytest). Omit to infer |
| `existingTests` | `string` | No | - | Paste existing tests so generated ones match conventions |

#### Example

```typescript
testgen({
  files: ["src/utils/api-keys.ts"],
  coverage: "edge",
  framework: "vitest"
})
```

---

### debug_triage

Systematic bug triage using Grok 4.3: ranked root-cause hypotheses with likelihoods, discriminating checks, and minimal fix for the top candidate. Provide the error/stack trace in `error`.

#### Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `error` | `string` | ✅ Yes | - | The error message or stack trace — REQUIRED |
| `code` | `string` | No | - | Relevant code (or use `files`) |
| `files` | `string[]` | No | - | File paths to read server-side. Supports line ranges: `src/foo.ts:100-200` |
| `context` | `string` | No | - | Repro steps, recent changes, frequency (always/intermittent) |
| `runtime` | `string` | No | - | Runtime/environment (e.g. `node 22`, `python 3.12/django`, browser) |

#### Example

```typescript
debug_triage({
  error: "TypeError: Cannot read property 'slice' of undefined\n at processData (src/utils/parser.ts:42:15)",
  context: "Started happening after recent refactor",
  runtime: "node 22",
  files: ["src/utils/parser.ts:35-50"]
})
```

---

## Analysis & Judgment

### gemini_analyze_text

Rhetorical analysis: dissect arguments for bias, logical fallacies, and persuasion tactics. Use for evaluating claims, detecting manipulation, or understanding argument structure. Put the TEXT in the `text` parameter.

#### Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `text` | `string` | ✅ Yes | - | The text to analyze |
| `type` | `string` | No | `"rhetoric"` | `rhetoric` (bias/fallacies/persuasion), `sentiment`, `summary`, `entities`, `key-points` |
| `files` | `string[]` | No | - | File paths to read as code context |

#### Example

```typescript
gemini_analyze_text({
  text: "The new iPhone is amazing! Best camera ever, but battery life could be better.",
  type: "sentiment"
})
```

---

### gemini_analyze_code

Analyze code for bugs, quality, security, or performance issues. Put the CODE in the `code` parameter, NOT in `focus`.

#### Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `code` | `string` | ✅ Yes | - | The actual source code to analyze |
| `focus` | `string` | No | `"general"` | Analysis focus (e.g. quality, security, performance, bugs, general) |
| `language` | `string` | No | - | Programming language |
| `files` | `string[]` | No | - | File paths to read as code context |

#### Example

```typescript
gemini_analyze_code({
  code: "const user = db.query('SELECT * FROM users WHERE id = ' + userId);",
  focus: "security"
})
```

---

### gemini_judge

Evaluate and synthesize multiple AI perspectives into a unified verdict. Put CONTENT in the `perspectives` parameter.

#### Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `perspectives` | `string` | ✅ Yes | - | The multiple AI perspectives/analyses to evaluate and synthesize |
| `mode` | `"synthesize" \| "evaluate" \| "rank" \| "resolve"` | No | `"synthesize"` | `synthesize` (merge best), `evaluate` (score each), `rank` (order by quality), `resolve` (settle conflicts) |
| `question` | `string` | No | - | The original question being judged |
| `query` / `text` | `string` | No | - | Fallback content to judge (use `perspectives` instead) |
| `files` | `string[]` | No | - | File paths to read as code context |

#### Example

```typescript
gemini_judge({
  perspectives: "Model A says X because... Model B says Y because...",
  question: "Which caching strategy should we use?",
  mode: "resolve"
})
```

---

### jury

Multi-model jury: runs question through configurable panel of AI jurors in parallel, then Gemini synthesizes a unified verdict. Put QUESTION in `question` parameter.

#### Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `question` | `string` | ✅ Yes | - | The question or problem for the jury to evaluate |
| `jurors` | `string` | No | `"grok,deepseek,kimi,openai"` | Comma-separated juror models. Available: `grok`, `openai`, `qwen`, `qwen_reason`, `kimi`, `perplexity`, `minimax`, `deepseek`, `glm`, `stepfun`, `ernie`, `local` (free offline via `LOCAL_LLM_MODEL`; `hermes` accepted as legacy alias) |
| `mode` | `"synthesize" \| "evaluate" \| "rank" \| "resolve"` | No | `"synthesize"` | Judge mode |
| `context` | `string` | No | - | Additional context for all jurors |

#### Example

```typescript
jury({
  question: "Should this service be REST or GraphQL?",
  jurors: "grok,deepseek,kimi,openai",
  mode: "synthesize"
})
```

---

### diff_review

Multi-model diff-aware code review: 2-3 lab-diverse reviewers (Kimi K2.7-Code, DeepSeek V4 Pro, GPT-5.5) scoped to the changed lines, deduplicated and severity-ranked by a Gemini judge. Provide the unified diff in `diff`.

#### Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `diff` | `string` | ✅ Yes | - | Unified diff to review (`git diff` output) |
| `focus` | `"security" \| "perf" \| "correctness" \| "style" \| "all"` | No | `"all"` | Review focus |
| `severityFloor` | `"blocker" \| "major" \| "minor" \| "nit"` | No | `"nit"` | Omit findings below this severity |
| `intent` | `string` | No | - | What the change is SUPPOSED to do (enables intent-mismatch detection) |
| `files` | `string[]` | No | - | File paths for surrounding context |

#### Example

```typescript
diff_review({
  diff: gitDiffOutput,
  focus: "security",
  severityFloor: "minor",
  intent: "Add rate limiting to the login endpoint"
})
```

---

### plan_critique

Adversarial red-team of an existing plan (from any source): multi-model pre-mortem, hidden-assumption audit, ranked risks with mitigations, concrete plan edits, verdict. Complements `planner_maker` (builds) and `planner_runner` (executes).

#### Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `plan` | `string` | ✅ Yes | - | The plan to critique (paste it) |
| `goal` | `string` | No | - | The goal the plan is supposed to achieve (enables scope-creep/gap detection) |
| `constraints` | `string` | No | - | Hard constraints (deadline, budget, compliance, team size) |
| `files` | `string[]` | No | - | Relevant code/doc paths for grounding |

#### Example

```typescript
plan_critique({
  plan: planMarkdown,
  goal: "Ship GDPR-compliant data export by end of quarter",
  constraints: "2 engineers, 3 weeks"
})
```

---

### gemini_brainstorm

Convergent synthesis: cluster, refine, and prioritize raw ideas into structured hierarchies. Use AFTER divergent ideation to organize and rank ideas by impact/feasibility. Put your PROMPT in the `prompt` parameter.

#### Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `prompt` | `string` | ✅ Yes | - | The ideas or topic to organize and refine |
| `claudeThoughts` | `string` | No | - | Claude's initial thoughts or raw ideas to cluster and refine |
| `maxClusters` | `number` | No | `5` | Number of idea clusters to create |
| `files` | `string[]` | No | - | File paths to read as code context |

#### Example

```typescript
gemini_brainstorm({
  prompt: "Improve code review process",
  claudeThoughts: "I think automated linting and AI suggestions could help",
  maxClusters: 3
})
```

---

### openai_brainstorm

Find alternative approaches: when stuck on a programming problem, reveals 3rd/4th/5th options you haven't considered, with cost of each. Use when you think there's only 1-2 ways to do something. Put your PROBLEM in the `problem` parameter.

#### Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `problem` | `string` | ✅ Yes | - | The engineering problem or design tradeoff to brainstorm about |
| `model` | `"gpt-5.4" \| "gpt-5.4-mini" \| "gpt-5.4-pro"` | No | `"gpt-5.4"` | Model variant |
| `quantity` | `number` | No | `5` | Number of approaches to generate |
| `constraints` | `string` | No | - | Technical constraints: language, framework, performance requirements, team size |
| `reasoning_effort` | `"none" \| "low" \| "medium" \| "high" \| "xhigh"` | No | - | Reasoning effort level |
| `max_tokens` | `number` | No | - | Maximum tokens for response |

#### Example

```typescript
openai_brainstorm({
  problem: "Reduce app cold start time",
  model: "gpt-5.4-mini",
  quantity: 5,
  constraints: "Must work on mobile devices"
})
```

---

### openai_code_review

Code review. Put the CODE in the `code` parameter, NOT in `focusAreas`.

#### Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `code` | `string` | ✅ Yes | - | The actual source code to review |
| `focusAreas` | `Array<"security"\|"performance"\|"readability"\|"bugs"\|"best-practices">` | No | - | Focus areas |
| `language` | `string` | No | - | Programming language |
| `files` | `string[]` | No | - | File paths to read as code context |

#### Example

```typescript
openai_code_review({
  code: "function processPayment(userId, amount) { ... }",
  focusAreas: ["security", "bugs"]
})
```

---

### openai_explain

Explain concepts. Put the TOPIC in the `topic` parameter.

#### Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `topic` | `string` | ✅ Yes | - | The topic or concept to explain |
| `level` | `"beginner" \| "intermediate" \| "expert"` | No | `"intermediate"` | Explanation level |
| `style` | `"technical" \| "simple" \| "analogy" \| "visual"` | No | `"simple"` | Explanation style |
| `files` | `string[]` | No | - | File paths to read as code context |

#### Example

```typescript
openai_explain({
  topic: "How does TCP congestion control work?",
  level: "beginner",
  style: "analogy"
})
```

---

### grok_brainstorm

Contrarian first-principles brainstorming: deconstruct a topic to atomic truths, challenge every assumption, then rebuild radical alternatives. Use when conventional thinking has stalled. Put your TOPIC in the `topic` parameter.

#### Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `topic` | `string` | ✅ Yes | - | The topic to brainstorm about |
| `numIdeas` | `number` | No | `5` | Number of radical rebuilds to generate |
| `constraints` | `string` | No | - | Any constraints or requirements to consider |
| `forceHeavy` | `boolean` | No | - | Use expensive Grok 4 Heavy model ($3/$15) for deeper creativity |
| `files` | `string[]` | No | - | File paths to read as code context |

#### Example

```typescript
grok_brainstorm({
  topic: "Revolutionary social media features",
  numIdeas: 8
})
```

---

### grok_architect

Architecture design. Put your REQUIREMENTS in the `requirements` parameter.

#### Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `requirements` | `string` | ✅ Yes | - | The architecture requirements or design question |
| `constraints` | `string` | No | - | Technical or business constraints to consider |
| `scale` | `string` | No | - | Expected scale (e.g. small, medium, large, enterprise) |
| `files` | `string[]` | No | - | File paths to read as code context |

#### Example

```typescript
grok_architect({
  requirements: "Real-time chat application with 100k concurrent users",
  constraints: "Must use AWS, budget $5k/month",
  scale: "enterprise"
})
```

---

### security_review

Dedicated security audit (DeepSeek V4 Pro): taint/data-flow analysis, OWASP/CWE-mapped findings with severity, exploitability sketch, and concrete fixes. For code you are authorized to review. Provide `code`, `diff`, or `files`.

#### Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `code` | `string` | No* | - | Code to audit (*or use `diff`/`files`) |
| `diff` | `string` | No* | - | Unified diff to audit (scopes the review to the change) |
| `files` | `string[]` | No* | - | File paths to read server-side |
| `standard` | `"owasp" \| "cwe" \| "both"` | No | `"both"` | Finding-mapping standard |
| `language` | `string` | No | - | Language/framework hint (e.g. `TypeScript/Express`) |
| `context` | `string` | No | - | Trust boundaries & deployment context (e.g. `internal-only service behind VPN`) |

#### Example

```typescript
security_review({
  diff: gitDiffOutput,
  standard: "owasp",
  context: "Public-facing API, no auth on this endpoint yet"
})
```

---

### kimi_long_context

Long-context analysis with Kimi K2.7-Code (262K context window). Put CONTENT in the `content` parameter.

#### Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `content` | `string` | ✅ Yes | - | The long text/document to analyze |
| `task` | `"summarize" \| "extract" \| "analyze" \| "compare" \| "find"` | No | `"analyze"` | Analysis task type |
| `outputFormat` | `"brief" \| "detailed" \| "structured"` | No | `"detailed"` | Output format |
| `query` | `string` | No | - | Specific question about the content (for extract/find tasks) |
| `files` | `string[]` | No | - | File paths to read as code context |

#### Example

```typescript
kimi_long_context({
  content: entireDesignDoc,
  task: "find",
  query: "What does this doc say about data retention?"
})
```

---

## Meta & Orchestration

### think

Anthropic's official "think" tool for structured reasoning. Provides a dedicated scratchpad for step-by-step problem solving.

#### Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `thought` | `string` | ✅ Yes | - | The reasoning thought or analysis step |

#### Example

```typescript
think({
  thought: "Let me break down this problem step by step..."
})
```

---

### nextThought

Sequential thinking with optional multi-model execution. Auto-creates a session if needed.

- **Basic** (thought logging): `nextThought({ thought: "Analyze X", nextThoughtNeeded: true })`
- **With execution**: `nextThought({ thought: "...", model: "gemini", executeModel: true, nextThoughtNeeded: true })`
- **Light distillation**: `nextThought({ thought: "...", model: "gemini", executeModel: true, distillContext: "light" })`
- **Judge step**: `nextThought({ thought: "Final verdict", model: "gemini", executeModel: true, contextWindow: "all", nextThoughtNeeded: false })`
- **Auto final judge**: `nextThought({ thought: "...", model: "kimi", executeModel: true, finalJudge: "gemini", nextThoughtNeeded: false })`
- **With memory save**: `nextThought({ ..., memoryProvider: { provider: "dokoro", saveToMemory: true } })`

#### Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `thought` | `string` | ✅ Yes | - | The thought content or prompt for the model |
| `nextThoughtNeeded` | `boolean` | ✅ Yes | - | Whether more thoughts are needed in the chain |
| `model` | `string` | No | - | Model to use: `grok`, `gemini`, `openai`, `perplexity`, `kimi`, `qwen`, `think` |
| `executeModel` | `boolean` | No | `false` | Actually execute the model's tool and return response |
| `contextWindow` | `number \| "none" \| "recent" \| "all"` | No | - | `none` (fresh), `recent` (last 3), `all` (full history). Prefer string names over numbers |
| `distillContext` | `"off" \| "light"` | No | `"off"` | `off` auto-distills at 8000+ tokens, `light` preserves detail |
| `finalJudge` | `string` | No | - | Model to use as final judge when session completes (e.g. `gemini`). Called automatically when `nextThoughtNeeded=false` |
| `memoryProvider` | `{ provider: string; saveToMemory?: boolean; loadFromMemory?: boolean }` | No | - | Pluggable memory MCP: `{ provider: 'dokoro'|'mem0', saveToMemory: true }` |
| `objective` | `string` | No | - | Session objective (for auto-session creation) |
| `thoughtNumber` | `number` | No | - | Override the thought number |
| `totalThoughts` | `number` | No | - | Update estimated total thoughts |
| `isRevision` | `boolean` | No | - | Mark this as a revision of an earlier thought |
| `revisesThought` | `number` | No | - | Which thought number this revises |
| `branchFromThought` | `number` | No | - | Branch from this thought number |

#### Example

```typescript
nextThought({
  thought: "Analyze the tradeoffs between microservices and monolith",
  model: "gemini",
  executeModel: true,
  contextWindow: "recent",
  nextThoughtNeeded: true
})
```

---

### focus

Multi-model reasoning. Coordinates different AI models across 9 modes and 11 domains.

#### Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `query` | `string` | ✅ Yes | - | The problem or question to solve |
| `mode` | `"simple" \| "debug" \| "deep-reasoning" \| "code-brainstorm" \| "architecture-debate" \| "research" \| "analyze" \| "focus-deep" \| "tachibot-status"` | No | - | Reasoning mode |
| `domain` | `"architecture" \| "algorithms" \| "debugging" \| "security" \| "performance" \| "api_design" \| "database" \| "frontend" \| "backend" \| "devops" \| "testing"` | No | - | Problem domain |
| `models` | `string[]` | No | - | Custom list of models to use |
| `rounds` | `number` | No | - | Number of reasoning rounds |
| `temperature` | `number` | No | - | Temperature for responses |
| `maxTokensPerRound` | `number` | No | - | Max tokens per model per round |
| `pingPongStyle` | `"competitive" \| "collaborative" \| "debate" \| "build-upon"` | No | - | Interaction style |
| `tokenEfficient` | `boolean` | No | - | Enable token optimization |
| `saveSession` | `boolean` | No | - | Save session for later retrieval with `continue_focus` |
| `executeNow` | `boolean` | No | - | Execute immediately vs queue |
| `context` | `string` | No | - | Additional context |

#### Example

```typescript
focus({
  query: "Should we use microservices or monolith?",
  mode: "deep-reasoning",
  domain: "architecture",
  rounds: 5
})
```

---

### continue_focus

Continue a focus session started with `focus({ saveSession: true })`.

#### Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `sessionId` | `string` | ✅ Yes | - | The session ID returned from a previous `focus` call |

**Note:** always registered alongside `think`/`focus`/`nextThought`/`usage_stats`, independent of the active tool profile.

#### Example

```typescript
continue_focus({ sessionId: "focus_abc123" })
```

---

### tachi

Smart AI assistant router — just describe what you need. Put your QUERY in the `query` parameter.

Auto-routes to the best mode: Research (`what is...`, `how does...`), Solve (`fix...`, `debug...`, `implement...`), Verify (`check...`, `is this correct...`), Creative (`brainstorm...`, `ideas for...`), Architect (`design...`, `which should I use...`), Judge (`which is best...`, `evaluate...`, `compare...`).

Call with no query to browse the full tool + skill catalog (grouped by provider, with per-key availability).

#### Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `query` | `string` | No | - | What you need help with. Leave empty to browse the full tool + skill catalog |
| `mode` | `"auto" \| "research" \| "solve" \| "verify" \| "creative" \| "architect" \| "judge"` | No | `"auto"` | Force a specific mode |

#### Example

```typescript
tachi({ query: "judge: React vs Vue vs Svelte" })
tachi({})  // no query → catalog of every tool + skill
```

---

### doctor

Diagnose your TachiBot setup: which API keys are detected, which tools are available vs hidden (and why), the active profile, and a suggested first step. Zero-cost, needs no API key. Call it when tools seem missing.

#### Parameters

None.

#### Example

```typescript
doctor({})
```

---

### usage_stats

View or reset tool usage statistics. Put your REQUEST in the `query` parameter.

#### Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `query` | `string` | No | `"view"` | What to do: `view` (default), `reset`, or any question about usage |
| `action` | `"view" \| "reset"` | No | `"view"` | Action |
| `format` | `"table" \| "json"` | No | `"table"` | Output format |
| `scope` | `"current" \| "all"` | No | `"current"` | Current repo or all repos |

#### Example

```typescript
usage_stats({ action: "view", scope: "all", format: "json" })
```

---

## Workflows

### workflow

Execute workflows with Ink rendering, comparison table, and optional AI judge.

#### Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `query` | `string` | ✅ Yes | - | Input query for the workflow |
| `name` | `string` | No | - | Workflow name to execute |
| `file` | `string` | No | - | Workflow YAML file path |
| `projectPath` | `string` | No | - | Project path for custom workflows |
| `compare` | `boolean` | No | `true` | Show comparison summary table |
| `judge` | `boolean` | No | - | Enable AI judge to evaluate all steps at the end |
| `judgeTool` | `string` | No | `"gemini_analyze_text"` | Tool used for judging |
| `maxStepTokens` | `number` | No | `2500` | Max tokens per step |
| `truncateSteps` | `boolean` | No | `true` | Truncate step outputs |

#### Example

```typescript
workflow({
  name: "comprehensive-code-review",
  query: codeToReview,
  judge: true
})
```

---

### workflow_start

Start a workflow session.

#### Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `name` | `string` | ✅ Yes | - | Workflow name |
| `query` | `string` | ✅ Yes | - | Input query |
| `variables` | `Record<string, string \| number \| boolean>` | No | - | Workflow variables |

#### Example

```typescript
workflow_start({
  name: "research-report",
  query: "Impact of quantum computing on cryptography",
  variables: { depth: "deep" }
})
```

---

### continue_workflow

Continue a running workflow session. Use `continue_focus` instead for focus sessions.

#### Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `sessionId` | `string` | ✅ Yes | - | The workflow session ID |

#### Example

```typescript
continue_workflow({ sessionId: "wf_abc123" })
```

---

### list_workflows

List available workflows.

#### Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `projectPath` | `string` | No | - | For custom workflows |

#### Example

```typescript
list_workflows({})
```

---

### create_workflow

Create a new workflow. Put the WORKFLOW NAME in the `name` parameter.

#### Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `name` | `string` | ✅ Yes | - | Workflow name |
| `type` | `"code-review" \| "brainstorm" \| "debug" \| "research" \| "custom"` | No | `"custom"` | Workflow type |
| `steps` | `string` | No | - | Workflow steps definition (YAML/JSON) |

#### Example

```typescript
create_workflow({
  name: "my-code-review",
  type: "code-review"
})
```

---

### visualize_workflow

Visualize workflow structure.

#### Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `name` | `string` | ✅ Yes | - | Workflow name |

#### Example

```typescript
visualize_workflow({ name: "comprehensive-code-review" })
```

---

### workflow_status

Get workflow status.

#### Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `sessionId` | `string` | ✅ Yes | - | The workflow session ID |

#### Example

```typescript
workflow_status({ sessionId: "wf_abc123" })
```

---

### validate_workflow

Validates workflow YAML/JSON content for correctness: syntax, interpolation references (`${step.output}`, `${variable}`), tool names exist and are enabled in `tools.config.json`, no circular dependencies, variable naming convention. Returns detailed error messages with suggestions.

#### Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `workflowContent` | `string` | ✅ Yes | - | The YAML or JSON content of the workflow to validate |
| `isJson` | `boolean` | No | `false` | Set to true if the content is JSON instead of YAML |
| `format` | `"text" \| "json"` | No | `"text"` | Output format |

#### Example

```typescript
validate_workflow({ workflowContent: yamlString })
```

---

### validate_workflow_file

Validates a workflow file from the filesystem (same checks as `validate_workflow`).

#### Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `filePath` | `string` | ✅ Yes | - | Path to the workflow file (YAML or JSON) |
| `format` | `"text" \| "json"` | No | `"text"` | Output format |

#### Example

```typescript
validate_workflow_file({ filePath: "workflows/my-workflow.yaml" })
```

---

## Prompt Engineering

### list_prompt_techniques

Discover available prompt engineering techniques. Shows all 31 techniques organized by category.

#### Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `filter` | `string` | No | `"all"` | Filter by category: `all`, `creative`, `research`, `analytical`, `reflective`, `reasoning`, `verification`, `meta`, `debate`, `judgment`, `engineering`, `research_advanced`, `decision`, `structured_coding` |

#### Example

```typescript
list_prompt_techniques({ filter: "reasoning" })
```

---

### preview_prompt_technique

Preview how a technique enhances your prompt WITHOUT executing. Returns an `execution_token` for later use.

#### Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `technique` | `string` | ✅ Yes | - | Technique name (e.g. `first_principles`, `tree_of_thoughts`) |
| `tool` | `string` | ✅ Yes | - | Target tool (e.g. `grok_reason`, `gemini_brainstorm`) |
| `query` | `string` | ✅ Yes | - | Your query or problem |

#### Example

```typescript
preview_prompt_technique({
  technique: "first_principles",
  tool: "grok_reason",
  query: "Should we build or buy our auth system?"
})
```

---

### execute_prompt_technique

Execute a prompt technique. Use `execution_token` from preview, OR provide full params (`technique`, `tool`, `query`). Use `"last"` as the token to execute the most recent preview.

#### Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `execution_token` | `string` | No | - | Token from preview, or `"last"` for most recent preview |
| `technique` | `string` | No | - | Technique name (if not using a token) |
| `tool` | `string` | No | - | Target tool name (if not using a token) |
| `query` | `string` | No | - | Your query or problem (if not using a token) |

#### Example

```typescript
execute_prompt_technique({ execution_token: "last" })
```

---

## Local Models

### local_query

Query a local open-weight model (Ollama / LM Studio / llama.cpp / vLLM) — zero-cost, offline, private. Set `LOCAL_LLM_BASE_URL` / `LOCAL_LLM_MODEL`; `LOCAL_LLM_NUM_CTX` for long prompts (Ollama).

#### Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `prompt` | `string` | ✅ Yes | - | The prompt to send to the local model |
| `model` | `string` | No | - | Model tag, e.g. `hermes3`, `qwen2.5` |
| `temperature` | `number` | No | `0.4` | Sampling temperature |

Also available as the `local` juror in [`jury`](#jury) (`hermes` accepted as a legacy alias, deduped after mapping).

#### Example

```typescript
local_query({
  prompt: "Summarize this changelog in 3 bullets",
  model: "hermes3"
})
```

---

## Environment Variables

Configure tool behavior via environment variables:

```bash
# API keys (see docs/API_KEYS.md)
PERPLEXITY_API_KEY=...
GROK_API_KEY=...            # or XAI_API_KEY
OPENAI_API_KEY=...
GEMINI_API_KEY=...
OPENROUTER_API_KEY=...      # gates Qwen/Kimi/MiniMax/DeepSeek/GLM/StepFun/ERNIE tools

# Search
DEFAULT_SEARCH_PROVIDER=perplexity
GROK_SEARCH_SOURCES_LIMIT=100

# Profile / tool overrides
TACHIBOT_PROFILE=full
ENABLE_TOOL_<NAME>=true
DISABLE_TOOL_<NAME>=true
DISABLE_ALL_TOOLS=false

# Local models (local_query, jury's `local` juror)
LOCAL_LLM_BASE_URL=http://localhost:11434/v1
LOCAL_LLM_MODEL=hermes3
LOCAL_LLM_API_KEY=local
LOCAL_LLM_NUM_CTX=8192
```

---

## See Also

- [Tool Profiles](TOOL_PROFILES.md) - Pre-configured tool sets and counts
- [Tool Parameters](TOOL_PARAMETERS.md) - Cross-cutting parameter conventions (files, focus, approach, etc.)
- [Configuration Guide](CONFIGURATION.md) - Complete configuration reference
- [API Keys Guide](API_KEYS.md) - Where to get API keys
- [Workflows](WORKFLOWS.md) - Custom workflow creation
