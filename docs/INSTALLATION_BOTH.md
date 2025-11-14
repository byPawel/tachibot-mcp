# Installing TachiBot MCP for Both Claude Code and Claude Desktop

## Method 1: Claude Desktop Extension (.mcpb file)

### Installation
1. Download `tachibot-mcp.mcpb` from [Releases](https://github.com/byPawel/tachibot-mcp/releases)
2. Open Claude Desktop
3. Go to **Settings** → **Developer** → **Extensions**
4. Click **"Install Extension"** and select the `.mcpb` file
5. Enter your API keys when prompted
6. Restart Claude Desktop

## Method 2: Manual Configuration (Works for Both)

### For Claude Desktop

Add to `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "tachibot": {
      "command": "node",
      "args": ["/path/to/tachibot-mcp/dist/src/server.js"],
      "env": {
        "TACHIBOT_PROFILE": "balanced",
        "PERPLEXITY_API_KEY": "your-key",
        "GROK_API_KEY": "your-key",
        "OPENAI_API_KEY": "your-key",
        "GOOGLE_API_KEY": "your-key"
      }
    }
  }
}
```

### For Claude Code

Add to your project's `.claude/mcp.json`:

```json
{
  "mcpServers": {
    "tachibot": {
      "command": "node",
      "args": ["/path/to/tachibot-mcp/dist/src/server.js"],
      "env": {
        "TACHIBOT_PROFILE": "balanced",
        "PERPLEXITY_API_KEY": "your-key",
        "GROK_API_KEY": "your-key",
        "OPENAI_API_KEY": "your-key"
      }
    }
  }
}
```

Or install globally via NPM and use:

```json
{
  "mcpServers": {
    "tachibot": {
      "command": "tachibot",
      "env": {
        "TACHIBOT_PROFILE": "balanced",
        "PERPLEXITY_API_KEY": "your-key",
        "GROK_API_KEY": "your-key",
        "OPENAI_API_KEY": "your-key"
      }
    }
  }
}
```

## Method 3: Global NPM Installation

```bash
# Install globally
npm install -g tachibot-mcp

# Find installation path
npm list -g tachibot-mcp
```

Then use the `tachibot` command directly in your configuration.

## Troubleshooting

### Server Not Starting

1. **Check Node.js version**: Ensure you have Node.js 18+ installed
   ```bash
   node --version
   ```

2. **Verify build**: Run the build command
   ```bash
   npm run build
   ```

3. **Test server directly**:
   ```bash
   node dist/src/server.js
   ```
   You should see initialization messages.

4. **Check logs**:
   - Claude Desktop: `tail -f ~/Library/Logs/Claude/mcp-server-tachibot*.log`
   - Claude Code: Check the Output panel in the editor

### ES Module Issues

If you see errors about ES modules:

1. Ensure your Node.js version supports ES modules (18+)
2. The package.json has `"type": "module"`
3. All imports use `.js` extensions

### API Key Issues

- API keys can be set in:
  1. Environment variables (`.env` file)
  2. Configuration JSON (env section)
  3. Claude Desktop Extension UI

### Profile Selection

Available profiles:
- `minimal` - 8 tools, ~4-5k tokens
- `research_power` - 16 tools, ~9-10k tokens
- `code_focus` - 13 tools, ~8-9k tokens
- `balanced` - 17 tools, ~10-11k tokens (default)
- `full` - 26 tools, ~18-19k tokens

Set via `TACHIBOT_PROFILE` environment variable.

## Verification

After installation, test by asking Claude:
- "Use the think tool to analyze this"
- "Use the perplexity_ask tool to search for..."
- "Use the focus tool for deep reasoning"

If tools appear and work, installation is successful!