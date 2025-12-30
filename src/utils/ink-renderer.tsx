/**
 * Ink-to-String Renderer for TachiBot MCP
 *
 * Uses React Ink as a layout engine to generate complex ANSI layouts,
 * then captures the output as a string for MCP tool responses.
 *
 * Key insight: MCP uses stdout for JSON-RPC, so we can't run live Ink there.
 * Instead, we render Ink components to a virtual stream and capture the output.
 */

// Import color setup FIRST (sets FORCE_COLOR before other imports)
import './color-setup.js';

import React from 'react';
import { render, Box, Text } from 'ink';
import Gradient from 'ink-gradient';
import Spinner from 'ink-spinner';
import BigText from 'ink-big-text';
import gradientString from 'gradient-string';
import { PassThrough } from 'stream';
import { loadJsonTheme, listJsonThemes } from './theme-loader.js';

// Table types
type Scalar = string | number | boolean | null | undefined;
type ScalarDict = { [key: string]: Scalar };

// ============================================================================
// THEME-BASED GRADIENTS
// ============================================================================

/**
 * Get gradient colors from a theme
 * Returns array of hex colors suitable for gradient-string
 */
export function getThemeGradient(themeName: string): string[] | null {
  const theme = loadJsonTheme(themeName);
  if (!theme?.colors) return null;

  const colors: string[] = [];
  const c = theme.colors;

  // Extract colors from theme in a nice gradient order
  if (c.bullet1) colors.push(c.bullet1);
  if (c.h1?.fg) colors.push(c.h1.fg);
  if (c.bullet2) colors.push(c.bullet2);
  if (c.h2?.fg) colors.push(c.h2.fg);
  if (c.bullet3) colors.push(c.bullet3);
  if (c.link) colors.push(c.link);

  // Need at least 2 colors for a gradient
  return colors.length >= 2 ? colors : null;
}

/**
 * Get all theme-based gradient presets
 */
export function getThemeGradients(): Record<string, string[]> {
  const themes = listJsonThemes();
  const gradients: Record<string, string[]> = {};

  for (const themeName of themes) {
    const colors = getThemeGradient(themeName);
    if (colors) {
      gradients[themeName] = colors;
    }
  }

  return gradients;
}

/**
 * Create a gradient function from theme colors
 */
export function createThemeGradient(themeName: string): ((text: string) => string) | null {
  const colors = getThemeGradient(themeName);
  if (!colors) return null;
  return gradientString(colors);
}

// Gradient name type for ink-gradient
type GradientName = 'cristal' | 'passion' | 'teen' | 'mind' | 'fruit' | 'atlas' | 'morning' | 'rainbow' | 'pastel' | 'vice' | 'instagram' | 'retro' | 'summer';

// ============================================================================
// TERMINAL ICONS (Lucide/Shadcn equivalents using Unicode)
// ============================================================================

/**
 * Terminal-safe icon mappings inspired by Lucide/Shadcn
 * Uses Unicode symbols that render in most terminals
 */
export const icons = {
  // Status
  check: '✓',
  checkCircle: '✔',
  x: '✗',
  xCircle: '✘',
  alertCircle: '⚠',
  alertTriangle: '△',
  info: 'ℹ',
  helpCircle: '?',

  // Arrows
  arrowRight: '→',
  arrowLeft: '←',
  arrowUp: '↑',
  arrowDown: '↓',
  chevronRight: '›',
  chevronLeft: '‹',
  chevronUp: '˄',
  chevronDown: '˅',

  // Actions
  play: '▶',
  pause: '‖',
  stop: '■',
  refresh: '↻',
  reload: '⟳',
  search: '⌕',
  zap: '⚡',
  sparkles: '✦',

  // Objects
  file: '▤',
  folder: '▧',
  folderOpen: '▨',
  code: '⟨⟩',
  terminal: '⌘',
  settings: '⚙',
  database: '⛁',
  cloud: '☁',

  // Communication
  message: '▣',
  mail: '✉',
  send: '➤',

  // AI/Models
  brain: '◎',
  bot: '◈',
  cpu: '⬡',
  sparkle: '✦',
  wand: '✧',

  // Data
  chartBar: '▊',
  chartLine: '⎇',
  trendUp: '↗',
  trendDown: '↘',

  // UI
  loader: '◌',
  spinner: '◉',
  circle: '○',
  circleFilled: '●',
  square: '□',
  squareFilled: '■',
  diamond: '◇',
  diamondFilled: '◆',
  star: '☆',
  starFilled: '★',

  // Misc
  clock: '◷',
  timer: '◴',
  calendar: '▦',
  link: '⛓',
  externalLink: '↗',
  copy: '⎘',
  trash: '⌫',
  edit: '✎',
  save: '⌧',
  download: '⬇',
  upload: '⬆',
  lock: '⌸',
  unlock: '⌹',
  key: '⚿',
  eye: '◉',
  eyeOff: '◌',

  // Tree/Structure
  branch: '├─',
  branchEnd: '└─',
  branchAlt: '├─⎇',
  revision: '├─↺',
  pipe: '│',

  // Workflow
  workflow: '⎔',
  step: '◈',
  merge: '⋈',
  split: '⋔',
} as const;

export type IconName = keyof typeof icons;

/**
 * Get icon by name with optional fallback
 */
export function getIcon(name: IconName, fallback?: string): string {
  return icons[name] || fallback || '•';
}

/**
 * Nerd Font icons (requires Nerd Font installed)
 * These are private-use Unicode characters from patched fonts
 * Reference: https://www.nerdfonts.com/cheat-sheet
 */
export const nerdIcons = {
  // ═══════════════════════════════════════════════════════════
  // TACHIBOT CUSTOM
  // ═══════════════════════════════════════════════════════════
  tachibot: '',      // nf-md-robot (U+F06A9) - our mascot
  tachiAlt: '',       // nf-oct-hubot (U+F09D9)
  tachiBrain: '󰧑',    // nf-md-brain (U+F09D1)
  tachiSpark: '',     // nf-md-creation (U+F1C9)

  // ═══════════════════════════════════════════════════════════
  // DEV / LANGUAGES
  // ═══════════════════════════════════════════════════════════
  git: '',           // nf-dev-git
  gitBranch: '',     // nf-dev-git_branch
  gitCommit: '',     // nf-dev-git_commit
  gitMerge: '',      // nf-dev-git_merge
  github: '',        // nf-dev-github_badge
  gitlab: '',        // nf-fa-gitlab
  nodejs: '',        // nf-dev-nodejs_small
  npm: '',           // nf-dev-npm
  python: '',        // nf-dev-python
  typescript: '',    // nf-seti-typescript
  javascript: '',    // nf-seti-javascript
  react: '',         // nf-dev-react
  vue: '',           // nf-md-vuejs
  rust: '',          // nf-dev-rust
  go: '',            // nf-seti-go
  docker: '',        // nf-dev-docker
  kubernetes: '󱃾',   // nf-md-kubernetes

  // ═══════════════════════════════════════════════════════════
  // AI / MODELS
  // ═══════════════════════════════════════════════════════════
  brain: '󰧑',        // nf-md-brain
  robot: '',        // nf-md-robot
  sparkle: '',       // nf-md-creation
  magic: '',        // nf-fa-magic
  lightning: '',    // nf-oct-zap
  cpu: '',          // nf-oct-cpu
  chip: '󰍛',         // nf-md-chip
  network: '󰛳',      // nf-md-lan
  api: '',          // nf-md-api

  // ═══════════════════════════════════════════════════════════
  // FILES / FOLDERS
  // ═══════════════════════════════════════════════════════════
  folder: '',        // nf-custom-folder
  folderOpen: '',    // nf-custom-folder_open
  file: '',          // nf-fa-file_o
  fileCode: '',      // nf-fa-file_code_o
  fileText: '',      // nf-fa-file_text_o
  filePdf: '',       // nf-fa-file_pdf_o
  fileImage: '',     // nf-fa-file_image_o
  fileZip: '',       // nf-fa-file_archive_o
  config: '',        // nf-seti-config
  json: '',          // nf-seti-json
  yaml: '',          // nf-dev-aptana

  // ═══════════════════════════════════════════════════════════
  // STATUS / INDICATORS
  // ═══════════════════════════════════════════════════════════
  check: '',         // nf-fa-check
  checkCircle: '',   // nf-fa-check_circle
  error: '',         // nf-fa-times_circle
  errorAlt: '',      // nf-fa-exclamation_circle
  warning: '',       // nf-fa-warning
  info: '',          // nf-fa-info_circle
  question: '',      // nf-fa-question_circle
  debug: '',         // nf-fa-bug
  flame: '',         // nf-fa-fire

  // ═══════════════════════════════════════════════════════════
  // ACTIONS
  // ═══════════════════════════════════════════════════════════
  play: '',          // nf-fa-play
  pause: '',         // nf-fa-pause
  stop: '',          // nf-fa-stop
  refresh: '',       // nf-fa-refresh
  sync: '',          // nf-fa-sync
  search: '',        // nf-fa-search
  download: '',      // nf-fa-download
  upload: '',        // nf-fa-upload
  trash: '',         // nf-fa-trash
  edit: '',          // nf-fa-pencil
  save: '',          // nf-fa-floppy_o
  copy: '',          // nf-fa-copy
  paste: '',         // nf-fa-paste
  undo: '',          // nf-fa-undo
  redo: '',          // nf-fa-repeat

  // ═══════════════════════════════════════════════════════════
  // UI / NAVIGATION
  // ═══════════════════════════════════════════════════════════
  arrowRight: '',    // nf-fa-arrow_right
  arrowLeft: '',     // nf-fa-arrow_left
  arrowUp: '',       // nf-fa-arrow_up
  arrowDown: '',     // nf-fa-arrow_down
  chevronRight: '',  // nf-fa-chevron_right
  chevronLeft: '',   // nf-fa-chevron_left
  chevronUp: '',     // nf-fa-chevron_up
  chevronDown: '',   // nf-fa-chevron_down
  menu: '',          // nf-fa-bars
  close: '',         // nf-fa-times
  plus: '',          // nf-fa-plus
  minus: '',         // nf-fa-minus
  expand: '',        // nf-fa-expand
  compress: '',      // nf-fa-compress

  // ═══════════════════════════════════════════════════════════
  // DATA / CHARTS
  // ═══════════════════════════════════════════════════════════
  chart: '',         // nf-fa-bar_chart
  chartLine: '',     // nf-fa-line_chart
  chartPie: '',      // nf-fa-pie_chart
  dashboard: '',     // nf-fa-dashboard
  database: '',      // nf-fa-database
  table: '',         // nf-fa-table
  list: '',          // nf-fa-list

  // ═══════════════════════════════════════════════════════════
  // MISC
  // ═══════════════════════════════════════════════════════════
  cog: '',           // nf-fa-cog
  cogs: '',          // nf-fa-cogs
  wrench: '',        // nf-fa-wrench
  terminal: '',      // nf-dev-terminal
  clock: '',         // nf-fa-clock_o
  calendar: '',      // nf-fa-calendar
  user: '',          // nf-fa-user
  users: '',         // nf-fa-users
  lock: '',          // nf-fa-lock
  unlock: '',        // nf-fa-unlock
  key: '',           // nf-fa-key
  link: '',          // nf-fa-link
  cloud: '',         // nf-fa-cloud
  cloudUpload: '',   // nf-fa-cloud_upload
  cloudDownload: '', // nf-fa-cloud_download
  star: '',          // nf-fa-star
  starEmpty: '',     // nf-fa-star_o
  heart: '',         // nf-fa-heart
  bolt: '',          // nf-fa-bolt
  comment: '',       // nf-fa-comment
  tag: '',           // nf-fa-tag
  bookmark: '',      // nf-fa-bookmark

  // ═══════════════════════════════════════════════════════════
  // REASONING / ANALYSIS (replaces emojis)
  // ═══════════════════════════════════════════════════════════
  target: '󰀘',        // nf-md-bullseye (replaces 🎯)
  scales: '󰖷',        // nf-md-scale_balance (replaces ⚖️)
  eye: '',           // nf-fa-eye (replaces 👀)
  eyeSlash: '',      // nf-fa-eye_slash
  building: '',      // nf-fa-building (replaces 🏗️)
  handshake: '󱢏',     // nf-md-handshake (replaces 🤝)
  flask: '',         // nf-fa-flask (replaces 🧪)
  sword: '󰓥',         // nf-md-sword (replaces ⚔️)
  swords: '󰚔',        // nf-md-sword_cross
  money: '',         // nf-fa-dollar (replaces 💰)
  branch: '',        // nf-oct-git_branch (replaces 🌿)
  lightbulb: '',     // nf-fa-lightbulb_o (replaces 💡)
  compass: '',       // nf-fa-compass
  flag: '',          // nf-fa-flag
  trophy: '',        // nf-fa-trophy
  shield: '',        // nf-fa-shield
  puzzle: '󰘗',        // nf-md-puzzle (replaces 🧩)
  thumbUp: '',       // nf-fa-thumbs_up
  thumbDown: '',     // nf-fa-thumbs_down

  // ═══════════════════════════════════════════════════════════
  // POWERLINE
  // ═══════════════════════════════════════════════════════════
  plRight: '',       // Powerline right arrow
  plLeft: '',        // Powerline left arrow
  plRightRound: '',  // Powerline right rounded
  plLeftRound: '',   // Powerline left rounded
} as const;

export type NerdIconName = keyof typeof nerdIcons;

// ═══════════════════════════════════════════════════════════
// SMART ICON SYSTEM (Auto-detects Nerd Fonts)
// ═══════════════════════════════════════════════════════════

// Cache detection result
let _nerdFontSupport: boolean | null = null;

/**
 * Check if terminal supports Nerd Fonts
 * Checks env vars and known terminal programs
 */
export function hasNerdFontSupport(): boolean {
  if (_nerdFontSupport !== null) return _nerdFontSupport;

  // Explicit enable/disable
  const explicit = process.env.TACHIBOT_NERD_FONTS || process.env.NERD_FONTS;
  if (explicit === '1' || explicit === 'true') {
    _nerdFontSupport = true;
    return true;
  }
  if (explicit === '0' || explicit === 'false') {
    _nerdFontSupport = false;
    return false;
  }

  // Check terminal program
  const term = process.env.TERM_PROGRAM || '';
  const termInfo = process.env.TERM || '';

  // Terminals that commonly have Nerd Fonts configured
  const nerdTerminals = [
    'iTerm.app',
    'WezTerm',
    'kitty',
    'Alacritty',
    'Hyper',
    'vscode',      // VS Code integrated terminal
    'Tabby',
    'Warp',
  ];

  // Check if running in a known Nerd Font terminal
  if (nerdTerminals.some(t => term.toLowerCase().includes(t.toLowerCase()))) {
    _nerdFontSupport = true;
    return true;
  }

  // Check for kitty specifically
  if (process.env.KITTY_WINDOW_ID) {
    _nerdFontSupport = true;
    return true;
  }

  // Check for WezTerm
  if (process.env.WEZTERM_PANE) {
    _nerdFontSupport = true;
    return true;
  }

  // Default: assume Nerd Font support (most modern dev terminals have them)
  // Users can disable with TACHIBOT_NERD_FONTS=0 if needed
  _nerdFontSupport = true;
  return true;
}

/**
 * Reset Nerd Font detection cache (for testing)
 */
export function resetNerdFontCache(): void {
  _nerdFontSupport = null;
}

/**
 * Unified icon function - THE PRIMARY WAY TO GET ICONS
 *
 * Auto-detects Nerd Font support:
 * - If Nerd Fonts available: returns Nerd Font glyph
 * - If not: returns Unicode fallback
 *
 * @example
 * icon('check')     // '' or '✓'
 * icon('tachibot')  // '' or '◈'
 * icon('git')       // '' or '⎔'
 */
export function icon(name: string): string {
  const useNerd = hasNerdFontSupport();

  // Try Nerd Font first if supported
  if (useNerd && name in nerdIcons) {
    return nerdIcons[name as NerdIconName];
  }

  // Fallback to Unicode icons
  if (name in icons) {
    return icons[name as IconName];
  }

  // Special fallbacks for Nerd-only icons
  const nerdFallbacks: Record<string, string> = {
    // Tachibot
    tachibot: '◈',
    tachiAlt: '◎',
    tachiBrain: '◎',
    tachiSpark: '✦',

    // Git/Dev
    git: '⎔',
    gitBranch: '⎇',
    gitCommit: '●',
    gitMerge: '⋈',
    github: '⬡',
    gitlab: '⬡',
    nodejs: '⬢',
    npm: '▣',
    python: '⌘',
    typescript: 'TS',
    javascript: 'JS',
    react: '⚛',
    vue: 'V',
    rust: 'R',
    go: 'Go',
    docker: '◳',
    kubernetes: '⎈',

    // AI
    robot: '◈',
    magic: '✧',
    lightning: '⚡',
    chip: '⬡',
    network: '⛓',
    api: '⟨⟩',

    // Files
    fileCode: '▤',
    fileText: '▤',
    filePdf: '▤',
    fileImage: '▤',
    fileZip: '▤',
    config: '⚙',
    json: '{}',
    yaml: '≡',

    // Status
    checkCircle: '✔',
    error: '✘',
    errorAlt: '✘',
    warning: '⚠',
    question: '?',
    debug: '⚙',
    flame: '⚡',

    // Actions
    sync: '↻',
    paste: '⎘',
    undo: '↶',
    redo: '↷',

    // UI
    menu: '≡',
    close: '✗',
    plus: '+',
    minus: '-',
    expand: '⤢',
    compress: '⤡',

    // Data
    chart: '▊',
    chartLine: '⎇',
    chartPie: '◔',
    dashboard: '▦',
    database: '⛁',
    table: '▦',
    list: '≡',

    // Misc
    cog: '⚙',
    cogs: '⚙',
    wrench: '⚙',
    terminal: '⌘',
    user: '◎',
    users: '◎◎',
    lock: '⌸',
    unlock: '⌹',
    key: '⚿',
    link: '⛓',
    cloud: '☁',
    cloudUpload: '☁↑',
    cloudDownload: '☁↓',
    star: '★',
    starEmpty: '☆',
    heart: '♥',
    bolt: '⚡',
    comment: '▣',
    tag: '⏏',
    bookmark: '▶',
    clock: '◷',
    calendar: '▦',

    // Reasoning/Analysis
    target: '◎',
    scales: '⚖',
    eye: '◉',
    eyeSlash: '◌',
    building: '▣',
    handshake: '≡',
    flask: '⚗',
    sword: '†',
    swords: '⚔',
    money: '$',
    branch: '⎇',
    lightbulb: '✦',
    compass: '◎',
    flag: '⚑',
    trophy: '◆',
    shield: '◇',
    puzzle: '▦',
    thumbUp: '+',
    thumbDown: '-',

    // Powerline (no fallback - just empty)
    plRight: '',
    plLeft: '',
    plRightRound: '',
    plLeftRound: '',
  };

  if (name in nerdFallbacks) {
    return nerdFallbacks[name];
  }

  return '•';
}

/**
 * Get raw Nerd Font icon (no fallback)
 */
export function getNerdIcon(name: NerdIconName): string {
  return nerdIcons[name] || '';
}

/**
 * Get raw Unicode icon (no Nerd Font)
 */
export function getUnicodeIcon(name: IconName): string {
  return icons[name] || '';
}

// Legacy alias
export const getSmartIcon = icon;

// ============================================================================
// TYPES
// ============================================================================

export interface StatusCardProps {
  title: string;
  status: 'success' | 'error' | 'warning' | 'info' | 'processing';
  message: string;
  metrics?: Record<string, string>;
  model?: string;
}

export interface ResultBlockProps {
  title: string;
  content: string;
  borderColor?: string;
  gradient?: string;
}

// ============================================================================
// INK COMPONENTS
// ============================================================================

/**
 * Status badge with colored indicator
 */
const StatusBadge: React.FC<{ status: StatusCardProps['status'] }> = ({ status }) => {
  const colors: Record<string, string> = {
    success: 'green',
    error: 'red',
    warning: 'yellow',
    info: 'cyan',
    processing: 'magenta',
  };
  const icons: Record<string, string> = {
    success: '✓',
    error: '✗',
    warning: '⚠',
    info: 'ℹ',
    processing: '◉',
  };

  return (
    <Text color={colors[status]} bold>
      {icons[status]} {status.toUpperCase()}
    </Text>
  );
};

/**
 * Status card with gradient header and metrics
 */
export const StatusCard: React.FC<StatusCardProps> = ({
  title,
  status,
  message,
  metrics,
  model
}) => {
  return (
    <Box flexDirection="column" borderStyle="round" borderColor="gray" padding={1}>
      {/* Header with gradient */}
      <Box justifyContent="space-between" marginBottom={1}>
        <Gradient name="morning">
          <Text bold>{title}</Text>
        </Gradient>
        {model && <Text color="cyan">[{model}]</Text>}
      </Box>

      {/* Status line */}
      <Box marginBottom={1}>
        <StatusBadge status={status} />
      </Box>

      {/* Message */}
      <Box borderStyle="single" borderColor="dim" paddingX={1} marginBottom={1}>
        <Text>{message}</Text>
      </Box>

      {/* Metrics grid */}
      {metrics && Object.keys(metrics).length > 0 && (
        <Box flexDirection="row" flexWrap="wrap">
          {Object.entries(metrics).map(([key, value]) => (
            <Box key={key} marginRight={2}>
              <Text color="gray">{key}: </Text>
              <Text color="white">{value}</Text>
            </Box>
          ))}
        </Box>
      )}
    </Box>
  );
};

/**
 * Result block with optional gradient border
 */
export const ResultBlock: React.FC<ResultBlockProps> = ({
  title,
  content,
  borderColor = 'cyan',
}) => {
  return (
    <Box flexDirection="column" borderStyle="round" borderColor={borderColor} padding={1}>
      <Box marginBottom={1}>
        <Gradient name="pastel">
          <Text bold underline>{title}</Text>
        </Gradient>
      </Box>
      <Text>{content}</Text>
    </Box>
  );
};

/**
 * Model header badge
 */
export const ModelHeader: React.FC<{ model: string; duration?: number }> = ({
  model,
  duration
}) => {
  const gradients: Record<string, GradientName> = {
    gemini: 'cristal',
    grok: 'passion',
    openai: 'teen',
    perplexity: 'mind',
    claude: 'fruit',
    kimi: 'atlas',
    qwen: 'morning',
  };

  const gradientName = gradients[model.toLowerCase()] || 'rainbow';

  return (
    <Box>
      <Gradient name={gradientName as any}>
        <Text bold> {model.toUpperCase()} </Text>
      </Gradient>
      {duration && (
        <Text color="gray"> {duration}ms</Text>
      )}
    </Box>
  );
};

// ============================================================================
// RENDER TO STRING UTILITY
// ============================================================================

/**
 * Render an Ink component to an ANSI string
 * Uses a virtual stream to capture output without hijacking stdout
 */
export function renderInkToString(element: React.ReactElement): string {
  let output = '';

  // Create a virtual stream to capture output
  const stream = new PassThrough();
  stream.on('data', (chunk) => {
    output += chunk.toString();
  });

  // Render to the virtual stream
  const { unmount, cleanup } = render(element, {
    stdout: stream as any,
    stdin: process.stdin,
    exitOnCtrlC: false,
  });

  // Immediately unmount to get the final frame
  unmount();
  cleanup();
  stream.end();

  return output;
}

/**
 * Gradient text rendering using gradient-string
 * Supports multiple presets and custom colors
 */
export type GradientPreset =
  | 'rainbow' | 'cristal' | 'teen' | 'mind' | 'morning'
  | 'vice' | 'passion' | 'fruit' | 'atlas' | 'retro';

/**
 * Render text with gradient colors
 */
export function renderGradientText(text: string, preset: GradientPreset = 'rainbow'): string {
  const gradient = (gradientString as any)[preset] || gradientString.rainbow;
  return gradient(text);
}

/**
 * Model-specific gradient presets
 */
const modelGradients: Record<string, GradientPreset> = {
  gemini: 'cristal',
  grok: 'passion',
  openai: 'teen',
  perplexity: 'mind',
  claude: 'fruit',
  kimi: 'atlas',
  qwen: 'morning',
};

/**
 * Render model name with appropriate gradient
 */
export function renderGradientModelName(model: string): string {
  const preset = modelGradients[model.toLowerCase()] || 'rainbow';
  return renderGradientText(` ${model.toUpperCase()} `, preset);
}

/**
 * BigText font options
 */
export type BigTextFont = 'block' | 'slick' | 'tiny' | 'grid' | 'pallet' | 'shade' | 'simple' | 'simpleBlock' | 'chrome' | '3d' | 'simple3d' | 'huge';

/**
 * Check if big headers are enabled
 * Set TACHIBOT_BIG_HEADERS=false to disable
 */
export const showBigHeaders = (): boolean => {
  return process.env.TACHIBOT_BIG_HEADERS !== 'false';
};

/**
 * Strip ANSI escape codes from text
 */
function stripAnsiCodes(text: string): string {
  // Comprehensive ANSI regex - covers SGR, cursor, and other sequences
  // eslint-disable-next-line no-control-regex
  const ansiRegex = /[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g;
  return text.replace(ansiRegex, '');
}

/**
 * Render large ASCII art text with optional gradient
 * Uses ink-big-text for rendering, then applies gradient-string for colors
 * Disabled if TACHIBOT_BIG_HEADERS=false
 */
export function renderBigText(
  text: string,
  options?: {
    font?: BigTextFont;
    gradient?: GradientPreset;
  }
): string {
  // Easy toggle - set TACHIBOT_BIG_HEADERS=false to disable
  if (!showBigHeaders()) return '';

  const font = options?.font || 'block';
  const gradient = options?.gradient;

  // Render BigText to string and strip any ANSI codes from Ink
  let ascii = stripAnsiCodes(renderInkToString(<BigText text={text} font={font} />));

  // Apply gradient if specified
  if (gradient) {
    const gradFn = (gradientString as unknown as Record<string, typeof gradientString.rainbow>)[gradient];
    if (gradFn && typeof gradFn.multiline === 'function') {
      // Normalize line widths for proper gradient alignment
      // gradient-string.multiline() applies colors per-line, so lines must be equal width
      const lines = ascii.split('\n');
      const maxWidth = Math.max(...lines.map(l => l.length));
      const normalized = lines.map(l => l.padEnd(maxWidth)).join('\n');
      return gradFn.multiline(normalized);
    }
  }

  return ascii;
}

/**
 * Render a tool name badge with gradient background
 * e.g., " ◉ focus " with cristal gradient
 */
export function renderToolBadge(
  toolName: string,
  options?: {
    icon?: string;
    gradient?: GradientPreset;
  }
): string {
  const icon = options?.icon || '◉';
  const gradient = options?.gradient || 'cristal';
  const badgeText = ` ${icon} ${toolName} `;

  // Create gradient background effect using chalk
  const gradFn = (gradientString as unknown as Record<string, typeof gradientString.rainbow>)[gradient];
  if (gradFn) {
    // Use inverse colors for background effect
    const colors = gradFn(badgeText);
    return `\x1b[7m${colors}\x1b[0m`; // ANSI inverse
  }
  return badgeText;
}

/**
 * Create a gradient divider line
 */
export function renderGradientDivider(width: number = 60, preset: GradientPreset = 'vice'): string {
  const line = '─'.repeat(width);
  return renderGradientText(line, preset);
}

/**
 * Create a gradient box border (top line with title)
 */
export function renderGradientBoxTop(title: string, width: number = 60, preset: GradientPreset = 'cristal'): string {
  const paddedTitle = ` ${title} `;
  const leftWidth = Math.floor((width - paddedTitle.length - 2) / 2);
  const rightWidth = width - paddedTitle.length - leftWidth - 2;
  const line = '╭' + '─'.repeat(leftWidth) + paddedTitle + '─'.repeat(rightWidth) + '╮';
  return renderGradientText(line, preset);
}

// ============================================================================
// HIGH-LEVEL RENDER FUNCTIONS
// ============================================================================

/**
 * Render a status card to string
 */
export function renderStatusCard(props: StatusCardProps): string {
  return renderInkToString(<StatusCard {...props} />);
}

/**
 * Render a result block to string
 */
export function renderResultBlock(props: ResultBlockProps): string {
  return renderInkToString(<ResultBlock {...props} />);
}

/**
 * Render a model header to string
 */
export function renderInkModelHeader(model: string, duration?: number): string {
  return renderInkToString(<ModelHeader model={model} duration={duration} />);
}

// ============================================================================
// ADVANCED VISUALIZATIONS (Grok's Ideas)
// ============================================================================

/**
 * Workflow step for cascade visualization
 */
export interface WorkflowStep {
  name: string;
  model: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  duration?: number;
  output?: string;
}

/**
 * Workflow Cascade - Visualize multi-model workflow as flowing steps
 */
export const WorkflowCascade: React.FC<{ steps: WorkflowStep[]; title?: string }> = ({
  steps,
  title = 'Workflow'
}) => {
  const getStatusIcon = (status: WorkflowStep['status']) => {
    const icons = { pending: '○', running: '◉', completed: '●', failed: '✗' };
    return icons[status];
  };

  const getStatusColor = (status: WorkflowStep['status']) => {
    const colors = { pending: 'gray', running: 'yellow', completed: 'green', failed: 'red' };
    return colors[status];
  };

  return (
    <Box flexDirection="column" borderStyle="round" borderColor="gray" padding={1}>
      <Gradient name="morning">
        <Text bold>◆ {title}</Text>
      </Gradient>
      <Box marginTop={1} flexDirection="column">
        {steps.map((step, idx) => (
          <Box key={idx} flexDirection="column">
            {/* Step with status */}
            <Box>
              <Text color={getStatusColor(step.status)}>{getStatusIcon(step.status)} </Text>
              <Text color="white" bold>{step.name}</Text>
              <Text color="gray"> → </Text>
              <Gradient name={modelGradients[step.model.toLowerCase()] || 'rainbow' as any}>
                <Text>{step.model}</Text>
              </Gradient>
              {step.duration && <Text color="gray"> ({step.duration}ms)</Text>}
            </Box>
            {/* Connector arrow */}
            {idx < steps.length - 1 && (
              <Box marginLeft={1}>
                <Text color="cyan">↓</Text>
              </Box>
            )}
          </Box>
        ))}
      </Box>
    </Box>
  );
};

/**
 * Render workflow cascade to string
 */
export function renderWorkflowCascade(steps: WorkflowStep[], title?: string): string {
  return renderInkToString(<WorkflowCascade steps={steps} title={title} />);
}

/**
 * Model response for chorus visualization
 */
export interface ModelResponse {
  model: string;
  response: string;
  confidence?: number;
  tokens?: number;
}

/**
 * Model Chorus - Side-by-side multi-model comparison
 */
export const ModelChorus: React.FC<{ responses: ModelResponse[]; title?: string }> = ({
  responses,
  title = 'Model Chorus'
}) => {
  return (
    <Box flexDirection="column" borderStyle="round" borderColor="gray" padding={1}>
      <Gradient name="vice">
        <Text bold>♫ {title}</Text>
      </Gradient>
      <Box marginTop={1} flexDirection="column">
        {responses.map((r, idx) => (
          <Box key={idx} flexDirection="column" marginBottom={1}>
            <Box>
              <Gradient name={modelGradients[r.model.toLowerCase()] || 'rainbow' as any}>
                <Text bold> {r.model.toUpperCase()} </Text>
              </Gradient>
              {r.confidence !== undefined && (
                <Text color="gray"> [{Math.round(r.confidence * 100)}% conf]</Text>
              )}
              {r.tokens && <Text color="gray"> {r.tokens} tok</Text>}
            </Box>
            <Box borderStyle="single" borderColor="dim" paddingX={1} marginTop={0}>
              <Text wrap="wrap">{r.response.slice(0, 200)}{r.response.length > 200 ? '...' : ''}</Text>
            </Box>
          </Box>
        ))}
      </Box>
    </Box>
  );
};

/**
 * Render model chorus to string
 */
export function renderModelChorus(responses: ModelResponse[], title?: string): string {
  return renderInkToString(<ModelChorus responses={responses} title={title} />);
}

/**
 * Phase for progress reel
 */
export interface ProgressPhase {
  name: string;
  status: 'pending' | 'active' | 'completed';
  elapsed?: number;
}

/**
 * Progress Reel - Horizontal timeline of phases
 */
export const ProgressReel: React.FC<{ phases: ProgressPhase[]; title?: string }> = ({
  phases,
  title = 'Progress'
}) => {
  const phaseColors: Record<string, string> = {
    pending: 'gray',
    active: 'yellow',
    completed: 'green',
  };

  return (
    <Box flexDirection="column">
      {title && (
        <Gradient name="teen">
          <Text bold>{title}</Text>
        </Gradient>
      )}
      <Box marginTop={1} flexDirection="row">
        {phases.map((phase, idx) => (
          <Box key={idx} flexDirection="row">
            <Box
              borderStyle="round"
              borderColor={phaseColors[phase.status]}
              paddingX={1}
            >
              <Text color={phaseColors[phase.status]} bold={phase.status === 'active'}>
                {phase.name}
              </Text>
              {phase.elapsed && (
                <Text color="gray"> {phase.elapsed}ms</Text>
              )}
            </Box>
            {idx < phases.length - 1 && (
              <Text color="cyan"> → </Text>
            )}
          </Box>
        ))}
      </Box>
    </Box>
  );
};

/**
 * Render progress reel to string
 */
export function renderProgressReel(phases: ProgressPhase[], title?: string): string {
  return renderInkToString(<ProgressReel phases={phases} title={title} />);
}

/**
 * Sparkline data point
 */
export interface SparklineData {
  label: string;
  values: number[];
  unit?: string;
}

/**
 * Render ASCII sparkline from values
 */
function asciiSparkline(values: number[], width: number = 20): string {
  if (values.length === 0) return '─'.repeat(width);

  const chars = '▁▂▃▄▅▆▇█';
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;

  // Resample to fit width
  const step = values.length / width;
  const result: string[] = [];

  for (let i = 0; i < width; i++) {
    const idx = Math.floor(i * step);
    const val = values[Math.min(idx, values.length - 1)];
    const normalized = (val - min) / range;
    const charIdx = Math.floor(normalized * (chars.length - 1));
    result.push(chars[charIdx]);
  }

  return result.join('');
}

/**
 * Sparklines Grid - Compact metrics dashboard
 */
export const SparklinesGrid: React.FC<{ data: SparklineData[]; title?: string }> = ({
  data,
  title = 'Metrics'
}) => {
  return (
    <Box flexDirection="column" borderStyle="round" borderColor="gray" padding={1}>
      <Gradient name="cristal">
        <Text bold>📊 {title}</Text>
      </Gradient>
      <Box marginTop={1} flexDirection="column">
        {data.map((d, idx) => {
          const latest = d.values[d.values.length - 1];
          const trend = d.values.length > 1
            ? (latest > d.values[d.values.length - 2] ? '↑' : latest < d.values[d.values.length - 2] ? '↓' : '→')
            : '→';
          const trendColor = trend === '↑' ? 'green' : trend === '↓' ? 'red' : 'gray';

          return (
            <Box key={idx} marginBottom={idx < data.length - 1 ? 1 : 0}>
              <Text color="gray">{d.label.padEnd(12)}</Text>
              <Text color="cyan">{asciiSparkline(d.values, 15)}</Text>
              <Text color={trendColor}> {trend}</Text>
              <Text color="white"> {latest?.toFixed(1)}</Text>
              {d.unit && <Text color="gray">{d.unit}</Text>}
            </Box>
          );
        })}
      </Box>
    </Box>
  );
};

/**
 * Render sparklines grid to string
 */
export function renderSparklinesGrid(data: SparklineData[], title?: string): string {
  return renderInkToString(<SparklinesGrid data={data} title={title} />);
}

/**
 * Thinking chain step
 */
export interface ThinkingStep {
  thought: string;
  model?: string;
  isRevision?: boolean;
  isBranch?: boolean;
}

/**
 * Thinking Chain Arbor - Tree visualization of thoughts
 */
export const ThinkingChainArbor: React.FC<{ steps: ThinkingStep[]; title?: string }> = ({
  steps,
  title = 'Thinking Chain'
}) => {
  return (
    <Box flexDirection="column" borderStyle="round" borderColor="gray" padding={1}>
      <Gradient name="fruit">
        <Text bold>🌳 {title}</Text>
      </Gradient>
      <Box marginTop={1} flexDirection="column">
        {steps.map((step, idx) => {
          const prefix = step.isBranch ? '├─⎇' : step.isRevision ? '├─↺' : '├──';
          const prefixColor = step.isBranch ? 'yellow' : step.isRevision ? 'magenta' : 'cyan';

          return (
            <Box key={idx} flexDirection="column">
              <Box>
                <Text color={prefixColor}>{idx === steps.length - 1 ? prefix.replace('├', '└') : prefix} </Text>
                <Text color="white">{step.thought.slice(0, 60)}{step.thought.length > 60 ? '...' : ''}</Text>
              </Box>
              {step.model && (
                <Box marginLeft={4}>
                  <Gradient name={modelGradients[step.model.toLowerCase()] || 'rainbow' as any}>
                    <Text dimColor>[{step.model}]</Text>
                  </Gradient>
                </Box>
              )}
            </Box>
          );
        })}
      </Box>
    </Box>
  );
};

/**
 * Render thinking chain arbor to string
 */
export function renderThinkingChainArbor(steps: ThinkingStep[], title?: string): string {
  return renderInkToString(<ThinkingChainArbor steps={steps} title={title} />);
}

/**
 * Focus Session summary
 */
export interface FocusSessionSummary {
  objective: string;
  models: string[];
  rounds: number;
  totalTokens: number;
  totalDuration: number;
  status: 'running' | 'completed' | 'failed';
}

/**
 * Focus Session Horizon - Panoramic session visualization
 */
export const FocusSessionHorizon: React.FC<FocusSessionSummary> = (session) => {
  const statusColors = { running: 'yellow', completed: 'green', failed: 'red' };
  const statusIcons = { running: '◉', completed: '✓', failed: '✗' };

  return (
    <Box flexDirection="column" borderStyle="double" borderColor={statusColors[session.status]} padding={1}>
      {/* Horizon bar */}
      <Box marginBottom={1}>
        <Gradient name="morning">
          <Text bold>{'▁▂▃▄▅▆▇█'.repeat(8)}</Text>
        </Gradient>
      </Box>

      {/* Session info */}
      <Box justifyContent="space-between">
        <Box>
          <Text color={statusColors[session.status]} bold>
            {statusIcons[session.status]} {session.status.toUpperCase()}
          </Text>
        </Box>
        <Box>
          <Text color="gray">Rounds: </Text>
          <Text color="cyan">{session.rounds}</Text>
        </Box>
      </Box>

      {/* Objective */}
      <Box marginTop={1}>
        <Text color="white" bold wrap="wrap">{session.objective}</Text>
      </Box>

      {/* Models used */}
      <Box marginTop={1} flexDirection="row" flexWrap="wrap">
        {session.models.map((model, idx) => (
          <Box key={idx} marginRight={1}>
            <Gradient name={modelGradients[model.toLowerCase()] || 'rainbow' as any}>
              <Text>{model}</Text>
            </Gradient>
          </Box>
        ))}
      </Box>

      {/* Metrics */}
      <Box marginTop={1} justifyContent="space-between">
        <Text color="gray">{session.totalTokens} tokens</Text>
        <Text color="gray">{(session.totalDuration / 1000).toFixed(1)}s</Text>
      </Box>
    </Box>
  );
};

/**
 * Render focus session horizon to string
 */
export function renderFocusSessionHorizon(session: FocusSessionSummary): string {
  return renderInkToString(<FocusSessionHorizon {...session} />);
}

// ============================================================================
// PRACTICAL COMPONENTS (Gemini's suggestions)
// ============================================================================

/**
 * Receipt data for cost tracking
 */
export interface ReceiptData {
  model: string;
  inputTokens: number;
  outputTokens: number;
  cachedTokens?: number;
  inputCostPer1k?: number;  // defaults based on model
  outputCostPer1k?: number;
  duration?: number;
}

/**
 * Receipt Printer - Skeuomorphic cost breakdown
 */
export const ReceiptPrinter: React.FC<ReceiptData> = ({
  model,
  inputTokens,
  outputTokens,
  cachedTokens = 0,
  inputCostPer1k = 0.001,
  outputCostPer1k = 0.002,
  duration,
}) => {
  const inputCost = (inputTokens / 1000) * inputCostPer1k;
  const outputCost = (outputTokens / 1000) * outputCostPer1k;
  const cachedSavings = (cachedTokens / 1000) * inputCostPer1k * 0.9; // 90% savings
  const totalCost = inputCost + outputCost - cachedSavings;

  const formatCost = (n: number) => `$${n.toFixed(4)}`;
  const formatNum = (n: number) => n.toLocaleString();

  return (
    <Box flexDirection="column" borderStyle="single" borderColor="gray" paddingX={2} paddingY={1}>
      {/* Header */}
      <Box justifyContent="center">
        <Text bold>═══ COMPUTE RECEIPT ═══</Text>
      </Box>

      {/* Model */}
      <Box justifyContent="center" marginTop={1}>
        <Gradient name={modelGradients[model.toLowerCase()] || 'rainbow' as any}>
          <Text>{model.toUpperCase()}</Text>
        </Gradient>
      </Box>

      <Text color="gray">{'─'.repeat(28)}</Text>

      {/* Line items */}
      <Box justifyContent="space-between">
        <Text>Input ({formatNum(inputTokens)} tok)</Text>
        <Text>{formatCost(inputCost)}</Text>
      </Box>

      <Box justifyContent="space-between">
        <Text>Output ({formatNum(outputTokens)} tok)</Text>
        <Text>{formatCost(outputCost)}</Text>
      </Box>

      {cachedTokens > 0 && (
        <Box justifyContent="space-between">
          <Text color="green">{icons.check} Cached ({formatNum(cachedTokens)})</Text>
          <Text color="green">-{formatCost(cachedSavings)}</Text>
        </Box>
      )}

      <Text color="gray">{'─'.repeat(28)}</Text>

      {/* Total */}
      <Box justifyContent="space-between">
        <Text bold>TOTAL</Text>
        <Text bold color={totalCost > 0.01 ? 'yellow' : 'green'}>
          {formatCost(totalCost)}
        </Text>
      </Box>

      {/* Duration */}
      {duration && (
        <Box justifyContent="center" marginTop={1}>
          <Text color="gray">{icons.clock} {(duration / 1000).toFixed(2)}s</Text>
        </Box>
      )}

      {/* Footer */}
      <Box justifyContent="center" marginTop={1}>
        <Text dimColor>tachibot-mcp</Text>
      </Box>
    </Box>
  );
};

/**
 * Render receipt to string
 */
export function renderReceipt(data: ReceiptData): string {
  return renderInkToString(<ReceiptPrinter {...data} />);
}

/**
 * Waterfall step for trace visualization
 */
export interface WaterfallStep {
  name: string;
  startOffset: number;  // ms from workflow start
  duration: number;     // ms
  status: 'success' | 'error' | 'running';
}

/**
 * Waterfall Trace - Chrome DevTools style timing visualization
 */
export const WaterfallTrace: React.FC<{ steps: WaterfallStep[]; title?: string; totalWidth?: number }> = ({
  steps,
  title = 'Execution Trace',
  totalWidth = 40,
}) => {
  if (steps.length === 0) return null;

  const maxEnd = Math.max(...steps.map(s => s.startOffset + s.duration));
  const scale = totalWidth / maxEnd;

  const statusColors: Record<string, string> = {
    success: 'green',
    error: 'red',
    running: 'yellow',
  };

  return (
    <Box flexDirection="column" borderStyle="round" borderColor="gray" padding={1}>
      <Gradient name="teen">
        <Text bold>{icons.chartLine} {title}</Text>
      </Gradient>

      <Box marginTop={1} flexDirection="column">
        {steps.map((step, idx) => {
          const offset = Math.floor(step.startOffset * scale);
          const width = Math.max(1, Math.floor(step.duration * scale));
          const bar = '═'.repeat(width);

          return (
            <Box key={idx}>
              <Text color="gray">{step.name.padEnd(12).slice(0, 12)} </Text>
              <Text>{' '.repeat(offset)}</Text>
              <Text color={statusColors[step.status]}>{bar}</Text>
              <Text color="gray"> {step.duration}ms</Text>
            </Box>
          );
        })}
      </Box>

      {/* Timeline ruler */}
      <Box marginTop={1}>
        <Text color="gray">{'─'.repeat(12)} </Text>
        <Text color="gray">0</Text>
        <Text color="gray">{' '.repeat(Math.floor(totalWidth / 2) - 2)}</Text>
        <Text color="gray">{Math.floor(maxEnd / 2)}ms</Text>
        <Text color="gray">{' '.repeat(Math.floor(totalWidth / 2) - 4)}</Text>
        <Text color="gray">{maxEnd}ms</Text>
      </Box>
    </Box>
  );
};

/**
 * Render waterfall trace to string
 */
export function renderWaterfallTrace(steps: WaterfallStep[], title?: string): string {
  return renderInkToString(<WaterfallTrace steps={steps} title={title} />);
}

/**
 * Error details for autopsy
 */
export interface ErrorDetails {
  type: string;
  message: string;
  model?: string;
  suggestion?: string;
  culprit?: string;
}

/**
 * Error Autopsy - Structured error visualization
 */
export const ErrorAutopsy: React.FC<ErrorDetails> = ({
  type,
  message,
  model,
  suggestion,
  culprit,
}) => {
  return (
    <Box flexDirection="column" borderStyle="round" borderColor="red" padding={1}>
      {/* Header */}
      <Box>
        <Text backgroundColor="red" color="white" bold> {icons.xCircle} {type} </Text>
        {model && (
          <Text color="gray"> [{model}]</Text>
        )}
      </Box>

      {/* Message */}
      <Box marginTop={1}>
        <Text color="yellow">{message}</Text>
      </Box>

      {/* Culprit */}
      {culprit && (
        <Box marginTop={1} flexDirection="column">
          <Text color="gray">Culprit:</Text>
          <Box borderStyle="single" borderColor="red" paddingX={1}>
            <Text color="red">{culprit}</Text>
          </Box>
        </Box>
      )}

      {/* Suggestion */}
      {suggestion && (
        <Box marginTop={1}>
          <Text color="green">{icons.sparkle} {suggestion}</Text>
        </Box>
      )}
    </Box>
  );
};

/**
 * Render error autopsy to string
 */
export function renderErrorAutopsy(error: ErrorDetails): string {
  return renderInkToString(<ErrorAutopsy {...error} />);
}

/**
 * Source citation for RAG
 */
export interface SourceCitation {
  title: string;
  url?: string;
  relevance: number;  // 0-1
  snippet?: string;
}

/**
 * Source Heatmap - RAG source visualization
 */
export const SourceHeatmap: React.FC<{ sources: SourceCitation[]; title?: string }> = ({
  sources,
  title = 'Sources',
}) => {
  const getRelevanceBar = (relevance: number) => {
    const filled = Math.round(relevance * 10);
    const empty = 10 - filled;
    // Return object so we can style differently
    return { filled, empty };
  };

  const getRelevanceColor = (relevance: number) => {
    if (relevance >= 0.8) return 'green';
    if (relevance >= 0.5) return 'yellow';
    return 'gray';
  };

  return (
    <Box flexDirection="column" borderStyle="round" borderColor="cyan" padding={1}>
      <Gradient name="cristal">
        <Text bold>{icons.search} {title}</Text>
      </Gradient>

      <Box marginTop={1} flexDirection="column">
        {sources.map((source, idx) => (
          <Box key={idx} flexDirection="column" marginBottom={idx < sources.length - 1 ? 1 : 0}>
            <Box>
              <Text color={getRelevanceColor(source.relevance)}>
                {'█'.repeat(getRelevanceBar(source.relevance).filled)}
              </Text>
              <Text color="#374151">
                {'█'.repeat(getRelevanceBar(source.relevance).empty)}
              </Text>
              <Text color="gray"> {Math.round(source.relevance * 100)}%</Text>
            </Box>
            <Box>
              <Text color="white" bold>{source.title}</Text>
            </Box>
            {source.url && (
              <Text color="blue" dimColor>{source.url}</Text>
            )}
            {source.snippet && (
              <Text color="gray" wrap="wrap">"{source.snippet.slice(0, 80)}..."</Text>
            )}
          </Box>
        ))}
      </Box>
    </Box>
  );
};

/**
 * Render source heatmap to string
 */
export function renderSourceHeatmap(sources: SourceCitation[], title?: string): string {
  return renderInkToString(<SourceHeatmap sources={sources} title={title} />);
}

// ============================================================================
// ASCII FLOWCHARTS (Mermaid alternative for terminals)
// ============================================================================

/**
 * Flowchart node
 */
export interface FlowNode {
  id: string;
  label: string;
  type?: 'start' | 'end' | 'process' | 'decision' | 'io';
}

/**
 * Flowchart edge
 */
export interface FlowEdge {
  from: string;
  to: string;
  label?: string;
}

/**
 * Render a node box based on type
 */
function renderNodeBox(label: string, type: FlowNode['type'] = 'process'): string[] {
  const width = Math.max(label.length + 4, 10);
  const pad = (s: string, w: number) => {
    const left = Math.floor((w - s.length) / 2);
    const right = w - s.length - left;
    return ' '.repeat(left) + s + ' '.repeat(right);
  };

  switch (type) {
    case 'start':
    case 'end':
      // Rounded: ( label )
      return [
        '╭' + '─'.repeat(width) + '╮',
        '│' + pad(label, width) + '│',
        '╰' + '─'.repeat(width) + '╯',
      ];
    case 'decision':
      // Diamond shape approximation
      const half = Math.floor(width / 2);
      return [
        ' '.repeat(half) + '◇' + ' '.repeat(half),
        '◁' + pad(label, width) + '▷',
        ' '.repeat(half) + '◇' + ' '.repeat(half),
      ];
    case 'io':
      // Parallelogram approximation
      return [
        '╱' + '─'.repeat(width) + '╲',
        '│' + pad(label, width) + '│',
        '╲' + '─'.repeat(width) + '╱',
      ];
    default:
      // Rectangle
      return [
        '┌' + '─'.repeat(width) + '┐',
        '│' + pad(label, width) + '│',
        '└' + '─'.repeat(width) + '┘',
      ];
  }
}

/**
 * ASCII Flowchart - Simple vertical flowchart renderer
 */
export const AsciiFlowchart: React.FC<{ nodes: FlowNode[]; edges: FlowEdge[]; title?: string }> = ({
  nodes,
  edges,
  title = 'Flowchart',
}) => {
  // Build a simple vertical layout following edge order
  const nodeMap = new Map(nodes.map(n => [n.id, n]));
  const visited = new Set<string>();
  const orderedNodes: FlowNode[] = [];

  // Simple topological sort for linear flow
  const startNode = nodes.find(n => n.type === 'start') || nodes[0];
  if (startNode) {
    let current: string | undefined = startNode.id;
    while (current && !visited.has(current)) {
      visited.add(current);
      const node = nodeMap.get(current);
      if (node) orderedNodes.push(node);
      const edge = edges.find(e => e.from === current);
      current = edge?.to;
    }
  }

  // Add any remaining nodes
  nodes.forEach(n => {
    if (!visited.has(n.id)) orderedNodes.push(n);
  });

  return (
    <Box flexDirection="column" borderStyle="round" borderColor="cyan" padding={1}>
      <Gradient name="cristal">
        <Text bold>{icon('workflow')} {title}</Text>
      </Gradient>

      <Box marginTop={1} flexDirection="column">
        {orderedNodes.map((node, idx) => {
          const box = renderNodeBox(node.label, node.type);
          const edge = edges.find(e => e.from === node.id);
          const nodeColor = node.type === 'start' ? 'green' :
                           node.type === 'end' ? 'red' :
                           node.type === 'decision' ? 'yellow' : 'white';

          return (
            <Box key={node.id} flexDirection="column" alignItems="center">
              {box.map((line, i) => (
                <Text key={i} color={nodeColor}>{line}</Text>
              ))}
              {idx < orderedNodes.length - 1 && (
                <Box flexDirection="column" alignItems="center">
                  <Text color="cyan">│</Text>
                  {edge?.label && <Text color="gray">{edge.label}</Text>}
                  <Text color="cyan">▼</Text>
                </Box>
              )}
            </Box>
          );
        })}
      </Box>
    </Box>
  );
};

/**
 * Render ASCII flowchart to string
 */
export function renderAsciiFlowchart(nodes: FlowNode[], edges: FlowEdge[], title?: string): string {
  return renderInkToString(<AsciiFlowchart nodes={nodes} edges={edges} title={title} />);
}

/**
 * Quick flowchart from simple array of steps
 * @example renderQuickFlow(['Start', 'Process A', 'Decision?', 'End'])
 */
export function renderQuickFlow(steps: string[], title?: string): string {
  const nodes: FlowNode[] = steps.map((label, i) => ({
    id: `n${i}`,
    label,
    type: i === 0 ? 'start' : i === steps.length - 1 ? 'end' :
          label.includes('?') ? 'decision' : 'process',
  }));

  const edges: FlowEdge[] = steps.slice(0, -1).map((_, i) => ({
    from: `n${i}`,
    to: `n${i + 1}`,
  }));

  return renderAsciiFlowchart(nodes, edges, title);
}

// ============================================================================
// BORDER BOX UTILITIES
// ============================================================================

/**
 * All available Ink border styles with their Unicode characters
 */
export const borderChars = {
  single:       { h: '─', v: '│', tl: '┌', tr: '┐', bl: '└', br: '┘' },
  double:       { h: '═', v: '║', tl: '╔', tr: '╗', bl: '╚', br: '╝' },
  round:        { h: '─', v: '│', tl: '╭', tr: '╮', bl: '╰', br: '╯' },
  bold:         { h: '━', v: '┃', tl: '┏', tr: '┓', bl: '┗', br: '┛' },
  singleDouble: { h: '─', v: '║', tl: '╓', tr: '╖', bl: '╙', br: '╜' },
  doubleSingle: { h: '═', v: '│', tl: '╒', tr: '╕', bl: '╘', br: '╛' },
  classic:      { h: '-', v: '|', tl: '+', tr: '+', bl: '+', br: '+' },
} as const;

export type BorderStyle = keyof typeof borderChars;

export interface BorderBoxProps {
  children: React.ReactNode;
  style?: BorderStyle;
  color?: string;
  title?: string;
  titleColor?: string;
  titleGradient?: string;  // Use gradient for title (e.g., 'cristal', 'rainbow', 'passion')
  padding?: number;
  paddingX?: number;
  paddingY?: number;
  width?: number | string;
}

/**
 * BorderBox - Consistent styled box with proper Unicode borders
 *
 * @example
 * <BorderBox style="round" color="cyan" title="Results">
 *   <Text>Content here</Text>
 * </BorderBox>
 *
 * @example With gradient title
 * <BorderBox style="double" color="magenta" title="TachiBot" titleGradient="cristal">
 *   <Text>Fancy content</Text>
 * </BorderBox>
 */
export const BorderBox: React.FC<BorderBoxProps> = ({
  children,
  style = 'round',
  color = 'gray',
  title,
  titleColor = 'white',
  titleGradient,
  padding,
  paddingX = padding ?? 1,
  paddingY = padding ?? 0,
  width,
}) => {
  const titleElement = title ? (
    titleGradient ? (
      <Gradient name={titleGradient as any}>
        <Text bold>{title}</Text>
      </Gradient>
    ) : (
      <Text bold color={titleColor}>{title}</Text>
    )
  ) : null;

  return (
    <Box
      flexDirection="column"
      borderStyle={style}
      borderColor={color}
      paddingX={paddingX}
      paddingY={paddingY}
      width={width}
    >
      {titleElement && <Box marginBottom={1}>{titleElement}</Box>}
      {children}
    </Box>
  );
};

/**
 * Render a BorderBox to string
 */
export function renderBorderBox(
  content: string | React.ReactNode,
  options: Omit<BorderBoxProps, 'children'> = {}
): string {
  const child = typeof content === 'string' ? <Text>{content}</Text> : content;
  return renderInkToString(<BorderBox {...options}>{child}</BorderBox>);
}

export interface GradientBorderBoxProps {
  children: React.ReactNode;
  style?: BorderStyle;
  gradient?: string | string[];  // Gradient name or custom colors
  title?: string;
  width?: number;
  paddingX?: number;
}

/**
 * GradientBorderBox - Box with gradient-colored borders!
 * Uses gradient-string for TrueColor gradient borders.
 *
 * @example
 * <GradientBorderBox gradient="cristal" title="TachiBot">
 *   <Text>Rainbow borders!</Text>
 * </GradientBorderBox>
 */
export const GradientBorderBox: React.FC<GradientBorderBoxProps> = ({
  children,
  style = 'round',
  gradient = 'cristal',
  title,
  width = 60,
  paddingX = 1,
}) => {
  const chars = borderChars[style];
  const innerWidth = width - 2;  // Account for vertical borders
  const padding = ' '.repeat(paddingX);

  // Get gradient function
  const gradFn = typeof gradient === 'string'
    ? (gradientString as any)[gradient] || gradientString.cristal
    : gradientString(gradient);

  // Build border strings
  const topBorder = title
    ? `${chars.tl}${chars.h} ${title} ${chars.h.repeat(Math.max(0, innerWidth - title.length - 3))}${chars.tr}`
    : `${chars.tl}${chars.h.repeat(innerWidth)}${chars.tr}`;
  const bottomBorder = `${chars.bl}${chars.h.repeat(innerWidth)}${chars.br}`;

  return (
    <Box flexDirection="column">
      <Text>{gradFn(topBorder)}</Text>
      <Box flexDirection="row">
        <Text>{gradFn(chars.v)}</Text>
        <Box flexDirection="column" width={innerWidth - 2}>
          <Text>{padding}</Text>
          {children}
          <Text>{padding}</Text>
        </Box>
        <Text>{gradFn(chars.v)}</Text>
      </Box>
      <Text>{gradFn(bottomBorder)}</Text>
    </Box>
  );
};

/**
 * Render a gradient border box to string
 * Uses pure string output to preserve ANSI color codes
 *
 * Supports:
 * - Built-in presets: 'cristal', 'rainbow', 'passion', etc.
 * - Theme names: 'dracula', 'nord', 'solarized' (from themes/*.json)
 * - Custom colors: ['#ff0000', '#00ff00', '#0000ff']
 */
export function renderGradientBorderBox(
  content: string,
  options: Omit<GradientBorderBoxProps, 'children'> = {}
): string {
  const {
    style = 'round',
    gradient = 'cristal',
    title,
    width = 60,
    paddingX = 1,
  } = options;

  const chars = borderChars[style];
  const innerWidth = width - 2;
  const padding = ' '.repeat(paddingX);

  // Get gradient function - check theme first, then presets, then custom colors
  type GradientFn = (text: string) => string;
  let gradFn: GradientFn;

  if (typeof gradient === 'string') {
    // Try theme gradient first
    const themeGrad = createThemeGradient(gradient);
    if (themeGrad) {
      gradFn = themeGrad;
    } else {
      // Fall back to built-in preset
      gradFn = (gradientString as unknown as Record<string, GradientFn>)[gradient] || gradientString.cristal;
    }
  } else {
    // Custom color array
    gradFn = gradientString(gradient as string[]);
  }

  // Build border strings with gradients
  const topBorder = title
    ? `${chars.tl}${chars.h} ${title} ${chars.h.repeat(Math.max(0, innerWidth - title.length - 3))}${chars.tr}`
    : `${chars.tl}${chars.h.repeat(innerWidth)}${chars.tr}`;
  const bottomBorder = `${chars.bl}${chars.h.repeat(innerWidth)}${chars.br}`;

  // Content lines - innerWidth is space between vertical bars
  const contentLines = content.split('\n');
  const contentWidth = innerWidth - (paddingX * 2);  // subtract padding only

  const lines: string[] = [
    gradFn(topBorder),
    `${gradFn(chars.v)}${padding}${' '.repeat(contentWidth)}${padding}${gradFn(chars.v)}`,
  ];

  for (const line of contentLines) {
    const paddedLine = line.padEnd(contentWidth);
    lines.push(`${gradFn(chars.v)}${padding}${paddedLine}${padding}${gradFn(chars.v)}`);
  }

  lines.push(
    `${gradFn(chars.v)}${padding}${' '.repeat(contentWidth)}${padding}${gradFn(chars.v)}`,
    gradFn(bottomBorder)
  );

  return lines.join('\n');
}

/**
 * Available gradient presets from gradient-string
 */
export const gradientPresets = [
  'cristal',
  'teen',
  'mind',
  'morning',
  'vice',
  'passion',
  'fruit',
  'instagram',
  'atlas',
  'retro',
  'summer',
  'rainbow',
  'pastel',
] as const;

/**
 * Quick border wrapper for any text
 * @example quickBorder('Hello!', 'round', 'cyan')
 */
export function quickBorder(
  text: string,
  style: BorderStyle = 'round',
  color: string = 'gray'
): string {
  return renderBorderBox(text, { style, color });
}

/**
 * Draw a manual ASCII box (for when you need pure string output)
 */
export function drawBox(
  lines: string[],
  style: BorderStyle = 'round',
  title?: string
): string {
  const chars = borderChars[style];
  const maxLen = Math.max(...lines.map(l => l.length), title?.length ?? 0);
  const width = maxLen + 4;

  const output: string[] = [];

  // Top border
  if (title) {
    const pad = width - title.length - 4;
    output.push(`${chars.tl}${chars.h} ${title} ${chars.h.repeat(pad)}${chars.tr}`);
  } else {
    output.push(`${chars.tl}${chars.h.repeat(width - 2)}${chars.tr}`);
  }

  // Content
  for (const line of lines) {
    const padded = line.padEnd(maxLen);
    output.push(`${chars.v} ${padded} ${chars.v}`);
  }

  // Bottom border
  output.push(`${chars.bl}${chars.h.repeat(width - 2)}${chars.br}`);

  return output.join('\n');
}

// ============================================================================
// TABLE COMPONENTS (Custom implementation - no ink-table dependency)
// ============================================================================

export interface DataTableProps<T extends ScalarDict> {
  data: T[];
  title?: string;
  titleGradient?: string;
  borderStyle?: BorderStyle;
  borderColor?: string;
}

/**
 * Custom Table component - pure Ink implementation
 * Renders tabular data with Unicode box-drawing borders
 */
export function Table<T extends ScalarDict>({
  data,
  borderStyle = 'single',
}: { data: T[]; borderStyle?: BorderStyle }) {
  if (data.length === 0) return <Text dimColor>No data</Text>;

  const chars = borderChars[borderStyle];
  const columns = Object.keys(data[0]);

  // Calculate column widths
  const widths: Record<string, number> = {};
  columns.forEach(col => {
    widths[col] = Math.max(
      col.length,
      ...data.map(row => String(row[col] ?? '').length)
    );
  });

  // Build border lines
  const totalWidth = columns.reduce((sum, col) => sum + widths[col] + 3, 0) + 1;
  const headerSep = columns.map(col => chars.h.repeat(widths[col] + 2)).join(chars.h);
  const rowSep = columns.map(col => chars.h.repeat(widths[col] + 2)).join('┼');

  return (
    <Box flexDirection="column">
      {/* Top border */}
      <Text color="gray">{chars.tl}{headerSep}{chars.tr}</Text>

      {/* Header row */}
      <Text>
        <Text color="gray">{chars.v}</Text>
        {columns.map((col, i) => (
          <React.Fragment key={col}>
            <Text bold color="cyan"> {col.padEnd(widths[col])} </Text>
            <Text color="gray">{chars.v}</Text>
          </React.Fragment>
        ))}
      </Text>

      {/* Header separator */}
      <Text color="gray">├{rowSep}┤</Text>

      {/* Data rows */}
      {data.map((row, rowIdx) => (
        <Text key={rowIdx}>
          <Text color="gray">{chars.v}</Text>
          {columns.map((col, i) => (
            <React.Fragment key={col}>
              <Text> {String(row[col] ?? '').padEnd(widths[col])} </Text>
              <Text color="gray">{chars.v}</Text>
            </React.Fragment>
          ))}
        </Text>
      ))}

      {/* Bottom border */}
      <Text color="gray">{chars.bl}{headerSep}{chars.br}</Text>
    </Box>
  );
}

/**
 * DataTable - Render data as a beautiful table with title
 *
 * @example
 * const data = [
 *   { model: 'Gemini', tokens: 1500, time: '2.3s' },
 *   { model: 'Grok', tokens: 1200, time: '1.8s' },
 * ];
 * <DataTable data={data} title="Model Comparison" />
 */
export function DataTable<T extends ScalarDict>({
  data,
  title,
  titleGradient = 'cristal',
  borderStyle = 'single',
}: DataTableProps<T>) {
  return (
    <Box flexDirection="column">
      {title && (
        <Box marginBottom={1}>
          <Gradient name={titleGradient as GradientName}>
            <Text bold>{icon('table')} {title}</Text>
          </Gradient>
        </Box>
      )}
      <Table data={data} borderStyle={borderStyle} />
    </Box>
  );
}

/**
 * Render a data table to string
 */
export function renderTable<T extends ScalarDict>(
  data: T[],
  title?: string,
  options: { gradient?: string; borderStyle?: BorderStyle } = {}
): string {
  return renderInkToString(
    <DataTable
      data={data}
      title={title}
      titleGradient={options.gradient}
      borderStyle={options.borderStyle}
    />
  );
}

/**
 * Render a simple key-value table
 */
export function renderKeyValueTable(
  entries: Record<string, string | number | boolean>,
  title?: string
): string {
  const data = Object.entries(entries).map(([key, value]) => ({
    Key: key,
    Value: String(value),
  }));
  return renderTable(data, title);
}

/**
 * Render a comparison table (useful for model comparisons)
 */
export function renderComparisonTable(
  items: Array<{ name: string; [key: string]: string | number }>,
  title?: string
): string {
  return renderTable(items, title);
}

// ============================================================================
// BRAILLE HIGH-RESOLUTION VISUALIZATIONS
// ============================================================================

/**
 * Braille patterns for 2x4 pixel density
 * Each braille character represents a 2x4 grid of dots
 * Unicode range: U+2800 to U+28FF
 */
const BRAILLE_BASE = 0x2800;

// Dot positions in braille (binary):
// 1 8
// 2 16
// 4 32
// 64 128

/**
 * Convert 2x4 grid of booleans to braille character
 */
function gridToBraille(grid: boolean[][]): string {
  const weights = [
    [1, 8],
    [2, 16],
    [4, 32],
    [64, 128],
  ];

  let value = 0;
  for (let row = 0; row < 4; row++) {
    for (let col = 0; col < 2; col++) {
      if (grid[row]?.[col]) {
        value += weights[row][col];
      }
    }
  }

  return String.fromCharCode(BRAILLE_BASE + value);
}

/**
 * Braille sparkline - ultra high-res sparkline using braille patterns
 * Provides 2x horizontal and 4x vertical resolution vs regular sparklines
 */
export function brailleSparkline(values: number[], width: number = 20): string {
  if (values.length === 0) return ' '.repeat(width);

  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;

  // We need width * 2 data points (each braille char is 2 wide)
  const targetPoints = width * 2;
  const step = values.length / targetPoints;

  const result: string[] = [];

  for (let i = 0; i < width; i++) {
    const grid: boolean[][] = [[], [], [], []];

    for (let col = 0; col < 2; col++) {
      const idx = Math.floor((i * 2 + col) * step);
      const val = values[Math.min(idx, values.length - 1)];
      const normalized = (val - min) / range;  // 0-1
      const height = Math.round(normalized * 4);  // 0-4 dots

      for (let row = 0; row < 4; row++) {
        grid[3 - row][col] = row < height;  // Bottom to top
      }
    }

    result.push(gridToBraille(grid));
  }

  return result.join('');
}

/**
 * Braille bar chart - horizontal bars with braille precision
 */
export function brailleBar(value: number, maxValue: number, width: number = 20): string {
  const ratio = Math.min(value / maxValue, 1);
  const fullChars = Math.floor(ratio * width);
  const partialRatio = (ratio * width) - fullChars;

  // Full braille block (all dots): ⣿
  const full = '⣿'.repeat(fullChars);

  // Partial using different dot patterns
  let partial = '';
  if (partialRatio > 0) {
    const partialDots = Math.round(partialRatio * 8);
    const patterns = [' ', '⡀', '⡄', '⡆', '⡇', '⣇', '⣧', '⣷', '⣿'];
    partial = patterns[partialDots];
  }

  const empty = ' '.repeat(Math.max(0, width - fullChars - (partial ? 1 : 0)));

  return full + partial + empty;
}

/**
 * Braille gradient progress bar - smooth gradient with braille precision
 * Uses gradient colors for filled portion and dark blocks for empty
 */
export const BrailleGradientProgress: React.FC<{
  value: number;
  maxValue: number;
  width?: number;
  gradient?: 'rainbow' | 'cristal' | 'passion' | 'teen' | 'mind' | 'atlas' | 'retro';
  showPercent?: boolean;
  label?: string;
}> = ({ value, maxValue, width = 30, gradient = 'cristal', showPercent = true, label }) => {
  const ratio = Math.min(value / maxValue, 1);
  const percent = Math.round(ratio * 100);
  const fullChars = Math.floor(ratio * width);
  const partialRatio = (ratio * width) - fullChars;

  // Partial braille patterns (8 levels)
  const patterns = ['⠀', '⡀', '⡄', '⡆', '⡇', '⣇', '⣧', '⣷', '⣿'];
  const partialIdx = Math.round(partialRatio * 8);
  const partial = partialIdx > 0 ? patterns[partialIdx] : '';

  const emptyChars = Math.max(0, width - fullChars - (partial ? 1 : 0));
  const filledStr = '⣿'.repeat(fullChars) + partial;
  const emptyStr = '⣿'.repeat(emptyChars);

  return (
    <Box>
      {label && <Text color="gray">{label.padEnd(12)}</Text>}
      <Text>[</Text>
      <Gradient name={gradient}>
        <Text>{filledStr}</Text>
      </Gradient>
      <Text color="#374151">{emptyStr}</Text>
      <Text>]</Text>
      {showPercent && <Text color="gray"> {percent}%</Text>}
    </Box>
  );
};

/**
 * Render braille gradient progress to string (for non-React contexts)
 */
export function renderBrailleGradientProgress(
  value: number,
  maxValue: number,
  width: number = 30,
  gradient: 'rainbow' | 'cristal' | 'passion' | 'teen' | 'mind' = 'cristal'
): string {
  return renderInkToString(
    <BrailleGradientProgress
      value={value}
      maxValue={maxValue}
      width={width}
      gradient={gradient}
    />
  );
}

/**
 * Braille heatmap - 2D visualization with braille patterns
 */
export function brailleHeatmap(data: number[][], width: number = 40): string {
  if (data.length === 0 || data[0].length === 0) return '';

  const rows = data.length;
  const cols = data[0].length;
  const min = Math.min(...data.flat());
  const max = Math.max(...data.flat());
  const range = max - min || 1;

  const lines: string[] = [];

  // Process 4 rows at a time (braille height)
  for (let y = 0; y < rows; y += 4) {
    let line = '';

    // Process 2 cols at a time (braille width)
    for (let x = 0; x < cols; x += 2) {
      const grid: boolean[][] = [[], [], [], []];

      for (let dy = 0; dy < 4; dy++) {
        for (let dx = 0; dx < 2; dx++) {
          const val = data[y + dy]?.[x + dx] ?? 0;
          const normalized = (val - min) / range;
          grid[dy][dx] = normalized > 0.5;  // Threshold
        }
      }

      line += gridToBraille(grid);
    }

    lines.push(line);
  }

  return lines.join('\n');
}

/**
 * BrailleSparkline component
 */
export const BrailleSparklineComponent: React.FC<{
  values: number[];
  width?: number;
  label?: string;
  color?: string;
  showValue?: boolean;
}> = ({ values, width = 20, label, color = 'cyan', showValue = true }) => {
  const latest = values[values.length - 1];
  const trend = values.length > 1
    ? (latest > values[values.length - 2] ? '↑' : latest < values[values.length - 2] ? '↓' : '→')
    : '→';
  const trendColor = trend === '↑' ? 'green' : trend === '↓' ? 'red' : 'gray';

  return (
    <Box>
      {label && <Text color="gray">{label.padEnd(12)}</Text>}
      <Text color={color}>{brailleSparkline(values, width)}</Text>
      {showValue && (
        <>
          <Text color={trendColor}> {trend}</Text>
          <Text color="white"> {latest?.toFixed(1)}</Text>
        </>
      )}
    </Box>
  );
};

/**
 * Render braille sparkline to string
 */
export function renderBrailleSparkline(
  values: number[],
  options: { width?: number; label?: string; color?: string } = {}
): string {
  return renderInkToString(
    <BrailleSparklineComponent values={values} {...options} />
  );
}

// ============================================================================
// SIDE-BY-SIDE DIFF COMPONENT
// ============================================================================

export interface DiffLine {
  type: 'unchanged' | 'added' | 'removed' | 'modified';
  left?: string;
  right?: string;
  leftNum?: number;
  rightNum?: number;
}

/**
 * Character-level diff highlighting
 */
function highlightCharDiff(left: string, right: string): { left: React.ReactNode; right: React.ReactNode } {
  const leftChars: React.ReactNode[] = [];
  const rightChars: React.ReactNode[] = [];

  const maxLen = Math.max(left.length, right.length);

  for (let i = 0; i < maxLen; i++) {
    const lChar = left[i] || ' ';
    const rChar = right[i] || ' ';

    if (lChar === rChar) {
      leftChars.push(<Text key={i}>{lChar}</Text>);
      rightChars.push(<Text key={i}>{rChar}</Text>);
    } else {
      leftChars.push(<Text key={i} backgroundColor="red" color="white">{lChar}</Text>);
      rightChars.push(<Text key={i} backgroundColor="green" color="white">{rChar}</Text>);
    }
  }

  return {
    left: <>{leftChars}</>,
    right: <>{rightChars}</>,
  };
}

/**
 * Side-by-side diff viewer with character-level highlighting
 */
export const SideBySideDiff: React.FC<{
  lines: DiffLine[];
  width?: number;
  title?: string;
}> = ({ lines, width = 80, title }) => {
  const halfWidth = Math.floor((width - 7) / 2);  // Account for gutter and line numbers

  const lineColors: Record<DiffLine['type'], string> = {
    unchanged: 'white',
    added: 'green',
    removed: 'red',
    modified: 'yellow',
  };

  const lineIndicators: Record<DiffLine['type'], string> = {
    unchanged: ' ',
    added: '+',
    removed: '-',
    modified: '~',
  };

  return (
    <Box flexDirection="column" borderStyle="round" borderColor="gray" padding={1}>
      {title && (
        <Box marginBottom={1}>
          <Gradient name="teen">
            <Text bold>{icon('gitCommit')} {title}</Text>
          </Gradient>
        </Box>
      )}

      {/* Header */}
      <Box>
        <Text color="gray">{'─'.repeat(halfWidth + 5)}┬{'─'.repeat(halfWidth + 1)}</Text>
      </Box>

      {lines.map((line, idx) => {
        const leftText = (line.left || '').slice(0, halfWidth).padEnd(halfWidth);
        const rightText = (line.right || '').slice(0, halfWidth).padEnd(halfWidth);

        if (line.type === 'modified' && line.left && line.right) {
          const { left: highlightedLeft, right: highlightedRight } = highlightCharDiff(
            line.left.slice(0, halfWidth),
            line.right.slice(0, halfWidth)
          );

          return (
            <Box key={idx}>
              <Text color="gray">{String(line.leftNum || '').padStart(3)} </Text>
              <Text color="yellow">{highlightedLeft}</Text>
              <Text color="gray"> │ </Text>
              <Text color="yellow">{highlightedRight}</Text>
            </Box>
          );
        }

        return (
          <Box key={idx}>
            <Text color="gray">{String(line.leftNum || '').padStart(3)} </Text>
            <Text color={lineColors[line.type]}>
              {lineIndicators[line.type]}{leftText}
            </Text>
            <Text color="gray"> │ </Text>
            <Text color={lineColors[line.type]}>
              {lineIndicators[line.type]}{rightText}
            </Text>
          </Box>
        );
      })}
    </Box>
  );
};

/**
 * Render side-by-side diff to string
 */
export function renderSideBySideDiff(
  lines: DiffLine[],
  title?: string,
  width?: number
): string {
  return renderInkToString(<SideBySideDiff lines={lines} title={title} width={width} />);
}

/**
 * Create diff lines from two strings
 */
export function createDiff(left: string, right: string): DiffLine[] {
  const leftLines = left.split('\n');
  const rightLines = right.split('\n');
  const maxLines = Math.max(leftLines.length, rightLines.length);

  const result: DiffLine[] = [];

  for (let i = 0; i < maxLines; i++) {
    const l = leftLines[i];
    const r = rightLines[i];

    if (l === r) {
      result.push({ type: 'unchanged', left: l, right: r, leftNum: i + 1, rightNum: i + 1 });
    } else if (l === undefined) {
      result.push({ type: 'added', right: r, rightNum: i + 1 });
    } else if (r === undefined) {
      result.push({ type: 'removed', left: l, leftNum: i + 1 });
    } else {
      result.push({ type: 'modified', left: l, right: r, leftNum: i + 1, rightNum: i + 1 });
    }
  }

  return result;
}

// ============================================================================
// SEMANTIC BADGES
// ============================================================================

export type BadgeVariant = 'success' | 'error' | 'warning' | 'info' | 'cached' | 'duration' | 'model' | 'custom';

export interface BadgeProps {
  text: string;
  variant?: BadgeVariant;
  icon?: string;
  color?: string;
  bgColor?: string;
}

/**
 * Semantic badge component
 * For inline status indicators like (CACHED), (300ms), etc.
 */
export const Badge: React.FC<BadgeProps> = ({
  text,
  variant = 'info',
  icon: customIcon,
  color,
  bgColor,
}) => {
  const variants: Record<BadgeVariant, { icon: string; color: string; bg?: string }> = {
    success: { icon: '✓', color: 'green' },
    error: { icon: '✗', color: 'red' },
    warning: { icon: '⚠', color: 'yellow' },
    info: { icon: 'ℹ', color: 'cyan' },
    cached: { icon: '◉', color: 'green', bg: 'green' },
    duration: { icon: '◷', color: 'gray' },
    model: { icon: '◈', color: 'magenta' },
    custom: { icon: '•', color: 'white' },
  };

  const v = variants[variant];
  const badgeIcon = customIcon || v.icon;
  const badgeColor = color || v.color;

  if (bgColor || v.bg) {
    return (
      <Text backgroundColor={bgColor || v.bg} color="white">
        {' '}{badgeIcon} {text}{' '}
      </Text>
    );
  }

  return (
    <Text color={badgeColor}>
      ({badgeIcon} {text})
    </Text>
  );
};

/**
 * Cached badge - shows cache hit
 */
export const CachedBadge: React.FC<{ tokens?: number }> = ({ tokens }) => (
  <Badge
    variant="cached"
    text={tokens ? `CACHED ${tokens} tok` : 'CACHED'}
  />
);

/**
 * Duration badge - shows timing
 */
export const DurationBadge: React.FC<{ ms: number }> = ({ ms }) => (
  <Badge
    variant="duration"
    text={ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(1)}s`}
  />
);

/**
 * Model badge - shows model name with appropriate gradient
 */
export const ModelBadge: React.FC<{ model: string }> = ({ model }) => {
  const gradient = modelGradients[model.toLowerCase()] || 'rainbow';
  return (
    <Gradient name={gradient as GradientName}>
      <Text bold> {model} </Text>
    </Gradient>
  );
};

/**
 * Badge group - multiple badges inline
 */
export const BadgeGroup: React.FC<{ badges: BadgeProps[] }> = ({ badges }) => (
  <Box flexDirection="row">
    {badges.map((badge, idx) => (
      <Box key={idx} marginRight={1}>
        <Badge {...badge} />
      </Box>
    ))}
  </Box>
);

/**
 * Render badges to string
 */
export function renderBadge(badge: BadgeProps): string {
  return renderInkToString(<Badge {...badge} />);
}

export function renderBadgeGroup(badges: BadgeProps[]): string {
  return renderInkToString(<BadgeGroup badges={badges} />);
}

// ============================================================================
// DROP SHADOW EFFECTS
// ============================================================================

/**
 * Shadow characters for drop shadow effect
 */
const shadowChars = {
  bottom: '▄',
  right: '▐',
  corner: '▖',
  full: '█',
};

/**
 * Add drop shadow to a box of text
 * Uses block characters to create shadow effect
 */
export function addDropShadow(content: string, shadowColor: string = 'gray'): string {
  const lines = content.split('\n');
  const maxWidth = Math.max(...lines.map(l => l.replace(/\x1b\[[0-9;]*m/g, '').length));

  const result: string[] = [];

  // Add shadow to right side of each line
  for (const line of lines) {
    const visibleLen = line.replace(/\x1b\[[0-9;]*m/g, '').length;
    const padding = ' '.repeat(maxWidth - visibleLen);
    result.push(`${line}${padding} \x1b[90m${shadowChars.right}\x1b[0m`);
  }

  // Add bottom shadow
  const bottomShadow = ` \x1b[90m${shadowChars.bottom.repeat(maxWidth + 1)}${shadowChars.corner}\x1b[0m`;
  result.push(bottomShadow);

  return result.join('\n');
}

/**
 * ShadowBox component - box with drop shadow
 */
export const ShadowBox: React.FC<{
  children: React.ReactNode;
  shadowColor?: string;
  borderStyle?: BorderStyle;
  borderColor?: string;
}> = ({ children, shadowColor = 'gray', borderStyle = 'round', borderColor = 'cyan' }) => {
  return (
    <Box flexDirection="column">
      <Box flexDirection="row">
        <Box
          flexDirection="column"
          borderStyle={borderStyle}
          borderColor={borderColor}
          paddingX={1}
        >
          {children}
        </Box>
        <Box flexDirection="column">
          <Text color={shadowColor}>{shadowChars.right}</Text>
          <Text color={shadowColor}>{shadowChars.right}</Text>
          <Text color={shadowColor}>{shadowChars.right}</Text>
        </Box>
      </Box>
      <Box marginLeft={1}>
        <Text color={shadowColor}>
          {shadowChars.bottom.repeat(10)}{shadowChars.corner}
        </Text>
      </Box>
    </Box>
  );
};

/**
 * Render gradient box with drop shadow
 */
export function renderGradientBoxWithShadow(
  content: string,
  options: Omit<GradientBorderBoxProps, 'children'> = {}
): string {
  const box = renderGradientBorderBox(content, options);
  return addDropShadow(box);
}

// ============================================================================
// CODE MINIMAP
// ============================================================================

/**
 * Generate VS Code style minimap of code
 * Uses braille patterns to compress code into overview
 */
export function codeMinimapBraille(code: string, width: number = 20, height: number = 10): string {
  const lines = code.split('\n');
  const linesPerRow = Math.ceil(lines.length / height);

  const result: string[] = [];

  for (let y = 0; y < height; y++) {
    let row = '';
    const startLine = y * linesPerRow;
    const endLine = Math.min(startLine + linesPerRow, lines.length);

    // Sample lines in this section
    const sectionLines = lines.slice(startLine, endLine);
    const avgLineLength = sectionLines.reduce((sum, l) => sum + l.length, 0) / (sectionLines.length || 1);
    const maxLineLength = Math.max(...sectionLines.map(l => l.length), 1);

    // Generate minimap row
    for (let x = 0; x < width; x++) {
      const charPos = Math.floor((x / width) * maxLineLength);

      // Check if any lines have content at this position
      let hasContent = false;
      let density = 0;

      for (const line of sectionLines) {
        if (line.length > charPos && line[charPos] !== ' ') {
          hasContent = true;
          density++;
        }
      }

      if (!hasContent) {
        row += ' ';
      } else {
        // Use braille density
        const ratio = density / sectionLines.length;
        if (ratio > 0.7) row += '⣿';
        else if (ratio > 0.4) row += '⣦';
        else if (ratio > 0.2) row += '⢇';
        else row += '⠂';
      }
    }

    result.push(row);
  }

  return result.join('\n');
}

/**
 * CodeMinimap component
 */
export const CodeMinimap: React.FC<{
  code: string;
  width?: number;
  height?: number;
  highlightLine?: number;
  color?: string;
}> = ({ code, width = 20, height = 10, highlightLine, color = 'cyan' }) => {
  const minimap = codeMinimapBraille(code, width, height);
  const lines = minimap.split('\n');
  const codeLines = code.split('\n').length;
  const linesPerRow = Math.ceil(codeLines / height);

  return (
    <Box flexDirection="column" borderStyle="round" borderColor="gray">
      <Text color="gray" dimColor> MINIMAP </Text>
      {lines.map((line, idx) => {
        const isHighlighted = highlightLine !== undefined &&
          highlightLine >= idx * linesPerRow &&
          highlightLine < (idx + 1) * linesPerRow;

        return (
          <Text key={idx} color={isHighlighted ? 'yellow' : color}>
            {isHighlighted ? '▶' : ' '}{line}
          </Text>
        );
      })}
    </Box>
  );
};

/**
 * Render code minimap to string
 */
export function renderCodeMinimap(
  code: string,
  options: { width?: number; height?: number; highlightLine?: number } = {}
): string {
  return renderInkToString(<CodeMinimap code={code} {...options} />);
}

// ============================================================================
// HEATMAP MATRIX
// ============================================================================

/**
 * Heatmap cell intensity characters
 */
// Use solid blocks with color intensity instead of shade patterns
const heatChars = ['█', '█', '█', '█'];
const heatColors = ['#1e3a5f', '#0891b2', '#eab308', '#ef4444']; // Dark blue → cyan → yellow → red

/**
 * HeatmapMatrix - 2D colored intensity grid
 */
export const HeatmapMatrix: React.FC<{
  data: number[][];
  rowLabels?: string[];
  colLabels?: string[];
  title?: string;
}> = ({ data, rowLabels, colLabels, title }) => {
  if (data.length === 0) return null;

  const min = Math.min(...data.flat());
  const max = Math.max(...data.flat());
  const range = max - min || 1;

  const getCell = (value: number) => {
    const normalized = (value - min) / range;
    const charIdx = Math.floor(normalized * (heatChars.length - 1));
    const colorIdx = Math.floor(normalized * (heatColors.length - 1));
    return { char: heatChars[charIdx], color: heatColors[colorIdx] };
  };

  const labelWidth = rowLabels ? Math.max(...rowLabels.map(l => l.length)) : 0;

  return (
    <Box flexDirection="column" borderStyle="round" borderColor="gray" padding={1}>
      {title && (
        <Gradient name="vice">
          <Text bold>{icon('chartBar')} {title}</Text>
        </Gradient>
      )}

      {/* Column labels */}
      {colLabels && (
        <Box marginTop={1} marginLeft={labelWidth + 2}>
          {colLabels.map((label, idx) => (
            <Text key={idx} color="gray">{label[0] || ' '} </Text>
          ))}
        </Box>
      )}

      {/* Data rows */}
      <Box marginTop={colLabels ? 0 : 1} flexDirection="column">
        {data.map((row, rowIdx) => (
          <Box key={rowIdx}>
            {rowLabels && (
              <Text color="gray">{rowLabels[rowIdx]?.padEnd(labelWidth) || ''} </Text>
            )}
            {row.map((val, colIdx) => {
              const { char, color } = getCell(val);
              return (
                <Text key={colIdx} color={color}>{char}{char}</Text>
              );
            })}
          </Box>
        ))}
      </Box>

      {/* Legend */}
      <Box marginTop={1}>
        <Text color="gray">Low </Text>
        {heatChars.map((char, idx) => (
          <Text key={idx} color={heatColors[idx]}>{char}</Text>
        ))}
        <Text color="gray"> High</Text>
      </Box>
    </Box>
  );
};

/**
 * Render heatmap matrix to string
 */
export function renderHeatmapMatrix(
  data: number[][],
  options: { rowLabels?: string[]; colLabels?: string[]; title?: string } = {}
): string {
  return renderInkToString(<HeatmapMatrix data={data} {...options} />);
}

// ============================================================================
// EXPANDABLE TREE
// ============================================================================

export interface TreeNode {
  label: string;
  children?: TreeNode[];
  expanded?: boolean;
  icon?: string;
  color?: string;
}

/**
 * ExpandableTree - Interactive tree with +/- toggles
 * Note: In MCP context this is static, but shows expand state
 */
export const ExpandableTree: React.FC<{
  nodes: TreeNode[];
  title?: string;
  indent?: number;
}> = ({ nodes, title, indent = 0 }) => {
  const renderNode = (node: TreeNode, depth: number, isLast: boolean): React.ReactNode => {
    const prefix = depth > 0
      ? '│  '.repeat(depth - 1) + (isLast ? '└─ ' : '├─ ')
      : '';

    const hasChildren = node.children && node.children.length > 0;
    const expandIcon = hasChildren
      ? (node.expanded !== false ? '▼' : '▶')
      : ' ';
    const nodeIcon = node.icon || (hasChildren ? icon('folder') : icon('file'));

    return (
      <Box key={node.label} flexDirection="column">
        <Box>
          <Text color="gray">{prefix}</Text>
          <Text color={hasChildren ? 'yellow' : 'gray'}>{expandIcon} </Text>
          <Text color={node.color || 'cyan'}>{nodeIcon} </Text>
          <Text color="white">{node.label}</Text>
        </Box>
        {hasChildren && node.expanded !== false && (
          <Box flexDirection="column">
            {node.children!.map((child, idx) =>
              renderNode(child, depth + 1, idx === node.children!.length - 1)
            )}
          </Box>
        )}
      </Box>
    );
  };

  return (
    <Box flexDirection="column" borderStyle="round" borderColor="gray" padding={1}>
      {title && (
        <Gradient name="morning">
          <Text bold>{icon('folderOpen')} {title}</Text>
        </Gradient>
      )}
      <Box marginTop={title ? 1 : 0} flexDirection="column">
        {nodes.map((node, idx) => renderNode(node, 0, idx === nodes.length - 1))}
      </Box>
    </Box>
  );
};

/**
 * Render expandable tree to string
 */
export function renderExpandableTree(nodes: TreeNode[], title?: string): string {
  return renderInkToString(<ExpandableTree nodes={nodes} title={title} />);
}

// ============================================================================
// GANTT TIMELINE
// ============================================================================

export interface GanttTask {
  name: string;
  start: number;  // Offset from timeline start
  duration: number;
  status?: 'pending' | 'active' | 'completed' | 'blocked';
  color?: string;
}

/**
 * GanttTimeline - Horizontal bar timeline
 */
export const GanttTimeline: React.FC<{
  tasks: GanttTask[];
  title?: string;
  width?: number;
  unit?: string;  // e.g., 'ms', 'day', 'step'
}> = ({ tasks, title, width = 50, unit = '' }) => {
  if (tasks.length === 0) return null;

  const maxEnd = Math.max(...tasks.map(t => t.start + t.duration));
  const scale = (width - 20) / maxEnd;  // Reserve space for labels

  const statusColors: Record<string, string> = {
    pending: 'gray',
    active: 'yellow',
    completed: 'green',
    blocked: 'red',
  };

  // Use solid blocks for all states - color provides differentiation
  const barChars: Record<string, string> = {
    pending: '█',
    active: '█',
    completed: '█',
    blocked: '█',
  };

  return (
    <Box flexDirection="column" borderStyle="round" borderColor="gray" padding={1}>
      {title && (
        <Gradient name="atlas">
          <Text bold>{icon('calendar')} {title}</Text>
        </Gradient>
      )}

      <Box marginTop={1} flexDirection="column">
        {tasks.map((task, idx) => {
          const offset = Math.floor(task.start * scale);
          const barWidth = Math.max(1, Math.floor(task.duration * scale));
          const status = task.status || 'pending';
          const color = task.color || statusColors[status];
          const char = barChars[status];

          return (
            <Box key={idx}>
              <Text color="gray">{task.name.padEnd(15).slice(0, 15)} </Text>
              <Text>{' '.repeat(offset)}</Text>
              <Text color={color}>{char.repeat(barWidth)}</Text>
              <Text color="gray"> {task.duration}{unit}</Text>
            </Box>
          );
        })}
      </Box>

      {/* Timeline ruler */}
      <Box marginTop={1}>
        <Text color="gray">{'─'.repeat(15)} </Text>
        <Text color="gray">0</Text>
        <Text color="gray">{' '.repeat(Math.floor((width - 20) / 2) - 2)}</Text>
        <Text color="gray">{Math.floor(maxEnd / 2)}{unit}</Text>
        <Text color="gray">{' '.repeat(Math.floor((width - 20) / 2) - 4)}</Text>
        <Text color="gray">{maxEnd}{unit}</Text>
      </Box>
    </Box>
  );
};

/**
 * Render Gantt timeline to string
 */
export function renderGanttTimeline(
  tasks: GanttTask[],
  options: { title?: string; width?: number; unit?: string } = {}
): string {
  return renderInkToString(<GanttTimeline tasks={tasks} {...options} />);
}

// ============================================================================
// SANKEY FLOW DIAGRAM
// ============================================================================

export interface SankeyNode {
  id: string;
  label: string;
  value?: number;
}

export interface SankeyLink {
  source: string;
  target: string;
  value: number;
}

/**
 * Simple ASCII Sankey diagram
 * Shows flow between stages with proportional width
 */
export const SankeyDiagram: React.FC<{
  nodes: SankeyNode[];
  links: SankeyLink[];
  title?: string;
  width?: number;
}> = ({ nodes, links, title, width = 60 }) => {
  // Group nodes into columns (simple left-to-right layout)
  const nodeMap = new Map(nodes.map(n => [n.id, n]));
  const sourceNodes = new Set(links.map(l => l.source));
  const targetNodes = new Set(links.map(l => l.target));

  // Left column: sources only
  const leftNodes = nodes.filter(n => sourceNodes.has(n.id) && !targetNodes.has(n.id));
  // Middle: both
  const middleNodes = nodes.filter(n => sourceNodes.has(n.id) && targetNodes.has(n.id));
  // Right: targets only
  const rightNodes = nodes.filter(n => !sourceNodes.has(n.id) && targetNodes.has(n.id));

  const maxValue = Math.max(...links.map(l => l.value));
  const flowWidth = Math.floor(width * 0.4);

  const renderFlow = (value: number) => {
    const barWidth = Math.max(1, Math.floor((value / maxValue) * 10));
    return '━'.repeat(barWidth);
  };

  return (
    <Box flexDirection="column" borderStyle="round" borderColor="gray" padding={1}>
      {title && (
        <Gradient name="vice">
          <Text bold>{icon('split')} {title}</Text>
        </Gradient>
      )}

      <Box marginTop={1} flexDirection="column">
        {/* Show flows from sources to targets */}
        {links.map((link, idx) => {
          const source = nodeMap.get(link.source);
          const target = nodeMap.get(link.target);

          return (
            <Box key={idx} marginBottom={idx < links.length - 1 ? 0 : 0}>
              <Text color="cyan">{source?.label.padEnd(12).slice(0, 12)}</Text>
              <Text color="yellow"> ━{renderFlow(link.value)}▶ </Text>
              <Text color="green">{target?.label}</Text>
              <Text color="gray"> ({link.value})</Text>
            </Box>
          );
        })}
      </Box>
    </Box>
  );
};

/**
 * Render Sankey diagram to string
 */
export function renderSankeyDiagram(
  nodes: SankeyNode[],
  links: SankeyLink[],
  title?: string
): string {
  return renderInkToString(<SankeyDiagram nodes={nodes} links={links} title={title} />);
}

// ============================================================================
// MASONRY GRID
// ============================================================================

export interface MasonryItem {
  content: string;
  height?: number;  // In lines
  color?: string;
  title?: string;
}

/**
 * MasonryGrid - Responsive multi-column layout
 */
export const MasonryGrid: React.FC<{
  items: MasonryItem[];
  columns?: number;
  width?: number;
  gap?: number;
}> = ({ items, columns = 2, width = 80, gap = 2 }) => {
  const colWidth = Math.floor((width - gap * (columns - 1)) / columns);

  // Distribute items into columns (shortest column first)
  const columnItems: MasonryItem[][] = Array.from({ length: columns }, () => []);
  const columnHeights = new Array(columns).fill(0);

  for (const item of items) {
    const shortestCol = columnHeights.indexOf(Math.min(...columnHeights));
    columnItems[shortestCol].push(item);
    columnHeights[shortestCol] += (item.height || 3) + 1;
  }

  return (
    <Box flexDirection="row">
      {columnItems.map((colItems, colIdx) => (
        <Box key={colIdx} flexDirection="column" width={colWidth} marginRight={colIdx < columns - 1 ? gap : 0}>
          {colItems.map((item, itemIdx) => (
            <Box
              key={itemIdx}
              flexDirection="column"
              borderStyle="round"
              borderColor={item.color || 'gray'}
              marginBottom={1}
              paddingX={1}
            >
              {item.title && (
                <Text bold color={item.color || 'cyan'}>{item.title}</Text>
              )}
              <Text wrap="wrap">{item.content.slice(0, colWidth * (item.height || 3))}</Text>
            </Box>
          ))}
        </Box>
      ))}
    </Box>
  );
};

/**
 * Render masonry grid to string
 */
export function renderMasonryGrid(
  items: MasonryItem[],
  options: { columns?: number; width?: number; gap?: number } = {}
): string {
  return renderInkToString(<MasonryGrid items={items} {...options} />);
}

// ============================================================================
// PURE REACT INK BORDER BOX (refactored from ANSI)
// ============================================================================

/**
 * InkBorderBox - Pure React Ink border implementation
 * Uses Ink's built-in Box borderStyle for proper rendering
 */
export const InkBorderBox: React.FC<{
  children: React.ReactNode;
  style?: BorderStyle;
  color?: string;
  title?: string;
  titleGradient?: GradientPreset;
  width?: number | string;
  padding?: number;
  paddingX?: number;
  paddingY?: number;
}> = ({
  children,
  style = 'round',
  color = 'gray',
  title,
  titleGradient,
  width,
  padding,
  paddingX = padding ?? 1,
  paddingY = padding ?? 0,
}) => {
  // Ink's borderStyle prop directly supports our border types
  const inkBorderStyle = style as 'single' | 'double' | 'round' | 'bold' | 'singleDouble' | 'doubleSingle' | 'classic';

  return (
    <Box
      flexDirection="column"
      borderStyle={inkBorderStyle}
      borderColor={color}
      paddingX={paddingX}
      paddingY={paddingY}
      width={width}
    >
      {title && (
        <Box marginBottom={1}>
          {titleGradient ? (
            <Gradient name={titleGradient as GradientName}>
              <Text bold>{title}</Text>
            </Gradient>
          ) : (
            <Text bold color={color}>{title}</Text>
          )}
        </Box>
      )}
      {children}
    </Box>
  );
};

/**
 * Render InkBorderBox to string
 */
export function renderInkBorderBox(
  content: string | React.ReactNode,
  options: {
    style?: BorderStyle;
    color?: string;
    title?: string;
    titleGradient?: GradientPreset;
    width?: number;
    padding?: number;
  } = {}
): string {
  const child = typeof content === 'string' ? <Text>{content}</Text> : content;
  return renderInkToString(<InkBorderBox {...options}>{child}</InkBorderBox>);
}

/**
 * InkGradientBox - React Ink box with gradient title
 * For cases where gradient borders aren't needed but gradient titles are
 */
export const InkGradientBox: React.FC<{
  children: React.ReactNode;
  title: string;
  gradient?: GradientPreset;
  borderStyle?: BorderStyle;
  borderColor?: string;
  icon?: string;
}> = ({
  children,
  title,
  gradient = 'cristal',
  borderStyle = 'round',
  borderColor = 'gray',
  icon: customIcon,
}) => {
  return (
    <Box
      flexDirection="column"
      borderStyle={borderStyle}
      borderColor={borderColor}
      padding={1}
    >
      <Box marginBottom={1}>
        {customIcon && <Text>{customIcon} </Text>}
        <Gradient name={gradient as GradientName}>
          <Text bold>{title}</Text>
        </Gradient>
      </Box>
      {children}
    </Box>
  );
};

/**
 * Render InkGradientBox to string
 */
export function renderInkGradientBox(
  content: string | React.ReactNode,
  title: string,
  options: {
    gradient?: GradientPreset;
    borderStyle?: BorderStyle;
    borderColor?: string;
    icon?: string;
  } = {}
): string {
  const child = typeof content === 'string' ? <Text>{content}</Text> : content;
  return renderInkToString(
    <InkGradientBox title={title} {...options}>{child}</InkGradientBox>
  );
}

// ============================================================================
// MODEL RESPONSE COMPONENTS (Pure React Ink)
// ============================================================================

/**
 * ModelResponseBox - Formatted model response with gradient header
 * Pure React Ink implementation
 */
export const ModelResponseBox: React.FC<{
  model: string;
  content: string;
  duration?: number;
  tokens?: number;
  cached?: boolean;
}> = ({ model, content, duration, tokens, cached }) => {
  const gradient = modelGradients[model.toLowerCase()] || 'rainbow';

  return (
    <Box flexDirection="column" borderStyle="round" borderColor="gray" padding={1}>
      {/* Header with model name and badges */}
      <Box marginBottom={1}>
        <Gradient name={gradient as GradientName}>
          <Text bold> {model.toUpperCase()} </Text>
        </Gradient>
        {cached && (
          <Box marginLeft={1}>
            <Text color="green">(◉ CACHED)</Text>
          </Box>
        )}
        {duration && (
          <Box marginLeft={1}>
            <Text color="gray">(◷ {duration}ms)</Text>
          </Box>
        )}
        {tokens && (
          <Box marginLeft={1}>
            <Text color="gray">({tokens} tok)</Text>
          </Box>
        )}
      </Box>

      {/* Content */}
      <Text wrap="wrap">{content}</Text>
    </Box>
  );
};

/**
 * Render model response box to string
 */
export function renderModelResponseBox(
  model: string,
  content: string,
  options: { duration?: number; tokens?: number; cached?: boolean } = {}
): string {
  return renderInkToString(
    <ModelResponseBox model={model} content={content} {...options} />
  );
}

/**
 * MultiModelComparison - Side-by-side model outputs
 * Pure React Ink implementation
 */
export const MultiModelComparison: React.FC<{
  responses: Array<{
    model: string;
    content: string;
    duration?: number;
    tokens?: number;
  }>;
  title?: string;
}> = ({ responses, title }) => {
  return (
    <Box flexDirection="column" borderStyle="double" borderColor="cyan" padding={1}>
      {title && (
        <Box marginBottom={1}>
          <Gradient name="vice">
            <Text bold>♫ {title}</Text>
          </Gradient>
        </Box>
      )}

      <Box flexDirection="column">
        {responses.map((r, idx) => (
          <Box key={idx} flexDirection="column" marginBottom={idx < responses.length - 1 ? 1 : 0}>
            <Box>
              <Gradient name={(modelGradients[r.model.toLowerCase()] || 'rainbow') as GradientName}>
                <Text bold> {r.model.toUpperCase()} </Text>
              </Gradient>
              {r.duration && <Text color="gray"> {r.duration}ms</Text>}
              {r.tokens && <Text color="gray"> {r.tokens} tok</Text>}
            </Box>
            <Box borderStyle="single" borderColor="dim" paddingX={1} marginTop={0}>
              <Text wrap="wrap">{r.content.slice(0, 200)}{r.content.length > 200 ? '...' : ''}</Text>
            </Box>
          </Box>
        ))}
      </Box>
    </Box>
  );
};

/**
 * Render multi-model comparison to string
 */
export function renderMultiModelComparison(
  responses: Array<{ model: string; content: string; duration?: number; tokens?: number }>,
  title?: string
): string {
  return renderInkToString(<MultiModelComparison responses={responses} title={title} />);
}

// ============================================================================
// PIE CHART COMPONENTS
// ============================================================================

/**
 * Pie chart data slice
 */
export interface PieSlice {
  label: string;
  value: number;
  displayValue?: string; // Custom display value for legend (e.g., "$0.42" instead of raw number)
  color?: string;
}

/**
 * Default colors for pie slices (vibrant terminal colors)
 */
const PIE_COLORS = [
  '#FF6B6B',  // Red
  '#4ECDC4',  // Teal
  '#45B7D1',  // Sky blue
  '#96CEB4',  // Sage green
  '#FFEAA7',  // Yellow
  '#DDA0DD',  // Plum
  '#98D8C8',  // Mint
  '#F7DC6F',  // Gold
  '#BB8FCE',  // Lavender
  '#85C1E9',  // Light blue
];

/**
 * Filled block characters for pie chart segments
 */
const BLOCK_FULL = '█';
const BLOCK_HALF = '▌';

/**
 * PieChart component - horizontal stacked bar representation
 * More readable than circular ASCII art in terminals
 */
export const PieChart: React.FC<{
  data: PieSlice[];
  width?: number;
  title?: string;
  showLegend?: boolean;
  showPercentages?: boolean;
}> = ({ data, width = 40, title, showLegend = true, showPercentages = true }) => {
  const total = data.reduce((sum, d) => sum + d.value, 0);
  if (total === 0) return <Text color="gray">No data</Text>;

  // Calculate widths for each slice
  const slicesWithMeta = data.map((slice, idx) => {
    const percentage = (slice.value / total) * 100;
    const sliceWidth = Math.round((slice.value / total) * width);
    return {
      ...slice,
      percentage,
      sliceWidth,
      color: slice.color || PIE_COLORS[idx % PIE_COLORS.length],
    };
  });

  // Adjust for rounding errors
  const totalWidth = slicesWithMeta.reduce((sum, s) => sum + s.sliceWidth, 0);
  if (totalWidth < width && slicesWithMeta.length > 0) {
    slicesWithMeta[0].sliceWidth += width - totalWidth;
  }

  return (
    <Box flexDirection="column">
      {title && (
        <Box marginBottom={1}>
          <Text bold color="cyan">{icons.chartBar} {title}</Text>
        </Box>
      )}

      {/* The pie bar */}
      <Box>
        {slicesWithMeta.map((slice, idx) => (
          <Text key={idx} color={slice.color}>
            {BLOCK_FULL.repeat(slice.sliceWidth)}
          </Text>
        ))}
      </Box>

      {/* Legend */}
      {showLegend && (
        <Box flexDirection="column" marginTop={1}>
          {slicesWithMeta.map((slice, idx) => (
            <Box key={idx}>
              <Text color={slice.color}>{BLOCK_FULL}</Text>
              <Text> {slice.label}</Text>
              {showPercentages && (
                <Text color="gray"> ({slice.percentage.toFixed(1)}%)</Text>
              )}
            </Box>
          ))}
        </Box>
      )}
    </Box>
  );
};

/**
 * DonutChart component - pie chart with center label
 */
export const DonutChart: React.FC<{
  data: PieSlice[];
  width?: number;
  title?: string;
  centerLabel?: string;
  showLegend?: boolean;
}> = ({ data, width = 40, title, centerLabel, showLegend = true }) => {
  const total = data.reduce((sum, d) => sum + d.value, 0);
  if (total === 0) return <Text color="gray">No data</Text>;

  // Calculate widths for each slice
  const slicesWithMeta = data.map((slice, idx) => {
    const percentage = (slice.value / total) * 100;
    const sliceWidth = Math.round((slice.value / total) * width);
    return {
      ...slice,
      percentage,
      sliceWidth,
      color: slice.color || PIE_COLORS[idx % PIE_COLORS.length],
    };
  });

  // Adjust for rounding errors
  const totalWidth = slicesWithMeta.reduce((sum, s) => sum + s.sliceWidth, 0);
  if (totalWidth < width && slicesWithMeta.length > 0) {
    slicesWithMeta[0].sliceWidth += width - totalWidth;
  }

  // Create donut with hole effect using dark solid blocks for center
  const holeWidth = Math.max(4, Math.floor(width * 0.3));
  const holeStart = Math.floor((width - holeWidth) / 2);
  const holeEnd = holeStart + holeWidth;

  return (
    <Box flexDirection="column">
      {title && (
        <Box marginBottom={1}>
          <Text bold color="cyan">{icons.chartBar} {title}</Text>
        </Box>
      )}

      {/* Top bar */}
      <Box>
        {slicesWithMeta.map((slice, idx) => (
          <Text key={idx} color={slice.color}>
            {BLOCK_FULL.repeat(slice.sliceWidth)}
          </Text>
        ))}
      </Box>

      {/* Center with hole - use dark solid blocks */}
      {centerLabel && (
        <Box justifyContent="center" marginY={0}>
          <Text color="#374151">{'█'.repeat(holeStart)}</Text>
          <Text bold color="white">{centerLabel.slice(0, holeWidth).padStart(Math.floor((holeWidth + centerLabel.length) / 2)).padEnd(holeWidth)}</Text>
          <Text color="#374151">{'█'.repeat(width - holeEnd)}</Text>
        </Box>
      )}

      {/* Bottom bar */}
      <Box>
        {slicesWithMeta.map((slice, idx) => (
          <Text key={idx} color={slice.color}>
            {BLOCK_FULL.repeat(slice.sliceWidth)}
          </Text>
        ))}
      </Box>

      {/* Legend */}
      {showLegend && (
        <Box flexDirection="column" marginTop={1}>
          {slicesWithMeta.map((slice, idx) => (
            <Box key={idx}>
              <Text color={slice.color}>{BLOCK_FULL}</Text>
              <Text> {slice.label}: </Text>
              <Text bold>{slice.displayValue ?? slice.value}</Text>
              <Text color="gray"> ({slice.percentage.toFixed(1)}%)</Text>
            </Box>
          ))}
        </Box>
      )}
    </Box>
  );
};

/**
 * Circular ASCII pie chart using Unicode arc characters
 * Creates a visual circular representation
 */
export const CircularPie: React.FC<{
  data: PieSlice[];
  radius?: number;
  title?: string;
}> = ({ data, radius = 6, title }) => {
  const total = data.reduce((sum, d) => sum + d.value, 0);
  if (total === 0) return <Text color="gray">No data</Text>;

  // Create a 2D grid for the circle
  const diameter = radius * 2 + 1;
  const grid: string[][] = Array(diameter).fill(null).map(() =>
    Array(diameter * 2).fill(' ')  // *2 for aspect ratio
  );

  // Fill the circle with colored segments
  let angleOffset = -Math.PI / 2; // Start at top
  const slicesWithMeta = data.map((slice, idx) => {
    const percentage = slice.value / total;
    const angleSize = percentage * 2 * Math.PI;
    const result = {
      ...slice,
      startAngle: angleOffset,
      endAngle: angleOffset + angleSize,
      color: slice.color || PIE_COLORS[idx % PIE_COLORS.length],
      percentage: percentage * 100,
    };
    angleOffset += angleSize;
    return result;
  });

  // Fill pixels
  for (let y = 0; y < diameter; y++) {
    for (let x = 0; x < diameter * 2; x++) {
      const dx = (x / 2) - radius;
      const dy = y - radius;
      const distance = Math.sqrt(dx * dx + dy * dy);

      if (distance <= radius && distance > radius * 0.3) {
        let angle = Math.atan2(dy, dx);
        // Find which slice this angle belongs to
        for (const slice of slicesWithMeta) {
          let startAngle = slice.startAngle;
          let endAngle = slice.endAngle;

          // Normalize angle
          while (angle < startAngle) angle += 2 * Math.PI;
          while (angle > endAngle && endAngle < startAngle + 2 * Math.PI) {
            if (angle <= endAngle + 2 * Math.PI) {
              grid[y][x] = slice.color || '█';
              break;
            }
          }

          if (angle >= startAngle && angle < endAngle) {
            grid[y][x] = slice.color || '█';
            break;
          }
        }
      }
    }
  }

  return (
    <Box flexDirection="column">
      {title && (
        <Box marginBottom={1}>
          <Text bold color="cyan">{icons.chartBar} {title}</Text>
        </Box>
      )}

      {/* Render circle using colored blocks */}
      <Box flexDirection="column">
        {grid.map((row, y) => (
          <Box key={y}>
            {row.map((cell, x) => {
              if (cell === ' ') return <Text key={x}> </Text>;
              // cell is the color
              return <Text key={x} color={cell}>█</Text>;
            })}
          </Box>
        ))}
      </Box>

      {/* Legend */}
      <Box flexDirection="column" marginTop={1}>
        {slicesWithMeta.map((slice, idx) => (
          <Box key={idx}>
            <Text color={slice.color}>{BLOCK_FULL}</Text>
            <Text> {slice.label} ({slice.percentage.toFixed(1)}%)</Text>
          </Box>
        ))}
      </Box>
    </Box>
  );
};

/**
 * Render pie chart to string (horizontal bar style)
 */
export function renderPieChart(
  data: PieSlice[],
  options: { width?: number; title?: string; showLegend?: boolean; showPercentages?: boolean } = {}
): string {
  return renderInkToString(<PieChart data={data} {...options} />);
}

/**
 * Render donut chart to string
 */
export function renderDonutChart(
  data: PieSlice[],
  options: { width?: number; title?: string; centerLabel?: string; showLegend?: boolean } = {}
): string {
  return renderInkToString(<DonutChart data={data} {...options} />);
}

/**
 * Render circular pie chart to string
 */
export function renderCircularPie(
  data: PieSlice[],
  options: { radius?: number; title?: string } = {}
): string {
  return renderInkToString(<CircularPie data={data} {...options} />);
}
