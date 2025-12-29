#!/usr/bin/env npx tsx
/**
 * Comprehensive demo of ALL TachiBot Ink components
 */

import {
  // Gradient functions
  renderGradientModelName,
  renderGradientDivider,
  renderGradientBorderBox,
  renderGradientBoxTop,

  // Workflow & Status
  renderWorkflowCascade,
  renderProgressReel,
  renderThinkingChainArbor,

  // Data visualization
  renderWaterfallTrace,
  renderSourceHeatmap,
  renderSparklinesGrid,
  brailleSparkline,
  brailleBar,

  // Tables
  renderTable,
  renderKeyValueTable,
  renderComparisonTable,

  // Boxes & Borders
  renderBorderBox,
  renderInkBorderBox,
  renderInkGradientBox,

  // Badges
  renderBadge,
  renderBadgeGroup,

  // Code
  renderCodeMinimap,

  // Trees & Diagrams
  renderExpandableTree,
  renderGanttTimeline,
  renderAsciiFlowchart,
  renderQuickFlow,

  // Diff
  renderSideBySideDiff,
  createDiff,

  // Receipt
  renderReceipt,

  // Icons
  icons,

  // Errors
  renderErrorAutopsy,
} from '../src/utils/ink-renderer.js';

import { renderSimpleTable } from '../src/utils/ink-table.js';
import { renderMarkdownToAnsi } from '../src/utils/ink-markdown-renderer.js';

const models = ['gemini', 'grok', 'openai', 'perplexity', 'claude', 'kimi', 'qwen'];
const themes = ['nebula', 'cyberpunk', 'minimal', 'ocean'];

// Helper to print section headers
const section = (title: string) => {
  console.log('\n' + '═'.repeat(70));
  console.log(`  ${title}`);
  console.log('═'.repeat(70) + '\n');
};

// ============================================================================
// THEME SHOWCASE
// ============================================================================

for (const theme of themes) {
  console.log('\n');
  console.log('╔══════════════════════════════════════════════════════════════════════╗');
  console.log(`║                         THEME: ${theme.toUpperCase().padEnd(12)}                          ║`);
  console.log('╚══════════════════════════════════════════════════════════════════════╝');

  // Gradient Background Badges
  section('GRADIENT BACKGROUND BADGES');
  for (const m of models) {
    process.stdout.write(renderMarkdownToAnsi('', theme, m).split('\n')[0] + '  ');
  }
  console.log('\n');

  // Markdown with theme
  section('MARKDOWN RENDERING');
  console.log(renderMarkdownToAnsi(`
## Code Analysis Report

The implementation looks **excellent**! Here's the breakdown:

### Findings
- Performance: \`O(n log n)\` complexity
- Security: No vulnerabilities detected
- Coverage: **94%** test coverage

### Code Sample
\`\`\`typescript
async function analyze(code: string) {
  const ast = parse(code);
  return validate(ast);
}
\`\`\`

> This is production-ready code.
`, theme, 'gemini'));
}

// ============================================================================
// GRADIENT MODEL NAMES (Theme-Independent)
// ============================================================================

section('GRADIENT MODEL NAMES');
console.log('  ' + models.map(m => renderGradientModelName(m)).join('  '));

// ============================================================================
// GRADIENT DIVIDERS
// ============================================================================

section('GRADIENT DIVIDERS');
const presets = ['cristal', 'passion', 'teen', 'mind', 'rainbow', 'vice', 'instagram', 'retro'] as const;
for (const preset of presets) {
  console.log(`  ${preset.padEnd(12)} ${renderGradientDivider(50, preset)}`);
}

// ============================================================================
// BOXES & BORDERS
// ============================================================================

section('GRADIENT BORDER BOX');
console.log(renderGradientBorderBox(
  'TachiBot Analysis',
  'Multi-model AI orchestration platform\nwith beautiful terminal output\nand comprehensive theming support',
  60,
  'cristal'
));

section('BORDER BOX STYLES');
const borderStyles = ['single', 'double', 'round', 'bold'] as const;
for (const style of borderStyles) {
  console.log(renderBorderBox(
    `${style.toUpperCase()} BORDER`,
    `This is a ${style} border box`,
    40,
    style
  ));
}

// ============================================================================
// TABLES
// ============================================================================

section('DATA TABLE');
console.log(renderTable([
  { Model: 'Gemini', Speed: '1.2s', Quality: '94%', Cost: '$0.001' },
  { Model: 'Grok', Speed: '0.8s', Quality: '91%', Cost: '$0.002' },
  { Model: 'OpenAI', Speed: '1.5s', Quality: '96%', Cost: '$0.003' },
  { Model: 'Claude', Speed: '1.1s', Quality: '95%', Cost: '$0.002' },
]));

section('KEY-VALUE TABLE');
console.log(renderKeyValueTable({
  'Session ID': 'abc-123-xyz',
  'Models Used': 'gemini, grok, openai',
  'Total Calls': '42',
  'Duration': '12.5s',
  'Cost': '$0.15',
  'Status': 'Complete',
}));

section('COMPARISON TABLE');
console.log(renderComparisonTable(
  ['Feature', 'Gemini', 'Grok', 'OpenAI'],
  [
    ['Speed', '★★★★☆', '★★★★★', '★★★☆☆'],
    ['Quality', '★★★★★', '★★★★☆', '★★★★★'],
    ['Cost', '★★★★★', '★★★★☆', '★★★☆☆'],
    ['Context', '★★★★★', '★★★★☆', '★★★★★'],
  ]
));

section('SIMPLE TABLE (ink-table)');
console.log(renderSimpleTable({
  headers: ['Tool', 'Provider', 'Status'],
  rows: [
    ['grok_reason', 'xAI', '✓ Active'],
    ['gemini_brainstorm', 'Google', '✓ Active'],
    ['openai_reason', 'OpenAI', '✓ Active'],
    ['perplexity_ask', 'Perplexity', '✓ Active'],
  ]
}));

// ============================================================================
// PROGRESS & WORKFLOW
// ============================================================================

section('WORKFLOW CASCADE');
console.log(renderWorkflowCascade([
  { name: 'Research', model: 'perplexity', status: 'completed', duration: 2100 },
  { name: 'Analyze', model: 'gemini', status: 'completed', duration: 1500 },
  { name: 'Synthesize', model: 'grok', status: 'running' },
  { name: 'Review', model: 'openai', status: 'pending' },
  { name: 'Finalize', model: 'claude', status: 'pending' },
], 'Multi-Model Pipeline'));

section('PROGRESS REEL');
console.log(renderProgressReel([
  { name: 'Parsing', progress: 100, status: 'completed' },
  { name: 'Analysis', progress: 100, status: 'completed' },
  { name: 'Generation', progress: 67, status: 'running' },
  { name: 'Validation', progress: 0, status: 'pending' },
], 'Code Generation'));

section('THINKING CHAIN');
console.log(renderThinkingChainArbor([
  { thought: 'Analyzing the architecture requirements', model: 'gemini', confidence: 0.92 },
  { thought: 'Considering microservices vs monolith', model: 'grok', confidence: 0.88 },
  { thought: 'Evaluating scalability patterns', model: 'openai', confidence: 0.95 },
  { thought: 'Final recommendation: hybrid approach', model: 'claude', confidence: 0.91 },
], 'Architecture Decision'));

// ============================================================================
// DATA VISUALIZATION
// ============================================================================

section('WATERFALL TRACE');
console.log(renderWaterfallTrace([
  { name: 'perplexity_ask', startOffset: 0, duration: 850, status: 'success' },
  { name: 'gemini_analyze', startOffset: 850, duration: 1200, status: 'success' },
  { name: 'grok_reason', startOffset: 2050, duration: 600, status: 'success' },
  { name: 'openai_synthesize', startOffset: 2650, duration: 900, status: 'success' },
], 'API Call Timeline'));

section('SOURCE HEATMAP');
console.log(renderSourceHeatmap([
  { url: 'https://docs.example.com/api', relevance: 0.95, citations: 12 },
  { url: 'https://github.com/repo/issues', relevance: 0.82, citations: 8 },
  { url: 'https://stackoverflow.com/q/123', relevance: 0.75, citations: 5 },
  { url: 'https://blog.tech.io/article', relevance: 0.68, citations: 3 },
], 'Research Sources'));

section('SPARKLINES GRID');
console.log(renderSparklinesGrid([
  { label: 'Latency', values: [120, 135, 110, 95, 88, 92, 85, 78, 82, 75], unit: 'ms' },
  { label: 'Tokens', values: [500, 620, 580, 750, 820, 680, 720, 890, 950, 1020], unit: 'tok' },
  { label: 'Cost', values: [0.01, 0.012, 0.011, 0.015, 0.018, 0.014, 0.016, 0.02, 0.022, 0.025], unit: '$' },
], 'Performance Metrics'));

section('BRAILLE SPARKLINES');
console.log('  Latency: ' + brailleSparkline([120, 135, 110, 95, 88, 92, 85, 78, 82, 75, 70, 65], 30));
console.log('  Tokens:  ' + brailleSparkline([500, 620, 580, 750, 820, 680, 720, 890, 950, 1020, 980, 1100], 30));
console.log('  Memory:  ' + brailleSparkline([45, 48, 52, 55, 58, 62, 65, 68, 72, 75, 78, 82], 30));

section('BRAILLE BARS');
console.log('  Gemini:     ' + brailleBar(94, 100, 25) + ' 94%');
console.log('  Grok:       ' + brailleBar(91, 100, 25) + ' 91%');
console.log('  OpenAI:     ' + brailleBar(96, 100, 25) + ' 96%');
console.log('  Perplexity: ' + brailleBar(88, 100, 25) + ' 88%');

// ============================================================================
// TREES & DIAGRAMS
// ============================================================================

section('EXPANDABLE TREE');
console.log(renderExpandableTree([
  {
    label: 'src/',
    expanded: true,
    children: [
      {
        label: 'tools/',
        expanded: true,
        children: [
          { label: 'grok-tools.ts' },
          { label: 'gemini-tools.ts' },
          { label: 'openai-tools.ts' },
        ]
      },
      {
        label: 'utils/',
        expanded: true,
        children: [
          { label: 'ink-renderer.tsx' },
          { label: 'ink-table.tsx' },
          { label: 'ansi-styles.ts' },
        ]
      },
      { label: 'server.ts' },
    ]
  }
], 'Project Structure'));

section('GANTT TIMELINE');
console.log(renderGanttTimeline([
  { name: 'Research', start: 0, duration: 20, status: 'completed' },
  { name: 'Design', start: 15, duration: 25, status: 'completed' },
  { name: 'Implement', start: 35, duration: 35, status: 'active' },
  { name: 'Test', start: 60, duration: 25, status: 'pending' },
  { name: 'Deploy', start: 80, duration: 20, status: 'pending' },
], { title: 'Project Timeline', width: 50 }));

section('ASCII FLOWCHART');
console.log(renderQuickFlow([
  'User Query',
  'Parse Intent',
  'Select Models',
  'Execute Tools',
  'Synthesize',
  'Return Result'
], 'Request Flow'));

// ============================================================================
// CODE VISUALIZATION
// ============================================================================

section('CODE MINIMAP');
const sampleCode = `
import { render } from 'ink';
import React from 'react';

interface Props {
  model: string;
  content: string;
}

export const ModelCard: React.FC<Props> = ({ model, content }) => {
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchData(model).then(setContent);
  }, [model]);

  return (
    <Box flexDirection="column" padding={1}>
      <Text bold>{model}</Text>
      <Text>{content}</Text>
    </Box>
  );
};
`;
console.log(renderCodeMinimap(sampleCode, 40, 12));

// ============================================================================
// DIFF VIEW
// ============================================================================

section('SIDE-BY-SIDE DIFF');
const oldCode = `function greet(name) {
  console.log("Hello " + name);
  return true;
}`;
const newCode = `function greet(name: string) {
  console.log(\`Hello \${name}!\`);
  return { success: true };
}`;
console.log(renderSideBySideDiff(createDiff(oldCode, newCode), 'Old', 'New'));

// ============================================================================
// BADGES
// ============================================================================

section('BADGES');
console.log(renderBadgeGroup([
  { text: 'Success', variant: 'success' },
  { text: 'Error', variant: 'error' },
  { text: 'Warning', variant: 'warning' },
  { text: 'Info', variant: 'info' },
  { text: 'Cached', variant: 'cached' },
]));
console.log();
console.log(renderBadgeGroup([
  { text: '1.2s', variant: 'duration' },
  { text: 'gemini', variant: 'model' },
  { text: 'Custom Badge', variant: 'custom', color: '#FF6B6B', icon: '★' },
]));

// ============================================================================
// RECEIPT
// ============================================================================

section('RECEIPT');
console.log(renderReceipt({
  model: 'gemini',
  inputTokens: 15420,
  outputTokens: 4280,
  cachedTokens: 2100,
  duration: 3450,
}));

// ============================================================================
// ERROR DISPLAY
// ============================================================================

section('ERROR AUTOPSY');
console.log(renderErrorAutopsy({
  type: 'APIError',
  message: 'Rate limit exceeded for grok-4-1-fast-reasoning',
  code: 429,
  stack: `at GrokClient.call (grok-tools.ts:142)
at FocusToolService.execute (focus-tool.ts:89)
at Server.handleRequest (server.ts:234)`,
  suggestion: 'Wait 60 seconds or switch to a different model'
}));

// ============================================================================
// ICONS
// ============================================================================

section('ICON LIBRARY');
const iconGroups = {
  'Status': ['check', 'x', 'alertCircle', 'info'],
  'Actions': ['play', 'pause', 'stop', 'refresh', 'zap'],
  'Objects': ['file', 'folder', 'code', 'terminal', 'database'],
  'AI/Models': ['brain', 'bot', 'sparkle', 'wand'],
  'Data': ['chartBar', 'trendUp', 'trendDown'],
  'Workflow': ['workflow', 'step', 'merge', 'split'],
};

for (const [group, iconNames] of Object.entries(iconGroups)) {
  const iconStr = iconNames.map(name =>
    `${icons[name as keyof typeof icons] || '?'} ${name}`
  ).join('  ');
  console.log(`  ${group.padEnd(12)} ${iconStr}`);
}

console.log('\n' + '═'.repeat(70));
console.log('  Demo complete! Run with: npx tsx scripts/demo-all-components.ts');
console.log('═'.repeat(70) + '\n');
