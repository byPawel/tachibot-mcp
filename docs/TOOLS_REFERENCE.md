# TachiBot MCP - Complete Tools Reference

**Complete parameter schemas, advanced usage, and examples for all 31 tools (32 with competitive mode)**

---

## Table of Contents

- [Core Reasoning Tools](#core-reasoning-tools)
  - [think](#think)
  - [focus](#focus)
  - [nextThought](#nextthought)
- [Perplexity Suite](#perplexity-suite)
  - [perplexity_ask](#perplexity_ask)
  - [perplexity_research](#perplexity_research)
  - [perplexity_reason](#perplexity_reason)
- [Grok Suite](#grok-suite)
  - [grok_search](#grok_search)
  - [grok_reason](#grok_reason)
  - [grok_code](#grok_code)
  - [grok_debug](#grok_debug)
  - [grok_architect](#grok_architect)
  - [grok_brainstorm](#grok_brainstorm)
- [OpenAI Suite](#openai-suite)
  - [openai_reason](#openai_reason)
  - [openai_brainstorm](#openai_brainstorm)
  - [openai_code_review](#openai_code_review)
  - [openai_explain](#openai_explain)
- [Gemini Suite](#gemini-suite)
  - [gemini_brainstorm](#gemini_brainstorm)
  - [gemini_analyze_code](#gemini_analyze_code)
  - [gemini_analyze_text](#gemini_analyze_text)
- [OpenRouter Suite](#openrouter-suite)
  - [qwen_coder](#qwen_coder)
  - [kimi_thinking](#kimi_thinking)
  - [qwen_competitive](#qwen_competitive) (conditional)
- [Workflow Tools](#workflow-tools)
  - [workflow](#workflow)
  - [list_workflows](#list_workflows)
  - [create_workflow](#create_workflow)
  - [visualize_workflow](#visualize_workflow)
  - [workflow_start](#workflow_start)
  - [continue_workflow](#continue_workflow)
  - [workflow_status](#workflow_status)
  - [validate_workflow](#validate_workflow)
  - [validate_workflow_file](#validate_workflow_file)
- [Workflows (YAML-based)](#workflows-yaml-based)
  - Note: verifier, scout, challenger, and pingpong are now YAML workflows, not MCP tools

---

## Core Reasoning Tools

### think

Anthropic's official "think" tool for structured reasoning. Provides a dedicated scratchpad for step-by-step problem solving.

#### Schema

```typescript
{
  thought: string;  // REQUIRED - Your reasoning step
}
```

#### Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `thought` | `string` | ✅ Yes | - | The reasoning thought or analysis step |

#### Example Calls

**Basic reasoning:**
```typescript
think({
  thought: "Let me break down this problem step by step..."
})
```

**Complex analysis:**
```typescript
think({
  thought: `Analyzing the architecture trade-offs:
  1. Microservices offer scalability but add complexity
  2. Monolith is simpler but may become bottleneck
  3. For MVP with 2-person team, monolith makes sense
  4. Can migrate to microservices later if needed`
})
```

#### Best Practices

- Use for complex reasoning chains
- Break down problems into logical steps
- Explicitly state assumptions
- Document decision rationale

---

### focus

Multi-model collaborative reasoning with 10+ specialized modes. Coordinate different AI models to solve problems together.

#### Schema

```typescript
{
  query: string;                    // REQUIRED
  mode?: string;                    // Default: "simple"
  domain?: string;
  models?: string[];
  rounds?: number;                  // Default: 5
  temperature?: number;             // 0-1, Default: 0.7
  maxTokensPerRound?: number;       // Default: 2000
  pingPongStyle?: string;           // Default: "collaborative"
  tokenEfficient?: boolean;         // Default: false
  saveSession?: boolean;            // Default: true
  executeNow?: boolean;             // Default: true
  context?: string;
}
```

#### Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `query` | `string` | ✅ Yes | - | The problem or question to solve |
| `mode` | `string` | No | `"simple"` | Reasoning mode (see modes below) |
| `domain` | `string` | No | - | Problem domain (see domains below) |
| `models` | `string[]` | No | Mode-specific | Custom list of models to use |
| `rounds` | `number` | No | `5` | Number of reasoning rounds |
| `temperature` | `number` | No | `0.7` | Temperature for responses (0-1) |
| `maxTokensPerRound` | `number` | No | `2000` | Max tokens per model per round |
| `pingPongStyle` | `string` | No | `"collaborative"` | Interaction style |
| `tokenEfficient` | `boolean` | No | `false` | Enable token optimization |
| `saveSession` | `boolean` | No | `true` | Save session for later retrieval |
| `executeNow` | `boolean` | No | `true` | Execute immediately vs queue |
| `context` | `string` | No | - | Additional context |

#### Available Modes

| Mode | Description | Best For |
|------|-------------|----------|
| `simple` | Basic single-model reasoning | Quick questions |
| `debug` | Debug-focused analysis | Finding bugs |
| `deep-reasoning` | Multi-model collaboration with critique | Complex problems |
| `code-brainstorm` | Technical brainstorming | Coding solutions |
| `architecture-debate` | Models debate architecture approaches | System design |
| `brainstorm` | Creative ideation | New ideas |
| `research` | Deep investigation with evidence | Research projects |
| `analyze` | Systematic analysis | Data/code analysis |
| `focus-deep` | Extended deep reasoning | Very complex problems |
| `status` | Check session status | Monitoring |

#### Available Domains

| Domain | Focus Area |
|--------|-----------|
| `architecture` | System architecture and design |
| `algorithms` | Algorithm design and optimization |
| `debugging` | Finding and fixing bugs |
| `security` | Security analysis and hardening |
| `performance` | Performance optimization |
| `api_design` | API design patterns |
| `database` | Database design and queries |
| `frontend` | Frontend development |
| `backend` | Backend development |
| `devops` | DevOps and infrastructure |
| `testing` | Testing strategies |

#### PingPong Styles

| Style | Behavior |
|-------|----------|
| `collaborative` | Models build on each other's ideas |
| `competitive` | Models try to find better solutions |
| `debate` | Models argue different perspectives |
| `build-upon` | Each model extends previous thoughts |

#### Example Calls

**Basic usage:**
```typescript
focus({
  query: "Design a scalable real-time chat system"
})
```

**Deep collaborative reasoning:**
```typescript
focus({
  query: "Should we use microservices or monolith?",
  mode: "deep-reasoning",
  domain: "architecture",
  rounds: 8
})
```

**Multi-model brainstorming:**
```typescript
focus({
  query: "Revolutionary social media features",
  mode: "brainstorm",
  models: ["grok", "claude-code", "qwen", "openai"],
  rounds: 10,
  temperature: 0.9,
  pingPongStyle: "build-upon"
})
```

**Architectural debate:**
```typescript
focus({
  query: "TypeScript vs JavaScript for large codebases",
  mode: "architecture-debate",
  domain: "frontend",
  temperature: 0.8
})
```

**Code-focused collaboration:**
```typescript
focus({
  query: "Optimize this database query performance",
  mode: "code-brainstorm",
  domain: "database",
  context: "PostgreSQL with 10M rows, high read volume"
})
```

---

### nextThought

Sequential thinking with branching and revision support. Break complex problems into numbered steps.

#### Schema

```typescript
{
  thought: string;                  // REQUIRED
  nextThoughtNeeded: boolean;       // REQUIRED
  thoughtNumber?: number;
  totalThoughts?: number;
  model?: string;
  isRevision?: boolean;
  revisesThought?: number;
  branchFromThought?: number;
}
```

#### Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `thought` | `string` | ✅ Yes | - | The current thinking step |
| `nextThoughtNeeded` | `boolean` | ✅ Yes | - | Whether another thought is needed |
| `thoughtNumber` | `number` | No | - | Current thought number (1-indexed) |
| `totalThoughts` | `number` | No | - | Estimated total thoughts needed |
| `model` | `string` | No | - | Model handling this thought |
| `isRevision` | `boolean` | No | `false` | Is this revising previous thinking? |
| `revisesThought` | `number` | No | - | Which thought number is being revised |
| `branchFromThought` | `number` | No | - | Branch from this thought number |

#### Example Calls

**Linear thinking sequence:**
```typescript
// Thought 1
nextThought({
  thought: "First, let's identify the core requirements...",
  thoughtNumber: 1,
  totalThoughts: 5,
  nextThoughtNeeded: true
})

// Thought 2
nextThought({
  thought: "Now let's consider the technical constraints...",
  thoughtNumber: 2,
  totalThoughts: 5,
  nextThoughtNeeded: true
})

// Final thought
nextThought({
  thought: "Based on analysis, recommend approach X because...",
  thoughtNumber: 5,
  totalThoughts: 5,
  nextThoughtNeeded: false
})
```

**Branching thinking:**
```typescript
nextThought({
  thought: "Let's explore an alternative approach...",
  thoughtNumber: 4,
  branchFromThought: 2,  // Branch from thought #2
  nextThoughtNeeded: true
})
```

**Revising previous thought:**
```typescript
nextThought({
  thought: "Actually, I need to revise my earlier assumption...",
  isRevision: true,
  revisesThought: 3,
  nextThoughtNeeded: true
})
```

---

## Perplexity Suite

### perplexity_ask

Web search with up-to-date information using Perplexity Sonar Pro.

#### Schema

```typescript
{
  query: string;                                        // REQUIRED
  searchDomain?: "general" | "academic" | "news" | "social";
  searchRecency?: "hour" | "day" | "week" | "month" | "year";
}
```

#### Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `query` | `string` | ✅ Yes | - | Search query |
| `searchDomain` | `string` | No | `"general"` | Search domain filter |
| `searchRecency` | `string` | No | - | Recency filter |

#### Search Domains

- `general` - General web search
- `academic` - Academic papers and research
- `news` - News articles
- `social` - Social media content

#### Search Recency Options

- `hour` - Last hour
- `day` - Last 24 hours
- `week` - Last 7 days
- `month` - Last 30 days
- `year` - Last 365 days

#### Example Calls

**Basic search:**
```typescript
perplexity_ask({
  query: "latest AI developments"
})
```

**Academic search:**
```typescript
perplexity_ask({
  query: "quantum computing error correction",
  searchDomain: "academic"
})
```

**Recent news:**
```typescript
perplexity_ask({
  query: "OpenAI announcements",
  searchDomain: "news",
  searchRecency: "week"
})
```

**Time-sensitive query:**
```typescript
perplexity_ask({
  query: "stock market trends",
  searchRecency: "day"
})
```

---

### perplexity_research

Deep research with multiple queries, evidence gathering, and synthesis.

#### Schema

```typescript
{
  topic: string;                    // REQUIRED
  questions?: string[];             // Sub-questions to explore
  depth?: "quick" | "standard" | "deep";  // Default: "standard"
}
```

#### Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `topic` | `string` | ✅ Yes | - | Research topic |
| `questions` | `string[]` | No | Auto-generated | Specific sub-questions to investigate |
| `depth` | `string` | No | `"standard"` | Research depth |

#### Depth Levels

- `quick` - Fast overview (2-3 queries, ~1min)
- `standard` - Balanced research (4-6 queries, ~2-3min)
- `deep` - Comprehensive investigation (8-12 queries, ~5-10min)

#### Example Calls

**Basic research:**
```typescript
perplexity_research({
  topic: "Latest AI reasoning techniques"
})
```

**With specific questions:**
```typescript
perplexity_research({
  topic: "Quantum computing practical applications",
  questions: [
    "What are the current quantum computing use cases?",
    "Which companies are leading quantum computing?",
    "What are the main technical challenges?",
    "When will quantum computers be commercially viable?"
  ],
  depth: "deep"
})
```

**Quick overview:**
```typescript
perplexity_research({
  topic: "Rust programming language trends",
  depth: "quick"
})
```

---

### perplexity_reason

Complex reasoning using Perplexity Sonar Reasoning Pro.

#### Schema

```typescript
{
  problem: string;                  // REQUIRED
  context?: string;
  approach?: "analytical" | "creative" | "systematic" | "comparative";
}
```

#### Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `problem` | `string` | ✅ Yes | - | Problem to reason about |
| `context` | `string` | No | - | Additional context |
| `approach` | `string` | No | `"analytical"` | Reasoning approach |

#### Reasoning Approaches

- `analytical` - Break down into components
- `creative` - Explore innovative solutions
- `systematic` - Methodical step-by-step
- `comparative` - Compare alternatives

#### Example Calls

**Analytical reasoning:**
```typescript
perplexity_reason({
  problem: "Why is Python slower than C++ for numerical computing?",
  approach: "analytical"
})
```

**Creative problem-solving:**
```typescript
perplexity_reason({
  problem: "How to reduce cloud infrastructure costs by 50%",
  approach: "creative",
  context: "E-commerce platform with 1M daily users"
})
```

**Systematic analysis:**
```typescript
perplexity_reason({
  problem: "Design a zero-downtime database migration strategy",
  approach: "systematic",
  context: "PostgreSQL 200GB production database"
})
```

---

## Grok Suite

### grok_search

Cost-optimized web search using Grok-4.1's live search with advanced filtering and enhanced reasoning.

#### Schema

```typescript
{
  query: string;                    // REQUIRED
  max_search_results?: number;      // Default: 20
  recency?: "all" | "day" | "week" | "month" | "year";
  sources?: Array<{
    type: "web" | "news" | "x" | "rss";
    allowed_websites?: string[];    // Domain whitelist
    country?: string;                // ISO country code (e.g., "US", "PL")
  }>;
}
```

#### Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `query` | `string` | ✅ Yes | - | Search query |
| `max_search_results` | `number` | No | `20` | Maximum search results (costs per 1k sources) |
| `recency` | `string` | No | `"all"` | Time filter |
| `sources` | `array` | No | `[{type: "web"}]` | Search source configuration |

#### Source Types

- `web` - General web search
- `news` - News articles
- `x` - X (Twitter) posts
- `rss` - RSS feeds

#### Example Calls

**Basic search:**
```typescript
grok_search({
  query: "latest AI developments"
})
```

**Domain-restricted search:**
```typescript
grok_search({
  query: "Python async best practices",
  sources: [{
    type: "web",
    allowed_websites: ["python.org", "docs.python.org", "peps.python.org"]
  }],
  recency: "year"
})
```

**News search with recency:**
```typescript
grok_search({
  query: "quantum computing breakthroughs",
  sources: [{ type: "news" }],
  recency: "week",
  max_search_results: 50
})
```

**Multi-source search:**
```typescript
grok_search({
  query: "React 19 features",
  sources: [
    {
      type: "web",
      allowed_websites: ["react.dev", "github.com/facebook/react"]
    },
    { type: "news" }
  ],
  max_search_results: 30
})
```

**Country-specific search:**
```typescript
grok_search({
  query: "local tech startups",
  sources: [{
    type: "news",
    country: "PL"  // Poland
  }],
  recency: "month"
})
```

**X (Twitter) search:**
```typescript
grok_search({
  query: "@anthropic announcements",
  sources: [{ type: "x" }],
  recency: "week",
  max_search_results: 100
})
```

**GitHub documentation search:**
```typescript
grok_search({
  query: "Next.js app router documentation",
  sources: [{
    type: "web",
    allowed_websites: [
      "nextjs.org",
      "github.com/vercel/next.js"
    ]
  }]
})
```

#### Cost Considerations

- Grok search is charged per 1000 sources searched
- `max_search_results` controls cost
- Default limit: 20 results (configurable via `GROK_SEARCH_SOURCES_LIMIT` env var)
- Use domain filtering to reduce unnecessary searches

---

### grok_reason

Deep logical reasoning with Grok-4.1 using first principles and enhanced emotional intelligence.

#### Schema

```typescript
{
  problem: string;                  // REQUIRED
  context?: string;
  approach?: "analytical" | "creative" | "systematic" | "first-principles";
  useHeavy?: boolean;               // Use Grok-4-heavy model
}
```

#### Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `problem` | `string` | ✅ Yes | - | Problem to reason about |
| `context` | `string` | No | - | Additional context |
| `approach` | `string` | No | `"first-principles"` | Reasoning approach |
| `useHeavy` | `boolean` | No | `false` | Use Grok-4-heavy for complex problems |

#### Example Calls

**First principles reasoning:**
```typescript
grok_reason({
  problem: "Why do rockets need stages?",
  approach: "first-principles"
})
```

**Complex problem with heavy model:**
```typescript
grok_reason({
  problem: "Design a consensus algorithm for distributed systems",
  approach: "systematic",
  useHeavy: true,
  context: "Byzantine fault tolerance required"
})
```

---

### grok_code

Code analysis and optimization with Grok-4.1 Fast (tool-calling optimized).

#### Schema

```typescript
{
  code: string;                     // REQUIRED
  task: "analyze" | "optimize" | "explain" | "review";  // REQUIRED
  language?: string;
  context?: string;
}
```

#### Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `code` | `string` | ✅ Yes | - | Code to analyze |
| `task` | `string` | ✅ Yes | - | Analysis task |
| `language` | `string` | No | Auto-detect | Programming language |
| `context` | `string` | No | - | Additional context |

#### Example Calls

**Code analysis:**
```typescript
grok_code({
  code: `
    function fibonacci(n) {
      if (n <= 1) return n;
      return fibonacci(n-1) + fibonacci(n-2);
    }
  `,
  task: "analyze",
  language: "javascript"
})
```

**Optimization:**
```typescript
grok_code({
  code: "SELECT * FROM users WHERE status = 'active'",
  task: "optimize",
  language: "sql",
  context: "Users table has 10M rows, queried frequently"
})
```

---

### grok_debug

Deep debugging assistance with Grok-4.1 Fast.

#### Schema

```typescript
{
  code: string;                     // REQUIRED
  error?: string;
  expectedBehavior?: string;
  actualBehavior?: string;
  context?: string;
}
```

#### Example Calls

**Debug with error:**
```typescript
grok_debug({
  code: `
    async function fetchData() {
      const data = await fetch('/api/data');
      return data.json();
    }
  `,
  error: "TypeError: data.json is not a function",
  context: "Using Node.js fetch API"
})
```

---

### grok_architect

System architecture and design with Grok-4.1.

#### Schema

```typescript
{
  requirements: string;             // REQUIRED
  constraints?: string;
  scale?: string;
  context?: string;
}
```

#### Example Calls

**Architecture design:**
```typescript
grok_architect({
  requirements: "Real-time chat application with 100k concurrent users",
  constraints: "Must use AWS, budget $5k/month",
  scale: "100k concurrent, 1M daily active users"
})
```

---

### grok_brainstorm

Creative brainstorming using Grok-4.1 with enhanced creativity and emotional intelligence.

#### Schema

```typescript
{
  problem: string;                  // REQUIRED
  quantity?: number;                // Default: 10
  style?: "innovative" | "practical" | "wild" | "systematic";
  constraints?: string;
}
```

#### Example Calls

**Creative ideation:**
```typescript
grok_brainstorm({
  problem: "Revolutionary social media features",
  quantity: 15,
  style: "wild"
})
```

---

## OpenAI Suite

### openai_brainstorm

Creative brainstorming using GPT-5 suite with advanced controls.

#### Schema

```typescript
{
  problem: string;                  // REQUIRED
  model?: "gpt-5" | "gpt-5-mini" | "gpt-5-nano";  // Default: "gpt-5-mini"
  quantity?: number;                // Default: 5
  style?: "innovative" | "practical" | "wild" | "systematic";
  constraints?: string;
  reasoning_effort?: "minimal" | "low" | "medium" | "high";
  verbosity?: "silent" | "minimal" | "concise" | "balanced" | "detailed" | "exhaustive";
  max_tokens?: number;              // Default: 4000
}
```

#### Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `problem` | `string` | ✅ Yes | - | Problem to brainstorm |
| `model` | `string` | No | `"gpt-5-mini"` | GPT-5 model variant |
| `quantity` | `number` | No | `5` | Number of ideas to generate |
| `style` | `string` | No | `"innovative"` | Brainstorming style |
| `constraints` | `string` | No | - | Additional constraints |
| `reasoning_effort` | `string` | No | `"low"` | Reasoning depth (GPT-5 only) |
| `verbosity` | `string` | No | `"balanced"` | Output verbosity (GPT-5 only) |
| `max_tokens` | `number` | No | `4000` | Maximum tokens |

#### Model Comparison

| Model | Speed | Cost | Best For |
|-------|-------|------|----------|
| `gpt-5-nano` | Fastest | $ | Quick ideation |
| `gpt-5-mini` | Fast | $$ | Most tasks (default) |
| `gpt-5` | Slow | $$$$ | Complex problems requiring deep reasoning |

#### Reasoning Effort (GPT-5 only)

- `minimal` - Quick responses
- `low` - Light reasoning
- `medium` - Balanced reasoning
- `high` - Deep, thorough reasoning

#### Verbosity Levels (GPT-5 only)

- `silent` - Minimal output
- `minimal` - Brief responses
- `concise` - Compact but complete
- `balanced` - Standard detail (default)
- `detailed` - Comprehensive
- `exhaustive` - Maximum detail

#### Example Calls

**Basic brainstorming:**
```typescript
openai_brainstorm({
  problem: "New features for a productivity app"
})
```

**With GPT-5 and high reasoning:**
```typescript
openai_brainstorm({
  problem: "Solve climate change with technology",
  model: "gpt-5",
  quantity: 10,
  style: "innovative",
  reasoning_effort: "high",
  verbosity: "detailed"
})
```

**Quick practical ideas:**
```typescript
openai_brainstorm({
  problem: "Reduce app cold start time",
  model: "gpt-5-nano",
  quantity: 5,
  style: "practical",
  constraints: "Must work on mobile devices"
})
```

**Wild ideation:**
```typescript
openai_brainstorm({
  problem: "Future of transportation",
  style: "wild",
  quantity: 20,
  verbosity: "exhaustive"
})
```

---

## Gemini Suite

### gemini_brainstorm

Collaborative ideation and brainstorming with Gemini.

#### Schema

```typescript
{
  prompt: string;                   // REQUIRED
  claudeThoughts?: string;          // Your initial thoughts
  maxRounds?: number;               // Default: 1
}
```

#### Example Calls

**Basic brainstorming:**
```typescript
gemini_brainstorm({
  prompt: "Innovative features for a fitness app"
})
```

**Collaborative brainstorming:**
```typescript
gemini_brainstorm({
  prompt: "Improve code review process",
  claudeThoughts: "I think automated linting and AI suggestions could help",
  maxRounds: 3
})
```

---

### gemini_analyze_code

Code quality and security analysis with Gemini.

#### Schema

```typescript
{
  code: string;                     // REQUIRED
  focus?: "general" | "security" | "performance" | "quality";
  language?: string;
}
```

#### Example Calls

**General code analysis:**
```typescript
gemini_analyze_code({
  code: `
    function processPayment(userId, amount) {
      const user = db.query('SELECT * FROM users WHERE id = ' + userId);
      charge(user.card, amount);
    }
  `,
  focus: "security"
})
```

---

### gemini_analyze_text

Text sentiment, entity extraction, and summarization.

#### Schema

```typescript
{
  text: string;                     // REQUIRED
  task: "sentiment" | "entities" | "summary" | "key-points";
}
```

#### Example Calls

**Sentiment analysis:**
```typescript
gemini_analyze_text({
  text: "The new iPhone is amazing! Best camera ever, but battery life could be better.",
  task: "sentiment"
})
```

---

## Qwen Suite

### qwen_coder

Advanced code generation with Qwen3-Coder (480B MoE model).

#### Schema

```typescript
{
  task: "generate" | "review" | "optimize" | "debug" | "refactor" | "explain";  // REQUIRED
  requirements: string;             // REQUIRED
  code?: string;                    // For non-generate tasks
  language?: string;
  useFree?: boolean;                // Use free tier model
}
```

#### Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `task` | `string` | ✅ Yes | - | Task type |
| `requirements` | `string` | ✅ Yes | - | What you need |
| `code` | `string` | No | - | Existing code (for review/optimize/debug/refactor/explain) |
| `language` | `string` | No | Auto-detect | Programming language |
| `useFree` | `boolean` | No | `false` | Use free tier model (lower quality) |

#### Example Calls

**Generate code:**
```typescript
qwen_coder({
  task: "generate",
  requirements: "Binary search tree implementation in Python with insert, delete, and search methods",
  language: "python"
})
```

**Review code:**
```typescript
qwen_coder({
  task: "review",
  requirements: "Check for bugs, performance issues, and best practices",
  code: `
    def fibonacci(n):
        if n <= 1:
            return n
        return fibonacci(n-1) + fibonacci(n-2)
  `,
  language: "python"
})
```

**Optimize code:**
```typescript
qwen_coder({
  task: "optimize",
  requirements: "Improve performance for large datasets",
  code: "const result = array.filter(x => x > 0).map(x => x * 2).reduce((a, b) => a + b)",
  language: "javascript"
})
```

---

## Advanced Modes

### verifier

Multi-model parallel verification with consensus analysis.

#### Schema

```typescript
{
  query: string;                    // REQUIRED
  variant?: "quick_verify" | "deep_verify" | "fact_check" |
            "code_verify" | "security_verify";  // Default: "quick_verify"
  model?: string | string[];        // Override variant models
  maxTokens?: number;
  timeout?: number;                 // Milliseconds
  includeSources?: boolean;         // Default: false (true for fact_check)
}
```

#### Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `query` | `string` | ✅ Yes | - | Statement or question to verify |
| `variant` | `string` | No | `"quick_verify"` | Verification strategy |
| `model` | `string \| string[]` | No | Variant-specific | Custom model(s) |
| `maxTokens` | `number` | No | Variant-specific | Max tokens per model |
| `timeout` | `number` | No | Variant-specific | Timeout in ms |
| `includeSources` | `boolean` | No | Variant-specific | Include source citations |

#### Variants

**quick_verify** (Default)
- Models: `gpt-5-mini`, `gemini-2.5-flash`, `gpt-5`
- Tokens: 2000
- Timeout: 10s
- Use: Fast verification

**deep_verify**
- Models: `gpt-5`, `qwq-32b`, `gemini-2.5-pro`, `qwen/qwen3-coder`
- Tokens: 6000
- Timeout: 30s
- Use: Complex reasoning

**fact_check**
- Models: `gpt-5`, `gemini-2.5-pro`, `gpt-5-mini`
- Tokens: 3000
- Timeout: 15s
- Sources: Enabled by default
- Use: Factual verification

**code_verify**
- Models: `gpt-5`, `gemini-2.5-pro`, `qwen/qwen3-coder`
- Tokens: 4000
- Timeout: 20s
- Use: Code correctness

**security_verify**
- Models: `gpt-5`, `gemini-2.5-pro`, `qwen/qwen3-coder`
- Tokens: 4000
- Timeout: 20s
- Use: Security analysis

#### Example Calls

**Basic verification:**
```typescript
verifier({
  query: "Is Python a statically typed language?"
})
```

**Fact check with sources:**
```typescript
verifier({
  query: "What is the speed of light?",
  variant: "fact_check",
  includeSources: true
})
```

**Code verification:**
```typescript
verifier({
  query: "Is this SQL query safe from injection?",
  variant: "security_verify"
})
```

**Custom models:**
```typescript
verifier({
  query: "Complex mathematical proof",
  variant: "deep_verify",
  model: ["gpt-5", "qwq-32b", "gemini-2.5-pro"],
  maxTokens: 8000
})
```

---

### scout

Conditional hybrid intelligence gathering with Perplexity and/or Grok.

#### Schema

```typescript
{
  query: string;                    // REQUIRED
  variant?: "research_scout" | "code_scout" | "fact_scout" | "quick_scout";
  searchProvider?: "perplexity" | "grok" | "both";  // Default: "perplexity"
  maxTokens?: number;
  timeout?: number;
  enableGrokLiveSearch?: boolean;   // Default: true (if using grok)
  maxSearchSources?: number;        // Grok source limit
  searchDomains?: string[];         // Domain whitelist
}
```

#### Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `query` | `string` | ✅ Yes | - | Research topic or question |
| `variant` | `string` | No | `"research_scout"` | Research strategy |
| `searchProvider` | `string` | No | `"perplexity"` | Search provider(s) |
| `maxTokens` | `number` | No | Variant-specific | Max tokens per call |
| `timeout` | `number` | No | Variant-specific | Timeout in ms |
| `enableGrokLiveSearch` | `boolean` | No | `true` | Enable Grok live search |
| `maxSearchSources` | `number` | No | Variant-specific | Max Grok sources (costs per 1k) |
| `searchDomains` | `string[]` | No | - | Restrict to specific domains |

#### Variants

**research_scout** (Default)
- Flow: Perplexity-first-always
- Tokens: 2500
- Max Sources: 100
- Use: Comprehensive research

**code_scout**
- Flow: Conditional hybrid
- Tokens: 2000
- Max Sources: 100
- Use: Technical documentation

**fact_scout**
- Flow: Waterfall
- Tokens: 1500
- Max Sources: 150
- Use: Fact verification

**quick_scout**
- Flow: Conditional hybrid
- Tokens: 1000
- Max Sources: 50
- Use: Fast lookups

#### Example Calls

**Basic research:**
```typescript
scout({
  query: "Latest quantum computing developments 2025"
})
```

**Code documentation search:**
```typescript
scout({
  query: "TypeScript 5.0 new features",
  variant: "code_scout",
  searchDomains: ["typescriptlang.org", "github.com/microsoft/TypeScript"]
})
```

**Use Grok live search:**
```typescript
scout({
  query: "Current space missions",
  searchProvider: "grok",
  enableGrokLiveSearch: true,
  maxSearchSources: 50
})
```

**Use both providers:**
```typescript
scout({
  query: "Comprehensive climate change research",
  searchProvider: "both",
  variant: "research_scout",
  maxSearchSources: 100
})
```

**Domain-restricted:**
```typescript
scout({
  query: "Python async/await best practices",
  searchDomains: ["python.org", "docs.python.org"],
  variant: "code_scout"
})
```

---

### challenger

Critical thinking and echo chamber prevention by generating counter-arguments.

#### Schema

```typescript
{
  context: string | object | array;  // REQUIRED
  model?: string;                    // Default: "gpt-5-mini"
  maxTokens?: number;                // Default: 2000
  temperature?: number;              // 0-1, Default: 0.9
}
```

#### Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `context` | `string \| object \| array` | ✅ Yes | - | Claims to challenge |
| `model` | `string` | No | `"gpt-5-mini"` | AI model to use |
| `maxTokens` | `number` | No | `2000` | Max tokens per call |
| `temperature` | `number` | No | `0.9` | Creativity (0-1) |

#### Supported Models

- `gpt-5-mini`, `gpt-5`, `qwq-32b`, `qwen3-30b`, `qwen3-coder-480b`
- `gemini-2.5-flash`, `gemini-2.5-pro`
- `grok-4`, `grok-4-0709`
- `sonar-pro`, `perplexity-sonar-pro`

#### Context Types

**String:**
```typescript
challenger({
  context: "AI will solve all of humanity's problems"
})
```

**Object:**
```typescript
challenger({
  context: {
    query: "Social media is only beneficial",
    text: "Everyone should use social media daily"
  }
})
```

**Array (detects groupthink):**
```typescript
challenger({
  context: [
    "Everyone agrees this is the best approach",
    "There is unanimous consensus",
    "All experts say the same thing"
  ]
})
```

#### Example Calls

**Basic challenge:**
```typescript
challenger({
  context: "Remote work is always better than office work"
})
```

**With custom model:**
```typescript
challenger({
  context: "Cryptocurrency will replace traditional banking",
  model: "gemini-2.5-flash",
  temperature: 0.7
})
```

**Groupthink detection:**
```typescript
challenger({
  context: [
    "This architecture is the only correct solution",
    "No other approach makes sense",
    "Everyone on the team agrees"
  ],
  maxTokens: 3000
})
```

---

## Workflow Tools

### workflow

Execute multi-step AI workflows from YAML/JSON files.

#### Schema

```typescript
{
  name: string;                     // REQUIRED - Workflow name
  query: string;                    // REQUIRED - Input for workflow
  projectPath?: string;             // For custom workflows
}
```

#### Example Calls

**Execute workflow:**
```typescript
workflow({
  name: "comprehensive-code-review",
  query: codeToReview
})
```

**Custom workflow:**
```typescript
workflow({
  name: "my-custom-workflow",
  query: "input data",
  projectPath: "/path/to/project"
})
```

---

### list_workflows

List available workflows.

#### Schema

```typescript
{
  projectPath?: string;             // For custom workflows
}
```

#### Example Calls

```typescript
list_workflows({})
```

---

### create_workflow

Create custom workflow from template.

#### Schema

```typescript
{
  name: string;                     // REQUIRED - Workflow name
  type: "code-review" | "brainstorm" | "debug" | "research" | "custom";  // REQUIRED
  steps?: string;                   // Custom YAML/JSON steps
}
```

#### Example Calls

**Create from template:**
```typescript
create_workflow({
  name: "my-code-review",
  type: "code-review"
})
```

**Custom workflow:**
```typescript
create_workflow({
  name: "custom-research",
  type: "custom",
  steps: `
steps:
  - name: gather-facts
    tool: perplexity_research
    input:
      topic: "\${input}"
  - name: analyze
    tool: gemini_analyze_text
    input:
      text: "\${gather-facts}"
  `
})
```

---

### visualize_workflow

Show workflow structure.

#### Schema

```typescript
{
  name: string;                     // REQUIRED
}
```

#### Example Calls

```typescript
visualize_workflow({
  name: "comprehensive-code-review"
})
```

---

## Collaborative Tools

### pingpong

Standalone multi-model conversation tool.

#### Schema

```typescript
{
  problem: string;                  // REQUIRED
  domain?: string;
  rounds?: number;                  // Default: 8
  models?: string[];                // Default: ["grok", "claude-code", "qwen", "openai"]
  temperature?: number;             // 0-1, Default: 0.8
  style?: "collaborative" | "competitive" | "debate" | "build-upon";  // Default: "collaborative"
}
```

#### Example Calls

**Collaborative problem-solving:**
```typescript
pingpong({
  problem: "Design a distributed caching system",
  domain: "architecture",
  rounds: 8,
  style: "collaborative"
})
```

**Competitive debate:**
```typescript
pingpong({
  problem: "Best approach to microservices architecture",
  models: ["grok", "openai", "gemini"],
  rounds: 10,
  style: "debate",
  temperature: 0.9
})
```

---

## Environment Variables

Configure tool behavior via environment variables:

```bash
# Search providers
DEFAULT_SEARCH_PROVIDER=perplexity
GROK_SEARCH_SOURCES_LIMIT=100

# Tool overrides
ENABLE_TOOL_HUNTER=false
DISABLE_TOOL_GROK_SEARCH=false
DISABLE_ALL_TOOLS=false

# Performance
TACHI_ENABLE_CACHE=true
TACHI_ENABLE_BATCHING=true
MAX_PINGPONG_ROUNDS=30
```

---

## See Also

- [Tool Profiles](TOOL_PROFILES.md) - Pre-configured tool sets
- [Tool Parameters](TOOL_PARAMETERS.md) - Detailed parameter docs for advanced modes
- [Configuration Guide](CONFIGURATION.md) - Complete configuration reference
- [API Keys Guide](API_KEYS.md) - Where to get API keys
- [Workflows](WORKFLOWS.md) - Custom workflow creation
