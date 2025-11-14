# Claude Desktop Manual Installation

## Method 1: Via Extension Installer (Recommended)

1. Open Claude Desktop
2. Navigate to: **Settings** → **Developer** → **Extensions**
3. Click **"Install Extension"**
4. Select the `tachibot-official.mcpb` file
5. Enter your API keys when prompted

## Method 2: Manual JSON Configuration

If the extension installer isn't working, configure manually:

### 1. Locate Claude Desktop Config

**macOS:**
```bash
~/Library/Application Support/Claude/claude_desktop_config.json
```

**Windows:**
```
%APPDATA%\Claude\claude_desktop_config.json
```

**Linux:**
```
~/.config/Claude/claude_desktop_config.json
```

### 2. Edit Configuration

Add this to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "tachibot": {
      "command": "node",
      "args": ["/absolute/path/to/tachibot-mcp/dist/src/server.js"],
      "env": {
        "TACHIBOT_PROFILE": "balanced",
        "PERPLEXITY_API_KEY": "your-perplexity-key",
        "GROK_API_KEY": "your-grok-key",
        "OPENAI_API_KEY": "your-openai-key",
        "GOOGLE_API_KEY": "your-gemini-key"
      }
    }
  }
}
```

**Note:** Replace `/absolute/path/to/tachibot-mcp/` with your actual installation path.

### 3. For Global NPM Installation

If you installed via npm globally:

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

## Method 3: Drag and Drop (If Supported)

Some versions of Claude Desktop support drag-and-drop:

1. Open Claude Desktop
2. Drag the `tachibot-official.mcpb` file onto the Claude Desktop window
3. Follow the installation prompts

## Troubleshooting

### File Association Issues

If .mcpb files open in the wrong application:

**macOS:**
1. Right-click the .mcpb file
2. Select "Get Info"
3. Under "Open with:", select Claude Desktop
4. Click "Change All..."

**Windows:**
1. Right-click the .mcpb file
2. Select "Open with" → "Choose another app"
3. Select Claude Desktop
4. Check "Always use this app"

### Verify Installation

After installation, restart Claude Desktop and check if TachiBot tools are available by typing:
- "Use the think tool"
- "Use the perplexity_ask tool"

If tools appear in the autocomplete or work when invoked, installation was successful.

## Alternative: Use NPM Global Install

If manual configuration is preferred:

```bash
# Install globally
npm install -g tachibot-mcp

# Find installation path
npm list -g tachibot-mcp

# Use that path in claude_desktop_config.json
```

## Need Help?

- Check Claude Desktop logs: **Help** → **Toggle Developer Tools** → **Console**
- Report issues: https://github.com/byPawel/tachibot-mcp/issues