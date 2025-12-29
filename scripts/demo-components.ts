#!/usr/bin/env npx tsx
/**
 * Demo Ink components from TachiBot MCP in different themes
 */

import {
  renderGradientModelName,
  renderGradientDivider,
  renderWorkflowCascade,
  renderBadgeGroup,
  icons
} from '../src/utils/ink-renderer.js';
import { renderMarkdownToAnsi } from '../src/utils/ink-markdown-renderer.js';

const models = ['gemini', 'grok', 'openai', 'perplexity', 'claude', 'kimi', 'qwen'];
const themes = ['nebula', 'cyberpunk', 'minimal', 'ocean', 'dracula', 'nord', 'solarized'];

for (const theme of themes) {
  console.log('\n');
  console.log('╔══════════════════════════════════════════════════════════════════╗');
  console.log(`║                      THEME: ${theme.toUpperCase().padEnd(10)}                         ║`);
  console.log('╚══════════════════════════════════════════════════════════════════╝');

  console.log('\n━━━ GRADIENT BACKGROUND BADGES ━━━\n');
  for (const m of models) {
    console.log(renderMarkdownToAnsi('', theme, m));
  }

  console.log('\n━━━ MARKDOWN WITH BADGE ━━━\n');
  console.log(renderMarkdownToAnsi(
    '## Analysis Result\n\nThe architecture looks **solid**!\n\n- Performance: OK\n- Security: OK\n- Scalability: OK',
    theme,
    'gemini'
  ));
}

console.log('\n━━━ GRADIENT TEXT NAMES (theme-independent) ━━━\n');
for (const m of models) {
  console.log('  ' + renderGradientModelName(m));
}

console.log('\n━━━ GRADIENT DIVIDERS (theme-independent) ━━━\n');
console.log(renderGradientDivider(60, 'cristal'));
console.log(renderGradientDivider(60, 'passion'));
console.log(renderGradientDivider(60, 'rainbow'));
console.log(renderGradientDivider(60, 'vice'));

console.log('\n━━━ WORKFLOW CASCADE ━━━\n');
console.log(renderWorkflowCascade([
  { name: 'Research', model: 'perplexity', status: 'completed', duration: 2100 },
  { name: 'Analyze', model: 'gemini', status: 'completed', duration: 1500 },
  { name: 'Synthesize', model: 'grok', status: 'running' },
  { name: 'Review', model: 'openai', status: 'pending' }
], 'AI Pipeline'));

console.log('\n━━━ BADGES ━━━\n');
console.log(renderBadgeGroup([
  { text: 'Success', variant: 'success' },
  { text: 'Error', variant: 'error' },
  { text: 'Warning', variant: 'warning' },
  { text: 'Info', variant: 'info' },
  { text: 'Cached', variant: 'cached' }
]));

console.log('\n━━━ ICONS ━━━\n');
const iconSamples = ['check', 'x', 'zap', 'brain', 'bot', 'sparkles', 'workflow', 'step'];
console.log('  ' + iconSamples.map(i => `${icons[i as keyof typeof icons]} ${i}`).join('  '));

console.log('\n');
