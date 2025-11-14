#!/bin/bash
# Wrapper script for tachibot-mcp that ensures proper Node.js environment

# Get the directory of this script
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

# Run the server (uses system node or nvm/volta if configured)
exec node "$DIR/dist/src/server.js"