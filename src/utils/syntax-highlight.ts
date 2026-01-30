/**
 * Syntax highlighting for terminal output using highlight.js
 * Replaces the unmaintained cli-highlight package.
 */

import hljs from 'highlight.js';

const RESET = '\x1b[0m';

const DEFAULT_ANSI: Record<string, string> = {
  'keyword': '\x1b[38;5;141m',
  'built_in': '\x1b[38;5;117m',
  'string': '\x1b[38;5;114m',
  'number': '\x1b[38;5;75m',
  'literal': '\x1b[38;5;75m',
  'title': '\x1b[38;5;117m',
  'title.class_': '\x1b[38;5;117m',
  'title.function_': '\x1b[38;5;222m',
  'function': '\x1b[38;5;222m',
  'class': '\x1b[38;5;117m',
  'comment': '\x1b[38;5;102m',
  'variable': '\x1b[38;5;117m',
  'operator': '\x1b[38;5;252m',
  'punctuation': '\x1b[38;5;252m',
  'attr': '\x1b[38;5;222m',
  'params': '\x1b[38;5;209m',
  'type': '\x1b[38;5;117m',
  'tag': '\x1b[38;5;211m',
  'property': '\x1b[38;5;222m',
  'regexp': '\x1b[38;5;114m',
  'meta': '\x1b[38;5;141m',
  'symbol': '\x1b[38;5;209m',
  'selector-tag': '\x1b[38;5;211m',
  'selector-class': '\x1b[38;5;222m',
  'selector-id': '\x1b[38;5;117m',
  'subst': '\x1b[38;5;252m',
  'section': '\x1b[38;5;141m',
  'name': '\x1b[38;5;117m',
  'attribute': '\x1b[38;5;222m',
  'addition': '\x1b[38;5;114m',
  'deletion': '\x1b[38;5;204m',
};

export interface HighlightOptions {
  language?: string;
  ignoreIllegals?: boolean;
  theme?: Record<string, (s: string) => string>;
}

function unescapeHtml(html: string): string {
  return html
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&#39;/g, "'");
}

function htmlToAnsi(html: string, theme?: Record<string, (s: string) => string>): string {
  let result = unescapeHtml(html);

  if (theme) {
    // Function-based theme: process innermost spans first
    let changed = true;
    while (changed) {
      const before = result;
      result = result.replace(/<span class="hljs-([^"]+)">([^<]*)<\/span>/g, (_, cls, content) => {
        const fn = theme[cls];
        return fn ? fn(content) : content;
      });
      changed = result !== before;
    }
    // Clean any remaining tags
    result = result.replace(/<[^>]+>/g, '');
  } else {
    // Default ANSI theme
    result = result
      .replace(/<span class="hljs-([^"]+)">/g, (_, cls) => DEFAULT_ANSI[cls] || '')
      .replace(/<\/span>/g, RESET);
    result = result.replace(/<[^>]+>/g, '');
  }

  return result;
}

export function highlight(code: string, options?: HighlightOptions): string {
  try {
    const result = options?.language
      ? hljs.highlight(code, { language: options.language, ignoreIllegals: options?.ignoreIllegals ?? true })
      : hljs.highlightAuto(code);
    return htmlToAnsi(result.value, options?.theme);
  } catch {
    return code;
  }
}
