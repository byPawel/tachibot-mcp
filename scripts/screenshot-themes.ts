#!/usr/bin/env npx tsx
/**
 * Screenshot-Ready Theme Display for TachiBot MCP
 *
 * Generates clean, screenshot-friendly output for:
 * - Landing page hero images
 * - Twitter/X posts
 * - Documentation
 *
 * Usage:
 *   npx tsx scripts/screenshot-themes.ts [theme|all|side-by-side|twitter]
 *   npx tsx scripts/screenshot-themes.ts all --nerd     # Use Nerd Font icons
 *
 * Nerd Font Icons (requires Nerd Font installed):
 *   - Download: https://www.nerdfonts.com/font-downloads
 *   - Recommended: JetBrainsMono Nerd Font, FiraCode Nerd Font
 */

import chalk from 'chalk';
chalk.level = 3;

// Check if --nerd flag is passed
const useNerdFonts = process.argv.includes('--nerd');

// Nerd Font Icons (https://www.nerdfonts.com/cheat-sheet)
const nfIcons = {
  robot: '\uf544',      //
  brain: '\uf5dc',      // 󰗠
  code: '\uf121',       //
  git: '\ue702',        //
  check: '\uf00c',      //
  warning: '\uf071',    //
  info: '\uf129',       //
  rocket: '\uf135',     //
  chart: '\uf201',      //
  workflow: '\ue729',   //
  lightning: '\uf0e7',  //
  search: '\uf002',     //
  star: '\uf005',       //
  // Model-specific icons
  gemini: '\ue69b',     //  (Google)
  grok: '\uf2db',       //  (X/Twitter)
  openai: '\ue697',     //  (OpenAI)
  perplexity: '\uf002', //  (Search)
  claude: '\uf544',     //  (Robot)
  kimi: '\uf005',       //  (Star)
  qwen: '\uf121',       //  (Code)
};

// Fallback to emoji if no Nerd Font
const icons = useNerdFonts ? nfIcons : {
  robot: '🤖',
  brain: '🧠',
  code: '💻',
  git: '📦',
  check: '✓',
  warning: '⚠',
  info: 'ℹ',
  rocket: '🚀',
  chart: '📊',
  workflow: '⚡',
  lightning: '⚡',
  search: '🔍',
  star: '⭐',
  gemini: '◈',
  grok: '✦',
  openai: '⚡',
  perplexity: '◉',
  claude: '●',
  kimi: '★',
  qwen: '◆',
};

import {
  getThemeByName,
  renderModelBadge,
  toolResultHeader,
  gradients,
  dividers,
  progressBar,
  score,
  success,
  warning,
  info,
  labelValue,
} from '../src/utils/ansi-styles.js';

const themes = ['nebula', 'cyberpunk', 'minimal', 'ocean'] as const;

// ═══════════════════════════════════════════════════════════════════
// HERO SCREENSHOT - Clean single-theme showcase
// ═══════════════════════════════════════════════════════════════════

function heroScreenshot(themeName: typeof themes[number]) {
  process.env.TACHIBOT_THEME = themeName;
  const theme = getThemeByName(themeName);

  const width = 66;
  const pad = (s: string, w: number) => s + ' '.repeat(Math.max(0, w - s.length));

  console.log();

  // Theme name badge
  const themeLabel = ` ${themeName.toUpperCase()} THEME `;
  console.log(chalk.gray(`  ┌─${themeLabel}${'─'.repeat(width - themeLabel.length - 2)}┐`));
  console.log();

  console.log(theme.h1(`  ╔${'═'.repeat(width)}╗`));
  console.log(theme.h1(`  ║${pad('', width)}║`));
  console.log(theme.h1(`  ║${pad(`  ${icons.robot} TachiBot MCP`, width)}║`));
  console.log(theme.h1(`  ║${pad('  Multi-Model AI Orchestration Platform', width)}║`));
  console.log(theme.h1(`  ║${pad('', width)}║`));
  console.log(theme.h1(`  ╚${'═'.repeat(width)}╝`));
  console.log();

  // Model badges row - all supported models
  console.log('  ' + ['gemini', 'grok', 'openai', 'perplexity'].map(m => renderModelBadge(m)).join(' '));
  console.log('  ' + ['claude', 'kimi', 'qwen'].map(m => renderModelBadge(m)).join(' '));
  console.log();

  // Metrics
  console.log(toolResultHeader({ model: 'gemini', durationMs: 1847, tokenCount: 2341, costAmount: 0.0023 }));
  console.log();

  // Progress visualization
  console.log(theme.h2(`  ${icons.workflow} Workflow Progress`));
  console.log();
  console.log(`   ${chalk.gray('research')}    ${progressBar(100, 15)} ${chalk.green('✓')}`);
  console.log(`   ${chalk.gray('analysis')}    ${progressBar(100, 15)} ${chalk.green('✓')}`);
  console.log(`   ${chalk.gray('synthesis')}   ${progressBar(75, 15)} ${chalk.cyan('▸')}`);
  console.log(`   ${chalk.gray('review')}      ${progressBar(0, 15)} ${chalk.gray('○')}`);
  console.log();

  // Quality metrics
  console.log(theme.h2(`  ${icons.chart} Analysis Results`));
  console.log();
  console.log(`   ${labelValue('Quality', score(96))}`);
  console.log(`   ${labelValue('Coverage', score(89))}`);
  console.log(`   ${labelValue('Performance', score(94))}`);
  console.log();

  // Status line
  console.log(`  ${success('✓ 47 passed')}  ${warning('⚠ 2 warnings')}  ${info('ℹ Ready for review')}`);
  console.log();

  // Footer gradient
  const themeGradient: Record<string, () => string> = {
    nebula: () => gradients.blueToPurple(64),
    cyberpunk: () => gradients.cyanToMagenta(64),
    minimal: () => dividers.thin,
    ocean: () => gradients.ocean(64),
  };
  console.log('  ' + (themeGradient[themeName]?.() || dividers.thin));
  console.log();
}

// ═══════════════════════════════════════════════════════════════════
// TWITTER CARD - Compact, punchy
// ═══════════════════════════════════════════════════════════════════

function twitterCard(themeName: typeof themes[number]) {
  process.env.TACHIBOT_THEME = themeName;
  const theme = getThemeByName(themeName);

  console.log();
  console.log(theme.h1('  ════════════════════════════════════════════'));
  console.log(theme.h1('   🤖 TachiBot MCP                           '));
  console.log(theme.h1('  ════════════════════════════════════════════'));
  console.log();

  // Compact model badges - 2 rows for Twitter
  console.log('  ' + ['gemini', 'grok', 'openai', 'perplexity'].map(m => renderModelBadge(m)).join(' '));
  console.log('  ' + ['kimi', 'qwen', 'claude'].map(m => renderModelBadge(m)).join(' '));
  console.log();

  // One-liner features
  console.log(`  ${theme.bullet1} ${theme.bold('31+ AI Tools')} across 5 providers`);
  console.log(`  ${theme.bullet1} ${theme.bold('YAML Workflows')} for complex pipelines`);
  console.log(`  ${theme.bullet1} ${theme.bold('Smart Routing')} picks best model`);
  console.log();

  // Quick result
  console.log(toolResultHeader({ model: 'gemini', durationMs: 847, tokenCount: 1234 }));
  console.log();

  // Gradient footer
  const gradient = themeName === 'cyberpunk' ? gradients.cyanToMagenta(44) :
                   themeName === 'ocean' ? gradients.ocean(44) :
                   gradients.blueToPurple(44);
  console.log('  ' + gradient);
  console.log();
}

// ═══════════════════════════════════════════════════════════════════
// SIDE BY SIDE - All 4 themes in compact view
// ═══════════════════════════════════════════════════════════════════

function sideBySide() {
  console.log();
  console.log(chalk.bold.white('  ╔══════════════════════════════════════════════════════════════════╗'));
  console.log(chalk.bold.white('  ║') + chalk.bold.cyan('     🎨 TachiBot MCP - Terminal Themes                            ') + chalk.bold.white('║'));
  console.log(chalk.bold.white('  ╚══════════════════════════════════════════════════════════════════╝'));
  console.log();

  for (const themeName of themes) {
    process.env.TACHIBOT_THEME = themeName;
    const theme = getThemeByName(themeName);

    const title = themeName.toUpperCase().padEnd(10);
    console.log(theme.h1(`  ━━━━━━━ ${title} ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`));
    console.log();

    // Model badges - all models
    console.log('  ' + ['gemini', 'grok', 'openai', 'perplexity'].map(m => renderModelBadge(m)).join(' '));
    console.log('  ' + ['kimi', 'qwen', 'claude'].map(m => renderModelBadge(m)).join(' '));
    console.log();

    // Quick stats
    console.log(`   ${labelValue('Quality', score(94))}  ${labelValue('Speed', score(87))}`);
    console.log();

    // Progress
    console.log(`   ${chalk.gray('workflow')} ${progressBar(75, 20)} ${chalk.cyan('75%')}`);
    console.log();
  }

  console.log(chalk.bold.cyan('  🌟 TACHIBOT_THEME=nebula|cyberpunk|minimal|ocean'));
  console.log();
}

// ═══════════════════════════════════════════════════════════════════
// CLI ENTRY
// ═══════════════════════════════════════════════════════════════════

const arg = process.argv[2];

if (arg === 'side-by-side' || arg === 'all-compact') {
  sideBySide();
} else if (arg === 'twitter') {
  twitterCard(process.argv[3] as typeof themes[number] || 'nebula');
} else if (themes.includes(arg as any)) {
  heroScreenshot(arg as typeof themes[number]);
} else if (arg === 'all' || !arg) {
  // Show all themes as hero screenshots
  for (const theme of themes) {
    heroScreenshot(theme);
  }
} else {
  console.log('Usage: npx tsx scripts/screenshot-themes.ts [theme|all|side-by-side|twitter]');
  console.log('Themes:', themes.join(', '));
}
