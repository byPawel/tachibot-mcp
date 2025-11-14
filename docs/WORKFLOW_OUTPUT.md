# Workflow Output Configuration

Control how workflow step outputs are displayed.

## Quick Reference

### YAML Configuration
```yaml
output:
  format: detailed
  truncateSteps: false  # Show full output (no truncation)
  maxStepTokens: 2500   # Only applies if truncateSteps=true
```

### Runtime Override
```bash
# Use workflow defaults
workflow --name code-review --query "..."

# Show full output (override workflow settings)
workflow --name code-review --query "..." --truncateSteps false

# Custom token limit
workflow --name code-review --query "..." --maxStepTokens 5000
```

---

## Configuration Options

### `truncateSteps` (boolean)
**Default:** `true`

Controls whether step outputs are truncated.

- `true` - Truncate at `maxStepTokens` limit (better readability)
- `false` - Show complete output (no truncation, full context)

**When to use false:**
- Comprehensive analysis workflows (code review, UX research)
- Debugging workflow outputs
- When you need full context from each step

**When to use true:**
- Quick iterative development
- When outputs are very large (>10k tokens)
- To reduce visual clutter in terminal

### `maxStepTokens` (number)
**Default:** `2500` tokens (~10,000 characters)

Maximum tokens per step output when `truncateSteps=true`.

**Token Reference:**
- 500 tokens ≈ 2,000 chars ≈ 1 paragraph
- 2,500 tokens ≈ 10,000 chars ≈ 2-3 pages (default)
- 5,000 tokens ≈ 20,000 chars ≈ 5-6 pages
- 10,000 tokens ≈ 40,000 chars ≈ 10-12 pages

**Recommended settings by workflow type:**

| Workflow Type | truncateSteps | maxStepTokens | Reason |
|--------------|---------------|---------------|---------|
| Quick brainstorm | `true` | `1000` | Fast iteration |
| Code review | `false` | - | Need full analysis |
| Research | `false` | - | Comprehensive findings |
| UX analysis | `false` | - | Full user journey |
| Debug workflow | `true` | `5000` | Balance detail/readability |
| Multi-step pipeline | `true` | `2500` | Standard default |

---

## Examples

### Example 1: Code Review (Show Everything)
```yaml
name: comprehensive-code-review
output:
  format: detailed
  truncateSteps: false  # Need full review details
```

**Result:** All step outputs shown in full - analysis, architecture review, security findings, etc.

### Example 2: Research Pipeline (Custom Limit)
```yaml
name: research-pipeline
output:
  format: detailed
  truncateSteps: true
  maxStepTokens: 5000  # Larger limit for research
```

**Result:** Each step truncated at ~5000 tokens (~20k characters), good balance for research workflows.

### Example 3: Quick Brainstorm (Default)
```yaml
name: quick-brainstorm
output:
  format: detailed
  # Uses defaults: truncateSteps=true, maxStepTokens=2500
```

**Result:** Concise output, easier to scan quickly.

### Example 4: Runtime Override
```bash
# Workflow has truncateSteps=true, but override to see full output
workflow --name quick-brainstorm --query "..." --truncateSteps false

# Use different token limit
workflow --name research --query "..." --maxStepTokens 10000
```

---

## Understanding Truncation Messages

When output is truncated, you'll see:
```
...(output truncated: ~3420 tokens, limit: 2500 tokens. Set truncateSteps=false for full output)...
```

This tells you:
- **Actual size:** ~3420 tokens
- **Limit applied:** 2500 tokens
- **How to see full output:** Set `truncateSteps=false`

---

## Migration from Old API

### ❌ Old (deprecated)
```yaml
output:
  maxStepOutputLength: -1  # Magic number, unclear
  maxStepOutputLength: 10000  # Characters, hard to estimate
```

### ✅ New (recommended)
```yaml
output:
  truncateSteps: false  # Clear intent
  maxStepTokens: 2500   # Meaningful for AI context
```

---

## Best Practices

1. **Start with defaults** (`truncateSteps=true`, `maxStepTokens=2500`)
2. **Set `truncateSteps=false` for:**
   - Complex analysis workflows
   - When step outputs feed into each other
   - Production-critical workflows
3. **Increase `maxStepTokens` for:**
   - Research-heavy workflows
   - Multi-perspective analysis
   - Detailed technical reports
4. **Use runtime overrides** when testing:
   - `--truncateSteps false` to debug
   - `--maxStepTokens 10000` for one-off deep dives

---

## Token vs Character Conversion

Internally, the system converts tokens to approximate characters using:
- **1 token ≈ 4 characters** (for English text)

| Tokens | Characters | Typical Content |
|--------|-----------|-----------------|
| 500 | ~2,000 | Short summary |
| 1,000 | ~4,000 | 1 page report |
| 2,500 | ~10,000 | 2-3 pages (default) |
| 5,000 | ~20,000 | 5-6 pages |
| 10,000 | ~40,000 | 10-12 pages |

For code, JSON, or special characters, the ratio may vary (typically 2-3 chars/token).

---

## FAQ

### Why tokens instead of characters?
Tokens are more meaningful for AI systems and give better estimates of context window usage.

### Can I set different limits per step?
Not yet, but it's on the roadmap. Current settings apply to all steps in a workflow.

### Does this affect model output?
No! This only controls **display** truncation. Model responses are controlled by `maxTokens` in the step configuration.

### What if I want unlimited output?
Set `truncateSteps: false`

### Can runtime parameters override workflow settings?
Yes! Runtime parameters take precedence over workflow YAML settings.
