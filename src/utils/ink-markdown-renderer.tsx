/**
 * Ink Markdown Renderer for TachiBot MCP
 *
 * Converts markdown to beautiful React Ink components with full theme support.
 * Uses marked.lexer() for parsing, React Ink for rendering.
 *
 * Architecture:
 *   Markdown → marked.lexer() → tokens → React Ink components → ANSI string
 *
 * Features:
 *   - Full theme support (JSON themes: dracula, nord, solarized, etc.)
 *   - Gradient dividers via ink-gradient
 *   - Syntax highlighting for code blocks
 *   - Nested formatting (bold inside lists, etc.)
 *   - Model badges with themed colors
 *
 * Usage:
 *   import { renderMarkdownToAnsi } from './ink-markdown-renderer.js';
 *   const ansi = renderMarkdownToAnsi(markdown, 'dracula');
 */

import './color-setup.js';

import React, { createContext, useContext, useMemo } from 'react';
import { render, Box, Text } from 'ink';
import Gradient from 'ink-gradient';
import { marked, Token, Tokens } from 'marked';
import { PassThrough } from 'stream';
import { loadJsonTheme, type JsonTheme } from './theme-loader.js';
import { icons, nerdIcons, hasNerdFontSupport, getIcon } from './ink-renderer.js';
import { highlight as cliHighlight } from 'cli-highlight';
import { InkTable, TableThemeProvider, type TableTheme } from './ink-table.js';

// ============================================================================
// THEME TYPES
// ============================================================================

export interface ColorStyle {
  fg?: string;
  bg?: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  dim?: boolean;
}

export interface InkTheme {
  name: string;

  // Headers
  h1: ColorStyle;
  h2: ColorStyle;
  h3: ColorStyle;
  h4: ColorStyle;

  // Text styles
  bold: ColorStyle;
  italic: ColorStyle;
  code: ColorStyle;
  link: ColorStyle;
  blockquote: ColorStyle;

  // List bullets (colors)
  bullet1: string;
  bullet2: string;
  bullet3: string;

  // Dividers
  divider: string;

  // Borders
  border: string;
  borderBlockquote: string;
  borderCode: string;

  // Gradient colors (for ink-gradient)
  gradient?: string[];

  // Model badges
  modelBadges?: Record<string, { fg: string; bg: string; icon?: string }>;
}

// ============================================================================
// DEFAULT THEME (Nebula - matches existing ansi-styles.ts)
// ============================================================================

const defaultTheme: InkTheme = {
  name: 'nebula',

  h1: { fg: '#000000', bg: '#5F87FF', bold: true },
  h2: { fg: '#000000', bg: '#5FAF5F', bold: true },
  h3: { fg: '#000000', bg: '#FFAF5F', bold: true },
  h4: { fg: '#000000', bg: '#87AFD7', bold: true },

  bold: { bold: true },
  italic: { italic: true },
  code: { fg: '#FFFFFF', bg: '#444444' },
  link: { fg: '#5F87FF', underline: true },
  blockquote: { fg: '#888888', italic: true },

  bullet1: '#00d7ff',  // cyan
  bullet2: '#ffaf00',  // yellow
  bullet3: '#5faf5f',  // green

  divider: '#444444',
  border: '#555555',
  borderBlockquote: '#00d7ff',
  borderCode: '#666666',

  gradient: ['#00d7ff', '#5F87FF', '#af5fff', '#ff5faf'],

  modelBadges: {
    gemini: { fg: '#000000', bg: '#8be9fd' },
    grok: { fg: '#000000', bg: '#ff79c6' },
    openai: { fg: '#000000', bg: '#50fa7b' },
    perplexity: { fg: '#000000', bg: '#bd93f9' },
    qwen: { fg: '#000000', bg: '#ff5555' },
    kimi: { fg: '#000000', bg: '#f1fa8c' },
    claude: { fg: '#000000', bg: '#ffb86c' },
  }
};

// ============================================================================
// THEME CONTEXT
// ============================================================================

const ThemeContext = createContext<InkTheme>(defaultTheme);

export const useTheme = () => useContext(ThemeContext);

// ============================================================================
// THEME LOADING FROM JSON
// ============================================================================

/**
 * Convert JSON theme to InkTheme format
 */
function jsonThemeToInkTheme(jsonTheme: JsonTheme | null): InkTheme {
  if (!jsonTheme || !jsonTheme.colors) {
    return defaultTheme;
  }

  const colors = jsonTheme.colors;

  return {
    name: jsonTheme.name || 'custom',

    h1: colors.h1 ? {
      fg: colors.h1.fg,
      bg: colors.h1.bg,
      bold: colors.h1.bold ?? true
    } : defaultTheme.h1,

    h2: colors.h2 ? {
      fg: colors.h2.fg,
      bg: colors.h2.bg,
      bold: colors.h2.bold ?? true
    } : defaultTheme.h2,

    h3: defaultTheme.h3,
    h4: defaultTheme.h4,

    bold: colors.bold ? { fg: colors.bold, bold: true } : defaultTheme.bold,
    italic: colors.italic ? { fg: colors.italic, italic: true } : defaultTheme.italic,
    code: colors.code ? { fg: colors.code.fg, bg: colors.code.bg } : defaultTheme.code,
    link: colors.link ? { fg: colors.link, underline: true } : defaultTheme.link,
    blockquote: defaultTheme.blockquote,

    bullet1: colors.bullet1 || defaultTheme.bullet1,
    bullet2: colors.bullet2 || defaultTheme.bullet2,
    bullet3: colors.bullet3 || defaultTheme.bullet3,

    divider: colors.divider || defaultTheme.divider,
    border: defaultTheme.border,
    borderBlockquote: colors.bullet1 || defaultTheme.borderBlockquote,
    borderCode: defaultTheme.borderCode,

    // Build gradient from theme colors
    gradient: [
      colors.bullet1 || defaultTheme.bullet1,
      colors.h1?.bg || defaultTheme.h1.bg!,
      colors.bullet2 || defaultTheme.bullet2,
      colors.h2?.bg || defaultTheme.h2.bg!,
    ].filter(Boolean) as string[],

    modelBadges: jsonTheme.modelBadges ?
      Object.fromEntries(
        Object.entries(jsonTheme.modelBadges).map(([k, v]: [string, { fg?: string; bg?: string; icon?: string }]) => [
          k,
          { fg: v.fg || '#000000', bg: v.bg || '#ffffff', icon: v.icon }
        ])
      ) : defaultTheme.modelBadges,
  };
}

/**
 * Load theme by name (from JSON files or use default)
 */
export function loadTheme(themeName?: string): InkTheme {
  if (!themeName) {
    themeName = process.env.TACHIBOT_THEME;
  }

  if (!themeName || themeName === 'nebula') {
    return defaultTheme;
  }

  const jsonTheme = loadJsonTheme(themeName);
  return jsonThemeToInkTheme(jsonTheme);
}

// ============================================================================
// THEMED COMPONENTS
// ============================================================================

/**
 * Themed heading component
 */
const ThemedHeading: React.FC<{ depth: number; children: React.ReactNode }> = ({ depth, children }) => {
  const theme = useTheme();

  const styles = [theme.h1, theme.h2, theme.h3, theme.h4];
  const style = styles[Math.min(depth - 1, 3)];

  return (
    <Box marginTop={1} marginBottom={1}>
      <Text
        color={style.fg}
        backgroundColor={style.bg}
        bold={style.bold}
        underline={style.underline}
      >
        {' '}{children}{' '}
      </Text>
    </Box>
  );
};

/**
 * Themed inline code
 */
const ThemedInlineCode: React.FC<{ children: string }> = ({ children }) => {
  const theme = useTheme();
  return (
    <Text color={theme.code.fg} backgroundColor={theme.code.bg}>
      {' '}{children}{' '}
    </Text>
  );
};

/**
 * Themed code block with border and syntax highlighting
 * Renders each line separately to preserve newlines in Ink
 */
const ThemedCodeBlock: React.FC<{ code: string; lang?: string }> = ({ code, lang }) => {
  const theme = useTheme();

  // Apply syntax highlighting
  let highlighted = code;
  try {
    if (lang) {
      highlighted = cliHighlight(code, {
        language: lang,
        ignoreIllegals: true,
      });
    }
  } catch {
    // Fallback to plain code if highlighting fails
    highlighted = code;
  }

  // Split into lines for proper rendering (Ink collapses newlines in single Text)
  const lines = highlighted.split('\n');

  return (
    <Box
      borderStyle="round"
      borderColor={theme.borderCode}
      paddingX={1}
      marginTop={1}
      marginBottom={1}
      flexDirection="column"
    >
      {lang && (
        <Text color={theme.link.fg} dimColor>
          {lang}
        </Text>
      )}
      {lines.map((line, i) => (
        <Text key={i}>{line || ' '}</Text>
      ))}
    </Box>
  );
};

/**
 * Themed blockquote with left border
 * Note: children should be block-level content, not wrapped in Text
 */
const ThemedBlockquote: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const theme = useTheme();

  return (
    <Box
      borderStyle="single"
      borderColor={theme.borderBlockquote}
      borderLeft
      borderRight={false}
      borderTop={false}
      borderBottom={false}
      paddingLeft={1}
      marginTop={1}
      marginBottom={1}
      flexDirection="column"
    >
      {children}
    </Box>
  );
};

/**
 * Themed bullet point
 */
const ThemedBullet: React.FC<{ level: number }> = ({ level }) => {
  const theme = useTheme();
  const bullets = ['●', '◆', '▸'];
  const colors = [theme.bullet1, theme.bullet2, theme.bullet3];
  const idx = Math.min(level, 2);

  return <Text color={colors[idx]}>{bullets[idx]} </Text>;
};

/**
 * Themed horizontal divider with gradient
 */
const ThemedDivider: React.FC<{ width?: number }> = ({ width = 60 }) => {
  const theme = useTheme();
  const line = '─'.repeat(width);

  if (theme.gradient && theme.gradient.length >= 2) {
    return (
      <Box marginTop={1} marginBottom={1}>
        <Gradient colors={theme.gradient}>
          {line}
        </Gradient>
      </Box>
    );
  }

  return (
    <Box marginTop={1} marginBottom={1}>
      <Text color={theme.divider}>{line}</Text>
    </Box>
  );
};

/**
 * Themed table - uses extractable InkTable component with theme integration
 *
 * The InkTable component is in a separate file (ink-table.tsx) for reusability
 * across projects (e.g., devlog-mcp). This wrapper applies the current theme.
 */
const ThemedTable: React.FC<{ table: Tokens.Table }> = ({ table }) => {
  const theme = useTheme();

  // Map InkTheme to TableTheme - high contrast headers
  const tableTheme: TableTheme = {
    borderColor: theme.border,
    headerColor: theme.h2.fg || '#000000',  // Dark text
    headerBgColor: theme.h2.bg || '#87AFD7', // Light background
    headerBold: theme.h2.bold ?? true,
    cellColor: undefined, // Use terminal default
  };

  return (
    <TableThemeProvider theme={tableTheme}>
      <InkTable table={table} />
    </TableThemeProvider>
  );
};

/**
 * Icon component - auto-detects Nerd Font support
 */
const Icon: React.FC<{
  name: keyof typeof icons;
  nerdName?: keyof typeof nerdIcons;
  color?: string;
}> = ({ name, nerdName, color }) => {
  const useNerd = hasNerdFontSupport() && nerdName && nerdIcons[nerdName];
  const icon = useNerd ? nerdIcons[nerdName!] : icons[name];

  return <Text color={color}>{icon}</Text>;
};

/**
 * Model-specific gradient color schemes (for backgrounds)
 * Bright, saturated gradients for dark text readability
 */
const modelGradients: Record<string, string[]> = {
  // AI Models
  gemini: ['#00D4FF', '#FF00D4'],      // Cyan → Magenta
  grok: ['#FF8800', '#FF4400'],        // Orange → Deep Orange
  openai: ['#00FF88', '#00DDFF'],      // Neon Green → Cyan
  perplexity: ['#A855F7', '#EC4899'],  // Purple → Pink
  qwen: ['#FFD000', '#FF8800'],        // Gold → Orange
  kimi: ['#C084FC', '#F472B6'],        // Violet → Pink
  claude: ['#FB923C', '#FBBF24'],      // Orange → Yellow
  // Orchestration Tools
  focus: ['#60A5FA', '#A78BFA'],       // Blue → Purple
  workflow: ['#34D399', '#22D3EE'],    // Green → Cyan
  think: ['#818CF8', '#A78BFA'],       // Indigo → Violet
  nextthought: ['#9333EA', '#4F46E5'], // Purple → Indigo
  // Analysis Modes
  scout: ['#38BDF8', '#818CF8'],       // Sky → Indigo
  verifier: ['#4ADE80', '#A3E635'],    // Green → Lime
  challenger: ['#F87171', '#FB923C'],  // Red → Orange
  // Local Tools
  usage_stats: ['#06B6D4', '#0EA5E9'], // Cyan → Sky
  list_workflows: ['#10B981', '#34D399'], // Emerald → Green
  validate_workflow: ['#F59E0B', '#FBBF24'], // Amber → Yellow
};

/**
 * Interpolate between two hex colors
 */
function interpolateColor(color1: string, color2: string, factor: number): string {
  const hex1 = color1.replace('#', '');
  const hex2 = color2.replace('#', '');

  const r1 = parseInt(hex1.slice(0, 2), 16);
  const g1 = parseInt(hex1.slice(2, 4), 16);
  const b1 = parseInt(hex1.slice(4, 6), 16);

  const r2 = parseInt(hex2.slice(0, 2), 16);
  const g2 = parseInt(hex2.slice(2, 4), 16);
  const b2 = parseInt(hex2.slice(4, 6), 16);

  const r = Math.round(r1 + (r2 - r1) * factor);
  const g = Math.round(g1 + (g2 - g1) * factor);
  const b = Math.round(b1 + (b2 - b1) * factor);

  return `${r};${g};${b}`;
}

/**
 * Create gradient background string with dark text
 * Uses Array.from() to properly handle multi-byte Unicode characters (emojis, icons)
 *
 * Optimized: Bold and text color applied ONCE at start (not per character)
 * This improves text rendering quality in terminals
 */
function createGradientBgText(text: string, colors: string[]): string {
  // Array.from handles Unicode properly (doesn't split surrogate pairs)
  const chars = Array.from(text);
  const numColors = colors.length;
  const reset = '\x1b[0m';
  const dark = '\x1b[38;2;30;30;30m';  // Dark gray text (softer than pure black)
  const bold = '\x1b[1m';

  // Apply bold and text color ONCE at the start for better rendering quality
  let result = bold + dark;

  for (let i = 0; i < chars.length; i++) {
    const position = i / (chars.length - 1 || 1);
    const colorIndex = position * (numColors - 1);
    const lowerIndex = Math.floor(colorIndex);
    const upperIndex = Math.min(lowerIndex + 1, numColors - 1);
    const factor = colorIndex - lowerIndex;

    const rgb = interpolateColor(colors[lowerIndex], colors[upperIndex], factor);
    // Only change background color per character
    result += `\x1b[48;2;${rgb}m${chars[i]}`;
  }

  return result + reset;
}

/**
 * Model badge component with gradient background and black text
 */
const ModelBadge: React.FC<{ model: string }> = ({ model }) => {
  const theme = useTheme();
  const modelKey = model.toLowerCase();
  const badge = theme.modelBadges?.[modelKey];
  const gradientColors = modelGradients[modelKey] || ['#888888', '#aaaaaa', '#cccccc'];

  // Model-specific icons (Unicode - curated by multi-model consensus)
  // Gemini judged: brand-appropriate symbols for each provider
  const modelIconMap: Record<string, string> = {
    gemini: '✦',       // Four-pointed star (single-width, renders correctly)
    grok: '⚡',         // Lightning bolt - high energy
    openai: '✾',       // Eight-petalled floret - approximates logo
    perplexity: '⍟',   // Circled star - search/discovery
    qwen: '☁',         // Cloud - Alibaba Cloud connection
    kimi: '☾',         // Crescent moon - Moonshot AI
    claude: '⚜',       // Fleur-de-lis - sophisticated/constitutional
    focus: '◉',
    workflow: '⎔',
    scout: '⊛',        // Circled asterisk - exploration
    verifier: '✓',
    challenger: '⚔',
    think: '◌',
  };

  // Get icon character
  let iconChar = badge?.icon || modelIconMap[modelKey] || '';

  // Build badge text with icon - tight spacing: "♊ gemini"
  const badgeText = iconChar ? `${iconChar} ${model}` : `${model}`;
  const gradientBadge = createGradientBgText(badgeText, gradientColors);

  return (
    <Box>
      <Text>{gradientBadge}</Text>
    </Box>
  );
};

// ============================================================================
// TYPE-SAFE TOKEN DEFINITIONS
// ============================================================================

/** Maximum recursion depth to prevent stack overflow on malformed markdown */
const MAX_RENDER_DEPTH = 20;

/** Base token interface with common properties */
interface BaseToken {
  raw: string;
}

/** Text token - leaf node with plain text */
interface TextToken extends BaseToken {
  type: 'text' | 'escape';
  text: string;
  tokens?: InlineToken[]; // Can have nested tokens in some contexts
}

/** Strong/Bold token */
interface StrongToken extends BaseToken {
  type: 'strong';
  text: string;
  tokens: InlineToken[];
}

/** Emphasis/Italic token */
interface EmToken extends BaseToken {
  type: 'em';
  text: string;
  tokens: InlineToken[];
}

/** Inline code token */
interface CodespanToken extends BaseToken {
  type: 'codespan';
  text: string;
}

/** Link token */
interface LinkToken extends BaseToken {
  type: 'link';
  href: string;
  title?: string;
  text: string;
  tokens?: InlineToken[];
}

/** Strikethrough token */
interface DelToken extends BaseToken {
  type: 'del';
  text: string;
  tokens: InlineToken[];
}

/** Line break token */
interface BrToken extends BaseToken {
  type: 'br';
}

/** Generic token for unknown types */
interface GenericToken extends BaseToken {
  type: string;
  text?: string;
  tokens?: InlineToken[];
}

/** Discriminated union of all inline token types */
type InlineToken =
  | TextToken
  | StrongToken
  | EmToken
  | CodespanToken
  | LinkToken
  | DelToken
  | BrToken
  | GenericToken;

/** Helper to safely get text content from any token */
const getTokenText = (token: InlineToken): string => {
  if ('text' in token && token.text) return token.text;
  if ('raw' in token && token.raw) return token.raw;
  return '';
};

// ============================================================================
// INLINE CONTENT RENDERER (handles nested formatting)
// ============================================================================

interface InlineContentProps {
  tokens?: InlineToken[];
  depth?: number;
}

const InlineContent: React.FC<InlineContentProps> = ({ tokens, depth = 0 }) => {
  const theme = useTheme();

  // Safety: prevent infinite recursion
  if (depth > MAX_RENDER_DEPTH) {
    return <Text dimColor>…</Text>;
  }

  // Early return for empty/invalid tokens
  if (!tokens || tokens.length === 0) return null;

  return (
    <>
      {tokens.map((token, index) => {
        const key = `${token.type}-${index}`;

        switch (token.type) {
          case 'strong':
            return (
              <Text key={key} bold color={theme.bold.fg}>
                <InlineContent tokens={token.tokens} depth={depth + 1} />
              </Text>
            );

          case 'em':
            return (
              <Text key={key} italic color={theme.italic.fg}>
                <InlineContent tokens={token.tokens} depth={depth + 1} />
              </Text>
            );

          case 'codespan':
            return <ThemedInlineCode key={key}>{getTokenText(token)}</ThemedInlineCode>;

          case 'link': {
            const linkToken = token as LinkToken;
            return (
              <Text key={key} color={theme.link.fg} underline={theme.link.underline}>
                {linkToken.text || linkToken.href}
              </Text>
            );
          }

          case 'del':
            return (
              <Text key={key} strikethrough dimColor>
                <InlineContent tokens={token.tokens} depth={depth + 1} />
              </Text>
            );

          case 'text':
          case 'escape':
            // Text tokens can have nested inline tokens (e.g., bold in list items)
            if (token.tokens && token.tokens.length > 0) {
              return <InlineContent key={key} tokens={token.tokens} depth={depth + 1} />;
            }
            return <Text key={key}>{getTokenText(token)}</Text>;

          case 'br':
            return <Text key={key}>{'\n'}</Text>;

          default:
            // Use type-safe helper for unknown token types
            return <Text key={key}>{getTokenText(token)}</Text>;
        }
      })}
    </>
  );
};

// ============================================================================
// TOKEN RENDERER (recursive block-level rendering)
// ============================================================================

/** Block-level text token with optional nested inline tokens */
interface BlockTextToken {
  type: 'text';
  raw: string;
  text: string;
  tokens?: InlineToken[];
}

interface TokenRendererProps {
  tokens: Token[];
  listLevel?: number;
  depth?: number;
}

const TokenRenderer: React.FC<TokenRendererProps> = ({
  tokens,
  listLevel = 0,
  depth = 0
}) => {
  // Safety: prevent infinite recursion on malformed markdown
  if (depth > MAX_RENDER_DEPTH) {
    return <Text dimColor>[Content truncated: max depth exceeded]</Text>;
  }

  // Early return for empty/invalid tokens
  if (!tokens || tokens.length === 0) return null;

  return (
    <>
      {tokens.map((token, index) => {
        const key = `${token.type}-${index}`;

        switch (token.type) {
          case 'heading': {
            const heading = token as Tokens.Heading;
            return (
              <ThemedHeading key={key} depth={heading.depth}>
                <InlineContent tokens={heading.tokens as InlineToken[]} />
              </ThemedHeading>
            );
          }

          case 'paragraph': {
            const para = token as Tokens.Paragraph;
            return (
              <Box key={key} marginBottom={1}>
                <Text>
                  <InlineContent tokens={para.tokens as InlineToken[]} />
                </Text>
              </Box>
            );
          }

          case 'list': {
            const list = token as Tokens.List;
            return (
              <Box key={key} flexDirection="column" marginBottom={1}>
                {list.items.map((item, i) => (
                  <Box key={i} flexDirection="row">
                    <ThemedBullet level={listLevel} />
                    <Box flexDirection="column" flexGrow={1}>
                      {/* Render list item content */}
                      {item.tokens && (
                        <TokenRenderer
                          tokens={item.tokens as Token[]}
                          listLevel={listLevel + 1}
                          depth={depth + 1}
                        />
                      )}
                    </Box>
                  </Box>
                ))}
              </Box>
            );
          }

          case 'blockquote': {
            const quote = token as Tokens.Blockquote;
            return (
              <ThemedBlockquote key={key}>
                <TokenRenderer tokens={quote.tokens as Token[]} depth={depth + 1} />
              </ThemedBlockquote>
            );
          }

          case 'code': {
            const code = token as Tokens.Code;
            return <ThemedCodeBlock key={key} code={code.text} lang={code.lang} />;
          }

          case 'hr':
            return <ThemedDivider key={key} />;

          case 'space':
            return null;

          case 'html': {
            // Skip HTML blocks
            return null;
          }

          case 'table': {
            const table = token as Tokens.Table;
            return <ThemedTable key={key} table={table} />;
          }

          case 'text': {
            // Block-level text token (e.g., in list items)
            // These can have nested inline tokens
            const textToken = token as BlockTextToken;
            if (textToken.tokens && textToken.tokens.length > 0) {
              return (
                <Text key={key}>
                  <InlineContent tokens={textToken.tokens} depth={depth + 1} />
                </Text>
              );
            }
            return <Text key={key}>{textToken.text || textToken.raw || ''}</Text>;
          }

          default: {
            // Fallback: render raw text safely
            // Use type assertion to access raw property that all marked tokens have
            const rawToken = token as { raw?: string; text?: string };
            return <Text key={key}>{rawToken.raw || rawToken.text || ''}</Text>;
          }
        }
      })}
    </>
  );
};

// ============================================================================
// MAIN MARKDOWN COMPONENT
// ============================================================================

export interface MarkdownProps {
  children: string;
  theme?: InkTheme;
  model?: string;
  showDivider?: boolean;
}

export const Markdown: React.FC<MarkdownProps> = ({
  children,
  theme,
  model,
  showDivider = true
}) => {
  const activeTheme = theme || defaultTheme;

  const tokens = useMemo(() => {
    try {
      return marked.lexer(children || '');
    } catch {
      return [];
    }
  }, [children]);

  return (
    <ThemeContext.Provider value={activeTheme}>
      <Box flexDirection="column">
        {/* Model badge header */}
        {model && (
          <Box marginBottom={1}>
            <ModelBadge model={model} />
          </Box>
        )}

        {/* Divider after badge */}
        {model && showDivider && <ThemedDivider width={60} />}

        {/* Markdown content */}
        <TokenRenderer tokens={tokens} />

        {/* Footer divider */}
        {showDivider && <ThemedDivider width={60} />}
      </Box>
    </ThemeContext.Provider>
  );
};

// ============================================================================
// RENDER TO STRING (for MCP tool responses)
// ============================================================================

/**
 * Generate model badge with gradient background (raw ANSI - outside Ink)
 */
function generateGradientBadge(model: string): string {
  const modelKey = model.toLowerCase();
  const gradientColors = modelGradients[modelKey] || ['#888888', '#cccccc'];

  // Model-specific icons (Unicode - curated by multi-model consensus)
  const modelIconMap: Record<string, string> = {
    // AI Models
    gemini: '✦',       // Four-pointed star (single-width)
    grok: '⚡',         // Lightning bolt
    openai: '✾',       // Eight-petalled floret
    perplexity: '⍟',   // Circled star
    qwen: '☁',         // Cloud
    kimi: '☾',         // Crescent moon
    claude: '⚜',       // Fleur-de-lis
    // Orchestration Tools
    focus: '◉',        // Fisheye
    workflow: '⎔',     // Box with dots
    think: '◌',        // Dotted circle
    nextthought: '⟳',  // Clockwise arrow (chain/sequence)
    // Analysis Modes
    scout: '⊛',        // Circled asterisk
    verifier: '✓',     // Check mark
    challenger: '⚔',   // Crossed swords
    // Local Tools
    usage_stats: '📊',  // Chart
    list_workflows: '📋', // Clipboard
    validate_workflow: '✔', // Check
  };

  const icon = modelIconMap[modelKey] || '';
  // Consistent spacing: " ♊ gemini "
  const badgeText = icon ? ` ${icon} ${model} ` : ` ${model} `;

  return createGradientBgText(badgeText, gradientColors);
}

/**
 * Render markdown to ANSI string using React Ink
 *
 * @param markdown - Markdown content to render
 * @param themeName - Theme name (loads from themes/*.json) or 'nebula' for default
 * @param model - Optional model name for badge header
 * @returns ANSI-formatted string
 *
 * @example
 * const output = renderMarkdownToAnsi('# Hello\n**Bold** text', 'dracula', 'gemini');
 */
export function renderMarkdownToAnsi(
  markdown: string,
  themeName?: string,
  model?: string
): string {
  const theme = loadTheme(themeName);

  // Generate badge OUTSIDE of Ink (raw ANSI codes)
  let output = '';
  if (model) {
    output = generateGradientBadge(model) + '\n';
  }

  const stream = new PassThrough();

  stream.on('data', (chunk: Buffer) => {
    output += chunk.toString();
  });

  // Render markdown content (without badge - we added it above)
  const { unmount } = render(
    <Markdown theme={theme} showDivider={!!model}>
      {markdown}
    </Markdown>,
    {
      stdout: stream as unknown as NodeJS.WriteStream,
      exitOnCtrlC: false,
      patchConsole: false,
    }
  );

  // Immediately unmount to capture static render
  unmount();

  return output;
}

/**
 * Render markdown to ANSI with Base64 encoding (for safe JSON-RPC transport)
 *
 * Use this when ANSI codes get corrupted through MCP transport.
 * Client should decode: Buffer.from(encoded, 'base64').toString()
 */
export function renderMarkdownToBase64(
  markdown: string,
  themeName?: string,
  model?: string
): string {
  const ansi = renderMarkdownToAnsi(markdown, themeName, model);
  return Buffer.from(ansi).toString('base64');
}

// ============================================================================
// EXPORTS
// ============================================================================

export {
  defaultTheme,
  ThemedHeading,
  ThemedInlineCode,
  ThemedCodeBlock,
  ThemedBlockquote,
  ThemedBullet,
  ThemedDivider,
  ThemedTable,
  ModelBadge,
  Icon,
  InlineContent,
  TokenRenderer,
};

// Re-export icon utilities for convenience
export { icons, nerdIcons, hasNerdFontSupport, getIcon };

// Types are already exported via interface declarations above
// InkTheme, ColorStyle, MarkdownProps are available as exports
