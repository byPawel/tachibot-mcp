# Claude Code Setup Guide

This guide covers setting up TachiBot MCP specifically for **Claude Code** (the CLI tool).

## Prerequisites

1. **Install dependencies:**
   ```bash
   cd tachibot-mcp
   npm install
   ```

2. **Build the project:**
   ```bash
   npm run build
   ```
   This compiles TypeScript to JavaScript in the `dist/` directory.

## Configuration

### 1. Locate Your Config File

Claude Code configuration is at: `~/.config/claude-code/config.json`

### 2. Add TachiBot MCP Server

Edit the config file and add the tachibot-mcp server:

```json
{
  "mcpServers": {
    "tachibot-mcp": {
      "command": "node",
      "args": ["/FULL/ABSOLUTE/PATH/TO/tachibot-mcp/dist/src/server.js"],
      "env": {
        "PERPLEXITY_API_KEY": "your-actual-key-here",
        "GROK_API_KEY": "your-actual-key-here",
        "OPENAI_API_KEY": "your-actual-key-here",
        "GOOGLE_API_KEY": "your-gemini-key-here",
        "OPENROUTER_API_KEY": "your-key-here"
      }
    }
  }
}
```

**Critical:**
- Replace `/FULL/ABSOLUTE/PATH/TO/` with your actual absolute path
- Example: `/Users/yourname/Documents/tachibot-mcp/dist/src/server.js`
- Do NOT use relative paths like `./dist/src/server.js` or `~/tachibot-mcp/...`

### 3. Connect to the Server

In Claude Code, run:
```
/mcp
```

This will attempt to connect to all configured MCP servers.

## Troubleshooting

### "Failed to reconnect" Error

**Problem:** Server fails to start or connect

**Solutions:**

1. **Verify the build:**
   ```bash
   cd tachibot-mcp
   ls -la dist/src/server.js
   ```
   If the file doesn't exist, run `npm run build`

2. **Check the path in config:**
   - Must be an absolute path
   - File must exist at that path
   - Use `pwd` in the tachibot-mcp directory to get the full path

3. **Test the server manually:**
   ```bash
   cd tachibot-mcp
   node dist/src/server.js
   ```
   Should start without errors and show "🚀 TachiBot MCP Server"

4. **Restart Claude Code:**
   - Exit Claude Code completely
   - Start a new session
   - Run `/mcp` again

### "No valid configuration found" Warning

This is normal if you haven't created a `tools.config.json` file. The server will use all tools by default.

To customize, create `tools.config.json`:
```json
{
  "activeProfile": "balanced"
}
```

See [TOOL_PROFILES.md](../TOOL_PROFILES.md) for profile options.

## Profile Configuration

You can control which tools are loaded using profiles:

### Via Environment Variable

In your config.json:
```json
{
  "mcpServers": {
    "tachibot-mcp": {
      "command": "node",
      "args": ["/path/to/dist/src/server.js"],
      "env": {
        "TACHIBOT_PROFILE": "minimal",
        "PERPLEXITY_API_KEY": "...",
        ...
      }
    }
  }
}
```

### Available Profiles

| Profile | Tools | Tokens | Best For |
|---------|-------|--------|----------|
| `minimal` | 8 | ~4-5k | Quick tasks, learning |
| `research_power` | 15 | ~9-10k | Research, brainstorming |
| `code_focus` | 13 | ~8-9k | Development, debugging |
| `balanced` | 17 | ~10-11k | General-purpose (default) |
| `full` | 26 | ~18-19k | Maximum capability |

## Development Workflow

When working on the tachibot-mcp codebase:

1. **Make changes** to TypeScript files in `src/`

2. **Rebuild:**
   ```bash
   npm run build
   ```

3. **Reconnect in Claude Code:**
   ```
   /mcp
   ```
   Or restart Claude Code entirely

## API Keys

Get your API keys from:

- **Perplexity:** https://www.perplexity.ai/settings/api
- **Grok (xAI):** https://console.x.ai/
- **OpenAI:** https://platform.openai.com/api-keys
- **Google (Gemini):** https://makersuite.google.com/app/apikey
- **OpenRouter:** https://openrouter.ai/keys

See [API_KEYS.md](API_KEYS.md) for pricing and free tier information.

## Next Steps

- Check [TOOLS_REFERENCE.md](TOOLS_REFERENCE.md) for complete tool documentation
- See [WORKFLOWS.md](WORKFLOWS.md) to create custom multi-step AI workflows
- Review [CONFIGURATION.md](CONFIGURATION.md) for advanced settings

## Support

If you encounter issues:

1. Check server logs when running manually: `node dist/src/server.js`
2. Verify all paths are absolute, not relative
3. Ensure `npm run build` completed successfully
4. Review the [GitHub Issues](https://github.com/byPawel/tachibot-mcp/issues)
