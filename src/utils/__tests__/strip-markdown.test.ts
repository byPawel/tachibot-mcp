import { describe, it, expect } from 'vitest';
import { stripMarkdown } from '../ansi-renderer.js';

describe('stripMarkdown', () => {
  it('strips headers to plain text by default', () => {
    expect(stripMarkdown('## Analysis')).toBe('Analysis');
    expect(stripMarkdown('### Summary')).toBe('Summary');
  });

  it('converts headers to ANSI bold when boldHeaders is true', () => {
    const result = stripMarkdown('## Analysis', { boldHeaders: true });
    expect(result).toBe('\x1b[1mAnalysis\x1b[0m');
  });

  it('handles h1-h6 with ANSI bold', () => {
    const result = stripMarkdown('# Title\n## Section\n### Sub', { boldHeaders: true });
    expect(result).toContain('\x1b[1mTitle\x1b[0m');
    expect(result).toContain('\x1b[1mSection\x1b[0m');
    expect(result).toContain('\x1b[1mSub\x1b[0m');
  });

  it('strips bold/italic/strikethrough normally', () => {
    expect(stripMarkdown('**bold** and *italic* and ~~strike~~')).toBe('bold and italic and strike');
  });

  it('preserves bullets and indentation', () => {
    const input = '- Item 1\n  - Sub item\n    - Deep';
    expect(stripMarkdown(input)).toBe(input);
  });

  it('preserves code blocks untouched', () => {
    const input = '```js\nconst x = 1;\n```';
    expect(stripMarkdown(input)).toContain('const x = 1;');
  });

  it('strips horizontal rules', () => {
    expect(stripMarkdown('---')).toBe('');
    expect(stripMarkdown('***')).toBe('');
  });
});
