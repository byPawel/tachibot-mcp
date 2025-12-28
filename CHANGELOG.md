# Changelog

All notable changes to TachiBot MCP will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.3.0] - 2025-12-28

### Added
- **Context Window String Aliases** - Use `"none"`, `"recent"`, `"all"` instead of magic numbers (0, 3, -1)
- **finalJudge** - Auto-call a judge model when session completes with `nextThoughtNeeded: false`
- **Context Distillation** - Compress 8000+ tokens to ~500 with `distillContext: "light" | "aggressive"`
- **Memory Provider Hints** - Pluggable memory system (devlog, mem0) returns hints for Claude to execute
- **usage_stats Tool** - Track tool usage with ASCII bar charts, per-repo statistics
- **general-judge Workflow** - Multi-model council (Grok, Perplexity, Qwen, Kimi) with Gemini extraction + GPT synthesis
- `src/utils/memory-provider.ts` - Hint-only formatter for memory MCPs
- `src/utils/model-availability.ts` - Centralized model availability checks

### Enhanced
- **nextThought** now supports:
  - `contextWindow: "none" | "recent" | "all"` (clearer than 0/3/-1)
  - `finalJudge: "gemini"` - Auto-executes judge with ALL context
  - `distillContext: "light"` - 5x token savings
  - `memoryProvider: { provider: "devlog" }` - Session persistence hints

### Example Usage
```typescript
// With string aliases and finalJudge
nextThought({
  thought: "Analyze the problem",
  model: "kimi",
  executeModel: true,
  contextWindow: "recent",  // Last 3 thoughts
  nextThoughtNeeded: true
})

nextThought({
  thought: "Final verdict",
  model: "grok",
  executeModel: true,
  contextWindow: "all",     // Full history
  finalJudge: "gemini",     // Auto-called!
  nextThoughtNeeded: false
})
```

## [2.2.7] - 2025-12-28

### Added
- **Enhanced nextThought with multi-model execution**
- **Multi-Model Judgment Protocols** in CLAUDE.md:
  - Protocol 1: Parallel Council (subagents for context isolation)
  - Protocol 2: Sequential Pipeline (progressive refinement)
  - Protocol 3: Adversarial Debate (pro vs con)
  - Protocol 4: Architecture Decision (focus modes)
- Model name normalization (spaces/underscores → hyphens)
- Model aliases in registry: `grok-search`, `grok-reason`, `gemini-judge`, etc.

## [2.0.3] - 2025-11-18

### Changed
- Updated OpenAI models from GPT-5 to GPT-5.1 series
- Updated default model to `gpt-5.1-codex-mini` for better code generation
- Added GPT-5.1 reasoning effort levels (none, low, medium, high)
- Changed default active profile from `research_power` to `full`
- Improved model configuration in workflows and tool mapper
- Updated model constants and defaults throughout codebase

### Fixed
- Model references in iterative-problem-solver workflow
- Model references in scout workflow
- Model references in ultra-creative-brainstorm workflow

## [2.0.2] - 2025-11-15

### Fixed
- OpenAI GPT-5.1 API integration
- License correction from MIT to AGPL-3.0 in package.json

## [2.0.1] - 2025-11-10

### Changed
- Updated README with comprehensive API key documentation
- Added missing GEMINI_API_KEY and OPENROUTER_API_KEY to installation examples
- Improved documentation clarity

## [2.0.0] - 2025-10-15

### Added
- Complete rewrite with 12 essential tools (reduced from 80+)
- Multi-model orchestration with GPT-5, Gemini, Grok, and more
- Tool profiles system (minimal, research_power, code_focus, balanced, full)
- Perplexity integration for web search and reasoning
- Grok-4 integration with live search capabilities
- Workflow system for multi-step tool sequences
- Challenger tool for critical thinking and verification
- Scout tool for hybrid intelligence gathering
- Verifier tool for multi-model consensus
- PingPong collaborative brainstorming
- Cost optimization and tracking features
- Session management with logging and export
- Comprehensive .env.example with all configuration options
- GitHub Actions workflows for CI/CD
- Community health files (CONTRIBUTING, CODE_OF_CONDUCT, SECURITY)

### Changed
- Simplified from 80+ tools to 12 essential ones
- Improved token efficiency (2.6k tokens vs 30k+)
- Better environment variable handling
- Deferred API key loading for better performance
- Modular architecture for easier maintenance
- Cleaned up workflows to use only existing tools

### Fixed
- Environment variable loading in MCP context
- API key configuration issues
- Build errors with missing personality module

### Security
- No hardcoded API keys in source code
- All sensitive data in environment variables
- Security policy and responsible disclosure process

## [1.0.0] - 2024-12-01

### Initial Release
- Original version with 80+ tools
- Basic multi-model support
- Initial MCP server implementation

---

Note: This is a side project maintained in spare time. Updates may be irregular.