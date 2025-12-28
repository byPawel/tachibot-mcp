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

  // Default: no Nerd Font support (safe fallback)
  _nerdFontSupport = false;
  return false;
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
    return '█'.repeat(filled) + '░'.repeat(10 - filled);
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
                {getRelevanceBar(source.relevance)}
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
