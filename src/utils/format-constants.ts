/**
 * Shared formatting constants for all tools
 * Clean plain text output with emojis and structure
 */

export const FORMAT_INSTRUCTION = `
OUTPUT RULES:
• No **bold** or __underline__ (CLI shows raw asterisks).
• Allowed: \`code\`, \`\`\`blocks\`\`\`, lists, headers, emojis.
• Lines under 80 chars. Paragraphs ≤4 lines.
• Blank line between sections.

REASONING: Connected prose (A→B→C). Short paragraphs, not walls.
Summarize with bullets if complex.

LISTS: Hierarchy for structure:
  • Main point
    ◦ Detail
      ▸ Sub-detail

CODE: \`\`\`lang blocks. Minimal inline comments.

SECTIONS: 🔍 HEADER ───
Blank line after. 2-4 sections max.

VERDICT: 🟢 pass 🟡 partial 🔴 fail
End only. One line + reason.`;

export const EMOJI_PALETTE = {
  // Section headers
  analysis: '🔍',
  verdict: '🎯',
  insight: '💡',
  key: '⚡',
  judge: '⚖️',
  fix: '🔧',
  search: '🔎',
  idea: '💭',
  warning: '⚠️',

  // Status indicators
  good: '🟢',
  warn: '🟡',
  bad: '🔴',
  info: '🔵',

  // Actions
  arrow: '→',
  check: '✓',
  cross: '✗',
};
