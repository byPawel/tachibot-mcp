# Tachibot-MCP Modes Documentation

## Overview

Tachibot-MCP provides intelligent orchestration of multiple AI models through specialized workflows. Each mode is designed for specific types of reasoning tasks and can be invoked using primary names or aliases.

## Available Modes

### 🎨 Brainstorm/Creative/Ideate Mode
**Purpose**: Generate innovative ideas and explore creative possibilities

**Tool Flow**:
```
1. gemini_brainstorm     - Initial creative exploration
2. openai_brainstorm     - Alternative perspectives
3. perplexity_research   - Real-world validation (optional)
4. think                 - Reflection and pattern recognition
5. openai_reason         - Feasibility analysis
```

**Use Cases**:
- Product ideation
- Creative problem-solving
- Feature brainstorming
- Marketing campaigns
- Innovation workshops

**Example**:
```bash
focus --mode brainstorm "Design a new mobile app for elderly users"
focus --mode creative "Alternative uses for blockchain technology"
focus --mode ideate "Sustainable packaging solutions"
```

### 🔬 Research/Investigate Mode
**Purpose**: Deep investigation with comprehensive evidence gathering

**Tool Flow**:
```
1. perplexity_research   - Comprehensive data gathering
2. think                 - Pattern recognition
3. openai_reason         - Systematic analysis
4. gemini_brainstorm     - Creative applications (optional)
```

**Use Cases**:
- Market research
- Technical investigations
- Academic research
- Competitive analysis
- Trend analysis

**Example**:
```bash
focus --mode research "Latest developments in quantum computing"
focus --mode investigate "Impact of remote work on productivity"
```

### 🧩 Solve/Analyze Mode
**Purpose**: Systematic problem-solving and analytical reasoning

**Tool Flow**:
```
1. think                 - Problem decomposition
2. openai_reason         - First principles analysis
3. perplexity_research   - Evidence gathering
4. gemini_brainstorm     - Innovative solutions
```

**Use Cases**:
- Technical debugging
- Business problem-solving
- Process optimization
- Root cause analysis
- Strategic planning

**Example**:
```bash
focus --mode solve "Optimize database query performance"
focus --mode analyze "Why is customer retention dropping?"
```

### 🎯 Synthesis/Integrate Mode
**Purpose**: Combine multiple perspectives into coherent insights

**Tool Flow**:
```
1. gemini_brainstorm     - Exploratory angles
2. perplexity_research   - Comprehensive data
3. openai_reason         - Analytical framework
4. think                 - Integration reflection
```

**Use Cases**:
- Strategic decision-making
- Multi-stakeholder alignment
- Complex report synthesis
- Cross-functional planning
- Holistic analysis

**Example**:
```bash
focus --mode synthesis "Combine user feedback with technical constraints"
focus --mode integrate "Merge marketing and engineering roadmaps"
```

### ✅ Fact-Check/Verify/Validate Mode
**Purpose**: Validate claims and ideas with evidence-based analysis

**Tool Flow**:
```
1. think                 - Decompose claims
2. perplexity_research   - Find evidence
3. openai_reason         - Analyze contradictions
4. gemini_brainstorm     - Alternative explanations
5. think                 - Final verdict synthesis
```

**Use Cases**:
- Content verification
- Assumption validation
- Risk assessment
- Due diligence
- Quality assurance

**Example**:
```bash
focus --mode fact-check "AI will replace all programmers by 2030"
focus --mode verify "This startup's growth claims"
focus --mode validate "Technical feasibility of the proposed solution"
```

### 🪞 Reflect/Review Mode
**Purpose**: Synthesize results from previous orchestration runs

**Tool Flow**:
- No tools executed - provides guidance for manual synthesis
- Reviews outputs from previous tool executions
- Identifies patterns and contradictions
- Creates actionable insights

**Use Cases**:
- Post-brainstorm synthesis
- Research summary
- Decision consolidation
- Learning extraction
- Action planning

**Example**:
```bash
# After running any other mode:
focus --mode reflect
focus --mode review "Synthesize all findings"
```

### 🔍 Debug Mode
**Purpose**: Understand available workflows and troubleshoot

**Tool Flow**:
- No tools executed - provides system information
- Shows available workflows and tools
- Displays token efficiency options

**Use Cases**:
- Learning the system
- Troubleshooting
- Configuration testing

**Example**:
```bash
focus --mode debug "Show me what's available"
```

## Mode Selection Guide

Choose your mode based on your primary goal:

| If you want to... | Use mode |
|-------------------|----------|
| Generate new ideas | `brainstorm` / `creative` / `ideate` |
| Find information and evidence | `research` / `investigate` |
| Solve a specific problem | `solve` / `analyze` |
| Combine multiple viewpoints | `synthesis` / `integrate` |
| Verify claims or assumptions | `fact-check` / `verify` / `validate` |
| Summarize previous results | `reflect` / `review` |
| Learn about the system | `debug` |

## Token Efficiency

All modes support token-efficient operation:

```bash
focus --mode brainstorm --tokenEfficient true "Your query"
```

This reduces output by ~30% while maintaining core functionality.

## Workflow Customization

Each workflow includes:
- **Required steps**: Core tools that always run
- **Optional steps**: Additional tools that may be skipped based on context
- **Adaptation checks**: Dynamic adjustments based on output length

## Best Practices

1. **Start with the right mode**: Choose based on your primary goal
2. **Provide context**: Include relevant background in your query
3. **Use reflect mode**: Always synthesize after complex workflows
4. **Iterate**: Run multiple modes for comprehensive analysis
5. **Token efficiency**: Use for faster responses when full output isn't needed

## Example Multi-Mode Workflow

```bash
# 1. Generate ideas
focus --mode brainstorm "New features for our app"

# 2. Validate feasibility
focus --mode fact-check "Can we implement real-time collaboration?"

# 3. Deep dive on specifics
focus --mode research "WebRTC implementation best practices"

# 4. Synthesize everything
focus --mode reflect
```

## Mode Aliases Reference

| Primary | Aliases | 
|---------|---------|
| brainstorm | creative, ideate |
| research | investigate |
| solve | analyze |
| synthesis | integrate |
| fact-check | verify, validate |
| reflect | review |

Use whichever name feels most natural for your use case!