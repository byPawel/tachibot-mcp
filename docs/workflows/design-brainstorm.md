# Ultra Creative Brainstorm Workflow

**Research-backed optimal AI model sequencing for maximum insight** 🚀

## Overview

This workflow uses **ALL 13 prompt engineering techniques** from `src/prompt-engineer.ts` with **scientifically-optimized model sequencing** based on Perplexity AI's research on optimal brainstorming workflows.

Implements the research-backed sequence: **Research → Reason → Ideate → Connect → Evaluate → Synthesize → Analyze → Implement**

## Features

### 🧠 9 Processing Phases (Optimal Ordering)

**Phase 0: Problem Decomposition** (Think)
   - Break down complex problems first
   - Identify core components and constraints

**Phase 1: Research Foundation** (Perplexity first!)
   - Comprehensive investigation
   - Evidence gathering with real-world data
   - *Why first?* Context is essential for creative thinking

**Phase 2: Deep Reasoning** (Grok)
   - Search for breakthrough approaches
   - First principles analysis
   - *Why second?* Understanding before ideation

**Phase 3: Divergent Ideation** (Gemini)
   - What-if speculation
   - Innovative solutions brainstorming
   - *Why third?* Generate wide range of ideas with solid foundation

**Phase 4: Long-Context Connections** (Kimi K2)
   - Alternative perspectives across contexts
   - Systematic analysis of relationships
   - *Why fourth?* 1M token context explores deep connections

**Phase 5: Convergent Refinement** (Grok + Gemini)
   - Evaluation of most promising ideas
   - Pattern recognition
   - *Why fifth?* Narrow down with analytical rigor

**Phase 6: Synthesis** (GPT-5 + Focus)
   - Creative applications across domains
   - Ultimate synthesis with 4 models
   - *Why sixth?* Combine best ideas into coherent solutions

**Phase 7: Feasibility Analysis** (Gemini)
   - Detailed feasibility assessment
   - Risk identification
   - *Why seventh?* Validate before implementation

**Phase 8: Implementation** (QWEN)
   - Technical implementation roadmap
   - Code/architecture planning
   - *Why last?* Implementation follows validated design

### 🎯 All 13 Prompt Techniques Used

1. ✅ `what_if_speculation` - Explore radical possibilities
2. ✅ `alternative_perspectives` - View from 5 different angles
3. ✅ `creative_applications` - Cross-domain thinking
4. ✅ `innovative_solutions` - Unconventional approaches
5. ✅ `comprehensive_investigation` - WHO/WHAT/WHEN/WHERE/WHY/HOW
6. ✅ `evidence_gathering` - Support and challenge with data
7. ✅ `systematic_analysis` - 6-step structured breakdown
8. ✅ `first_principles` - Rebuild from fundamental truths
9. ✅ `feasibility_analysis` - Technical/Economic/Time/Resource analysis
10. ✅ `quick_reflection` - Pattern recognition checkpoints
11. ✅ `pattern_recognition` - Identify themes and connections
12. ✅ `problem_decomposition` - Break into manageable parts
13. ✅ `integration_reflection` - Synthesize all perspectives

### 🤖 Models Used

- **GPT-5** - Advanced reasoning and synthesis
- **Gemini 2.5 Pro** - Creative brainstorming and analysis
- **Grok-3** - First principles and critical analysis
- **Kimi K2** - Long-context systematic thinking
- **QWEN Coder** - Technical feasibility
- **Perplexity** - Research and evidence
- **Think** - Metacognitive reflection

## Usage

### Basic
```bash
workflow --name ultra-creative-brainstorm --query "AI-powered education platform"
```

### With Custom Variables
```yaml
variables:
  max_ideas: 15
  depth_level: "very-deep"
```

### Example Queries

**Product Innovation:**
```bash
workflow --name ultra-creative-brainstorm --query "Revolutionary approach to personal fitness tracking"
```

**Technical Architecture:**
```bash
workflow --name ultra-creative-brainstorm --query "Scalable real-time collaboration system for 10M users"
```

**Business Strategy:**
```bash
workflow --name ultra-creative-brainstorm --query "Sustainable revenue model for open-source software"
```

**Research Question:**
```bash
workflow --name ultra-creative-brainstorm --query "Future of human-AI collaboration in creative work"
```

## Output Structure

All outputs saved to `workflow-output/ultra-creative-brainstorm/YYYY-MM-DD-HH-MM-UUID/`:

```
phase1-divergent/
  - what-if-speculation.md
  - alternative-perspectives.md
  - innovative-solutions.md

phase2-research/
  - comprehensive-investigation.md
  - evidence-gathering.md

phase3-analysis/
  - first-principles-analysis.md
  - systematic-analysis.md
  - problem-decomposition.md

phase4-patterns/
  - pattern-recognition.md
  - quick-reflection-1.md

phase5-applications/
  - creative-applications.md

phase6-feasibility/
  - feasibility-analysis.md
  - integration-reflection.md

phase7-verification/
  - grok-critique.md
  - gemini-critique.md
  - qwen-critique.md
  - final-reflection.md

phase8-synthesis/
  - ultimate-synthesis.md
  - final-summary.md
```

## Token Usage

**Estimated**: 150,000 - 200,000+ tokens total (with auto-synthesis protection)

**Per Phase (Maximum Output)**:
- Phase 1: ~26k tokens (what-if: 8k, perspectives: 10k, solutions: 8k)
- Phase 2: ~20k tokens (research: 12k, evidence: 8k)
- Phase 3: ~30k tokens (first-principles: 10k, systematic: 12k, decomposition: 8k)
- Phase 4: ~8k tokens (patterns: 8k, reflection: minimal)
- Phase 5: ~15k tokens (creative applications with 3 models)
- Phase 6: ~24k tokens (feasibility: 12k, integration: 12k)
- Phase 7: ~30k tokens (3 parallel critiques @ 10k each)
- Phase 8: ~32k tokens (ultimate synthesis: 20k, final summary: 12k)

**Auto-Synthesis Protection**:
- Checkpoints every 12,000 tokens
- Synthesis trigger at 25,000 tokens
- Prevents MCP token overflow

## Recommended Profiles

- **Best**: `full` profile (30 tools, ~22-23k tokens)
- **Alternative**: `balanced` profile (15 tools, ~8-9k tokens)
- **Minimum**: `research_power` profile (14 tools, ~9-10k tokens)

## Auto-Synthesis Protection

Configured for large outputs:
- Token threshold: 25,000
- Checkpoint interval: 12,000
- Synthesis tool: Gemini Analyze Text
- Max synthesis tokens: 8,000
- Prevents MCP token limit issues

## Advanced Features

### Parallel Execution
Phase 7 runs 3 models simultaneously for critique:
- Grok (analytical)
- Gemini (creative)
- QWEN (technical)

### Context Accumulation
Each phase builds on previous outputs, creating a snowball effect of insights.

### Multi-Round Reasoning
- Focus tool: 3-5 rounds per call
- Ultimate synthesis: 5 rounds with 4 models

## Performance Tips

1. **Use `full` profile** for maximum capability
2. **Run during off-peak hours** - takes 5-15 minutes
3. **Check auto-synthesis logs** - monitors token usage
4. **Review checkpoints** - saves state every 12k tokens

## Validation

Validate before running:
```bash
{
  "tool": "validate_workflow_file",
  "filePath": "./workflows/ultra-creative-brainstorm.yaml",
  "format": "text"
}
```

## Why This Order?

Based on AI research on optimal brainstorming:
- **Research first** - Context enables better creativity
- **Reasoning second** - Understanding before ideation
- **Ideation third** - Generate ideas with solid foundation
- **Connections fourth** - Long-context explores relationships
- **Refinement fifth** - Evaluate and narrow down
- **Synthesis sixth** - Combine best ideas
- **Validation seventh** - Feasibility check
- **Implementation last** - Technical roadmap

## Comparison

### vs Simple Brainstorm
- Simple: 1 model, 3 steps, ~2k tokens
- Ultra: 7 models, 21 steps, ~185k tokens
- **92x more thorough**

### vs Standard Workflow
- Standard: 5-8 steps, linear
- Ultra: 21 steps, optimal sequence, 13 prompt techniques
- **4-5x more comprehensive**

## When to Use

✅ **Perfect for**:
- Critical business decisions
- Complex technical architecture
- Product innovation strategy
- Research hypothesis generation
- Long-term strategic planning

❌ **Overkill for**:
- Simple questions
- Quick fact-checking
- Minor code reviews
- Routine tasks

## Cost Estimate

Based on average API costs:
- **GPT-5**: ~$0.50-1.00
- **Gemini 2.5 Pro**: ~$0.20-0.40
- **Grok-3**: ~$0.30-0.60
- **Kimi K2**: ~$0.15-0.30
- **QWEN**: ~$0.10-0.20
- **Perplexity**: ~$0.05-0.10

**Total**: ~$1.30 - $2.60 per run

Worth it for critical decisions! 💪

## Customization

### Reduce Scope
Comment out phases in YAML:
```yaml
# Skip Phase 2 if no research needed
# - name: comprehensive-investigation
#   tool: perplexity_research
```

### Increase Depth
Adjust model rounds:
```yaml
# Increase ultimate synthesis rounds
rounds: 10  # was 5
```

### Change Models
Swap in different models:
```yaml
models: ["o1", "claude-opus", "gemini-2.0-flash"]
```

## Troubleshooting

**Token limit exceeded**:
- Auto-synthesis should prevent this
- Reduce `maxTokens` per step
- Skip less critical phases

**Too slow**:
- Use `research_code` profile (fewer tools)
- Reduce model rounds
- Run fewer parallel critiques

**Out of API credits**:
- Comment out expensive models (GPT-5, Gemini Pro)
- Use free alternatives (QWEN free tier, Gemini 2.5 Flash)

## Future Enhancements

- [ ] Add workflow-internal tools (hunter, scout, verifier, challenger)
- [ ] Conditional branching based on complexity
- [ ] User feedback loops between phases
- [ ] Export to presentation format
- [ ] Comparison with existing solutions

---

**Created by**: Tachibot MCP Team
**Version**: 2.0
**Last Updated**: 2025-01-12

*The most powerful creative brainstorming tool in existence.* 🎯
