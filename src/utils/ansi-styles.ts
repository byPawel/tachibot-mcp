/**
 * ANSI Terminal Styling System with Multiple Themes
 *
 * Provides beautiful terminal output with named themes:
 * - nebula (default): Modern SaaS look, soft pastels on dark
 * - cyberpunk: High contrast neon on black
 * - minimal: Swiss typography, mostly monochrome
 * - ocean: Cool blues and teals
 *
 * Configure via: TACHIBOT_THEME=nebula|cyberpunk|minimal|ocean
 */

// Force colors BEFORE importing chalk (chalk reads env at import time)
process.env.FORCE_COLOR = '3';

import chalk from 'chalk';

// Also set chalk.level for good measure (belt and suspenders)
chalk.level = 3;

// In chalk v4, the type is chalk.Chalk (the interface describing chalk instances)
type ChalkInstance = chalk.Chalk;

// ============================================================================
// THEME TYPES
// ============================================================================

export type ThemeName = 'nebula' | 'cyberpunk' | 'minimal' | 'ocean';

export interface ModelBadgeStyle {
  bg: string;      // Background color
  fg: string;      // Foreground (text) color
  label: string;   // Display label
}

export interface Theme {
  name: ThemeName;
  description: string;

  // Model badges
  modelBadges: Record<string, ModelBadgeStyle>;

  // Header styles
  h1: ChalkInstance;
  h2: ChalkInstance;
  h3: ChalkInstance;
  h4: ChalkInstance;

  // Text styles
  bold: ChalkInstance;
  italic: ChalkInstance;
  code: ChalkInstance;
  link: ChalkInstance;
  blockquote: ChalkInstance;
  dim: ChalkInstance;

  // List bullets
  bullet1: string;
  bullet2: string;
  bullet3: string;

  // Status badges
  success: ChalkInstance;
  error: ChalkInstance;
  warning: ChalkInstance;
  info: ChalkInstance;

  // Dividers
  dividerThin: string;
  dividerThick: string;

  // Table characters
  tableChars: Record<string, string>;

  // Code block border
  codeBorder: ChalkInstance;
  codeBackground: ChalkInstance;
}

// ============================================================================
// THEME: NEBULA (Default - Modern SaaS)
// ============================================================================
// Inspired by VS Code, Linear, Vercel
// Soft pastels, desaturated colors, easy on the eyes

const nebulaTheme: Theme = {
  name: 'nebula',
  description: 'Modern SaaS look with soft pastels (default)',

  modelBadges: {
    // OpenAI - Emerald green (brand color)
    openai: { bg: 'bgGreen', fg: 'black', label: ' gpt-5.2 ' },
    'gpt-5.2': { bg: 'bgGreen', fg: 'black', label: ' gpt-5.2 ' },
    'gpt-5.2-pro': { bg: 'bgGreenBright', fg: 'black', label: ' gpt-5.2-pro ' },

    // Gemini - Google blue
    gemini: { bg: 'bgBlueBright', fg: 'black', label: ' gemini ' },
    'gemini-3-pro-preview': { bg: 'bgBlueBright', fg: 'black', label: ' gemini-3-pro ' },
    'gemini-3-flash-preview': { bg: 'bgCyanBright', fg: 'black', label: ' gemini-flash ' },

    // Grok - Magenta/purple
    grok: { bg: 'bgMagentaBright', fg: 'black', label: ' grok ' },
    'grok-4-1-fast-reasoning': { bg: 'bgMagentaBright', fg: 'black', label: ' grok-4.1 ' },
    'grok-4-1-fast-non-reasoning': { bg: 'bgMagenta', fg: 'black', label: ' grok-4.1-fast ' },
    'grok-code-fast-1': { bg: 'bgMagentaBright', fg: 'black', label: ' grok-code ' },

    // Perplexity - Teal (knowledge/search)
    perplexity: { bg: 'bgCyanBright', fg: 'black', label: ' perplexity ' },
    'sonar-pro': { bg: 'bgCyanBright', fg: 'black', label: ' perplexity ' },
    'sonar-reasoning-pro': { bg: 'bgCyan', fg: 'black', label: ' perplexity-reason ' },

    // Kimi - Yellow
    kimi: { bg: 'bgYellowBright', fg: 'black', label: ' kimi ' },
    'moonshotai/kimi-k2-thinking': { bg: 'bgYellowBright', fg: 'black', label: ' kimi-k2 ' },

    // Qwen - Alibaba orange/red
    qwen: { bg: 'bgRedBright', fg: 'black', label: ' qwen ' },
    'qwen/qwen3-coder-plus': { bg: 'bgRedBright', fg: 'black', label: ' qwen-coder ' },
    'qwen/qwen3-coder': { bg: 'bgRedBright', fg: 'black', label: ' qwen-coder ' },
    'qwen/qwq-32b': { bg: 'bgRed', fg: 'black', label: ' qwq-32b ' },

    // Tool modes
    focus: { bg: 'bgWhiteBright', fg: 'black', label: ' focus ' },
    workflow: { bg: 'bgWhiteBright', fg: 'black', label: ' workflow ' },
    scout: { bg: 'bgCyanBright', fg: 'black', label: ' scout ' },
    verifier: { bg: 'bgGreenBright', fg: 'black', label: ' verifier ' },
    challenger: { bg: 'bgRedBright', fg: 'black', label: ' challenger ' },
    think: { bg: 'bgWhite', fg: 'black', label: ' think ' },
  },

  // Headers - Background colored for visibility
  h1: chalk.bgHex('#5F87FF').black.bold,    // Blue bg, black text
  h2: chalk.bgHex('#5FAF5F').black.bold,    // Green bg, black text
  h3: chalk.bgHex('#FFAF5F').black.bold,    // Gold bg, black text
  h4: chalk.bgHex('#87AFD7').black.bold,    // Light blue bg, black text

  // Text
  bold: chalk.bold,
  italic: chalk.italic,
  code: chalk.bgGray.white,
  link: chalk.underline.hex('#5F87FF'),     // Soft blue
  blockquote: chalk.gray.italic,
  dim: chalk.hex('#666666'),

  // Bullets - Cyan, Yellow, Green
  bullet1: chalk.cyan('●'),
  bullet2: chalk.yellow('◆'),
  bullet3: chalk.green('▸'),

  // Status
  success: chalk.bgGreen.black,
  error: chalk.bgRed.white,
  warning: chalk.bgYellow.black,
  info: chalk.bgBlue.white,

  // Dividers
  dividerThin: chalk.gray('─'.repeat(60)),
  dividerThick: chalk.gray('━'.repeat(60)),

  // Tables - Rounded style
  tableChars: {
    'top': '─', 'top-mid': '┬', 'top-left': '╭', 'top-right': '╮',
    'bottom': '─', 'bottom-mid': '┴', 'bottom-left': '╰', 'bottom-right': '╯',
    'left': '│', 'left-mid': '├', 'mid': '─', 'mid-mid': '┼',
    'right': '│', 'right-mid': '┤', 'middle': '│',
  },

  codeBorder: chalk.gray,
  codeBackground: chalk.bgHex('#1C1C1C'),
};

// ============================================================================
// THEME: CYBERPUNK (High Contrast Neon)
// ============================================================================
// Bold neon colors, heavy borders, HUD-style

const cyberpunkTheme: Theme = {
  name: 'cyberpunk',
  description: 'High contrast neon on black - Blade Runner vibes',

  modelBadges: {
    // OpenAI - Electric green
    openai: { bg: 'bgGreenBright', fg: 'black', label: ' ⚡ GPT-5.2 ' },
    'gpt-5.2': { bg: 'bgGreenBright', fg: 'black', label: ' ⚡ GPT-5.2 ' },
    'gpt-5.2-pro': { bg: 'bgGreenBright', fg: 'black', label: ' ⚡ GPT-5.2-PRO ' },

    // Gemini - Electric blue
    gemini: { bg: 'bgBlueBright', fg: 'black', label: ' ◈ GEMINI ' },
    'gemini-3-pro-preview': { bg: 'bgBlueBright', fg: 'black', label: ' ◈ GEMINI-3 ' },
    'gemini-3-flash-preview': { bg: 'bgCyanBright', fg: 'black', label: ' ◈ GEMINI-FLASH ' },

    // Grok - Hot magenta
    grok: { bg: 'bgMagentaBright', fg: 'black', label: ' ✦ GROK ' },
    'grok-4-1-fast-reasoning': { bg: 'bgMagentaBright', fg: 'black', label: ' ✦ GROK-4.1 ' },
    'grok-4-1-fast-non-reasoning': { bg: 'bgMagenta', fg: 'white', label: ' ✦ GROK-FAST ' },
    'grok-code-fast-1': { bg: 'bgMagentaBright', fg: 'black', label: ' ✦ GROK-CODE ' },

    // Perplexity - Cyan neon
    perplexity: { bg: 'bgCyanBright', fg: 'black', label: ' ◉ PERPLEXITY ' },
    'sonar-pro': { bg: 'bgCyanBright', fg: 'black', label: ' ◉ SONAR ' },
    'sonar-reasoning-pro': { bg: 'bgCyan', fg: 'white', label: ' ◉ SONAR-REASON ' },

    // Kimi - Yellow/gold
    kimi: { bg: 'bgYellowBright', fg: 'black', label: ' ★ KIMI ' },
    'moonshotai/kimi-k2-thinking': { bg: 'bgYellowBright', fg: 'black', label: ' ★ KIMI-K2 ' },

    // Qwen - Red hot
    qwen: { bg: 'bgRedBright', fg: 'black', label: ' ◆ QWEN ' },
    'qwen/qwen3-coder-plus': { bg: 'bgRedBright', fg: 'black', label: ' ◆ QWEN-CODER ' },
    'qwen/qwen3-coder': { bg: 'bgRed', fg: 'white', label: ' ◆ QWEN ' },
    'qwen/qwq-32b': { bg: 'bgRedBright', fg: 'black', label: ' ◆ QWQ-32B ' },

    // Tool modes
    focus: { bg: 'bgWhiteBright', fg: 'black', label: ' ▶ FOCUS ' },
    workflow: { bg: 'bgWhite', fg: 'black', label: ' ▶ WORKFLOW ' },
    scout: { bg: 'bgCyanBright', fg: 'black', label: ' ▶ SCOUT ' },
    verifier: { bg: 'bgGreenBright', fg: 'black', label: ' ▶ VERIFIER ' },
    challenger: { bg: 'bgRedBright', fg: 'black', label: ' ▶ CHALLENGER ' },
    think: { bg: 'bgGray', fg: 'whiteBright', label: ' ▶ THINK ' },
  },

  // Headers - Neon colors
  h1: chalk.bold.underline.magentaBright,
  h2: chalk.bold.cyanBright,
  h3: chalk.bold.yellowBright,
  h4: chalk.bold.whiteBright,

  // Text
  bold: chalk.bold.whiteBright,
  italic: chalk.italic.white,
  code: chalk.bgBlack.greenBright,
  link: chalk.underline.cyanBright,
  blockquote: chalk.magenta.italic,
  dim: chalk.gray,

  // Bullets - Neon symbols
  bullet1: chalk.magentaBright('▸'),
  bullet2: chalk.cyanBright('▹'),
  bullet3: chalk.yellowBright('▪'),

  // Status
  success: chalk.bgGreenBright.black,
  error: chalk.bgRedBright.black,
  warning: chalk.bgYellowBright.black,
  info: chalk.bgCyanBright.black,

  // Dividers
  dividerThin: chalk.magentaBright('═'.repeat(60)),
  dividerThick: chalk.cyanBright('█'.repeat(60)),

  // Tables - Double line (heavy)
  tableChars: {
    'top': '═', 'top-mid': '╤', 'top-left': '╔', 'top-right': '╗',
    'bottom': '═', 'bottom-mid': '╧', 'bottom-left': '╚', 'bottom-right': '╝',
    'left': '║', 'left-mid': '╟', 'mid': '─', 'mid-mid': '┼',
    'right': '║', 'right-mid': '╢', 'middle': '│',
  },

  codeBorder: chalk.magentaBright,
  codeBackground: chalk.bgBlack,
};

// ============================================================================
// THEME: MINIMAL (Swiss Typography)
// ============================================================================
// Mostly monochrome, color only for badges

const minimalTheme: Theme = {
  name: 'minimal',
  description: 'Clean Swiss typography, minimal color usage',

  modelBadges: {
    // All badges are simple, dark bg with white text
    openai: { bg: 'bgBlack', fg: 'green', label: ' gpt-5.2 ' },
    'gpt-5.2': { bg: 'bgBlack', fg: 'green', label: ' gpt-5.2 ' },
    'gpt-5.2-pro': { bg: 'bgBlack', fg: 'greenBright', label: ' gpt-5.2-pro ' },

    gemini: { bg: 'bgBlack', fg: 'blue', label: ' gemini ' },
    'gemini-3-pro-preview': { bg: 'bgBlack', fg: 'blue', label: ' gemini-3 ' },
    'gemini-3-flash-preview': { bg: 'bgBlack', fg: 'blueBright', label: ' gemini-flash ' },

    grok: { bg: 'bgBlack', fg: 'magenta', label: ' grok ' },
    'grok-4-1-fast-reasoning': { bg: 'bgBlack', fg: 'magenta', label: ' grok-4.1 ' },
    'grok-4-1-fast-non-reasoning': { bg: 'bgBlack', fg: 'magentaBright', label: ' grok-fast ' },
    'grok-code-fast-1': { bg: 'bgBlack', fg: 'magenta', label: ' grok-code ' },

    perplexity: { bg: 'bgBlack', fg: 'cyan', label: ' perplexity ' },
    'sonar-pro': { bg: 'bgBlack', fg: 'cyan', label: ' perplexity ' },
    'sonar-reasoning-pro': { bg: 'bgBlack', fg: 'cyanBright', label: ' perplexity-reason ' },

    kimi: { bg: 'bgBlack', fg: 'yellow', label: ' kimi ' },
    'moonshotai/kimi-k2-thinking': { bg: 'bgBlack', fg: 'yellow', label: ' kimi-k2 ' },

    qwen: { bg: 'bgBlack', fg: 'red', label: ' qwen ' },
    'qwen/qwen3-coder-plus': { bg: 'bgBlack', fg: 'red', label: ' qwen-coder ' },
    'qwen/qwen3-coder': { bg: 'bgBlack', fg: 'red', label: ' qwen ' },
    'qwen/qwq-32b': { bg: 'bgBlack', fg: 'redBright', label: ' qwq-32b ' },

    focus: { bg: 'bgBlack', fg: 'white', label: ' focus ' },
    workflow: { bg: 'bgBlack', fg: 'white', label: ' workflow ' },
    scout: { bg: 'bgBlack', fg: 'cyan', label: ' scout ' },
    verifier: { bg: 'bgBlack', fg: 'green', label: ' verifier ' },
    challenger: { bg: 'bgBlack', fg: 'red', label: ' challenger ' },
    think: { bg: 'bgBlack', fg: 'gray', label: ' think ' },
  },

  // Headers - Monochrome hierarchy
  h1: chalk.bold.underline.white,
  h2: chalk.bold.white,
  h3: chalk.italic.white,
  h4: chalk.gray,

  // Text
  bold: chalk.bold,
  italic: chalk.italic,
  code: chalk.inverse,
  link: chalk.underline,
  blockquote: chalk.gray.italic,
  dim: chalk.gray,

  // Bullets - Simple
  bullet1: chalk.white('•'),
  bullet2: chalk.gray('◦'),
  bullet3: chalk.gray('-'),

  // Status
  success: chalk.green,
  error: chalk.red,
  warning: chalk.yellow,
  info: chalk.blue,

  // Dividers
  dividerThin: chalk.gray('─'.repeat(40)),
  dividerThick: chalk.white('─'.repeat(40)),

  // Tables - Simple single line
  tableChars: {
    'top': '─', 'top-mid': '─', 'top-left': ' ', 'top-right': ' ',
    'bottom': '─', 'bottom-mid': '─', 'bottom-left': ' ', 'bottom-right': ' ',
    'left': ' ', 'left-mid': ' ', 'mid': '─', 'mid-mid': '─',
    'right': ' ', 'right-mid': ' ', 'middle': ' ',
  },

  codeBorder: chalk.gray,
  codeBackground: chalk.reset,
};

// ============================================================================
// THEME: OCEAN (Cool Blues)
// ============================================================================
// Calming blue palette, professional look

const oceanTheme: Theme = {
  name: 'ocean',
  description: 'Cool blues and teals - calm and professional',

  modelBadges: {
    openai: { bg: 'bgGreen', fg: 'black', label: ' gpt-5.2 ' },
    'gpt-5.2': { bg: 'bgGreen', fg: 'black', label: ' gpt-5.2 ' },
    'gpt-5.2-pro': { bg: 'bgGreenBright', fg: 'black', label: ' gpt-5.2-pro ' },

    gemini: { bg: 'bgBlueBright', fg: 'black', label: ' gemini ' },
    'gemini-3-pro-preview': { bg: 'bgBlueBright', fg: 'black', label: ' gemini-3 ' },
    'gemini-3-flash-preview': { bg: 'bgBlue', fg: 'white', label: ' gemini-flash ' },

    grok: { bg: 'bgMagenta', fg: 'white', label: ' grok ' },
    'grok-4-1-fast-reasoning': { bg: 'bgMagenta', fg: 'white', label: ' grok-4.1 ' },
    'grok-4-1-fast-non-reasoning': { bg: 'bgMagentaBright', fg: 'black', label: ' grok-fast ' },
    'grok-code-fast-1': { bg: 'bgMagenta', fg: 'white', label: ' grok-code ' },

    perplexity: { bg: 'bgCyan', fg: 'black', label: ' perplexity ' },
    'sonar-pro': { bg: 'bgCyan', fg: 'black', label: ' perplexity ' },
    'sonar-reasoning-pro': { bg: 'bgCyanBright', fg: 'black', label: ' perplexity-reason ' },

    kimi: { bg: 'bgYellow', fg: 'black', label: ' kimi ' },
    'moonshotai/kimi-k2-thinking': { bg: 'bgYellow', fg: 'black', label: ' kimi-k2 ' },

    qwen: { bg: 'bgRed', fg: 'white', label: ' qwen ' },
    'qwen/qwen3-coder-plus': { bg: 'bgRed', fg: 'white', label: ' qwen-coder ' },
    'qwen/qwen3-coder': { bg: 'bgRed', fg: 'white', label: ' qwen ' },
    'qwen/qwq-32b': { bg: 'bgRedBright', fg: 'black', label: ' qwq-32b ' },

    focus: { bg: 'bgWhite', fg: 'blue', label: ' focus ' },
    workflow: { bg: 'bgWhite', fg: 'blue', label: ' workflow ' },
    scout: { bg: 'bgCyan', fg: 'black', label: ' scout ' },
    verifier: { bg: 'bgGreen', fg: 'black', label: ' verifier ' },
    challenger: { bg: 'bgRed', fg: 'white', label: ' challenger ' },
    think: { bg: 'bgBlue', fg: 'white', label: ' think ' },
  },

  // Headers - Blue tones
  h1: chalk.bold.underline.cyanBright,
  h2: chalk.bold.blueBright,
  h3: chalk.bold.cyan,
  h4: chalk.bold.blue,

  // Text
  bold: chalk.bold,
  italic: chalk.italic,
  code: chalk.bgBlue.white,
  link: chalk.underline.cyanBright,
  blockquote: chalk.cyan.italic,
  dim: chalk.hex('#4A6FA5'),

  // Bullets
  bullet1: chalk.cyanBright('●'),
  bullet2: chalk.blueBright('◆'),
  bullet3: chalk.cyan('▸'),

  // Status
  success: chalk.bgGreen.black,
  error: chalk.bgRed.white,
  warning: chalk.bgYellow.black,
  info: chalk.bgCyanBright.black,

  // Dividers
  dividerThin: chalk.cyan('~'.repeat(60)),
  dividerThick: chalk.blueBright('═'.repeat(60)),

  // Tables - Single line
  tableChars: {
    'top': '─', 'top-mid': '┬', 'top-left': '┌', 'top-right': '┐',
    'bottom': '─', 'bottom-mid': '┴', 'bottom-left': '└', 'bottom-right': '┘',
    'left': '│', 'left-mid': '├', 'mid': '─', 'mid-mid': '┼',
    'right': '│', 'right-mid': '┤', 'middle': '│',
  },

  codeBorder: chalk.blue,
  codeBackground: chalk.bgHex('#0D1B2A'),
};

// ============================================================================
// THEME REGISTRY
// ============================================================================

export const themes: Record<ThemeName, Theme> = {
  nebula: nebulaTheme,
  cyberpunk: cyberpunkTheme,
  minimal: minimalTheme,
  ocean: oceanTheme,
};

// ============================================================================
// THEME SELECTION
// ============================================================================

// Import JSON theme loader
import { loadJsonTheme, hasJsonTheme, applyJsonTheme, listJsonThemes } from './theme-loader.js';

/**
 * Get current theme from environment
 * Checks for JSON themes first, then falls back to built-in themes.
 * Default: 'nebula'
 */
export function getTheme(): Theme {
  const themeName = process.env.TACHIBOT_THEME?.toLowerCase() || 'nebula';

  // Check for custom JSON theme first
  if (hasJsonTheme(themeName)) {
    const jsonTheme = loadJsonTheme(themeName);
    if (jsonTheme) {
      // Get base theme to extend
      const baseThemeName = (jsonTheme.extends || 'nebula') as ThemeName;
      const baseTheme = themes[baseThemeName] || themes.nebula;
      return applyJsonTheme(jsonTheme, baseTheme) as Theme;
    }
  }

  // Fall back to built-in themes
  return themes[themeName as ThemeName] || themes.nebula;
}

/**
 * Get theme by name
 */
export function getThemeByName(name: string): Theme {
  // Check for custom JSON theme first
  if (hasJsonTheme(name)) {
    const jsonTheme = loadJsonTheme(name);
    if (jsonTheme) {
      const baseThemeName = (jsonTheme.extends || 'nebula') as ThemeName;
      const baseTheme = themes[baseThemeName] || themes.nebula;
      return applyJsonTheme(jsonTheme, baseTheme) as Theme;
    }
  }

  return themes[name as ThemeName] || themes.nebula;
}

/**
 * List all available themes (built-in + JSON)
 */
export function listAllThemes(): string[] {
  const builtIn = Object.keys(themes);
  const custom = listJsonThemes();
  return [...new Set([...builtIn, ...custom])];
}

// ============================================================================
// BADGE HELPERS
// ============================================================================

// Raw ANSI escape codes - bypass chalk entirely for reliability
const ANSI = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  // Foreground colors
  black: '\x1b[30m',
  white: '\x1b[37m',
  whiteBright: '\x1b[97m',
  // Background colors
  bgRed: '\x1b[41m',
  bgGreen: '\x1b[42m',
  bgYellow: '\x1b[43m',
  bgBlue: '\x1b[44m',
  bgMagenta: '\x1b[45m',
  bgCyan: '\x1b[46m',
  bgGray: '\x1b[100m',
  bgWhite: '\x1b[47m',
  bgRedBright: '\x1b[101m',
  bgGreenBright: '\x1b[102m',
  bgYellowBright: '\x1b[103m',
  bgBlueBright: '\x1b[104m',
  bgMagentaBright: '\x1b[105m',
  bgCyanBright: '\x1b[106m',
};

// Map theme bg/fg names to raw ANSI codes
const bgMap: Record<string, string> = {
  bgBlack: '\x1b[40m', bgRed: ANSI.bgRed, bgGreen: ANSI.bgGreen, bgYellow: ANSI.bgYellow,
  bgBlue: ANSI.bgBlue, bgMagenta: ANSI.bgMagenta, bgCyan: ANSI.bgCyan,
  bgGray: ANSI.bgGray, bgWhite: ANSI.bgWhite, bgWhiteBright: '\x1b[107m',
  bgRedBright: ANSI.bgRedBright, bgGreenBright: ANSI.bgGreenBright,
  bgYellowBright: ANSI.bgYellowBright, bgBlueBright: ANSI.bgBlueBright,
  bgMagentaBright: ANSI.bgMagentaBright, bgCyanBright: ANSI.bgCyanBright,
};
const fgMap: Record<string, string> = {
  black: ANSI.black, white: ANSI.white, whiteBright: ANSI.whiteBright,
  // Additional foreground colors for minimal theme
  red: '\x1b[31m', green: '\x1b[32m', yellow: '\x1b[33m',
  blue: '\x1b[34m', magenta: '\x1b[35m', cyan: '\x1b[36m', gray: '\x1b[90m',
  redBright: '\x1b[91m', greenBright: '\x1b[92m', yellowBright: '\x1b[93m',
  blueBright: '\x1b[94m', magentaBright: '\x1b[95m', cyanBright: '\x1b[96m',
};

// Unicode colored emoji for badges (ANSI-free, works everywhere)
const MODEL_EMOJI: Record<string, string> = {
  grok: '🟣',      // purple
  gemini: '🔵',    // blue
  openai: '🟢',    // green
  perplexity: '🔷', // cyan diamond
  kimi: '🟡',      // yellow
  qwen: '🔴',      // red
  focus: '⚪',
  workflow: '⬜',
  scout: '🔍',
  verifier: '✅',
  challenger: '⚔️',
  think: '💭',
};

/**
 * Render a model badge with ANSI background color
 */
export function renderModelBadge(model: string, theme?: Theme): string {
  const t = theme || getTheme();
  const normalized = model.toLowerCase().trim();

  // Find badge style in theme
  let badgeStyle: ModelBadgeStyle | undefined;
  for (const [key, style] of Object.entries(t.modelBadges)) {
    if (normalized.includes(key) || key.includes(normalized)) {
      badgeStyle = style;
      break;
    }
  }

  // Fallback to gray badge
  if (!badgeStyle) {
    badgeStyle = { bg: 'bgGray', fg: 'white', label: ` ${normalized} ` };
  }

  // Build ANSI badge using raw codes for reliability
  const bg = bgMap[badgeStyle.bg] || ANSI.bgGray;
  const fg = fgMap[badgeStyle.fg] || ANSI.white;
  const label = badgeStyle.label || ` ${normalized} `;

  return `${bg}${fg}${ANSI.bold}${label}${ANSI.reset}`;
}

/**
 * Get model badge (alias for backward compatibility)
 */
export function getModelBadge(model: string): string {
  return renderModelBadge(model);
}

/**
 * Create a custom badge
 */
export function badge(
  text: string,
  bgColor: keyof typeof chalk = 'bgBlue',
  fgColor: 'black' | 'white' = 'white'
): string {
  const bg = (chalk as any)[bgColor] || chalk.bgBlue;
  return fgColor === 'black' ? bg.black(` ${text} `) : bg.white(` ${text} `);
}

// ============================================================================
// LEGACY EXPORTS (backward compatibility)
// ============================================================================

export const headerStyles = {
  get h1() { return getTheme().h1; },
  get h2() { return getTheme().h2; },
  get h3() { return getTheme().h3; },
  get h4() { return getTheme().h4; },
};

export const textStyles = {
  get bold() { return getTheme().bold; },
  get italic() { return getTheme().italic; },
  get code() { return getTheme().code; },
  get link() { return getTheme().link; },
  get blockquote() { return getTheme().blockquote; },
};

export const bullets = {
  get level1() { return getTheme().bullet1; },
  get level2() { return getTheme().bullet2; },
  get level3() { return getTheme().bullet3; },
  ordered: (n: number) => chalk.cyan(`${n}.`),
};

export const dividers = {
  get thin() { return getTheme().dividerThin; },
  get thick() { return getTheme().dividerThick; },
  get double() { return chalk.gray('═'.repeat(60)); },
  get dotted() { return chalk.gray('┈'.repeat(60)); },
  get dashed() { return chalk.gray('┄'.repeat(60)); },
  get wave() { return chalk.cyan('﹏'.repeat(30)); },
  get stars() { return chalk.yellow('✦ ✧ '.repeat(15)); },
  get dots() { return chalk.gray('· · · '.repeat(20)); },
};

// ============================================================================
// GRADIENT DIVIDERS (256-color)
// ============================================================================

/**
 * Create a gradient divider using 256 colors
 */
export function gradientDivider(
  fromColor: number,
  toColor: number,
  char: string = '─',
  width: number = 60
): string {
  let result = '';
  for (let i = 0; i < width; i++) {
    const colorCode = Math.round(fromColor + ((toColor - fromColor) * (i / width)));
    result += chalk.ansi256(colorCode)(char);
  }
  return result;
}

export const gradients = {
  /** Blue to purple gradient (nebula theme) */
  blueToPurple: (width = 60) => gradientDivider(69, 141, '─', width),
  /** Cyan to magenta gradient (cyberpunk theme) */
  cyanToMagenta: (width = 60) => gradientDivider(51, 201, '═', width),
  /** Green to yellow gradient */
  greenToYellow: (width = 60) => gradientDivider(42, 226, '─', width),
  /** Ocean gradient (blue shades) */
  ocean: (width = 60) => gradientDivider(24, 39, '∙', width),
  /** Sunset gradient (red to orange) */
  sunset: (width = 60) => gradientDivider(196, 214, '━', width),
  /** Rainbow using fixed color stops */
  rainbow: (width = 60) => {
    const colors = [196, 208, 226, 46, 51, 57, 201]; // ROYGBIV
    let result = '';
    for (let i = 0; i < width; i++) {
      const colorIndex = Math.floor((i / width) * colors.length);
      result += chalk.ansi256(colors[colorIndex])('━');
    }
    return result;
  },
};

// ============================================================================
// BOXED SECTION HEADERS
// ============================================================================

/**
 * Create a boxed section header: ╭─ Title ─╮
 */
export function boxedHeader(
  title: string,
  options: {
    width?: number;
    style?: 'rounded' | 'sharp' | 'double';
    color?: chalk.Chalk;
  } = {}
): string {
  const { width = 50, style = 'rounded', color = chalk.cyan } = options;
  const theme = getTheme();

  const chars = {
    rounded: { tl: '╭', tr: '╮', bl: '╰', br: '╯', h: '─', v: '│' },
    sharp: { tl: '┌', tr: '┐', bl: '└', br: '┘', h: '─', v: '│' },
    double: { tl: '╔', tr: '╗', bl: '╚', br: '╝', h: '═', v: '║' },
  }[style];

  const innerWidth = width - 2;
  const titleLen = title.length + 2; // space padding
  const leftPad = Math.floor((innerWidth - titleLen) / 2);
  const rightPad = innerWidth - titleLen - leftPad;

  const topLine = color(
    chars.tl + chars.h.repeat(leftPad) + ' '
  ) + theme.bold(title) + color(
    ' ' + chars.h.repeat(rightPad) + chars.tr
  );

  return topLine;
}

/**
 * Create a full box around content
 */
export function boxSection(
  title: string,
  content: string,
  options: {
    width?: number;
    style?: 'rounded' | 'sharp' | 'double';
    color?: chalk.Chalk;
  } = {}
): string {
  const { width = 50, style = 'rounded', color = chalk.cyan } = options;
  const theme = getTheme();

  const chars = {
    rounded: { tl: '╭', tr: '╮', bl: '╰', br: '╯', h: '─', v: '│' },
    sharp: { tl: '┌', tr: '┐', bl: '└', br: '┘', h: '─', v: '│' },
    double: { tl: '╔', tr: '╗', bl: '╚', br: '╝', h: '═', v: '║' },
  }[style];

  const innerWidth = width - 4;
  const titleLen = title.length + 2;
  const leftPad = Math.floor((innerWidth - titleLen) / 2);
  const rightPad = innerWidth - titleLen - leftPad;

  const lines: string[] = [];

  // Top border with title
  lines.push(color(
    chars.tl + chars.h.repeat(leftPad + 1) + ' '
  ) + theme.bold(title) + color(
    ' ' + chars.h.repeat(rightPad + 1) + chars.tr
  ));

  // Content lines
  const contentLines = content.split('\n');
  for (const line of contentLines) {
    const paddedLine = line.padEnd(innerWidth);
    lines.push(color(chars.v + ' ') + paddedLine + color(' ' + chars.v));
  }

  // Bottom border
  lines.push(color(chars.bl + chars.h.repeat(width - 2) + chars.br));

  return lines.join('\n');
}

// ============================================================================
// DECORATIVE SEPARATORS
// ============================================================================

export const decorative = {
  /** Starfield separator */
  starfield: (width = 60) => {
    const stars = ['✦', '✧', '★', '☆', '·'];
    let result = '';
    for (let i = 0; i < width; i++) {
      const star = stars[Math.floor(Math.random() * stars.length)];
      result += chalk.ansi256(141 + Math.floor(Math.random() * 30))(star);
    }
    return result;
  },

  /** Circuit pattern (cyberpunk) */
  circuit: chalk.cyan('─┬──┴─┬──┴─┬──┴─┬──┴─┬──┴─┬──┴─┬──┴─'),

  /** Wave pattern (ocean) */
  waves: chalk.blue('≋≋≋≋≋≋≋≋≋≋≋≋≋≋≋≋≋≋≋≋≋≋≋≋≋≋≋≋≋≋'),

  /** Sparkles */
  sparkles: chalk.yellow('✨ ✨ ✨ ✨ ✨ ✨ ✨ ✨ ✨ ✨'),

  /** Arrows */
  arrows: chalk.cyan('→ → → → → → → → → → → → → → →'),

  /** Chevrons */
  chevrons: chalk.magenta('» » » » » » » » » » » » » » »'),

  /** Diamond chain */
  diamonds: chalk.cyan('◆ ◇ ◆ ◇ ◆ ◇ ◆ ◇ ◆ ◇ ◆ ◇ ◆ ◇ ◆'),

  /** Fade dots */
  fadeDots: chalk.gray('·  ·  ·  ·  ·  ·  ·  ·  ·  ·  ·'),
};

export const tableChars = {
  get double() { return themes.cyberpunk.tableChars; },
  get single() { return themes.ocean.tableChars; },
  get rounded() { return themes.nebula.tableChars; },
};

// Re-export modelBadges for backward compatibility
export const modelBadges = nebulaTheme.modelBadges;

// ============================================================================
// SYNTAX HIGHLIGHTING THEME
// ============================================================================

export const syntaxTheme = {
  keyword: chalk.magenta,
  string: chalk.green,
  number: chalk.cyan,
  comment: chalk.gray.italic,
  function: chalk.yellow,
  variable: chalk.blue,
  operator: chalk.white,
  punctuation: chalk.gray,
  className: chalk.cyan.bold,
  property: chalk.blue,
  boolean: chalk.cyan,
  null: chalk.gray,
};

// ============================================================================
// PROGRESS BAR (Braille with Gradient)
// ============================================================================

export const progressChars = {
  // Braille characters for smoother progress bars
  filled: '⣿',
  empty: '⣿',  // Same char, different color for dark background
  // Braille partial fill patterns (8 levels of fill)
  partial: ['⠀', '⡀', '⡄', '⡆', '⡇', '⣇', '⣧', '⣷'],
};

// Gradient colors for progress bar fill
const progressGradientColors = [
  '#22C55E', // Green
  '#34D399', // Emerald
  '#22D3EE', // Cyan
];

/**
 * Apply gradient colors to a string of characters
 */
function applyGradient(text: string, colors: string[]): string {
  if (text.length === 0) return '';
  const result: string[] = [];
  for (let i = 0; i < text.length; i++) {
    const colorIdx = Math.floor((i / text.length) * colors.length);
    const color = colors[Math.min(colorIdx, colors.length - 1)];
    result.push(chalk.hex(color)(text[i]));
  }
  return result.join('');
}

export function progressBar(percent: number, width: number = 20): string {
  const clamped = Math.max(0, Math.min(100, percent));
  const filled = Math.round((clamped / 100) * width);
  const empty = width - filled;

  const filledBar = progressChars.filled.repeat(filled);
  const emptyBar = progressChars.empty.repeat(empty);
  const darkColor = chalk.hex('#374151');  // Dark gray for empty portion

  // Apply gradient to filled portion
  const gradientFilled = applyGradient(filledBar, progressGradientColors);

  return `[${gradientFilled}${darkColor(emptyBar)}]` + chalk.gray(` ${clamped}%`);
}

// ============================================================================
// STYLIZED HELPERS (Scores, Stats, etc.)
// ============================================================================

/**
 * Render a score with color coding (e.g., "3/10" or "9/10")
 * Low scores = red, medium = yellow, high = green
 */
export function score(value: number, max: number = 10): string {
  const percent = (value / max) * 100;
  const color = percent < 40 ? chalk.red : percent < 70 ? chalk.yellow : chalk.green;
  return chalk.bold(color(`${value}`)) + chalk.gray(`/${max}`);
}

/**
 * Render a score with improvement arrow (e.g., "3/10 → 9/10")
 */
export function scoreImprovement(from: number, to: number, max: number = 10): string {
  const fromScore = score(from, max);
  const toScore = score(to, max);
  const arrow = from < to ? chalk.greenBright(' → ') : chalk.redBright(' → ');
  return fromScore + arrow + toScore;
}

/**
 * Render a percentage with color coding
 */
export function percentage(value: number): string {
  const clamped = Math.max(0, Math.min(100, value));
  const color = clamped < 33 ? chalk.red : clamped < 66 ? chalk.yellow : chalk.green;
  return color.bold(`${clamped}%`);
}

/**
 * Render a label with value (e.g., "Tokens: 1,234")
 */
export function labelValue(label: string, value: string | number): string {
  return chalk.gray(`${label}: `) + chalk.white.bold(`${value}`);
}

/**
 * Render a key-value pair inline (e.g., "model=gpt-5.2")
 */
export function keyValue(key: string, value: string): string {
  return chalk.cyan(key) + chalk.gray('=') + chalk.white(value);
}

/**
 * Render a timestamp
 */
export function timestamp(date?: Date): string {
  const d = date || new Date();
  const time = d.toLocaleTimeString('en-US', { hour12: false });
  return chalk.gray(`[${time}]`);
}

/**
 * Render duration (e.g., "1.2s" or "45ms")
 */
export function duration(ms: number): string {
  if (ms < 1000) {
    return chalk.cyan(`${ms}ms`);
  }
  const seconds = (ms / 1000).toFixed(1);
  const color = ms < 5000 ? chalk.green : ms < 15000 ? chalk.yellow : chalk.red;
  return color(`${seconds}s`);
}

/**
 * Render a cost (e.g., "$0.0045")
 */
export function cost(amount: number): string {
  const color = amount < 0.01 ? chalk.green : amount < 0.10 ? chalk.yellow : chalk.red;
  return color(`$${amount.toFixed(4)}`);
}

/**
 * Render tokens count with formatting
 */
export function tokens(count: number): string {
  const formatted = count.toLocaleString();
  const color = count < 1000 ? chalk.green : count < 5000 ? chalk.yellow : chalk.cyan;
  return color(`${formatted} tokens`);
}

/**
 * Render a highlighted keyword/term
 */
export function highlight(text: string): string {
  return chalk.bgYellow.black(` ${text} `);
}

/**
 * Render inline code
 */
export function inlineCode(text: string): string {
  return chalk.bgGray.white(` ${text} `);
}

/**
 * Render a file path
 */
export function filePath(path: string): string {
  return chalk.cyan.underline(path);
}

/**
 * Render a URL/link
 */
export function link(url: string, text?: string): string {
  const displayText = text || url;
  // OSC 8 hyperlink for supported terminals
  const supportsHyperlinks =
    process.env.TERM_PROGRAM === 'iTerm.app' ||
    process.env.TERM_PROGRAM === 'WezTerm' ||
    process.env.TERM === 'xterm-kitty';

  if (supportsHyperlinks) {
    return `\x1b]8;;${url}\x07${chalk.blue.underline(displayText)}\x1b]8;;\x07`;
  }
  return chalk.blue.underline(displayText);
}

/**
 * Render a warning message
 */
export function warning(text: string): string {
  return chalk.bgYellow.black(' ⚠ ') + chalk.yellow(` ${text}`);
}

/**
 * Render an error message
 */
export function error(text: string): string {
  return chalk.bgRed.white(' ✗ ') + chalk.red(` ${text}`);
}

/**
 * Render a success message
 */
export function success(text: string): string {
  return chalk.bgGreen.black(' ✓ ') + chalk.green(` ${text}`);
}

/**
 * Render an info message
 */
export function info(text: string): string {
  return chalk.bgBlue.white(' ℹ ') + chalk.blue(` ${text}`);
}

/**
 * Render a debug message
 */
export function debug(text: string): string {
  return chalk.bgMagenta.white(' 🔍 ') + chalk.magenta(` ${text}`);
}

/**
 * Render a section header with divider
 */
export function sectionHeader(title: string): string {
  const theme = getTheme();
  return `\n${theme.h2(title)}\n${theme.dividerThin}\n`;
}

/**
 * Render a model response header
 */
export function modelHeader(model: string, extra?: string): string {
  const badge = renderModelBadge(model);
  const extraText = extra ? chalk.gray(` ${extra}`) : '';
  return `${badge}${extraText}\n`;
}

// ============================================================================
// COMPOSITE HELPERS
// ============================================================================

/**
 * Render a complete tool result header
 * Example: " grok-4.1  Completed in 2.3s | 1,234 tokens | $0.0012"
 */
export function toolResultHeader(opts: {
  model: string;
  durationMs?: number;
  tokenCount?: number;
  costAmount?: number;
}): string {
  const parts = [renderModelBadge(opts.model)];

  if (opts.durationMs !== undefined) {
    parts.push(duration(opts.durationMs));
  }
  if (opts.tokenCount !== undefined) {
    parts.push(tokens(opts.tokenCount));
  }
  if (opts.costAmount !== undefined) {
    parts.push(cost(opts.costAmount));
  }

  return parts.join(chalk.gray(' | ')) + '\n';
}

/**
 * Render a code review score summary
 * Example: "Score: 3/10 → 9/10 with fixes"
 */
export function reviewScore(current: number, potential?: number, max: number = 10): string {
  if (potential !== undefined) {
    return chalk.bold('Score: ') + scoreImprovement(current, potential, max) + chalk.gray(' with fixes');
  }
  return chalk.bold('Score: ') + score(current, max);
}
