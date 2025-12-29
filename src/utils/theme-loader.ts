/**
 * JSON Theme Loader for TachiBot MCP
 *
 * Loads custom themes from JSON files in the themes/ directory.
 * Supports theme inheritance via "extends" property.
 *
 * Usage:
 *   1. Create a JSON file in themes/ (e.g., themes/dracula.json)
 *   2. Set TACHIBOT_THEME=dracula
 *   3. Restart the MCP server
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import chalk from 'chalk';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Path to themes directory (from dist/src/utils -> ../../themes)
const THEMES_DIR = path.resolve(__dirname, '../../../themes');

// ============================================================================
// TYPES
// ============================================================================

/**
 * Chalk builder type - chainable style builder
 * Uses interface for recursive self-reference support
 */
interface ChalkBuilder {
  (text: string | number): string;
  bold: ChalkBuilder;
  italic: ChalkBuilder;
  underline: ChalkBuilder;
  hex(color: string): ChalkBuilder;
  bgHex(color: string): ChalkBuilder;
  ansi256(code: number): ChalkBuilder;
  bgAnsi256(code: number): ChalkBuilder;
}

/** Final callable style function */
type ChalkStyleFn = (text: string | number) => string;

// ============================================================================
// COLOR CONVERSION
// ============================================================================

/**
 * Convert hex color to ANSI 256 color code
 */
function hexToAnsi256(hex: string): number {
  // Remove # if present
  hex = hex.replace('#', '');

  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);

  // Check for grayscale
  if (r === g && g === b) {
    if (r < 8) return 16;
    if (r > 248) return 231;
    return Math.round(((r - 8) / 247) * 24) + 232;
  }

  // Convert to 6x6x6 color cube
  const ansiR = Math.round(r / 255 * 5);
  const ansiG = Math.round(g / 255 * 5);
  const ansiB = Math.round(b / 255 * 5);

  return 16 + (36 * ansiR) + (6 * ansiG) + ansiB;
}

/**
 * Create chalk style from color config
 */
function createChalkStyle(config: {
  fg?: string;
  bg?: string;
  bold?: boolean;
  underline?: boolean;
  italic?: boolean;
}): ChalkStyleFn {
  // Use ChalkBuilder for internal chaining, cast through unknown for type safety
  let style = chalk as unknown as ChalkBuilder;

  if (config.bold) style = style.bold;
  if (config.underline) style = style.underline;
  if (config.italic) style = style.italic;

  if (config.fg) {
    if (config.fg.startsWith('#')) {
      style = style.ansi256(hexToAnsi256(config.fg));
    } else if (config.fg.match(/^\d+$/)) {
      style = style.ansi256(parseInt(config.fg));
    } else {
      // Named color - access dynamically
      const colorStyle = (chalk as unknown as Record<string, ChalkBuilder>)[config.fg];
      if (colorStyle) style = colorStyle;
    }
  }

  if (config.bg) {
    if (config.bg.startsWith('#')) {
      style = style.bgAnsi256(hexToAnsi256(config.bg));
    } else if (config.bg.match(/^\d+$/)) {
      style = style.bgAnsi256(parseInt(config.bg));
    } else {
      // Named color with bg prefix
      const bgName = 'bg' + config.bg.charAt(0).toUpperCase() + config.bg.slice(1);
      const bgStyle = (chalk as unknown as Record<string, ChalkBuilder>)[bgName];
      if (bgStyle) style = bgStyle;
    }
  }

  // Return as callable function
  return style as ChalkStyleFn;
}

// ============================================================================
// JSON THEME INTERFACE
// ============================================================================

interface JsonThemeColors {
  h1?: { fg?: string; bg?: string; bold?: boolean; underline?: boolean };
  h2?: { fg?: string; bg?: string; bold?: boolean };
  bold?: string;
  italic?: string;
  code?: { fg?: string; bg?: string };
  link?: string;
  bullet1?: string;
  bullet2?: string;
  bullet3?: string;
  divider?: string;
}

export interface JsonTheme {
  name: string;
  description?: string;
  extends?: 'nebula' | 'cyberpunk' | 'minimal' | 'ocean';
  colors?: JsonThemeColors;
  modelBadges?: Record<string, { fg?: string; bg?: string; icon?: string }>;
}

// ============================================================================
// THEME LOADING
// ============================================================================

/**
 * Load a JSON theme file
 */
export function loadJsonTheme(themeName: string): JsonTheme | null {
  const themePath = path.join(THEMES_DIR, `${themeName}.json`);

  if (!fs.existsSync(themePath)) {
    return null;
  }

  try {
    const content = fs.readFileSync(themePath, 'utf-8');
    return JSON.parse(content) as JsonTheme;
  } catch (error) {
    console.error(`[theme-loader] Failed to load theme ${themeName}:`, error);
    return null;
  }
}

/**
 * List all available JSON themes
 */
export function listJsonThemes(): string[] {
  if (!fs.existsSync(THEMES_DIR)) {
    return [];
  }

  return fs.readdirSync(THEMES_DIR)
    .filter(f => f.endsWith('.json') && f !== 'theme-schema.json')
    .map(f => f.replace('.json', ''));
}

/**
 * Check if a custom JSON theme exists
 */
export function hasJsonTheme(themeName: string): boolean {
  const themePath = path.join(THEMES_DIR, `${themeName}.json`);
  return fs.existsSync(themePath);
}

/**
 * Apply JSON theme colors to a base theme object
 * Returns style functions that can be used like the built-in themes
 */
export function applyJsonTheme(jsonTheme: JsonTheme, baseTheme: any): any {
  const result = { ...baseTheme };

  if (!jsonTheme.colors) {
    return result;
  }

  const colors = jsonTheme.colors;

  // Apply color overrides
  if (colors.h1) {
    result.h1 = createChalkStyle(colors.h1);
  }
  if (colors.h2) {
    result.h2 = createChalkStyle(colors.h2);
  }
  if (colors.bold) {
    result.bold = chalk.bold.hex(colors.bold);
  }
  if (colors.italic) {
    result.italic = chalk.italic.hex(colors.italic);
  }
  if (colors.code) {
    result.code = createChalkStyle(colors.code);
  }
  if (colors.link) {
    result.link = chalk.underline.hex(colors.link);
  }
  if (colors.bullet1) {
    result.bullet1 = chalk.hex(colors.bullet1)('●');
  }
  if (colors.bullet2) {
    result.bullet2 = chalk.hex(colors.bullet2)('○');
  }
  if (colors.bullet3) {
    result.bullet3 = chalk.hex(colors.bullet3)('▸');
  }
  if (colors.divider) {
    result.dividerThin = chalk.hex(colors.divider)('─'.repeat(60));
    result.dividerThick = chalk.hex(colors.divider)('━'.repeat(60));
  }

  // Apply model badge overrides
  if (jsonTheme.modelBadges) {
    result.modelBadges = { ...result.modelBadges };
    for (const [model, badge] of Object.entries(jsonTheme.modelBadges)) {
      if (badge.bg && badge.fg) {
        const bgCode = badge.bg.startsWith('#') ? hexToAnsi256(badge.bg) : parseInt(badge.bg);
        const fgCode = badge.fg.startsWith('#') ? hexToAnsi256(badge.fg) : parseInt(badge.fg);
        result.modelBadges[model] = {
          style: chalk.bgAnsi256(bgCode).ansi256(fgCode).bold,
          icon: badge.icon || result.modelBadges[model]?.icon || '',
          label: model.toUpperCase()
        };
      }
    }
  }

  return result;
}

// Export for use in ansi-styles.ts
export { hexToAnsi256, createChalkStyle };
