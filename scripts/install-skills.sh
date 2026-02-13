#!/bin/bash

# TachiBot MCP - Skill Installer
# Deploys Claude Code skills to ~/.claude/skills/

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SKILLS_SOURCE="$SCRIPT_DIR/../skills"
SKILLS_TARGET="$HOME/.claude/skills"

if [ ! -d "$SKILLS_SOURCE" ]; then
    exit 0  # No skills to install, skip silently
fi

mkdir -p "$SKILLS_TARGET"

installed=0
for skill_dir in "$SKILLS_SOURCE"/*/; do
    [ -d "$skill_dir" ] || continue
    skill_name=$(basename "$skill_dir")
    target_dir="$SKILLS_TARGET/$skill_name"

    mkdir -p "$target_dir"
    cp "$skill_dir"SKILL.md "$target_dir/SKILL.md"
    installed=$((installed + 1))
done

if [ "$installed" -gt 0 ]; then
    echo "TachiBot: $installed skills installed to $SKILLS_TARGET"
    echo "  Available: /judge, /think, /focus, /breakdown, /decompose, /prompt, /tachi"
fi
