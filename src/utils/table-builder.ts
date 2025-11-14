/**
 * Beautiful Unicode box-drawing table builder using cli-table3
 * Provides a fluent API for creating readable, professional tables
 *
 * @example
 * ```typescript
 * const table = new TableBuilder()
 *   .withHeaders(['Status', 'Model', 'Conclusion'])
 *   .withAlignments(['center', 'left', 'center'])
 *   .addRow(['✅', 'grok-4', '✓ true'])
 *   .build();
 * ```
 */

import Table from 'cli-table3';
import type * as CliTable3 from 'cli-table3';

export type Alignment = 'left' | 'center' | 'right';

export interface TableStyle {
  chars: Partial<Record<CliTable3.CharName, string>>;
  style?: {
    head?: string[];
    border?: string[];
    compact?: boolean;
  };
}

/**
 * Predefined table styles
 */
export const TableStyles = {
  /**
   * Beautiful Unicode box-drawing characters
   * Uses double lines for outer border, single lines for inner
   */
  unicode: {
    chars: {
      'top': '═',
      'top-mid': '╤',
      'top-left': '╔',
      'top-right': '╗',
      'bottom': '═',
      'bottom-mid': '╧',
      'bottom-left': '╚',
      'bottom-right': '╝',
      'left': '║',
      'left-mid': '╟',
      'mid': '─',
      'mid-mid': '┼',
      'right': '║',
      'right-mid': '╢',
      'middle': '│'
    },
    style: {
      head: [],  // No color styling for headers
      border: [] // No color styling for borders
    }
  },

  /**
   * Compact Unicode style with single lines
   */
  compact: {
    chars: {
      'top': '─',
      'top-mid': '┬',
      'top-left': '┌',
      'top-right': '┐',
      'bottom': '─',
      'bottom-mid': '┴',
      'bottom-left': '└',
      'bottom-right': '┘',
      'left': '│',
      'left-mid': '├',
      'mid': '─',
      'mid-mid': '┼',
      'right': '│',
      'right-mid': '┤',
      'middle': '│'
    },
    style: {
      head: [],
      border: []
    }
  },

  /**
   * ASCII-only style for maximum compatibility
   */
  ascii: {
    chars: {
      'top': '-',
      'top-mid': '+',
      'top-left': '+',
      'top-right': '+',
      'bottom': '-',
      'bottom-mid': '+',
      'bottom-left': '+',
      'bottom-right': '+',
      'left': '|',
      'left-mid': '+',
      'mid': '-',
      'mid-mid': '+',
      'right': '|',
      'right-mid': '+',
      'middle': '|'
    },
    style: {
      head: [],
      border: []
    }
  }
};

/**
 * Fluent API table builder with beautiful Unicode box-drawing
 */
export class TableBuilder {
  private headers: string[] = [];
  private alignments: Alignment[] = [];
  private rows: (string | number)[][] = [];
  private style: TableStyle = TableStyles.unicode;
  private colWidths?: number[];

  /**
   * Set table headers
   */
  public withHeaders(headers: string[]): this {
    this.headers = headers;
    return this;
  }

  /**
   * Set column alignments
   * @param alignments - Array of 'left', 'center', or 'right'
   */
  public withAlignments(alignments: Alignment[]): this {
    this.alignments = alignments;
    return this;
  }

  /**
   * Set explicit column widths
   * @param widths - Array of column widths in characters
   */
  public withColumnWidths(widths: number[]): this {
    this.colWidths = widths;
    return this;
  }

  /**
   * Use a predefined style
   * @param styleName - 'unicode', 'compact', or 'ascii'
   */
  public withStyle(styleName: 'unicode' | 'compact' | 'ascii'): this {
    this.style = TableStyles[styleName];
    return this;
  }

  /**
   * Use custom box-drawing characters
   * @param chars - Custom character set
   */
  public withCustomChars(chars: Partial<Record<CliTable3.CharName, string>>): this {
    this.style = {
      ...this.style,
      chars: { ...this.style.chars, ...chars }
    };
    return this;
  }

  /**
   * Add a single row to the table
   * @param row - Array of cell values
   */
  public addRow(row: (string | number)[]): this {
    this.rows.push(row);
    return this;
  }

  /**
   * Add multiple rows at once
   * @param rows - Array of row arrays
   */
  public addRows(rows: (string | number)[][]): this {
    this.rows.push(...rows);
    return this;
  }

  /**
   * Build and return the formatted table string
   * @returns Formatted table with newline prefix for spacing
   */
  public build(): string {
    const options: CliTable3.TableConstructorOptions = {
      head: this.headers.length > 0 ? this.headers : undefined,
      colAligns: this.alignments.length > 0 ? this.alignments : undefined,
      ...this.style
    };

    // Only add colWidths if explicitly set
    if (this.colWidths && this.colWidths.length > 0) {
      options.colWidths = this.colWidths;
    }

    const table = new Table(options);

    if (this.rows.length > 0) {
      table.push(...this.rows);
    }

    // Add newline prefix for better spacing in output
    return '\n' + table.toString();
  }

  /**
   * Build and return without the leading newline
   * @returns Formatted table without prefix spacing
   */
  public buildRaw(): string {
    return this.build().trimStart();
  }
}

/**
 * Quick helper function for simple tables
 * @param headers - Column headers
 * @param rows - Table rows
 * @param alignments - Optional column alignments
 * @returns Formatted table string
 *
 * @example
 * ```typescript
 * const table = quickTable(
 *   ['Name', 'Age'],
 *   [['Alice', 30], ['Bob', 25]],
 *   ['left', 'right']
 * );
 * ```
 */
export function quickTable(
  headers: string[],
  rows: (string | number)[][],
  alignments?: Alignment[]
): string {
  const builder = new TableBuilder().withHeaders(headers).addRows(rows);

  if (alignments) {
    builder.withAlignments(alignments);
  }

  return builder.build();
}
