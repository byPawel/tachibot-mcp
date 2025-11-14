#!/bin/bash
# MCPB Launcher - Ensures fresh extraction with proper stdio handling

set -e  # Exit on error

# Get the directory where this script is located
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
MCPB_PATH="$SCRIPT_DIR/tachibot-mcp.mcpb"
EXTRACT_DIR="/tmp/tachibot-mcp-$$"  # Use PID for unique temp dir

# Create extraction directory
mkdir -p "$EXTRACT_DIR"

# Extract MCPB (overwrite existing)
cd "$EXTRACT_DIR"
unzip -qo "$MCPB_PATH"

# Replace bash process with node to preserve stdio
exec node "$EXTRACT_DIR/dist/src/server-cjs.cjs"
