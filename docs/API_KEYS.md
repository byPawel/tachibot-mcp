# API Keys Guide

Complete guide to obtaining, configuring, and managing API keys for TachiBot MCP.

---

## Table of Contents

- [Overview](#overview)
- [Required vs Optional Keys](#required-vs-optional-keys)
- [Provider Details](#provider-details)
  - [Perplexity](#perplexity)
  - [Grok / xAI](#grok--xai)
  - [OpenAI](#openai)
  - [Google Gemini](#google-gemini)
  - [OpenRouter](#openrouter)
- [Cost Comparison](#cost-comparison)
- [Free Tier Information](#free-tier-information)
- [Usage Monitoring](#usage-monitoring)
- [Rate Limits](#rate-limits)
- [Best Practices](#best-practices)
- [Troubleshooting](#troubleshooting)

---

## Overview

TachiBot MCP works with multiple AI providers to offer diverse capabilities. You only need API keys for the providers you want to use.

### Minimal Setup (Basic Research)
- **Perplexity API Key** - For web search and research

### Recommended Setup (Full Power)
- **Perplexity API Key** - Web search and research
- **Grok API Key** - Live web search, reasoning
- **OpenAI API Key** - GPT-5 brainstorming, comparison

### Complete Setup (All Features)
- All of the above, plus:
- **Google API Key** - Gemini models
- **OpenRouter API Key** - Qwen models

---

## Required vs Optional Keys

| Provider | Required For | Tools Affected |
|----------|--------------|----------------|
| **Perplexity** | Research, web search | `perplexity_ask`, `perplexity_research`, `perplexity_reason`, `scout` (default) |
| **Grok/xAI** | Live search, reasoning | `grok_search`, `grok_reason`, `grok_code`, `grok_debug`, `grok_architect`, `grok_brainstorm`, `scout` (with grok) |
| **OpenAI** | GPT-5 models | `openai_brainstorm`, `openai_reason`, `openai_code_review`, `openai_explain`, `focus` (some modes), `verifier`, `challenger` |
| **Google** | Gemini models | `gemini_brainstorm`, `gemini_analyze_code`, `gemini_analyze_text`, `verifier`, `scout` |
| **OpenRouter** | Qwen models | `qwen_coder`, `qwen_competitive` |

**Note:** The `focus` tool and advanced modes (`verifier`, `scout`, `challenger`) automatically use available providers. More API keys = more capabilities.

---

## Provider Details

### Perplexity

Perplexity provides real-time web search and research capabilities with citations.

#### Get Your API Key

1. **Sign Up:** https://www.perplexity.ai/
2. **Navigate to Settings:** https://www.perplexity.ai/settings/api
3. **Generate API Key:** Click "Generate New API Key"
4. **Copy the key** - You won't be able to see it again!

#### Models Available

- **sonar-pro** - Latest web search (used by `perplexity_ask`)
- **sonar-reasoning-pro** - Advanced reasoning (used by `perplexity_reason`)
- **sonar-research** - Deep research (used by `perplexity_research`)

#### Pricing

| Model | Input | Output | Best For |
|-------|-------|--------|----------|
| Sonar Pro | $3.00 / 1M tokens | $15.00 / 1M tokens | Quick search |
| Sonar Reasoning Pro | $5.00 / 1M tokens | $25.00 / 1M tokens | Complex reasoning |

**Free Tier:** $5 credit on signup (typically ~100-200 queries)

#### Rate Limits

- **Standard:** 20 requests/minute
- **Pro:** 100 requests/minute

#### Cost Estimation

- Single `perplexity_ask`: ~$0.01 - $0.02
- Single `perplexity_research` (deep): ~$0.10 - $0.30
- 100 searches/day ≈ $1-2/day

#### Add to .env

```bash
PERPLEXITY_API_KEY=pplx-abc123...
```

---

### Grok / xAI

Grok (by xAI) provides live web search, reasoning, and code analysis.

#### Get Your API Key

1. **Sign Up:** https://console.x.ai/
2. **Navigate to API Keys:** In the console dashboard
3. **Create New Key:** Click "Create API Key"
4. **Copy and save** the key immediately

#### Models Available

- **grok-4-1-fast-reasoning** - Latest (Nov 2025): Enhanced reasoning, creativity & emotional intelligence (2M context)
- **grok-4-1-fast-non-reasoning** - Tool-calling optimized: Fast inference, agentic workflows (2M context)
- **grok-4-fast-reasoning** - Previous reasoning model
- **grok-4-0709** - Heavy model (expensive, use sparingly)
- **grok-code-fast-1** - Coding specialist

#### Pricing

| Model | Input | Output | Notes |
|-------|-------|--------|-------|
| Grok-4.1 | $0.20 / 1M tokens | $0.50 / 1M tokens | Latest & best! |
| Grok-4.1-fast | $0.20 / 1M tokens | $0.50 / 1M tokens | Tool-calling optimized |
| Grok-4 | $5.00 / 1M tokens | $15.00 / 1M tokens | Previous version |
| Grok-4-heavy | $10.00 / 1M tokens | $30.00 / 1M tokens | 256k context |
| **Live Search** | **$5 / 1k sources** | - | Extra cost per search! |

**Important:** Grok live search (`grok_search` tool) costs $5 per 1000 sources searched. Control with `maxSearchSources` parameter or `GROK_SEARCH_SOURCES_LIMIT` env var.

#### Free Tier

- **$25 credit** on signup
- Usually good for 1000-2000 queries or 20-50 live searches

#### Rate Limits

- **Standard:** 60 requests/minute
- **Enterprise:** 600 requests/minute

#### Cost Estimation

- Single `grok_reason`: ~$0.02 - $0.05
- Single `grok_search` (20 sources): ~$0.15 - $0.25
- Single `grok_search` (100 sources): ~$0.50 - $0.70

**Tip:** Use `scout` with `searchProvider: "perplexity"` for cheaper searches, reserve Grok for when you need live data.

#### Add to .env

```bash
GROK_API_KEY=xai-abc123...
# OR (alternative)
XAI_API_KEY=xai-abc123...
```

---

### OpenAI

OpenAI provides GPT-5 models for brainstorming, comparison, and reasoning.

#### Get Your API Key

1. **Sign Up:** https://platform.openai.com/signup
2. **Navigate to API Keys:** https://platform.openai.com/api-keys
3. **Create New Secret Key**
4. **Copy immediately** - not shown again!

#### Models Available

- **gpt-5.1** - Flagship model with deep reasoning (2M context)
- **gpt-5.1-codex-mini** - Fast, cheap workhorse for code tasks (256K context)
- **gpt-5.1-codex** - Power model for complex code (1M context)
- **gpt-5-pro** - Premium for complex orchestration (4M context)

#### Pricing

> **Note:** Prices are approximate and may be outdated. Check [OpenAI Pricing](https://openai.com/pricing) for current rates.

| Model | Input | Output | Notes |
|-------|-------|--------|-------|
| gpt-5.1 | ~$10 / 1M tokens | ~$30 / 1M tokens | Flagship reasoning |
| gpt-5.1-codex-mini | ~$2 / 1M tokens | ~$6 / 1M tokens | Best value for code |
| gpt-5.1-codex | ~$15 / 1M tokens | ~$45 / 1M tokens | Complex code tasks |
| gpt-5-pro | ~$20 / 1M tokens | ~$60 / 1M tokens | Premium orchestration |

**Warning:** GPT-5 models may generate invisible reasoning tokens that increase costs. Monitor usage carefully.

#### Free Tier

- **$5 credit** for new accounts
- Must add payment method after trial

#### Rate Limits

| Tier | Requests/Min | Tokens/Min |
|------|--------------|------------|
| Free | 3 | 40,000 |
| Tier 1 | 500 | 30,000 |
| Tier 2 | 5,000 | 450,000 |

#### Cost Estimation

- Single `openai_brainstorm` (gpt-5.1-codex-mini): ~$0.01 - $0.03
- Single `openai_brainstorm` (gpt-5): ~$0.15 - $0.40
- Single `openai_code_review`: ~$0.02 - $0.05

**Tip:** Use `model: "gpt-5.1-codex-mini"` by default, only use `gpt-5` for complex tasks.

#### Add to .env

```bash
OPENAI_API_KEY=sk-abc123...
```

---

### Google Gemini

Google's Gemini models for analysis, brainstorming, and text processing.

#### Get Your API Key

1. **Go to AI Studio:** https://aistudio.google.com/apikey
2. **Click "Get API Key"**
3. **Create API key** for existing project or create new project
4. **Copy the key**

#### Models Available

- **gemini-3-pro-preview** - Fast, cost-effective
- **gemini-3-pro-preview** - Advanced reasoning

#### Pricing

| Model | Input | Output |
|-------|-------|--------|
| Gemini 3 Pro Preview | $0.075 / 1M tokens | $0.30 / 1M tokens |
| Gemini 3 Pro Preview | $1.25 / 1M tokens | $5.00 / 1M tokens |

**Free Tier:**
- **15 requests/minute** (free tier)
- **1,500 requests/day** (free tier)
- Very generous for experimentation!

#### Rate Limits

| Tier | Requests/Min | Requests/Day |
|------|--------------|--------------|
| Free | 15 | 1,500 |
| Paid | 1,000 | 50,000 |

#### Cost Estimation

- Single `gemini_brainstorm`: ~$0.001 - $0.005 (flash) or ~$0.02 - $0.05 (pro)
- Single `gemini_analyze_code`: ~$0.005 - $0.02
- Gemini is very cost-effective!

#### Add to .env

```bash
GOOGLE_API_KEY=AIzaSy...
```

---

### OpenRouter

OpenRouter provides access to Qwen models and other open-source models.

#### Get Your API Key

1. **Sign Up:** https://openrouter.ai/
2. **Navigate to Keys:** https://openrouter.ai/keys
3. **Create New Key**
4. **Add credits** to your account ($10 minimum recommended)

#### Models Available (via TachiBot)

- **qwen/qwen3-coder** - 480B MoE coder (BEST for code)
- **qwen/qwq-32b** - Reasoning model
- **qwen/qwen3-30b** - General purpose

#### Pricing

| Model | Input | Output |
|-------|-------|--------|
| Qwen3-coder-480B | $1.50 / 1M tokens | $6.00 / 1M tokens |
| QwQ-32B | $0.20 / 1M tokens | $0.80 / 1M tokens |
| Qwen3-30B | $0.60 / 1M tokens | $2.40 / 1M tokens |

**Free Tier:** Some models have free tier, but Qwen models are paid only.

#### Rate Limits

Varies by model, generally:
- **Free models:** 20 requests/minute
- **Paid models:** 100+ requests/minute

#### Cost Estimation

- Single `qwen_coder` (generate): ~$0.05 - $0.15
- Single `qwen_coder` (review): ~$0.02 - $0.08
- Very cost-effective for code tasks!

#### Add to .env

```bash
OPENROUTER_API_KEY=sk-or-v1-abc123...
```

#### OpenRouter Gateway Mode (Optional)

OpenRouter can act as a **unified gateway** for all providers (OpenAI, Gemini, Grok) with a single API key:

```bash
# Enable gateway mode - routes all providers through OpenRouter
USE_OPENROUTER_GATEWAY=true
OPENROUTER_API_KEY=sk-or-v1-abc123...
```

**How it works:**
| Provider | Default Mode | Gateway Mode |
|----------|--------------|--------------|
| Kimi/Qwen | OpenRouter | OpenRouter (no change) |
| OpenAI | Direct API | → OpenRouter |
| Gemini | Direct API | → OpenRouter |
| Grok | Direct API | → OpenRouter |
| Perplexity | Direct API | Direct API (always) |

**Benefits:**
- ✅ Single API key for most providers
- ✅ Unified billing dashboard
- ✅ Automatic fallback/load balancing

**Limitations:**
- ⚠️ Perplexity still requires direct API (not on OpenRouter)
- ⚠️ Some provider-specific features may not work (e.g., `reasoning_effort`)
- ⚠️ Slight latency overhead (proxy)

**Note:** Gateway mode is validated by Andrej Karpathy's [llm-council](https://github.com/karpathy/llm-council) project.

---

## Cost Comparison

**Approximate cost per 1000 queries** (typical usage):

| Provider | Light Use | Medium Use | Heavy Use |
|----------|-----------|------------|-----------|
| **Perplexity** | $10-20 | $50-100 | $200-500 |
| **Grok** | $20-50 | $100-200 | $500-1000 |
| **OpenAI (mini)** | $10-30 | $50-150 | $200-600 |
| **OpenAI (GPT-5)** | $100-300 | $500-1500 | $2000+ |
| **Gemini (flash)** | $1-5 | $10-30 | $50-150 |
| **Gemini (pro)** | $20-50 | $100-250 | $500-1000 |
| **OpenRouter (Qwen)** | $5-20 | $30-100 | $150-500 |

**Most Cost-Effective Setup:**
- Perplexity (search) + Gemini Flash (analysis) + OpenAI mini (brainstorming)
- Estimated: **$30-100/month** for regular use

**Power User Setup:**
- All providers enabled
- Estimated: **$200-500/month** for heavy use

---

## Free Tier Information

### Best Free Tiers

1. **Google Gemini** - 1,500 requests/day, very generous
2. **Perplexity** - $5 credit (~100-200 queries)
3. **Grok** - $25 credit (~1000-2000 queries)
4. **OpenAI** - $5 credit (~200-500 queries with mini)

### Free Tier Strategy

Start with this order:
1. **Week 1:** Use Gemini free tier (1500 req/day)
2. **Week 2:** Use Perplexity $5 credit
3. **Week 3:** Use Grok $25 credit
4. **Week 4:** Use OpenAI $5 credit
5. **Month 2:** Add payment method to favorite provider

This gives you ~1 month of free usage!

---

## Usage Monitoring

### Provider Dashboards

Monitor usage at:
- **Perplexity:** https://www.perplexity.ai/settings/billing
- **Grok:** https://console.x.ai/billing
- **OpenAI:** https://platform.openai.com/usage
- **Google:** https://console.cloud.google.com/billing
- **OpenRouter:** https://openrouter.ai/activity

### Alerts

Set up alerts in provider dashboards:
- OpenAI: Usage limits at https://platform.openai.com/settings/organization/limits
- Google Cloud: Budget alerts in console
- OpenRouter: Email alerts in settings

---

## Rate Limits

### Handling Rate Limits

TachiBot automatically handles rate limits with:
- Exponential backoff
- Request queuing
- Fallback to alternative providers

### If You Hit Limits

1. **Wait** - Limits reset every minute
2. **Use alternative tool** - e.g., `perplexity_ask` instead of `grok_search`
3. **Upgrade tier** - Most providers offer higher tiers
4. **Enable fallbacks** - Use multiple providers for redundancy

### Rate Limit Reference

| Provider | Free Tier | Paid Tier 1 | Paid Tier 2 |
|----------|-----------|-------------|-------------|
| Perplexity | 20/min | 100/min | Custom |
| Grok | 60/min | 60/min | 600/min |
| OpenAI | 3/min | 500/min | 5000/min |
| Gemini | 15/min | 1000/min | Custom |
| OpenRouter | 20/min | 100/min | Custom |

---

## Best Practices

### 1. Start Small

Begin with one provider:
- **Research focus:** Start with Perplexity
- **Code focus:** Start with Gemini (free tier)
- **General use:** Start with OpenAI mini

### 2. Use Profiles to Control Costs

Select a minimal profile to reduce tool count and API calls:

```bash
TACHIBOT_PROFILE=minimal  # Only 8 tools, lowest cost
```

See [TOOL_PROFILES.md](TOOL_PROFILES.md) for details.

### 3. Choose Right Tools for Task

- **Quick fact check:** `perplexity_ask` (cheap)
- **Deep research:** `perplexity_research` (expensive, use sparingly)
- **Live data:** `grok_search` with low `maxSearchSources` (10-20)
- **Code tasks:** `gemini_analyze_code` or `qwen_coder` (cost-effective)
- **Brainstorming:** `gemini_brainstorm` or `openai_brainstorm` with `model: "gpt-5.1-codex-mini"`

### 4. Monitor Regularly

Check usage weekly:
- Review provider dashboards
- Check TachiBot logs
- Adjust usage patterns if costs are high

### 5. Optimize Search Parameters

Control Grok search costs:

```typescript
grok_search({
  query: "...",
  max_search_results: 20,  // Lower = cheaper
  sources: [{
    type: "web",
    allowed_websites: ["python.org"]  // Restrict domains
  }]
})
```

### 6. Use Caching

Enable caching to avoid duplicate API calls:

```bash
TACHI_ENABLE_CACHE=true
TACHI_CACHE_TTL=3600  # 1 hour
```

---

## Troubleshooting

### "Invalid API Key" Error

**Symptoms:** Tool fails with "401 Unauthorized" or "Invalid API key"

**Solutions:**
1. Verify key is correct in `.env`
2. Check key hasn't expired (regenerate if needed)
3. Ensure no extra spaces or quotes around key
4. Restart the server after changing `.env`

### "Rate Limit Exceeded"

**Symptoms:** "429 Too Many Requests" error

**Solutions:**
1. Wait 1 minute and retry
2. Reduce request frequency
3. Upgrade to paid tier for higher limits
4. Use alternative tool/provider

### "Insufficient Credits"

**Symptoms:** "402 Payment Required" or "Insufficient funds"

**Solutions:**
1. Check provider billing dashboard
2. Add credits/payment method
3. Use alternative provider temporarily

### High Unexpected Costs

**Symptoms:** Bill higher than expected

**Solutions:**
1. Check provider usage dashboard
2. Review which tools are being used
3. Switch to `minimal` or `balanced` profile
4. Avoid `grok_search` with high `maxSearchSources`
5. Use `gpt-5.1-codex-mini` instead of `gpt-5`

### API Key Not Working After Setup

**Symptoms:** Key added to `.env` but still getting errors

**Solutions:**
1. Restart the TachiBot server (IMPORTANT)
2. Check `.env` is in the correct directory
3. Verify no typos in key name (e.g., `PERPLEXITY_API_KEY` not `PERPLEXITY_KEY`)
4. Check file is named `.env` exactly (not `.env.example`)

---

## Security Best Practices

### Protect Your Keys

1. **Never commit `.env` to git**
   - Add `.env` to `.gitignore`
   - Use `.env.example` for templates

2. **Rotate keys periodically**
   - Regenerate every 3-6 months
   - Immediately if leaked

3. **Use separate keys per project**
   - Don't reuse keys across projects
   - Easier to track usage

4. **Set spending limits in provider dashboards**
   - OpenAI: Hard limits in settings
   - OpenRouter: Budget alerts
   - Google Cloud: Budget alerts

### If a Key is Compromised

1. **Immediately revoke** the key in provider dashboard
2. **Generate new key**
3. **Update `.env`**
4. **Restart server**
5. **Review usage** for unauthorized activity
6. **Report to provider** if fraudulent charges

---

## Next Steps

- ✅ Got your API keys? → See [INSTALLATION.md](INSTALLATION.md)
- ✅ Configured `.env`? → See [QUICKSTART.md](QUICKSTART.md)
- ✅ Want to optimize costs? → See [TOOL_PROFILES.md](TOOL_PROFILES.md)
- ✅ Need help with tools? → See [TOOLS_REFERENCE.md](TOOLS_REFERENCE.md)

---

## Support

- **Issues:** https://github.com/byPawel/tachibot-mcp/issues
- **Discussions:** https://github.com/byPawel/tachibot-mcp/discussions

---

**Remember:** You only pay for what you use. Start with free tiers, monitor usage, and scale up as needed!
