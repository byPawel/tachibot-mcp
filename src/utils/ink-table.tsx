/**
 * Ink Table Component - Native React Ink Table with Flexbox Layout
 *
 * A responsive, theme-aware table component for React Ink CLI applications.
 * Designed to be extractable/reusable across projects (e.g., devlog-mcp).
 *
 * Features:
 * - Responsive: Adapts to terminal width automatically
 * - Native Ink Flexbox layout (no string-based table generation)
 * - Theme-aware borders and colors via context
 * - Column alignment support (left, center, right)
 * - Content truncation with ellipsis for overflow
 * - Markdown/inline token rendering support
 *
 * Usage:
 *   import { InkTable, SimpleTable, TableThemeContext } from './ink-table.js';
 *
 *   // With markdown tokens (from marked.js):
 *   <InkTable table={markdownTableToken} />
 *
 *   // With simple data arrays:
 *   <SimpleTable
 *     headers={['Name', 'Age', 'City']}
 *     rows={[['Alice', '30', 'NYC'], ['Bob', '25', 'LA']]}
 *   />
 *
 * @module ink-table
 * @author TachiBot MCP
 * @license MIT
 */

// Force color support FIRST
import './color-setup.js';

import React, { createContext, useContext, useMemo } from 'react';
import { Box, Text, useStdout, render } from 'ink';
import { PassThrough } from 'stream';

// ============================================================================
// TYPES
// ============================================================================

/** Table theme configuration */
export interface TableTheme {
  /** Border color (hex or named) */
  borderColor: string;
  /** Header text color */
  headerColor?: string;
  /** Header background color */
  headerBgColor?: string;
  /** Header bold flag */
  headerBold?: boolean;
  /** Cell text color */
  cellColor?: string;
  /** Alternating row background (optional) */
  alternateRowBg?: string;
}

/** Default table theme - high contrast headers */
const defaultTableTheme: TableTheme = {
  borderColor: '#666666',
  headerColor: '#000000',      // Dark text on light bg
  headerBgColor: '#87AFD7',    // Soft blue background
  headerBold: true,
  cellColor: undefined,        // Use terminal default
};

/** Theme context for table components */
const TableThemeContext = createContext<TableTheme>(defaultTableTheme);

/** Hook to access table theme */
export const useTableTheme = () => useContext(TableThemeContext);

/** Provider component for table theming */
export const TableThemeProvider: React.FC<{
  theme?: Partial<TableTheme>;
  children: React.ReactNode;
}> = ({ theme, children }) => {
  const mergedTheme = useMemo(
    () => ({ ...defaultTableTheme, ...theme }),
    [theme]
  );
  return (
    <TableThemeContext.Provider value={mergedTheme}>
      {children}
    </TableThemeContext.Provider>
  );
};

/** Cell alignment */
export type CellAlign = 'left' | 'center' | 'right';

/** Token-like structure for cell content (compatible with marked.js) */
export interface CellToken {
  type?: string;
  text?: string;
  raw?: string;
  tokens?: CellToken[];
}

/** Table data structure (compatible with marked.js Tokens.Table) */
export interface TableData {
  header: Array<{ tokens?: CellToken[] }>;
  rows: Array<Array<{ tokens?: CellToken[] }>>;
  align?: Array<CellAlign | null>;
}

// ============================================================================
// UTILITIES
// ============================================================================

/** Box drawing characters for table borders */
const BOX = {
  topLeft: '┌',
  topRight: '┐',
  bottomLeft: '└',
  bottomRight: '┘',
  horizontal: '─',
  vertical: '│',
  leftT: '├',
  rightT: '┤',
  topT: '┬',
  bottomT: '┴',
  cross: '┼',
} as const;

/**
 * Truncate text with ellipsis at word boundary (smarter truncation)
 */
function truncate(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text;

  // Try to truncate at word boundary
  const truncated = text.slice(0, maxLen - 1);
  const lastSpace = truncated.lastIndexOf(' ');

  // If we can cut at a word boundary (at least 60% of maxLen), do it
  if (lastSpace > maxLen * 0.6) {
    return truncated.slice(0, lastSpace) + '…';
  }

  // Otherwise just truncate at maxLen
  return truncated + '…';
}

/**
 * Get visible character length (strips ANSI codes)
 */
function visibleLength(str: string): number {
  // eslint-disable-next-line no-control-regex
  return str.replace(/\x1b\[[0-9;]*m/g, '').length;
}

/**
 * Extract plain text from cell tokens recursively
 */
function extractText(tokens?: CellToken[]): string {
  if (!tokens || tokens.length === 0) return '';
  return tokens
    .map((t) => {
      if (t.tokens && Array.isArray(t.tokens)) {
        return extractText(t.tokens);
      }
      return t.text || t.raw || '';
    })
    .join('');
}

/**
 * Get terminal width with fallback
 */
function getTerminalWidth(stdout?: NodeJS.WriteStream): number {
  // Try stdout columns first
  if (stdout?.columns) {
    return stdout.columns;
  }
  // Try process.stdout
  if (process.stdout?.columns) {
    return process.stdout.columns;
  }
  // Fallback to reasonable default
  return 100;
}

// ============================================================================
// SUB-COMPONENTS
// ============================================================================

interface HorizontalBorderProps {
  left: string;
  mid: string;
  right: string;
  cross: string;
  colWidths: number[];
}

const HorizontalBorder: React.FC<HorizontalBorderProps> = ({
  left,
  mid,
  right,
  cross,
  colWidths,
}) => {
  const theme = useTableTheme();
  // colWidths already include padding, so just use them directly
  const segments = colWidths.map((w) => mid.repeat(w));
  return (
    <Text color={theme.borderColor}>
      {left}
      {segments.join(cross)}
      {right}
    </Text>
  );
};

interface TableCellProps {
  content: string;
  width: number;
  align?: CellAlign;
  isHeader?: boolean;
}

const TableCell: React.FC<TableCellProps> = React.memo(({
  content,
  width,
  align = 'left',
  isHeader = false,
}) => {
  const theme = useTableTheme();

  // FIX: Account for the 2 padding spaces we add in render (' ' + text + ' ')
  const innerWidth = Math.max(0, width - 2);
  const truncated = truncate(content, innerWidth);

  // Calculate padding for alignment based on inner width
  const padTotal = Math.max(0, innerWidth - visibleLength(truncated));
  let padLeft = 0;
  let padRight = 0;

  if (align === 'center') {
    padLeft = Math.floor(padTotal / 2);
    padRight = padTotal - padLeft;
  } else if (align === 'right') {
    padLeft = padTotal;
  } else {
    padRight = padTotal;
  }

  const paddedText = ' '.repeat(padLeft) + truncated + ' '.repeat(padRight);

  // Only bold headers if no background color (background already distinguishes them)
  const shouldBold = isHeader && theme.headerBold && !theme.headerBgColor;

  return (
    <Text
      bold={shouldBold}
      color={isHeader ? theme.headerColor : theme.cellColor}
      backgroundColor={isHeader ? theme.headerBgColor : undefined}
      wrap="truncate"
    >
      {' '}{paddedText}{' '}
    </Text>
  );
});

interface TableRowProps {
  cells: string[];
  colWidths: number[];
  aligns: Array<CellAlign | null>;
  isHeader?: boolean;
}

const TableRow: React.FC<TableRowProps> = React.memo(({
  cells,
  colWidths,
  aligns,
  isHeader = false,
}) => {
  const theme = useTableTheme();

  // FIX: Calculate total width = sum(colWidths) + borders (numCols + 1)
  const totalWidth = colWidths.reduce((sum, w) => sum + w, 0) + colWidths.length + 1;

  return (
    <Box
      flexDirection="row"
      flexWrap="nowrap"
      width={totalWidth}
    >
      <Text color={theme.borderColor}>{BOX.vertical}</Text>
      {cells.map((cell, i) => (
        <React.Fragment key={i}>
          <TableCell
            content={cell}
            width={colWidths[i]}
            align={aligns[i] || 'left'}
            isHeader={isHeader}
          />
          <Text color={theme.borderColor}>{BOX.vertical}</Text>
        </React.Fragment>
      ))}
    </Box>
  );
});

// ============================================================================
// MAIN COMPONENTS
// ============================================================================

export interface InkTableProps {
  /** Table data (compatible with marked.js Tokens.Table) */
  table: TableData;
  /** Maximum total width (overrides terminal detection) */
  maxWidth?: number;
  /** Minimum column width */
  minColWidth?: number;
  /** Maximum column width */
  maxColWidth?: number;
}

/**
 * InkTable - Renders markdown table tokens as native Ink components
 *
 * @example
 * // With marked.js tokens
 * const tokens = marked.lexer(markdownText);
 * const tableToken = tokens.find(t => t.type === 'table');
 * <InkTable table={tableToken} />
 */
export const InkTable: React.FC<InkTableProps> = ({
  table,
  maxWidth,
  minColWidth = 8,
  maxColWidth = 40,
}) => {
  const { stdout } = useStdout();
  const termWidth = maxWidth ?? getTerminalWidth(stdout);

  const numCols = table.header.length;
  if (numCols === 0) return null;

  // Extract text content from all cells
  const headerTexts = table.header.map((cell) => extractText(cell.tokens));
  const rowTexts = table.rows.map((row) =>
    row.map((cell) => extractText(cell.tokens))
  );

  // Calculate column widths based on content
  const colWidths = useMemo(() => {
    const widths: number[] = [];

    for (let col = 0; col < numCols; col++) {
      let maxLen = visibleLength(headerTexts[col]);

      for (const row of rowTexts) {
        maxLen = Math.max(maxLen, visibleLength(row[col] || ''));
      }

      // Add 2 for cell padding (' content ') so we compare cell widths consistently
      widths.push(maxLen + 2);
    }

    // Calculate available width for columns
    // Account for: borders (numCols + 1) + cell padding (numCols * 2)
    const borderWidth = numCols + 1;
    const paddingWidth = numCols * 2;
    const availableWidth = termWidth - borderWidth - paddingWidth;
    const perColMax = Math.floor(availableWidth / numCols);

    // Clamp widths
    return widths.map((w) =>
      Math.min(Math.max(w, minColWidth), Math.min(maxColWidth, perColMax))
    );
  }, [numCols, headerTexts, rowTexts, termWidth, minColWidth, maxColWidth]);

  // Get alignments
  const aligns = table.align || [];

  return (
    <Box flexDirection="column">
      {/* Top border */}
      <HorizontalBorder
        left={BOX.topLeft}
        mid={BOX.horizontal}
        right={BOX.topRight}
        cross={BOX.topT}
        colWidths={colWidths}
      />

      {/* Header row */}
      <TableRow
        cells={headerTexts}
        colWidths={colWidths}
        aligns={aligns}
        isHeader={true}
      />

      {/* Header separator */}
      <HorizontalBorder
        left={BOX.leftT}
        mid={BOX.horizontal}
        right={BOX.rightT}
        cross={BOX.cross}
        colWidths={colWidths}
      />

      {/* Data rows */}
      {rowTexts.map((row, i) => (
        <TableRow
          key={i}
          cells={row}
          colWidths={colWidths}
          aligns={aligns}
          isHeader={false}
        />
      ))}

      {/* Bottom border */}
      <HorizontalBorder
        left={BOX.bottomLeft}
        mid={BOX.horizontal}
        right={BOX.bottomRight}
        cross={BOX.bottomT}
        colWidths={colWidths}
      />
    </Box>
  );
};

export interface SimpleTableProps {
  /** Column headers */
  headers: string[];
  /** Row data (array of arrays) */
  rows: string[][];
  /** Column alignments */
  align?: Array<CellAlign | null>;
  /** Maximum total width */
  maxWidth?: number;
  /** Minimum column width */
  minColWidth?: number;
  /** Maximum column width */
  maxColWidth?: number;
}

/**
 * SimpleTable - Renders a table from plain string data
 *
 * @example
 * <SimpleTable
 *   headers={['Name', 'Age', 'City']}
 *   rows={[
 *     ['Alice', '30', 'New York'],
 *     ['Bob', '25', 'Los Angeles'],
 *   ]}
 *   align={['left', 'right', 'center']}
 * />
 */
export const SimpleTable: React.FC<SimpleTableProps> = ({
  headers,
  rows,
  align,
  ...rest
}) => {
  // Convert to TableData format
  const tableData: TableData = {
    header: headers.map((h) => ({ tokens: [{ text: h }] })),
    rows: rows.map((row) => row.map((cell) => ({ tokens: [{ text: cell }] }))),
    align,
  };

  return <InkTable table={tableData} {...rest} />;
};

// ============================================================================
// SMART TABLE (Auto-Split at Max Columns)
// ============================================================================

/** Row data for SmartTable */
export interface SmartRow {
  /** Row label (first column) */
  label: string;
  /** Values for each column */
  values: string[];
  /** Full text for Details section (optional) */
  detail?: string;
}

export interface SmartTableProps {
  /** Table title */
  title?: string;
  /** Column headers (excluding label column) */
  headers: string[];
  /** Row data */
  rows: SmartRow[];
  /** Maximum columns per table (default: 3) */
  maxColumns?: number;
  /** Show details section below table (default: true if any row has detail) */
  showDetails?: boolean;
  /** Maximum column width */
  maxColWidth?: number;
}

/**
 * SmartTable - Auto-splits tables with more than maxColumns
 *
 * @example
 * <SmartTable
 *   title="Comparison"
 *   headers={['Streaming', 'Batched', 'Hybrid', 'Cards']}
 *   rows={[
 *     { label: 'Latency', values: ['✓ Best', '✗ Worst', '◐ Med', '◐ Med'], detail: 'Streaming has lowest latency' },
 *     { label: 'Cost', values: ['✗ High', '✓ Low', '◐ Med', '◐ Med'], detail: 'Batched is most cost effective' },
 *   ]}
 *   maxColumns={3}
 * />
 */
export const SmartTable: React.FC<SmartTableProps> = ({
  title,
  headers,
  rows,
  maxColumns = 3,
  showDetails,
  maxColWidth = 25,
}) => {
  // Headers go into data columns (label is always first)
  const dataColCount = maxColumns - 1; // Reserve 1 for label column

  // Split headers into chunks
  const headerChunks: string[][] = [];
  for (let i = 0; i < headers.length; i += dataColCount) {
    headerChunks.push(headers.slice(i, i + dataColCount));
  }

  // Determine if we should show details
  const hasDetails = rows.some(r => r.detail);
  const shouldShowDetails = showDetails ?? hasDetails;

  return (
    <Box flexDirection="column">
      {headerChunks.map((chunkHeaders, chunkIndex) => (
        <Box key={chunkIndex} flexDirection="column" marginBottom={1}>
          {/* Table title with part number */}
          {title && (
            <Text bold>
              {title} {headerChunks.length > 1 ? `(${chunkIndex + 1}/${headerChunks.length})` : ''}
            </Text>
          )}

          {/* Table for this chunk */}
          <SimpleTable
            headers={['', ...chunkHeaders]}
            rows={rows.map(r => [
              r.label,
              ...r.values.slice(
                chunkIndex * dataColCount,
                (chunkIndex + 1) * dataColCount
              ),
            ])}
            maxColWidth={maxColWidth}
          />

          {/* Details section (only show once, on last chunk) */}
          {shouldShowDetails && chunkIndex === headerChunks.length - 1 && (
            <Box flexDirection="column" marginTop={1}>
              {rows.filter(r => r.detail).map((row, i) => (
                <Text key={i} wrap="wrap">• {row.label}: {row.detail}</Text>
              ))}
            </Box>
          )}
        </Box>
      ))}
    </Box>
  );
};

// ============================================================================
// KEY VALUE CARD (For Long Content)
// ============================================================================

export interface KeyValueCardProps {
  /** Card title */
  title: string;
  /** Key-value entries */
  entries: Array<{ key: string; value: string }>;
  /** Border color (default: blue) */
  borderColor?: string;
  /** Optional model name for theming */
  model?: string;
}

/**
 * KeyValueCard - Displays long content in a bordered card format
 *
 * @example
 * <KeyValueCard
 *   title="Step 1: Research"
 *   entries={[
 *     { key: 'Model', value: 'perplexity' },
 *     { key: 'Duration', value: '2.3s' },
 *     { key: 'Output', value: 'Found 5 key patterns...' },
 *   ]}
 * />
 */
export const KeyValueCard: React.FC<KeyValueCardProps> = ({
  title,
  entries,
  borderColor = '#60A5FA',
}) => {
  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor={borderColor}
      paddingX={1}
      marginBottom={1}
    >
      <Text bold color={borderColor}>{title}</Text>
      <Box marginTop={1} flexDirection="column">
        {entries.map((entry, i) => (
          <Box key={i} flexDirection="row">
            <Text dimColor>{entry.key.padEnd(12)}</Text>
            <Text wrap="wrap">{entry.value}</Text>
          </Box>
        ))}
      </Box>
    </Box>
  );
};

// ============================================================================
// RENDER HELPERS (Ink to ANSI String)
// ============================================================================

/**
 * Render an Ink element to an ANSI string
 */
function renderInkToString(element: React.ReactElement): string {
  const stream = new PassThrough();
  let output = '';
  stream.on('data', (chunk: Buffer) => {
    output += chunk.toString();
  });

  const { unmount } = render(element, {
    stdout: stream as unknown as NodeJS.WriteStream,
    exitOnCtrlC: false,
    patchConsole: false,
  });

  unmount();
  return output;
}

/**
 * Render SmartTable to ANSI string
 */
export function renderSmartTable(props: SmartTableProps): string {
  return renderInkToString(<SmartTable {...props} />);
}

/**
 * Render KeyValueCard to ANSI string
 */
export function renderKeyValueCard(props: KeyValueCardProps): string {
  return renderInkToString(<KeyValueCard {...props} />);
}

/**
 * Render SimpleTable to ANSI string
 */
export function renderSimpleTable(props: SimpleTableProps): string {
  return renderInkToString(<SimpleTable {...props} />);
}

// ============================================================================
// EXPORTS
// ============================================================================

export {
  BOX,
  truncate,
  visibleLength,
  extractText,
  getTerminalWidth,
  defaultTableTheme,
  TableThemeContext,
  renderInkToString,
};
