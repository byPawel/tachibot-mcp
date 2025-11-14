# Changelog

All notable changes to TachiBot MCP will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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