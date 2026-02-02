# Changelog

All notable changes to TachiBot MCP will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.14.5] - 2026-02-02

### Added
- **Tool annotations** — all 35+ tools now have MCP-standard annotations (`title`, `readOnlyHint`, `openWorldHint`, `streamingHint`). Improves `/mcp` display and tool discovery via ToolSearch
- **`src/utils/tool-annotations.ts`** — centralized annotation registry
- **`src/utils/stream-distill.ts`** — `truncateSmart()` for paragraph-boundary-aware truncation; distillation logic ready for future use when Claude Code supports display/context separation
- **25K character safety net** — responses capped with smart truncation to prevent Claude Code's 30K background task truncation

### Changed
- **ANSI rendering removed from tool results** — replaced `renderOutput()` with `stripMarkdown()` in `safeAddTool()`. Claude Code CLI does not render markdown in tool result blocks, so decorative formatting (`**bold**`, `*italic*`, `` `code` ``) is now stripped while structural elements (`#` headers, `-` bullets, numbered lists, `>` blockquotes, `|` tables, code block content) are preserved
- **`stripMarkdown()` rewritten** — code blocks protected via placeholder extraction (prevents corrupting code samples); `*` bullets normalized to `-` before italic stripping; `_italic_` skip added to avoid mangling `snake_case` identifiers
- **`kimi_decompose` prompt improved** — dependency graph now uses box-drawing characters (`├─ └─ ──►`) for visual clarity; task cards use indented tree format with acceptance criteria
- **Heavy Coding profile** — enabled `openai_code_review` and `openai_explain` (40 → 42 tools)
- **Wildcard permission** — replaced 30 individual `mcp__tachibot-mcp__*` entries in `~/.claude/settings.json` with single `mcp__tachibot-mcp__*` wildcard

### Fixed
- **Token overhead reduced to ~x1** — removed ANSI escape code overhead (~x1.5-2x) and Ink rendering overhead (~x12x). Tool results now return clean plain text at baseline token cost
- **`truncateSmart()` marker overflow** — marker length now subtracted from cap before truncating, ensuring output never exceeds the specified limit

## [2.13.0] - 2026-01-30

### Removed
- **@types/yaml** — stub package; `yaml` ships its own TypeScript definitions
- **ink-box** — deprecated; use Ink's built-in `<Box>` component
- **js-yaml** + **@types/js-yaml** — redundant YAML parser; consolidated on `yaml` v2
- **cli-highlight** — unmaintained (5 years); replaced with `highlight.js` wrapper
- **ts-node** — stalling ESM support; replaced with `tsx`

### Added
- **highlight.js** — direct dependency replacing cli-highlight for syntax highlighting
- **tsx** — modern TypeScript execution for ESM projects (devDependency)
- `src/utils/syntax-highlight.ts` — lightweight highlight.js-to-ANSI wrapper with default theme and function-based theme support

### Changed
- **Node engine requirement** bumped from `>=20.19.0` to `>=22.0.0` (Node 22 active LTS)
- `src/validators/syntax-validator.ts` — migrated from `js-yaml.load()` to `yaml.parse()`
- `src/utils/ansi-renderer.ts` — switched to local syntax-highlight utility
- `src/utils/ink-markdown-renderer.tsx` — switched to local syntax-highlight utility

## [2.12.1] - 2026-01-29

### Changed
- **Heavy Coding** is now the default profile (40 tools) — ships as `activeProfile` in `tools.config.json`
- Updated profile description and README to reflect default status
- Updated `tools.config.json` available tools list with new Kimi tools and `list_plans`

## [2.12.0] - 2026-01-29

### Added
- **Kimi K2.5 Suite** — 3 new tools expanding Kimi from 1 to 4 tools:
  - `kimi_code` — SWE-focused code generation/fixing (SWE-Bench 76.8%), temp=0.3, 240s timeout
  - `kimi_decompose` — Structured task decomposition with Agent Swarm reasoning, dependency graphs, parallel subtask identification, acceptance criteria. Output formats: tree, flat, dependencies
  - `kimi_long_context` — Long-context document analysis (best-effort 256K context window), 5 task types (summarize/extract/analyze/compare/find), 300s timeout
- **Planner: kimi_decompose integration** — `planner_maker` now includes a Decomposition phase using `kimi_decompose` to break tasks into subtasks with dependency ordering before synthesis
- **Planner: 80% checkpoint** — `planner_runner` now supports 50%, 80%, and 100% verification checkpoints. The 80% checkpoint uses `kimi_decompose` to decompose remaining work into granular subtasks, ensuring nothing is missed before the final push

### Fixed
- **z.number() coercion bug** — MCP clients send numbers as strings (e.g., `maxSteps: "3"`), causing Zod validation failures. Replaced `z.number()` with `z.coerce.number()` at 3 parameter locations (temperature, maxSteps, steps). Added `.int().min().max()` constraints for maxSteps and steps

### Changed
- All 6 profiles updated with new Kimi tools (enabled in all except minimal)
- Profile tool counts: Minimal 12, Research Power 28, Code Focus 28, Balanced 36, Heavy Coding 40, Full 48
- `planner_maker` synthesis steps now include task decomposition output for better-structured plans
- `planner_runner` description updated to document 80% checkpoint and kimi_decompose integration
- Server registration updated: "Qwen, Kimi x4, MiniMax"

## [2.3.1] - 2025-12-28

### Fixed
- **gemini_analyze_text** and **gemini_analyze_code** now work via nextThought
  - Added missing cases in ToolExecutionService switch statement
  - Added parameter mapping (`text:` and `code:` params)
- **TACHIBOT_FINAL_JUDGE** env var now properly resolves as default judge

### Changed
- **balanced profile** now includes `gemini_analyze_text: true`
- Removed noisy memory save hint from nextThought output

### Added
- **TACHIBOT_FINAL_JUDGE** env var - Set default final judge model (e.g., `gemini`)

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