# TachiBot MCP - Universal AI Orchestrator

[![Version](https://img.shields.io/badge/version-2.0.0-blue.svg)](https://github.com/byPawel/tachibot-mcp)
[![License](https://img.shields.io/badge/license-Apache%202.0-green.svg)](LICENSE)
[![Node](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen.svg)](https://nodejs.org)
[![MCP](https://img.shields.io/badge/MCP-Compatible-purple.svg)](https://modelcontextprotocol.io)

Multi-model AI orchestration platform with 31 tools (32 with competitive mode), advanced workflows, and intelligent prompt engineering. Works with Claude Code, Claude Desktop, Cursor, and any MCP-compatible client.

---

## 📚 Documentation

**🌐 Full Documentation:** [tachibot.com/docs](https://tachibot.com/docs)

### Quick Links

- **[Installation Guide](docs/INSTALLATION_BOTH.md)** - Get started in 5 minutes
- **[Configuration](docs/CONFIGURATION.md)** - Profiles, API keys, settings
- **[Tools Reference](docs/TOOLS_REFERENCE.md)** - All 31 tools explained
- **[Workflows](docs/WORKFLOWS.md)** - Multi-step AI orchestration
- **[API Keys Guide](docs/API_KEYS.md)** - Where to get API keys

---

## ✨ Key Features

### 🤖 Multi-Model Intelligence
- **31 AI Tools:** Perplexity, Grok, GPT-5, Gemini, Qwen, Kimi (32 with competitive mode)
- **Multi-Model Reasoning:** Challenger, Verifier, Scout modes
- **Smart Routing:** Automatic model selection for optimal results

### 🔄 Advanced Workflows
- **YAML-Based Workflows:** Define complex multi-step AI processes
- **Prompt Engineering:** 14 research-backed techniques built-in
- **Auto-Synthesis:** Prevents token overflow on large workflows
- **Parallel Execution:** Run multiple models simultaneously

### 🎯 Tool Profiles
- **Minimal** (8 tools) - Budget-friendly, token-constrained
- **Research Power** (15 tools) - Default, best balance
- **Code Focus** (13 tools) - Software development
- **Balanced** (17 tools) - General-purpose
- **Full** (31 tools, 32 with competitive) - Maximum capability

### 🔧 Developer Experience
- **Claude Code Native** - First-class support
- **Claude Desktop** - Full integration
- **Cursor** - Works seamlessly
- **TypeScript** - Fully typed
- **Extensible** - Add custom tools & workflows

---

## 🚀 Quick Start

### Installation

```bash
# Via NPM (recommended)
npm install -g tachibot-mcp

# Verify installation
tachibot --version
```

### Setup

1. **Add API Keys** (at least one):
   ```bash
   cp .env.example .env
   # Edit .env and add your API keys
   ```

2. **Configure Profile** (optional):
   ```bash
   # Edit .env
   TACHIBOT_PROFILE=research_power  # or minimal, code_focus, balanced, full
   ```

3. **Add to Claude Code/Desktop**:
   ```json
   {
     "mcpServers": {
       "tachibot": {
         "command": "tachibot",
         "env": {
           "PERPLEXITY_API_KEY": "your-key",
           "GROK_API_KEY": "your-key",
           "OPENAI_API_KEY": "your-key",
           "GEMINI_API_KEY": "your-key",
           "OPENROUTER_API_KEY": "your-key"
         }
       }
     }
   }
   ```

4. **Restart Claude** and you're ready! 🎉

See [Installation Guide](docs/INSTALLATION_BOTH.md) for detailed instructions.

---

## 📦 What's Included

### Core Tools
- 🔍 **Research:** `perplexity_ask`, `perplexity_research`, `grok_search`, `scout`
- 🧠 **Reasoning:** `grok_reason`, `kimi_thinking`, `openai_brainstorm`, `focus`
- 💡 **Analysis:** `gemini_brainstorm`, `gemini_analyze_text`, `qwen_coder`
- ✅ **Validation:** `verifier`, `challenger`
- 💭 **Meta:** `think`, `nextThought`

### Advanced Modes
- **Focus** - Deep collaborative reasoning (4+ models)
- **Scout** - Multi-source information gathering
- **Challenger** - Critical analysis with fact-checking
- **Verifier** - Multi-model consensus verification

### Workflows
- **Ultra Creative Brainstorm** - 15 steps, 10 techniques
- **Iterative Problem Solver** - Research → Analyze → Solve
- **Code Architecture Review** - Systematic code analysis
- **Accessibility Audit** - WCAG compliance checking
- **Custom Workflows** - Build your own in YAML

---

## 🌟 Example Usage

### Quick Research
```typescript
// In Claude Code
perplexity_ask({
  query: "What are the latest developments in transformer architecture?"
})
```

### Multi-Model Reasoning
```typescript
focus({
  query: "Design a scalable microservice architecture",
  mode: "deep-reasoning",
  models: ["grok-3", "gpt-5", "gemini-2.5"],
  rounds: 5
})
```

### Run Workflow
```bash
workflow --name ultra-creative-brainstorm --query "AI-powered code review system"
```

---

## 🎓 Learn More

### Documentation
- 📖 [Full Documentation](https://tachibot.com/docs)
- 🔧 [Configuration Guide](docs/CONFIGURATION.md)
- 🛠️ [Tool Parameters](docs/TOOL_PARAMETERS.md)
- 🎯 [Tool Profiles](docs/TOOL_PROFILES.md)
- 🔐 [API Keys Guide](docs/API_KEYS.md)
- ⚡ [Focus Modes](docs/FOCUS_MODES.md)
- 📝 [Workflows Guide](docs/WORKFLOWS.md)

### Setup Guides
- [Claude Code Setup](docs/CLAUDE_CODE_SETUP.md)
- [Claude Desktop Setup](docs/CLAUDE_DESKTOP_MANUAL.md)
- [Both Platforms](docs/INSTALLATION_BOTH.md)

---

## 🤝 Contributing

We welcome contributions! See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

- 🐛 [Report Issues](https://github.com/byPawel/tachibot-mcp/issues)
- 💡 [Request Features](https://github.com/byPawel/tachibot-mcp/issues/new?template=feature_request.md)
- 📖 [Improve Docs](https://github.com/byPawel/tachibot-mcp/pulls)

---

## 📄 License

Apache License 2.0 - see [LICENSE](LICENSE) for details.

---

## 🔗 Links

- **Website:** [tachibot.com](https://tachibot.com)
- **Documentation:** [tachibot.com/docs](https://tachibot.com/docs)
- **GitHub:** [github.com/byPawel/tachibot-mcp](https://github.com/byPawel/tachibot-mcp)
- **Issues:** [Report a Bug](https://github.com/byPawel/tachibot-mcp/issues)

---

**Made with ❤️ by the TachiBot Team**

*Transform your AI workflow with intelligent multi-model orchestration.*
