/**
 * ANSI Terminal Renderer for Markdown
 *
 * Converts markdown output to beautiful ANSI-styled terminal output.
 * Uses the theme system from ansi-styles.ts and ink-markdown-renderer.tsx.
 *
 * Configuration:
 *   RENDER_OUTPUT=markdown - Raw markdown, no processing (default, ~1x tokens)
 *   RENDER_OUTPUT=ink      - React Ink rendering with themes, gradients, tables (~12x tokens)
 *   RENDER_OUTPUT=ansi     - Legacy marked-terminal rendering
 *   RENDER_OUTPUT=plain    - Stripped plain text
 *
 *   TACHIBOT_THEME=nebula|cyberpunk|minimal|ocean|dracula|nord|solarized
 */

import { marked } from 'marked';
import { markedTerminal } from 'marked-terminal';
import { highlight as cliHighlight } from 'cli-highlight';
import chalk from 'chalk';

// Force chalk to output colors (MCP stdio is not a TTY, so chalk auto-disables)
chalk.level = 3;

// Force gradient-string colors
process.env.FORCE_COLOR = '3';

import {
  getTheme,
  renderModelBadge,
  toolResultHeader,
  dividers,
  type Theme,
} from './ansi-styles.js';

import {
  renderGradientDivider,
  renderGradientModelName,
  type GradientPreset,
} from './ink-renderer.js';

import { renderMarkdownToAnsi as renderInkMarkdown } from './ink-markdown-renderer.js';

// Track if marked has been configured (prevent repeated configuration)
let markedConfigured = false;

// Model to gradient preset mapping
const modelGradientPresets: Record<string, GradientPreset> = {
  gemini: 'cristal',
  grok: 'passion',
  openai: 'teen',
  perplexity: 'mind',
  claude: 'fruit',
  kimi: 'atlas',
  qwen: 'morning',
};

// Simple gradient using basic ANSI colors (fallback for non-TrueColor terminals)
function simpleGradient(width: number = 50): string {
  const colors = [
    '\x1b[36m',  // cyan
    '\x1b[96m',  // bright cyan
    '\x1b[94m',  // bright blue
    '\x1b[35m',  // magenta
    '\x1b[95m',  // bright magenta
  ];
  const reset = '\x1b[0m';
  let result = '';
  for (let i = 0; i < width; i++) {
    const colorIdx = Math.floor((i / width) * colors.length);
    result += colors[colorIdx] + '─';
  }
  return result + reset;
}

/**
 * Get TrueColor gradient divider based on model
 */
function getModelGradientDivider(model?: string, width: number = 60): string {
  const preset = model ? modelGradientPresets[model.toLowerCase()] || 'vice' : 'vice';
  try {
    return renderGradientDivider(width, preset);
  } catch {
    return simpleGradient(width);
  }
}

/**
 * Get gradient model badge (TrueColor)
 */
function getGradientModelBadge(model: string): string {
  try {
    return renderGradientModelName(model);
  } catch {
    return renderModelBadge(model);
  }
}

// ============================================================================
// TYPES
// ============================================================================

export type RenderMode = 'ansi' | 'markdown' | 'plain' | 'ink';

export interface RenderOptions {
  /** Model name for badge (e.g., 'grok', 'gemini') */
  model?: string;
  /** Force specific render mode (overrides env var) */
  mode?: RenderMode;
  /** Show divider after badge */
  showDivider?: boolean;
  /** Duration in milliseconds (for header) */
  durationMs?: number;
  /** Token count (for header) */
  tokenCount?: number;
  /** Cost amount (for header) */
  costAmount?: number;
}

// ============================================================================
// SINGLETON THEME CACHE
// ============================================================================

let cachedTheme: Theme | null = null;
let cachedRenderMode: RenderMode | null = null;

function getCachedTheme(): Theme {
  if (!cachedTheme) {
    cachedTheme = getTheme();
  }
  return cachedTheme;
}

/**
 * Clear theme cache (useful for testing or hot-reload)
 */
export function clearThemeCache(): void {
  cachedTheme = null;
  cachedRenderMode = null;
}

// ============================================================================
// RENDER MODE DETECTION
// ============================================================================

/**
 * Get the current render mode from environment (cached)
 */
export function getRenderMode(): RenderMode {
  if (!cachedRenderMode) {
    const mode = process.env.RENDER_OUTPUT?.toLowerCase();
    if (mode === 'ink' || mode === 'plain' || mode === 'ansi') {
      cachedRenderMode = mode;
    } else {
      cachedRenderMode = 'markdown'; // default - raw markdown (~1x tokens vs ink's ~12x)
    }
  }
  return cachedRenderMode;
}

/**
 * Check if ANSI rendering is enabled
 */
export function isAnsiEnabled(): boolean {
  return getRenderMode() === 'ansi';
}

// ============================================================================
// MAIN RENDER FUNCTION
// ============================================================================

/**
 * Render content with optional model badge and ANSI styling
 *
 * @param content - The markdown content to render
 * @param modelOrOptions - Model name string OR full options object
 * @returns Rendered string (ANSI, markdown, or plain based on config)
 *
 * @example
 * // Simple usage with model name
 * return renderOutput(result, 'grok');
 *
 * @example
 * // Full options with metrics
 * return renderOutput(result, {
 *   model: 'gemini',
 *   durationMs: 2300,
 *   tokenCount: 1234,
 *   costAmount: 0.0045
 * });
 */
export function renderOutput(
  content: string,
  modelOrOptions?: string | RenderOptions
): string {
  // Normalize options
  const options: RenderOptions =
    typeof modelOrOptions === 'string'
      ? { model: modelOrOptions }
      : modelOrOptions || {};

  const mode = options.mode || getRenderMode();
  const isAnsi = mode === 'ansi';

  let output = '';

  // Render content based on mode
  switch (mode) {
    case 'ink':
      // Use React Ink renderer - handles badge, gradients, tables internally
      output = renderInkMarkdown(content, undefined, options.model);
      break;
    case 'ansi':
      // Add model badge header with divider for ansi mode
      if (options.model) {
        if (options.durationMs !== undefined || options.tokenCount !== undefined || options.costAmount !== undefined) {
          output = toolResultHeader({
            model: options.model,
            durationMs: options.durationMs,
            tokenCount: options.tokenCount,
            costAmount: options.costAmount,
          });
        } else {
          output = renderModelBadge(options.model) + '\n';
        }
        output += dividers.thin + '\n\n';
      }
      output += renderAnsi(content);
      output += '\n' + simpleGradient(60) + '\n';
      break;
    case 'plain':
      output += stripMarkdown(content);
      break;
    case 'markdown':
    default:
      output += content;
      break;
  }

  return output;
}

// ============================================================================
// ANSI RENDERER (using marked-terminal)
// ============================================================================

/**
 * Configure marked-terminal once (singleton pattern)
 */
function configureMarked(): void {
  if (markedConfigured) return;
  markedConfigured = true;

  const theme = getCachedTheme();

  // Configure marked with terminal renderer (ONCE only)
  marked.use(
    markedTerminal(
      {
        // Use theme ChalkInstance styles
        firstHeading: theme.h1,
        heading: theme.h2,
        strong: theme.bold,
        em: theme.italic,
        codespan: theme.code,
        del: chalk.strikethrough.gray,  // ~~strikethrough~~
        link: theme.link,
        href: chalk.gray.underline,

        // Blockquote with vertical bar prefix
        blockquote: (text: string) => {
          const bar = chalk.cyan('│ ');
          const lines = text.trim().split('\n');
          return '\n' + lines.map(line => bar + chalk.italic.gray(line)).join('\n') + '\n';
        },

        // Code blocks with border box
        code: (code: string, lang?: string) => {
          const border = chalk.gray;
          const width = Math.min(Math.max(...code.split('\n').map(l => l.length)) + 4, 80);
          const top = border('╭' + '─'.repeat(width - 2) + '╮');
          const bottom = border('╰' + '─'.repeat(width - 2) + '╯');
          const langLabel = lang ? chalk.cyan(` ${lang} `) : '';
          const header = lang ? border('╭─') + langLabel + border('─'.repeat(width - lang.length - 5) + '╮') : top;

          const lines = code.split('\n').map(line => {
            const padded = line.padEnd(width - 4);
            return border('│ ') + chalk.white(padded) + border(' │');
          });

          return '\n' + header + '\n' + lines.join('\n') + '\n' + bottom + '\n';
        },

        // List formatting with themed bullets - multi-level
        list: (body: string, ordered?: boolean) => {
          if (ordered) {
            let num = 0;
            return body.replace(/●/g, () => {
              num++;
              return chalk.cyan(`${num}.`);
            });
          }
          // Replace default bullets with themed ones
          // Match: ●, *, -, anywhere in the line (including after box borders)
          return body
            .replace(/[●\*]\s+/g, theme.bullet1 + ' ')
            .replace(/-\s+(?=[A-Z])/g, theme.bullet1 + ' ');  // Only - before capital letter
        },

        // List item - clean up formatting
        listitem: (text: string) => {
          // Remove leading/trailing | from reflowed text but keep content
          return text.replace(/^\|\s*/gm, '').replace(/\s*\|$/gm, '');
        },

        // Horizontal rule - use themed divider
        hr: () => '\n' + theme.dividerThin + '\n',

        // Table styling
        // NOTE: cli-table3 has a bug where custom chars + style.border produces malformed ANSI
        // Only use head styling, skip border colors to avoid [90m without \x1b prefix
        tableOptions: {
          chars: theme.tableChars,
          style: {
            head: ['cyan', 'bold'],
            // border: ['gray'],  // Disabled - causes malformed ANSI with custom chars
          },
        },

        // Other options
        unescape: true,
        emoji: true,
        showSectionPrefix: false,
        reflowText: false,  // Disabled - causes stray | characters
        width: 100,
      }
    ) as Parameters<typeof marked.use>[0]
  );
}

/**
 * Convert markdown to ANSI-styled terminal output
 */
function renderAnsi(md: string): string {
  // Configure marked once (lazy initialization)
  configureMarked();

  const theme = getCachedTheme();

  try {
    // Extract RAWANSI sections (already formatted, skip processing)
    const rawSections: string[] = [];
    let processedMd = md.replace(/\x00RAWANSI\x00([\s\S]*?)\x00\/RAWANSI\x00/g, (_, content) => {
      rawSections.push(content);
      return `\x00RAW${rawSections.length - 1}\x00`;
    });

    // Pre-process: Normalize bullet markers to ● for consistent handling
    // Convert * and - at start of list items to ●
    processedMd = processedMd.replace(/^(\s*)\* /gm, '$1● ');
    processedMd = processedMd.replace(/^(\s*)- /gm, '$1● ');

    let result = marked.parse(processedMd) as string;

    // Post-process: Convert any remaining ~~strikethrough~~ markers
    result = result.replace(/~~([^~]+)~~/g, '\x1b[9m\x1b[90m$1\x1b[0m');

    // Post-process: Convert any remaining **bold** markers to ANSI bold
    // Use non-greedy match and ensure no newlines in content
    result = result.replace(/\*\*([^*\n]+?)\*\*/g, theme.bold('$1'));

    // Post-process: Convert any remaining *italic* markers to ANSI italic
    // More precise: must not be list bullet (no space after first *), no newlines, non-greedy
    result = result.replace(/(?<!\n)(?<!^)\*([^*\n\s][^*\n]*?)\*/gm, theme.italic('$1'));

    // Post-process: Add borders to code blocks FIRST (before inline code processing)
    // This prevents inline code regex from matching inside code blocks
    result = result.replace(/(\n {4}[^\n]+(?:\n {4}[^\n]+)*)/g, (match) => {
      const lines = match.trim().split('\n').map(l => l.replace(/^ {4}/, ''));
      const code = lines.join('\n');

      // Zed editor color scheme
      const zed = {
        purple: '\x1b[38;5;141m',     // Keywords (import, from, const, as)
        cyan: '\x1b[38;5;117m',       // Identifiers, variables (React, className)
        yellow: '\x1b[38;5;222m',     // Properties, methods (.Root, .forwardRef)
        green: '\x1b[38;5;114m',      // Strings
        orange: '\x1b[38;5;209m',     // Special (typeof, spread)
        pink: '\x1b[38;5;211m',       // JSX tags
        gray: '\x1b[38;5;102m',       // Comments
        white: '\x1b[38;5;252m',      // Text, punctuation
        blue: '\x1b[38;5;75m',        // Numbers, constants
      };
      const rst = '\x1b[0m';

      const syntaxTheme = {
        keyword: (s: string) => zed.purple + s + rst,      // import, from, const, if, return
        built_in: (s: string) => zed.cyan + s + rst,       // console, Math, React
        string: (s: string) => zed.green + s + rst,        // "strings"
        number: (s: string) => zed.blue + s + rst,         // 123
        literal: (s: string) => zed.blue + s + rst,        // true, false, null
        function: (s: string) => zed.yellow + s + rst,     // function calls
        title: (s: string) => zed.cyan + s + rst,          // function/class names
        class: (s: string) => zed.cyan + s + rst,          // class names
        comment: (s: string) => zed.gray + s + rst,        // // comments
        variable: (s: string) => zed.cyan + s + rst,       // variables
        operator: (s: string) => zed.white + s + rst,      // = + - =>
        punctuation: (s: string) => zed.white + s + rst,   // {} () ;
        attr: (s: string) => zed.yellow + s + rst,         // attributes, properties
        params: (s: string) => zed.orange + s + rst,       // parameters
        type: (s: string) => zed.cyan + s + rst,           // types
        'class-name': (s: string) => zed.cyan + s + rst,   // ClassName
        tag: (s: string) => zed.pink + s + rst,            // JSX tags
        property: (s: string) => zed.yellow + s + rst,     // .property
      };

      // Try to apply syntax highlighting with custom theme
      // Skip highlighting for:
      // - URL-heavy content (sources, citations)
      // - Prose with citation markers like [1], [2], [3]
      // - Content that looks like natural language (has common words)
      let highlighted: string;
      const hasUrls = /https?:\/\//.test(code);
      const hasCitations = /\[\d+\]/.test(code);  // [1], [2], etc.
      const looksLikeProse = /\b(the|and|or|but|with|from|to|as|is|are|was|were|has|have|this|that)\b/i.test(code);

      if (hasUrls || hasCitations || looksLikeProse) {
        // Don't syntax highlight prose/citations - just use plain text
        highlighted = code;
      } else {
        try {
          highlighted = cliHighlight(code, {
            ignoreIllegals: true,
            theme: syntaxTheme
          });
        } catch {
          highlighted = code;
        }
      }

      const highlightedLines = highlighted.split('\n');
      // Calculate max length from raw lines (without ANSI codes)
      const stripAnsi = (s: string) => s.replace(/\x1b\[[0-9;]*m/g, '');
      const maxLen = Math.max(...highlightedLines.map(l => stripAnsi(l).length), 20);

      const gray = '\x1b[90m';
      const reset = '\x1b[0m';

      const top = gray + '╭' + '─'.repeat(maxLen + 2) + '╮' + reset;
      const bottom = gray + '╰' + '─'.repeat(maxLen + 2) + '╯' + reset;
      const boxedLines = highlightedLines.map(l => {
        const padding = maxLen - stripAnsi(l).length;
        return gray + '│ ' + reset + l + ' '.repeat(padding) + reset + gray + ' │' + reset;
      });

      return '\n\x00CODEBLOCK\x00' + top + '\n' + boxedLines.join('\n') + '\n' + bottom + '\x00/CODEBLOCK\x00';
    });

    // Post-process: Convert any remaining `code` markers to ANSI code
    // But NOT inside code blocks (marked with sentinel)
    const codeBlocks: string[] = [];
    result = result.replace(/\x00CODEBLOCK\x00[\s\S]*?\x00\/CODEBLOCK\x00/g, (match) => {
      codeBlocks.push(match.replace(/\x00\/?CODEBLOCK\x00/g, ''));
      return `\x00CB${codeBlocks.length - 1}\x00`;
    });

    // Now safe to process inline code
    result = result.replace(/`([^`]+)`/g, theme.code(' $1 '));

    // Restore code blocks
    result = result.replace(/\x00CB(\d+)\x00/g, (_, idx) => codeBlocks[parseInt(idx)]);

    // Post-process: Clean up stray | characters from text reflow
    // Remove | at start of lines (not inside code blocks or tables)
    result = result.replace(/^\s*\|\s*(?![─│┌┐└┘├┤┬┴┼╭╮╯╰])/gm, '');
    // Remove trailing | (not part of table)
    result = result.replace(/\s*\|\s*$/gm, '');

    // Post-process: Replace remaining * bullets with themed bullet
    const bullet = theme.bullet1;
    // Match any: box border (with any ANSI), then "* " as bullet
    result = result.replace(/((?:\x1b\[[\d;]*m)*│(?:\x1b\[[\d;]*m)* (?:\x1b\[[\d;]*m)*)\* /g, `$1${bullet} `);
    // Also catch standalone "* " at line starts (outside boxes)
    result = result.replace(/^((?:\x1b\[[\d;]*m)*)\* /gm, `$1${bullet} `);

    // Post-process: Style diff blocks (lines starting with +, -, @@)
    result = result.replace(/^(\+[^\n]*)/gm, '\x1b[32m$1\x1b[0m');  // Green for additions
    result = result.replace(/^(-[^\n]*)/gm, '\x1b[31m$1\x1b[0m');   // Red for deletions
    result = result.replace(/^(@@[^\n]*@@)/gm, '\x1b[36m$1\x1b[0m'); // Cyan for hunk headers

    // Fix malformed ANSI codes using "Payload Reconstruction" (Gemini's approach)
    // Matches ANY chaotic ANSI-like pattern and rebuilds it cleanly:
    // - (?:\x1b|\[)+ matches one or more ESC or [ (handles [[, [, \x1b[, etc.)
    // - ([\d;\[]+) captures the body: digits, semicolons, or stray brackets
    // - m is the SGR terminator
    const chaosPattern = /(?:\x1b|\[)+([\d;\[]+)m/g;
    result = result.replace(chaosPattern, (match, body) => {
      // Extract only numeric parameters (removes stray brackets)
      const params = body.split(/[;\[]/).filter((x: string) => /^\d+$/.test(x));
      // If no valid numbers found, leave as-is (might be text like "[m")
      if (params.length === 0) return match;
      // Reconstruct clean ANSI sequence
      return `\x1b[${params.join(';')}m`;
    });

    // Restore RAWANSI sections (already formatted content)
    result = result.replace(/\x00RAW(\d+)\x00/g, (_, idx) => rawSections[parseInt(idx)] || '');

    return result;
  } catch (error) {
    // Fallback if parsing fails
    console.error('[ansi-renderer] Parse error:', error);
    return md;
  }
}

// ============================================================================
// PLAIN TEXT STRIPPER
// ============================================================================

/**
 * Strip all markdown formatting to plain text
 */
function stripMarkdown(md: string): string {
  return (
    md
      // Headers
      .replace(/^#{1,6}\s+/gm, '')
      // Bold
      .replace(/\*\*([^*]+)\*\*/g, '$1')
      .replace(/__([^_]+)__/g, '$1')
      // Italic
      .replace(/\*([^*]+)\*/g, '$1')
      .replace(/_([^_]+)_/g, '$1')
      // Strikethrough
      .replace(/~~([^~]+)~~/g, '$1')
      // Inline code
      .replace(/`([^`]+)`/g, '$1')
      // Code blocks
      .replace(/```[\s\S]*?```/g, (match) => {
        return match.replace(/```\w*\n?/g, '').replace(/```/g, '');
      })
      // Links
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
      // Images
      .replace(/!\[([^\]]*)\]\([^)]+\)/g, '$1')
      // Blockquotes
      .replace(/^>\s+/gm, '')
      // Horizontal rules
      .replace(/^[-*_]{3,}$/gm, '---')
      // List markers
      .replace(/^[\s]*[-*+]\s+/gm, '  - ')
      .replace(/^[\s]*\d+\.\s+/gm, '  ')
      // Tables (simplified)
      .replace(/\|/g, ' ')
      .replace(/^[-:]+$/gm, '')
      // Clean up extra whitespace
      .replace(/\n{3,}/g, '\n\n')
      .trim()
  );
}

// ============================================================================
// ANSI ESCAPE CODE STRIPPER
// ============================================================================

/**
 * Strip all ANSI escape codes from text
 * Used to clean rendered output before sending to LLM context
 * (LLM sees plain text, human sees beautiful colors via stderr)
 */
export function stripAnsi(text: string): string {
  // Comprehensive ANSI regex - covers SGR, cursor, and other sequences
  // eslint-disable-next-line no-control-regex
  const ansiRegex = /[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g;
  return text.replace(ansiRegex, '');
}

// ============================================================================
// RE-EXPORTS for convenience
// ============================================================================

export {
  getTheme,
  renderModelBadge,
  toolResultHeader,
  // Styling helpers
  score,
  scoreImprovement,
  percentage,
  labelValue,
  keyValue,
  timestamp,
  duration,
  cost,
  tokens,
  highlight,
  inlineCode,
  filePath,
  link,
  warning,
  error,
  success,
  info,
  debug,
  sectionHeader,
  modelHeader,
  reviewScore,
  progressBar,
} from './ansi-styles.js';
