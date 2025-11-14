#!/bin/bash

echo "📦 Building TachiBot MCP Extension Package..."
echo ""

# Get the root directory
ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
PACKAGE_NAME="tachibot-mcp.mcpb"
OUTPUT_PATH="$ROOT_DIR/$PACKAGE_NAME"

# Change to root directory
cd "$ROOT_DIR"

# Ensure dist directory exists
if [ ! -d "dist" ]; then
    echo "⚙️  Building project first..."
    npm run build
fi

# Install production dependencies
echo "📦 Installing production dependencies..."
npm install --production --no-optional

# Remove old package if exists
rm -f "$OUTPUT_PATH"

# Create the .mcpb package using zip
echo "📝 Creating extension package..."
zip -r "$PACKAGE_NAME" \
    manifest.json \
    dist/ \
    node_modules/ \
    package.json \
    smithery.yaml \
    mcp.json \
    tools.config.json \
    profiles/ \
    workflows/ \
    personality/ \
    README.md \
    LICENSE \
    .env.example \
    docs/ \
    -x "*.DS_Store" "*/__tests__/*" "*.test.js" "*.spec.js" "*/.git/*"

# Check if package was created successfully
if [ -f "$OUTPUT_PATH" ]; then
    SIZE=$(du -h "$OUTPUT_PATH" | cut -f1)
    echo ""
    echo "✅ Extension package created successfully!"
    echo "📦 Package: $PACKAGE_NAME"
    echo "📊 Size: $SIZE"
    echo "📍 Location: $OUTPUT_PATH"
    echo ""
    echo "🚀 Installation Instructions:"
    echo "1. Download the .mcpb file"
    echo "2. Double-click to open in Claude Desktop"
    echo "3. Click 'Install' and configure your API keys"
    echo ""
    echo "💡 Or drag and drop the file into Claude Desktop Extensions settings"
else
    echo "❌ Error creating package"
    exit 1
fi