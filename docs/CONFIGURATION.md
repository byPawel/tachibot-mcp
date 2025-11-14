# Configuration Guide

Complete guide to configuring TachiBot MCP for optimal performance, cost control, and feature selection.

---

## Table of Contents

- [Quick Start](#quick-start)
- [Profile System](#profile-system)
- [Environment Variables](#environment-variables)
- [API Configuration](#api-configuration)
- [Cost & Usage Controls](#cost--usage-controls)
- [Performance Tuning](#performance-tuning)
- [Tool Management](#tool-management)
- [Advanced Configuration](#advanced-configuration)
- [Configuration Examples](#configuration-examples)
- [Troubleshooting](#troubleshooting)

---

## Quick Start

### Minimal Setup

1. **Create `.env` file:**
   ```bash
   cp .env.example .env
   ```

2. **Add at least one API key:**
   ```bash
   PERPLEXITY_API_KEY=your-key-here
   ```

3. **Choose a profile (optional):**
   ```bash
   TACHIBOT_PROFILE=minimal
   ```

4. **Start using TachiBot!**

---

## Profile System

Profiles control which tools are loaded, affecting both functionality and token usage.

### Available Profiles

| Profile | Tools | Tokens | Use Case |
|---------|-------|--------|----------|
| `minimal` | 8 | ~4-5k | Basic tasks, learning, token constraints |
| `research_power` | 15 | ~9-10k | Research, fact-checking, verification (DEFAULT) |
| `code_focus` | 13 | ~8-9k | Software development, debugging |
| `balanced` | 17 | ~10-11k | General-purpose daily work |
| `full` | 26 | ~18-19k | Maximum capability |

### Switching Profiles

#### Method 1: Environment Variable (Recommended)

Set `TACHIBOT_PROFILE` in your Claude/Cursor config:

**Claude Desktop** (`~/Library/Application Support/Claude/claude_desktop_config.json`):
```json
{
  "mcpServers": {
    "tachibot": {
      "command": "tachibot",
      "env": {
        "TACHIBOT_PROFILE": "minimal",
        "PERPLEXITY_API_KEY": "your-key"
      }
    }
  }
}
```

**Cursor** (MCP settings):
```json
{
  "mcpServers": {
    "tachibot": {
      "command": "tachi",
      "env": {
        "TACHIBOT_PROFILE": "code_focus",
        "OPENAI_API_KEY": "your-key"
      }
    }
  }
}
```

#### Method 2: Edit `tools.config.json`

```json
{
  "activeProfile": "balanced"
}
```

Restart TachiBot after changing.

#### Method 3: Custom Profile

Create your own tool selection:

```json
{
  "customProfile": {
    "enabled": true,
    "description": "My custom research setup",
    "tools": {
      "think": true,
      "focus": true,
      "perplexity_ask": true,
      "perplexity_research": true,
      "grok_search": true,
      "scout": true,
      "verifier": true,
      "gemini_brainstorm": true,
      "qwen_coder": true,
      "workflow": true
    }
  }
}
```

### Profile Precedence

1. **Highest:** `customProfile.enabled = true` in `tools.config.json`
2. **Medium:** `TACHIBOT_PROFILE` environment variable
3. **Low:** `activeProfile` in `tools.config.json`
4. **Fallback:** All tools enabled

### Profile Details

See [TOOL_PROFILES.md](TOOL_PROFILES.md) for detailed profile documentation.

---

## Environment Variables

### Profile Selection

```bash
# Choose your tool profile
TACHIBOT_PROFILE=research_power
```

### API Keys

```bash
# Core providers
PERPLEXITY_API_KEY=pplx-...
GROK_API_KEY=xai-...
OPENAI_API_KEY=sk-...
GOOGLE_API_KEY=AIza...
OPENROUTER_API_KEY=sk-or-...

# Alternative naming
XAI_API_KEY=xai-...  # Alternative to GROK_API_KEY

# Optional
ANTHROPIC_API_KEY=sk-ant-...
QWEN_API_KEY=...
```

### Search Configuration

```bash
# Default search provider for scout/research
# Options: perplexity, grok, both
DEFAULT_SEARCH_PROVIDER=perplexity

# Enable Grok-4 live search (costs extra per 1k sources)
ENABLE_GROK_LIVE_SEARCH=false

# Max sources for Grok searches (default: 100)
# Lower = cheaper, Higher = more comprehensive
GROK_SEARCH_SOURCES_LIMIT=100

# Prefer Perplexity in scout (recommended for cost)
SCOUT_PREFER_PERPLEXITY=true
```

### Cost & Usage Limits

**⚠️ IMPORTANT:** These environment variables are NOT currently enforced by TachiBot. Dollar-based cost tracking is not implemented. To control costs:
- Use `maxTokens` parameter in workflows to limit output size
- Set hard limits in provider dashboards (OpenAI, Grok, Perplexity, etc.)
- Choose cheaper models via `smartRouting` optimization
- Enable caching to reduce duplicate API calls

### Performance

```bash
# Enable result caching
TACHI_ENABLE_CACHE=true

# Cache TTL (seconds)
TACHI_CACHE_TTL=3600

# Enable request batching
TACHI_ENABLE_BATCHING=true

# Max ping-pong rounds
MAX_PINGPONG_ROUNDS=24

# Max reasoning rounds
MAX_REASONING_ROUNDS=5
```

### Tool Overrides

```bash
# Force enable a tool (overrides profile)
ENABLE_TOOL_HUNTER=true
ENABLE_TOOL_PINGPONG=true

# Force disable a tool (overrides profile)
DISABLE_TOOL_GROK_SEARCH=true
DISABLE_TOOL_QWEN_COMPETITIVE=true

# Disable ALL tools (testing only)
DISABLE_ALL_TOOLS=false
```

### Model Preferences

```bash
# Primary reasoning model
PRIMARY_REASONING_MODEL=grok_reason

# Backup reasoning models (comma-separated)
BACKUP_REASONING_MODELS=openai_brainstorm,qwq_reason

# Primary research model
PRIMARY_RESEARCH_MODEL=perplexity_research

# Primary analysis model
PRIMARY_ANALYSIS_MODEL=gemini_analyze_code
```

### Model Selection (Multi-Model Tools)

Configure which models are used for Scout, Challenger, and Verifier tools. These tools run multiple models in parallel for consensus/verification.

```bash
# Scout model configuration
SCOUT_QUICK_MODELS=qwen/qwen3-coder-plus,gemini-2.5-flash,gpt-5-mini
SCOUT_RESEARCH_MODELS=qwen/qwen3-coder-plus,gemini-2.5-pro,gpt-5-mini

# Challenger model configuration
CHALLENGER_MODELS=qwen/qwen3-coder-plus,gemini-2.5-pro,gpt-5-mini

# Verifier model configuration
VERIFIER_QUICK_MODELS=qwen/qwen3-coder-plus,gemini-2.5-flash,gpt-5-mini
VERIFIER_STANDARD_MODELS=qwen/qwen3-coder-plus,gemini-2.5-pro,gpt-5-mini
VERIFIER_DEEP_MODELS=qwen/qwen3-coder-plus,gemini-2.5-pro,gpt-5

# Default models for fallback
DEFAULT_MODELS=qwen/qwen3-coder-plus,gemini-2.5-pro,gpt-5-mini
```

**Cost Optimization:**
- **gpt-5-mini**: 60% cheaper (~$0.50/$1.00 per 1M tokens), faster, good for most tasks
- **gpt-5**: Full quality (~$1.25/$2.50 per 1M tokens), best for critical decisions
- **gemini-2.5-flash**: Faster, cheaper, good for quick checks
- **gemini-2.5-pro**: Better reasoning/accuracy, recommended for verification

**Recommendation:** Use defaults (gpt-5-mini) for 60% cost savings. Upgrade to gpt-5 only for `deep_verify` or critical workflows.

### Model-Specific Settings

```bash
# Grok Heavy (256k context, requires ENABLE_EXPENSIVE_MODELS=true)
ENABLE_GROK_HEAVY=false
GROK_PRIORITY=2
GROK_MAX_TOKENS=100000
GROK_COST_LIMIT=1.0
```

### Miscellaneous

```bash
# Default technical domain
DEFAULT_DOMAIN=architecture

# Enable visual ASCII art
ENABLE_VISUALS=true

# Cost optimization
COST_OPTIMIZATION=true

# Debug logging
DEBUG=false
```

---

## API Configuration

### Required APIs

Different profiles require different API keys:

**minimal profile:**
- ✅ Perplexity OR Grok (for search)
- ✅ Gemini OR OpenAI (for brainstorming)

**research_power profile:**
- ✅ Perplexity (for research)
- ✅ Grok (for live search)
- ✅ OpenAI (for brainstorming)
- ✅ Gemini (for brainstorming)

**code_focus profile:**
- ✅ Grok (for code tools)
- ✅ Gemini (for code analysis)
- ✅ Qwen via OpenRouter (for code generation)

**full profile:**
- ✅ All API keys for maximum capability

### Where to Get API Keys

See [API_KEYS.md](API_KEYS.md) for detailed instructions on obtaining API keys from each provider.

Quick links:
- Perplexity: https://www.perplexity.ai/settings/api
- Grok/xAI: https://console.x.ai/
- OpenAI: https://platform.openai.com/api-keys
- Google Gemini: https://aistudio.google.com/apikey
- OpenRouter: https://openrouter.ai/keys

---

## Cost & Usage Controls

**⚠️ IMPORTANT:** TachiBot does NOT enforce dollar-based cost limits internally.

### Setting Spending Limits

**Method 1: Provider Dashboard Limits (RECOMMENDED)**

Set hard limits in each provider's dashboard - these are the ONLY enforced limits:
- **OpenAI:** https://platform.openai.com/settings/organization/limits
- **Google Cloud:** Budget alerts in billing console
- **OpenRouter:** Budget limits in settings
- **Perplexity:** Check usage at https://www.perplexity.ai/settings/billing
- **Grok/xAI:** Check usage at https://console.x.ai/billing

**Method 2: Token Limits in Workflows**

Control costs by limiting tokens per workflow step:
```yaml
steps:
  - tool: openai_brainstorm
    input:
      problem: "${query}"
    maxTokens: 500  # Limits output to 500 tokens
```

### Cost Optimization Strategies

#### 1. Choose Right Profile

```bash
TACHIBOT_PROFILE=minimal  # Lowest cost
```

#### 2. Disable Expensive Tools

```bash
DISABLE_TOOL_GROK_SEARCH=true
DISABLE_TOOL_PERPLEXITY_RESEARCH=true
```

#### 3. Limit Grok Search Sources

```bash
GROK_SEARCH_SOURCES_LIMIT=20  # Lower = cheaper
```

#### 4. Prefer Cheaper Providers

```bash
DEFAULT_SEARCH_PROVIDER=perplexity  # Cheaper than Grok
SCOUT_PREFER_PERPLEXITY=true
```

#### 5. Enable Caching

```bash
TACHI_ENABLE_CACHE=true
TACHI_CACHE_TTL=3600  # Cache for 1 hour
```

#### 6. Use Cost Optimization Mode

```bash
COST_OPTIMIZATION=true  # Prefer cheaper models
```

### Monitoring Costs

Check usage in provider dashboards:
- Perplexity: https://www.perplexity.ai/settings/billing
- Grok: https://console.x.ai/billing
- OpenAI: https://platform.openai.com/usage
- Google: https://console.cloud.google.com/billing
- OpenRouter: https://openrouter.ai/activity

---

## Performance Tuning

### Caching

Enable caching to avoid duplicate API calls:

```bash
TACHI_ENABLE_CACHE=true
TACHI_CACHE_TTL=3600  # 1 hour in seconds
```

**Benefits:**
- Saves money on duplicate requests
- Faster responses for cached queries
- Reduces API rate limit pressure

**Caveats:**
- Cached results may be stale
- Increase TTL for static data, decrease for real-time

### Batching

Enable request batching for parallel execution:

```bash
TACHI_ENABLE_BATCHING=true
```

**Benefits:**
- Faster parallel tool execution
- Better resource utilization

### Reasoning Rounds

Control depth vs speed tradeoff:

```bash
MAX_REASONING_ROUNDS=5       # For focus tool
MAX_PINGPONG_ROUNDS=24       # For pingpong tool
```

**Lower rounds = Faster + Cheaper**
**Higher rounds = Deeper reasoning + More expensive**

### Model Priority

Control which models are used first:

```bash
GROK_PRIORITY=1      # Lower = higher priority
QWEN_CODER_PRIORITY=2
```

---

## Tool Management

### Viewing Active Tools

On startup, TachiBot shows:
```
📋 Using profile 'research_power'
   Research-focused with Grok search + all Perplexity + brainstorming (~9-10k tokens, 15 tools)
🚀 TachiBot MCP Server v5.0
Tools registered: 15 active
```

### Disabling Specific Tools

#### Via Environment Variable

```bash
DISABLE_TOOL_GROK_SEARCH=true
DISABLE_TOOL_HUNTER=true
```

#### Via Custom Profile

In `tools.config.json`:
```json
{
  "customProfile": {
    "enabled": true,
    "tools": {
      "think": true,
      "focus": true,
      "grok_search": false,    // Disabled
      "hunter": false          // Disabled
    }
  }
}
```

### Enabling Specific Tools

```bash
ENABLE_TOOL_PINGPONG=true
ENABLE_TOOL_CHALLENGER=true
```

### Tool Override Precedence

1. **Highest:** `ENABLE_TOOL_*` environment variable
2. **High:** `DISABLE_TOOL_*` environment variable
3. **Medium:** Custom profile in `tools.config.json`
4. **Low:** Selected profile
5. **Fallback:** All tools enabled

---

## Advanced Configuration

### Local Model Support (LM Studio)

```bash
# LM Studio configuration
LMSTUDIO_BASE_URL=http://localhost:1234/v1
LMSTUDIO_MODEL=your-model-name
```

### Multiple Environments

Create different `.env` files for different use cases:

```bash
# Development
.env.dev
TACHIBOT_PROFILE=minimal
DEBUG=true

# Production
.env.prod
TACHIBOT_PROFILE=balanced
DEBUG=false
```

Use with:
```bash
cp .env.dev .env  # For development
cp .env.prod .env # For production
```

### CI/CD Integration

For automated testing:

```bash
DISABLE_ALL_TOOLS=true           # Disable real API calls
ENABLE_TOOL_THINK=true           # Enable only local tools
ENABLE_TOOL_FOCUS=true
```

---

## Configuration Examples

### Example 1: Budget-Conscious Setup

```bash
# Minimal profile for lowest token count
TACHIBOT_PROFILE=minimal

# Only free tier API keys
PERPLEXITY_API_KEY=...
GOOGLE_API_KEY=...

# Disable expensive tools
DISABLE_TOOL_GROK_SEARCH=true
DISABLE_TOOL_PERPLEXITY_RESEARCH=true

# Optimize for cost
COST_OPTIMIZATION=true
GROK_SEARCH_SOURCES_LIMIT=10
DEFAULT_SEARCH_PROVIDER=perplexity

# Enable caching
TACHI_ENABLE_CACHE=true
TACHI_CACHE_TTL=7200  # 2 hours
```

**Expected monthly cost:** $10-30

### Example 2: Research Power User

```bash
# Research-focused profile
TACHIBOT_PROFILE=research_power

# All research API keys
PERPLEXITY_API_KEY=...
GROK_API_KEY=...
OPENAI_API_KEY=...
GOOGLE_API_KEY=...

# Enable Grok live search
ENABLE_GROK_LIVE_SEARCH=true
GROK_SEARCH_SOURCES_LIMIT=100

# Both search providers
DEFAULT_SEARCH_PROVIDER=both

# Enable all features
TACHI_ENABLE_CACHE=true
TACHI_ENABLE_BATCHING=true
```

**Expected monthly cost:** $200-500

### Example 3: Code Development Focus

```bash
# Code-focused profile
TACHIBOT_PROFILE=code_focus

# Code-related API keys
GROK_API_KEY=...
GOOGLE_API_KEY=...
OPENROUTER_API_KEY=...

# Disable research tools
DISABLE_TOOL_PERPLEXITY_RESEARCH=true
DISABLE_TOOL_SCOUT=true

# Enable code tools
ENABLE_TOOL_QWEN_CODER=true

# Code domain default
DEFAULT_DOMAIN=backend
```

**Expected monthly cost:** $50-200

### Example 4: Maximum Capability

```bash
# Full profile
TACHIBOT_PROFILE=full

# All API keys
PERPLEXITY_API_KEY=...
GROK_API_KEY=...
OPENAI_API_KEY=...
GOOGLE_API_KEY=...
OPENROUTER_API_KEY=...

# Enable expensive models (Grok Heavy - 256k context)
ENABLE_EXPENSIVE_MODELS=true
ENABLE_GROK_HEAVY=true

# All features enabled
ENABLE_GROK_LIVE_SEARCH=true
TACHI_ENABLE_CACHE=true
TACHI_ENABLE_BATCHING=true
MAX_PINGPONG_ROUNDS=48
MAX_REASONING_ROUNDS=10
```

**Expected monthly cost:** $500-2000+

---

## Troubleshooting

### Profile Not Loading

**Problem:** Tools from profile not appearing

**Solutions:**
1. Check `TACHIBOT_PROFILE` spelling
2. Restart TachiBot server
3. Check startup logs for profile name
4. Verify profile file exists in `profiles/`

### Tool Still Appearing After Disable

**Problem:** Disabled tool still shows up

**Solutions:**
1. Check tool name spelling
2. Restart TachiBot server
3. Verify environment variable set correctly
4. Check for conflicting `ENABLE_TOOL_*` variable

### Cost Limits Not Working

**Problem:** Spending exceeds limits

**Solutions:**
1. Check provider dashboards for hard limits
2. Reduce `GROK_SEARCH_SOURCES_LIMIT`
3. Switch to cheaper profile
4. Disable expensive tools

### API Key Not Working

**Problem:** "Invalid API key" errors

**Solutions:**
1. Verify key is correct in `.env`
2. Check no extra spaces around key
3. Restart TachiBot server
4. Regenerate key in provider dashboard
5. Check key hasn't expired

### High Token Usage

**Problem:** Using too many tokens

**Solutions:**
1. Switch to `minimal` profile
2. Disable unused tools
3. Reduce `MAX_REASONING_ROUNDS`
4. Reduce `MAX_PINGPONG_ROUNDS`
5. Use custom profile with only needed tools

---

## See Also

- [Tool Profiles](TOOL_PROFILES.md) - Detailed profile descriptions
- [API Keys](API_KEYS.md) - Getting and managing API keys
- [Tools Reference](TOOLS_REFERENCE.md) - Complete tool schemas
- [Installation](INSTALLATION.md) - Installation guide
- [Quickstart](QUICKSTART.md) - 5-minute setup

---

**Need help?** Open an issue at https://github.com/byPawel/tachibot-mcp/issues
