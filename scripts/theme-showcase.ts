#!/usr/bin/env npx tsx
/**
 * Theme Showcase for TachiBot MCP
 *
 * Run: npx tsx scripts/theme-showcase.ts [theme]
 *
 * Generates beautiful terminal output for:
 * - Landing page screenshots
 * - Twitter/social media posts
 * - Documentation
 */

import chalk from 'chalk';
chalk.level = 3; // Force true color

// Import theme utilities
import {
  getTheme,
  getThemeByName,
  renderModelBadge,
  toolResultHeader,
  dividers,
  gradients,
  highlight,
  score,
  labelValue,
  sectionHeader,
  progressBar,
  success,
  warning,
  error as errorStyle,
  info,
} from '../src/utils/ansi-styles.js';

const themes = ['nebula', 'cyberpunk', 'minimal', 'ocean'] as const;

function showcaseTheme(themeName: typeof themes[number]) {
  // Override env for this theme
  process.env.TACHIBOT_THEME = themeName;

  // Force cache clear by getting theme fresh
  const theme = getThemeByName(themeName);

  console.log('\n');

  // ━━━ Theme Header ━━━
  const headerWidth = 70;
  const title = ` ${themeName.toUpperCase()} THEME `;
  const padding = Math.floor((headerWidth - title.length) / 2);

  console.log(theme.h1('━'.repeat(headerWidth)));
  console.log(theme.h1('━'.repeat(padding) + title + '━'.repeat(headerWidth - padding - title.length)));
  console.log(theme.h1('━'.repeat(headerWidth)));
  console.log();

  // ━━━ Model Badges Showcase ━━━
  console.log(theme.h2('  🤖 Multi-Model AI Orchestration\n'));

  // Row 1: Main providers
  console.log('  ' + ['gemini', 'grok', 'openai', 'perplexity'].map(m => renderModelBadge(m)).join(' '));
  // Row 2: Additional models
  console.log('  ' + ['claude', 'kimi', 'qwen'].map(m => renderModelBadge(m)).join(' '));
  console.log();

  // ━━━ Tool Result Header ━━━
  console.log(theme.h2('  📊 Real-Time Metrics\n'));
  console.log(toolResultHeader({
    model: 'gemini',
    durationMs: 2847,
    tokenCount: 1234,
    costAmount: 0.0045
  }));
  console.log();

  // ━━━ Code Block with Syntax Highlighting ━━━
  console.log(theme.h2('  💻 Code Intelligence\n'));

  const codeExample = `
  const gray = '\\x1b[90m';
  const reset = '\\x1b[0m';

  // TachiBot: Multi-model reasoning
  async function orchestrate(query: string) {
    const models = ['gemini', 'grok', 'openai'];
    const results = await Promise.all(
      models.map(m => callModel(m, query))
    );
    return synthesize(results);
  }`;

  const codeLines = codeExample.trim().split('\n');
  const maxLen = Math.max(...codeLines.map(l => l.length), 50);
  const gray = '\x1b[90m';
  const rst = '\x1b[0m';

  console.log(`  ${gray}╭${'─'.repeat(maxLen + 2)}╮${rst}`);
  console.log(`  ${gray}│${rst} ${chalk.cyan('typescript')}${' '.repeat(maxLen - 10)}${gray}│${rst}`);
  console.log(`  ${gray}├${'─'.repeat(maxLen + 2)}┤${rst}`);

  // Simple syntax highlighting
  for (const line of codeLines) {
    const highlighted = line
      .replace(/(const|async|function|await|return)/g, chalk.magenta('$1'))
      .replace(/('.*?')/g, chalk.green('$1'))
      .replace(/(\/\/.*)/g, chalk.gray('$1'))
      .replace(/(\w+)(?=\()/g, chalk.yellow('$1'));
    const pad = maxLen - line.length;
    console.log(`  ${gray}│${rst} ${highlighted}${' '.repeat(pad)} ${gray}│${rst}`);
  }
  console.log(`  ${gray}╰${'─'.repeat(maxLen + 2)}╯${rst}`);
  console.log();

  // ━━━ Status & Progress ━━━
  console.log(theme.h2('  📈 Analysis Results\n'));

  console.log(`  ${labelValue('Quality Score', score(94))}`);
  console.log(`  ${labelValue('Performance', score(87))}`);
  console.log(`  ${labelValue('Coverage', score(76))}`);
  console.log();

  console.log(`  ${success('✓ All tests passed')}  ${info('ℹ 47 checks')}  ${warning('⚠ 2 warnings')}`);
  console.log();

  // ━━━ Progress Bars ━━━
  console.log(theme.h2('  ⏳ Multi-Step Workflow\n'));

  console.log(`  ${labelValue('Step 1: Research', progressBar(100, 20))} ${chalk.green('Complete')}`);
  console.log(`  ${labelValue('Step 2: Analysis', progressBar(100, 20))} ${chalk.green('Complete')}`);
  console.log(`  ${labelValue('Step 3: Synthesis', progressBar(67, 20))} ${chalk.cyan('In Progress')}`);
  console.log(`  ${labelValue('Step 4: Review', progressBar(0, 20))} ${chalk.gray('Pending')}`);
  console.log();

  // ━━━ Divider Showcase ━━━
  console.log(theme.h2('  ✨ Beautiful Dividers\n'));
  console.log('  ' + dividers.thin);
  console.log('  ' + dividers.thick);
  console.log('  ' + gradients.blueToPurple(60));
  console.log('  ' + gradients.cyanToMagenta(60));
  console.log('  ' + gradients.ocean(60));
  console.log('  ' + gradients.rainbow(60));
  console.log();

  // ━━━ Feature List ━━━
  console.log(theme.h2('  🚀 TachiBot Features\n'));

  const features = [
    ['31+ AI Tools', 'Multi-model orchestration across providers'],
    ['YAML Workflows', 'Define complex AI pipelines declaratively'],
    ['Smart Routing', 'Auto-select best model for each task'],
    ['Focus Modes', 'Deep reasoning, debates, brainstorming'],
  ];

  for (const [name, desc] of features) {
    console.log(`  ${theme.bullet1} ${theme.bold(name)}: ${chalk.gray(desc)}`);
  }
  console.log();

  // Footer gradient - match theme style
  const themeGradients: Record<string, () => string> = {
    nebula: () => gradients.blueToPurple(60),
    cyberpunk: () => gradients.cyanToMagenta(60),
    minimal: () => dividers.thin,
    ocean: () => gradients.ocean(60),
  };
  console.log('  ' + (themeGradients[themeName]?.() || dividers.thin));
  console.log();
}

function showcaseSingleTheme(themeName: string) {
  if (!themes.includes(themeName as any)) {
    console.error(`Unknown theme: ${themeName}`);
    console.error(`Available themes: ${themes.join(', ')}`);
    process.exit(1);
  }
  showcaseTheme(themeName as typeof themes[number]);
}

function showcaseAllThemes() {
  console.log('\n');
  console.log(chalk.bold.white('  ╔══════════════════════════════════════════════════════════════════╗'));
  console.log(chalk.bold.white('  ║') + chalk.bold.cyan('     🤖 TachiBot MCP - Multi-Model AI Orchestration Platform     ') + chalk.bold.white('║'));
  console.log(chalk.bold.white('  ║') + chalk.gray('          Beautiful Terminal Themes for AI Workflows              ') + chalk.bold.white('║'));
  console.log(chalk.bold.white('  ╚══════════════════════════════════════════════════════════════════╝'));

  for (const theme of themes) {
    showcaseTheme(theme);
  }

  console.log(chalk.bold.cyan('\n  🌟 Set your theme: TACHIBOT_THEME=nebula|cyberpunk|minimal|ocean\n'));
}

// CLI entry
const arg = process.argv[2];
if (arg && arg !== '--all') {
  showcaseSingleTheme(arg);
} else {
  showcaseAllThemes();
}
