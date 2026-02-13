#!/bin/bash

# TachiBot MCP Easy Installer
# This script installs TachiBot MCP for Claude Desktop

set -e

echo "🤖 TachiBot MCP Installer"
echo "========================="
echo ""

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed!"
    echo ""
    echo "Please install Node.js v20+ first:"
    echo "👉 https://nodejs.org/en/download/"
    echo ""
    exit 1
fi

# Check Node.js version
NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 20 ]; then
    echo "❌ Node.js version is too old (v$NODE_VERSION)"
    echo "Please install Node.js v20 or higher"
    echo "👉 https://nodejs.org/en/download/"
    echo ""
    exit 1
fi

echo "✅ Node.js $(node -v) detected"
echo ""

# Get installation directory
INSTALL_DIR="$HOME/.tachibot-mcp"
echo "📁 Installing to: $INSTALL_DIR"
echo ""

# Clone or update repository
if [ -d "$INSTALL_DIR" ]; then
    echo "📦 Updating existing installation..."
    cd "$INSTALL_DIR"
    git pull
else
    echo "📦 Downloading TachiBot..."
    git clone https://github.com/byPawel/tachibot-mcp.git "$INSTALL_DIR"
    cd "$INSTALL_DIR"
fi

# Install dependencies
echo "📦 Installing dependencies..."
npm install --silent

# Build
echo "🔨 Building TachiBot..."
npm run build --silent

echo ""
echo "✅ TachiBot installed successfully!"
echo ""

# Install Claude Code skills
SKILLS_DIR="$HOME/.claude/skills"
echo "📝 Installing Claude Code skills..."

if [ -d "$INSTALL_DIR/skills" ]; then
    mkdir -p "$SKILLS_DIR"
    for skill_dir in "$INSTALL_DIR/skills"/*/; do
        skill_name=$(basename "$skill_dir")
        target_dir="$SKILLS_DIR/$skill_name"

        if [ -d "$target_dir" ]; then
            echo "   Updating: /$skill_name"
        else
            echo "   Installing: /$skill_name"
        fi

        mkdir -p "$target_dir"
        cp "$skill_dir"SKILL.md "$target_dir/SKILL.md"
    done
    echo "✅ Skills installed! Available: /judge, /think, /focus, /breakdown, /decompose, /prompt, /tachi"
else
    echo "⚠️  No skills directory found, skipping skill installation"
fi

# Get Node.js path
NODE_PATH=$(which node)

# Create Claude Desktop config directory if it doesn't exist
CONFIG_DIR="$HOME/Library/Application Support/Claude"
CONFIG_FILE="$CONFIG_DIR/claude_desktop_config.json"

mkdir -p "$CONFIG_DIR"

# Read existing config or create new one
if [ -f "$CONFIG_FILE" ]; then
    echo "⚙️  Updating existing Claude Desktop config..."
    # Backup existing config
    cp "$CONFIG_FILE" "$CONFIG_FILE.backup"

    # Use Python to merge configs (preserving other servers)
    python3 << EOF
import json
import sys

config_file = "$CONFIG_FILE"

# Read existing config
with open(config_file, 'r') as f:
    config = json.load(f)

# Ensure mcpServers exists
if 'mcpServers' not in config:
    config['mcpServers'] = {}

# Add or update tachibot-mcp
config['mcpServers']['tachibot-mcp'] = {
    "command": "$NODE_PATH",
    "args": ["$INSTALL_DIR/dist/src/server-cjs.cjs"],
    "env": {
        "NODE_ENV": "production"
    }
}

# Write back
with open(config_file, 'w') as f:
    json.dump(config, f, indent=2)

print("✅ Config updated!")
EOF
else
    echo "⚙️  Creating new Claude Desktop config..."
    cat > "$CONFIG_FILE" << EOF
{
  "mcpServers": {
    "tachibot-mcp": {
      "command": "$NODE_PATH",
      "args": ["$INSTALL_DIR/dist/src/server-cjs.cjs"],
      "env": {
        "NODE_ENV": "production"
      }
    }
  }
}
EOF
    echo "✅ Config created!"
fi

echo ""
echo "🎉 Installation complete!"
echo ""
echo "📝 Next steps:"
echo "   1. Quit Claude Desktop completely (Cmd+Q)"
echo "   2. Reopen Claude Desktop"
echo "   3. TachiBot should appear in your MCP servers"
echo ""
echo "🔑 To add API keys:"
echo "   Edit this file: $CONFIG_FILE"
echo "   Add keys to the 'env' section:"
echo "   \"PERPLEXITY_API_KEY\": \"your-key-here\""
echo "   \"GROK_API_KEY\": \"your-key-here\""
echo "   \"OPENAI_API_KEY\": \"your-key-here\""
echo ""
echo "📖 Documentation: https://github.com/byPawel/tachibot-mcp"
echo ""
echo "💡 Try these skills in Claude Code:"
echo "   /judge how to implement auth?"
echo "   /think gemini optimize this query"
echo "   /decompose implement real-time collaboration"
echo "   /tachi (show all available skills)"
echo ""
