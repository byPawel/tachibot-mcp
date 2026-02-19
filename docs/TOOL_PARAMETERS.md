# Tool Parameters Documentation

This document provides comprehensive information about all available parameters for the refactored tools: **Challenger**, **Verifier**, and **Scout**.

## Table of Contents

- [Challenger](#challenger)
- [Verifier](#verifier)
- [Scout](#scout)
- [API Requirements](#api-requirements)

---

## Challenger

The Challenger tool provides critical thinking and echo chamber prevention by generating counter-arguments and alternative perspectives.

### Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `context` | `string \| object \| array` | ✅ Yes | - | The claims, statements, or context to challenge. Can be a string, object with `query`/`text`/`content`, or array of contexts |
| `model` | `string` | No | `'gpt-5.1-codex-mini'` | AI model to use for generating challenges. See [Supported Models](#supported-models) section |
| `maxTokens` | `number` | No | `2000` | Maximum tokens per API call |
| `temperature` | `number` | No | `0.9` | Temperature for response generation (0-1). Higher = more creative challenges |

### Example Usage

```typescript
import { Challenger } from './modes/challenger.js';

const challenger = new Challenger();

// Basic usage
const result1 = await challenger.challenge(
  'AI will solve all of humanity\'s problems.'
);

// With custom parameters
const result2 = await challenger.challenge(
  'Social media has only positive effects.',
  {
    model: 'gemini-3.1-pro-preview',
    temperature: 0.7,
    maxTokens: 1500
  }
);

// With object context
const result3 = await challenger.challenge({
  query: 'Climate change is not real',
  text: 'Scientists are all wrong about global warming'
});

// With array context (detects groupthink)
const result4 = await challenger.challenge([
  'Everyone agrees this is the best solution',
  'There is unanimous consensus on this',
  'All experts say the same thing'
]);
```

### Return Structure

```typescript
interface ChallengeResult {
  claims: Claim[];              // Extracted claims with metadata
  challenges: Challenge[];      // Generated challenges for each claim
  groupthinkDetected: boolean;  // Whether echo chamber behavior detected
  alternativePerspectives: string[]; // Alternative viewpoints
  synthesis: string;            // Comprehensive analysis markdown
}

interface Claim {
  id: string;
  text: string;
  confidence: number;           // 0-1
  type: 'fact' | 'opinion' | 'assumption' | 'conclusion';
}

interface Challenge {
  claimId: string;
  challenge: string;
  evidence?: string;
  severity: 'low' | 'medium' | 'high';
  alternativeView?: string;
}
```

### Supported Models

| Provider | Models | Notes |
|----------|--------|-------|
| **Google Gemini** | `gemini-3.1-pro-preview`, `gemini-3.1-pro-preview`, `gemini-3.1-pro-preview`, `gemini-3.1-pro-preview-lite` | Gemini 3 Pro is latest (Nov 2025) |
| **OpenAI** | `gpt-5.1`, `gpt-5.1-codex-mini`, `gpt-5.1-codex`, `gpt-5-pro` | Codex models use /v1/responses endpoint |
| **xAI (Grok)** | `grok-4-1-fast-reasoning`, `grok-4-1-fast-non-reasoning`, `grok-code-fast-1`, `grok-4-0709` | Grok 4.1 is latest (Nov 2025) |
| **Perplexity** | `sonar-pro`, `sonar-reasoning-pro` | Web search enabled |
| **OpenRouter** | `qwen/qwen3-coder-plus`, `moonshotai/kimi-k2-thinking` | Requires OPENROUTER_API_KEY |

### Notes

- Higher `temperature` values produce more diverse and creative challenges
- The tool automatically detects claim types (fact, opinion, assumption, conclusion)
- Groupthink detection works best with array contexts containing multiple similar statements
- Default model (`gpt-5.1-codex-mini`) balances cost and quality

---

## Verifier

The Verifier tool provides multi-model parallel verification with consensus analysis, querying multiple AI models simultaneously to reach a consensus.

### Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `query` | `string` | ✅ Yes | - | The statement or question to verify |
| `variant` | `string` | No | `'quick_verify'` | Verification strategy. Options: `quick_verify`, `deep_verify`, `fact_check`, `code_verify`, `security_verify` |
| `model` | `string \| string[]` | No | Variant-specific | Custom model(s) to use instead of variant defaults. Can be single model or array |
| `maxTokens` | `number` | No | Variant-specific | Maximum tokens per model call |
| `timeout` | `number` | No | Variant-specific | Timeout in milliseconds for each model query |
| `includeSources` | `boolean` | No | `false` | Whether to include source citations (recommended for `fact_check`) |

### Variants

Each variant uses different models and settings optimized for specific use cases:

#### `quick_verify` (Default)
- **Models**: `qwen/qwen3-coder-plus`, `gemini-3.1-pro-preview`, `gpt-5.1-codex-mini`
- **Tokens**: 2000
- **Timeout**: 10000ms
- **Use case**: Fast verification of simple statements

#### `deep_verify`
- **Models**: `qwen/qwen3-coder-plus`, `gemini-3.1-pro-preview`, `gpt-5.1`
- **Tokens**: 6000
- **Timeout**: 30000ms
- **Use case**: Complex reasoning and analysis

#### `fact_check`
- **Models**: `qwen/qwen3-coder-plus`, `gemini-3.1-pro-preview`, `gpt-5.1-codex-mini`
- **Tokens**: 3000
- **Timeout**: 15000ms
- **Include Sources**: Yes (default)
- **Use case**: Factual verification with citations

#### `code_verify`
- **Models**: `qwen/qwen3-coder-plus`, `gemini-3.1-pro-preview`, `gpt-5.1-codex-mini`
- **Tokens**: 4000
- **Timeout**: 20000ms
- **Use case**: Code correctness verification

#### `security_verify`
- **Models**: `qwen/qwen3-coder-plus`, `gemini-3.1-pro-preview`, `gpt-5.1-codex-mini`
- **Tokens**: 4000
- **Timeout**: 20000ms
- **Use case**: Security vulnerability detection

### Example Usage

```typescript
import { Verifier } from './modes/verifier.js';

const verifier = new Verifier();

// Basic usage (quick_verify)
const result1 = await verifier.verify(
  'Is Python a statically typed language?'
);

// Use specific variant
const result2 = await verifier.verify(
  'What is the speed of light?',
  { variant: 'fact_check', includeSources: true }
);

// Custom models
const result3 = await verifier.verify(
  'Is this code safe?',
  {
    model: ['gpt-5.1', 'gemini-3.1-pro-preview'],
    maxTokens: 3000
  }
);

// Code verification
const result4 = await verifier.verify(
  'function add(a, b) { return a + b; }',
  { variant: 'code_verify' }
);

// Security check
const result5 = await verifier.verify(
  'SELECT * FROM users WHERE id = ${userId}',
  { variant: 'security_verify' }
);
```

### Return Structure

```typescript
interface VerifierResult {
  consensus: number;            // 0-1, agreement level among models
  majority: any;                // The majority conclusion
  outliers: ModelResponse[];    // Models that disagreed
  responses: ModelResponse[];   // All model responses
  synthesis: string;            // Comprehensive analysis
  confidence: number;           // 0-1, overall confidence score
  shouldTerminate?: boolean;    // True if consensus >= 0.8
}

interface ModelResponse {
  model: string;
  response: any;
  conclusion?: string;          // Extracted conclusion (true/false/uncertain/needs-context)
  evidence?: string[];          // Supporting evidence
  confidence?: number;          // Model's confidence (0-1)
  tokens?: number;             // Tokens used
}
```

### Notes

- Models are queried in parallel for speed
- Timeouts prevent slow models from blocking results
- At least one model must succeed for valid result
- Consensus >= 80% sets `shouldTerminate = true`
- Use `includeSources: true` with `fact_check` for citations

---

## Scout

The Scout tool provides conditional hybrid intelligence gathering, using Perplexity for facts and optionally Grok-4 with live search.

### Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `query` | `string` | ✅ Yes | - | The topic or question to research |
| `variant` | `string` | No | `'research_scout'` | Research strategy. Options: `research_scout`, `code_scout`, `fact_scout`, `quick_scout` |
| `searchProvider` | `string` | No | `'perplexity'` | Search provider: `perplexity`, `grok`, or `both` |
| `maxTokens` | `number` | No | Variant-specific | Maximum tokens per API call |
| `timeout` | `number` | No | Variant-specific | Timeout in milliseconds |
| `enableGrokLiveSearch` | `boolean` | No | `true` (if using grok) | Enable Grok-4 live web search (costs extra) |
| `maxSearchSources` | `number` | No | Variant-specific | Maximum search sources for Grok (costs per 1k sources) |
| `searchDomains` | `string[]` | No | - | Restrict search to specific domains |

### Variants

#### `research_scout` (Default)
- **Flow**: `perplexity-first-always`
- **Perplexity Timeout**: 500ms
- **Parallel Models**: `gemini-3.1-pro-preview`, `gpt-5.1-codex-mini`
- **Tokens**: 2500
- **Max Sources**: 100
- **Use case**: Comprehensive research with current facts

#### `code_scout`
- **Flow**: `conditional-hybrid`
- **Perplexity For**: Latest API docs only
- **Primary**: `gemini-3.1-pro-preview`
- **Tokens**: 2000
- **Max Sources**: 100
- **Use case**: Technical documentation and code information

#### `fact_scout`
- **Flow**: `waterfall`
- **Perplexity Timeout**: 1000ms
- **Tokens**: 1500
- **Max Sources**: 150
- **Use case**: Fact verification with high reliability

#### `quick_scout`
- **Flow**: `conditional-hybrid`
- **Perplexity Timeout**: 250ms
- **Parallel Models**: `gemini-3.1-pro-preview`, `gpt-5.1-codex-mini`
- **Tokens**: 1000
- **Max Sources**: 50
- **Use case**: Fast information gathering

### Example Usage

```typescript
import { Scout } from './modes/scout.js';

const scout = new Scout();

// Basic usage (research_scout)
const result1 = await scout.scout(
  'Latest developments in quantum computing 2025'
);

// Use specific variant
const result2 = await scout.scout(
  'TypeScript 5.0 new features',
  { variant: 'code_scout' }
);

// Use Grok live search
const result3 = await scout.scout(
  'Current space exploration missions',
  {
    searchProvider: 'grok',
    enableGrokLiveSearch: true,
    maxSearchSources: 50
  }
);

// Use both providers
const result4 = await scout.scout(
  'Comprehensive renewable energy research',
  {
    searchProvider: 'both',
    maxSearchSources: 100
  }
);

// Domain filtering
const result5 = await scout.scout(
  'Python documentation',
  {
    searchDomains: ['python.org', 'docs.python.org']
  }
);

// Quick lookup
const result6 = await scout.scout(
  'Node.js version 20 features',
  {
    variant: 'quick_scout',
    maxTokens: 500
  }
);
```

### Return Structure

```typescript
interface ScoutResult {
  probe?: ProbeResult;          // Initial probe results
  facts?: FactResult;           // Gathered facts
  analyses?: AnalysisResult[];  // Multi-model analyses
  synthesis: string;            // Comprehensive synthesis
  warning?: string;             // Warnings (e.g., outdated info)
  executionTime: number;        // Time in milliseconds
  tokensUsed: number;          // Total tokens consumed
}

interface FactResult {
  facts: string[];
  sources?: string[];
  timestamp: string;
  reliability: number;          // 0-1
}

interface AnalysisResult {
  model: string;
  analysis: string;
  insights: string[];
}
```

### Cost Control

Scout includes built-in cost controls:

- **Source Limits**: Controls how many sources Grok searches (costs per 1k)
  - `quick_scout`: 50 sources
  - `research_scout`: 100 sources (configurable via `GROK_SEARCH_SOURCES_LIMIT` env)
  - `fact_scout`: 150 sources

- **Search Provider**: Default is Perplexity (cheaper), Grok is optional
- **Timeouts**: Prevent long-running expensive calls
- **Token Limits**: Per-variant limits prevent runaway costs

### Notes

- Requires `PERPLEXITY_API_KEY` for Perplexity search
- Requires `GROK_API_KEY` or `XAI_API_KEY` for Grok search
- `searchProvider: 'both'` combines results from both providers
- Domain filtering restricts searches to specified websites
- Grok live search costs are based on sources searched (per 1000)

---

## API Requirements

### Required API Keys

Configure these in your `.env` file:

```bash
# Required for most tools
OPENAI_API_KEY=sk-...

# Optional but recommended
GOOGLE_API_KEY=...           # For Gemini models
PERPLEXITY_API_KEY=...       # For Perplexity search
GROK_API_KEY=...             # For Grok models and live search
# or
XAI_API_KEY=...              # Alternative to GROK_API_KEY

# Optional configuration
DEFAULT_SEARCH_PROVIDER=perplexity  # perplexity|grok|both
GROK_SEARCH_SOURCES_LIMIT=100       # Max sources for Grok
```

### Model Routing

Tools automatically route to the appropriate API based on model name:

- **`gpt*`, `qwen*`, `qwq*`** → OpenAI API
- **`gemini*`** → Google API
- **`grok*`** → xAI API
- **`perplexity*`, `sonar*`** → Perplexity API

### Error Handling

All tools handle API failures gracefully:

- Timeouts return partial results
- Failed models are excluded from consensus
- Fallback mechanisms ensure results even with partial failures

---

## Testing

Comprehensive tests are available in `src/modes/__tests__/`:

```bash
# Run all tests
npm test

# Run specific tool tests
npm test challenger
npm test verifier
npm test scout

# Run with coverage
npm test -- --coverage
```

See test files for more usage examples:
- `src/modes/__tests__/challenger.test.ts`
- `src/modes/__tests__/verifier.test.ts`
- `src/modes/__tests__/scout.test.ts`

---

## Performance Tips

1. **Use appropriate variants**: Don't use `deep_verify` when `quick_verify` suffices
2. **Set token limits**: Lower `maxTokens` for simple queries
3. **Control timeouts**: Shorter timeouts for time-sensitive operations
4. **Choose models wisely**: `gpt-5.1-codex-mini` and `gemini-3.1-pro-preview` are fast and cheap
5. **Limit Grok sources**: Keep `maxSearchSources` low unless needed
6. **Use `quick_scout`**: For simple lookups instead of full research

---

## Migration Guide

If migrating from old tool structure:

### Challenger (formerly separate tools)
```typescript
// Old
await thinkTool.challenge(context);

// New
await challenger.challenge(context, { model: 'gpt-5.1-codex-mini' });
```

### Verifier (formerly consensus tools)
```typescript
// Old
await multiModelTool.verify(query);

// New
await verifier.verify(query, { variant: 'quick_verify' });
```

### Scout (formerly search + research tools)
```typescript
// Old
await researchTool.search(query);

// New
await scout.scout(query, { variant: 'research_scout' });
```

---

## Support

For issues or questions:
- GitHub: https://github.com/byPawel/tachibot-mcp
