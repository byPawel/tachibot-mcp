/**
 * Format Stripper Utility
 * Strips **bold**, *italic* markdown and ANSI escape codes from text
 * Used to ensure clean plain text output from all tool returns
 */

/**
 * Strip formatting from text - removes markdown bold/italic and ANSI codes
 * Preserves emojis and plain text content
 */
export function stripFormatting(text: string): string {
  if (!text || typeof text !== 'string') {
    return text;
  }

  return text
    .replace(/\*\*([^*]+)\*\*/g, '$1')  // Remove **bold**
    .replace(/\*([^*]+)\*/g, '$1')       // Remove *italic*
    .replace(/\x1b\[[0-9;]*m/g, '')      // Remove ANSI escape codes
    .replace(/\x00RAWANSI\x00[\s\S]*?\x00\/RAWANSI\x00/g, ''); // Remove RAWANSI blocks
}

/**
 * Wrap a string-returning function to strip formatting from its output
 */
export function withStrippedFormatting<T extends any[]>(
  fn: (...args: T) => Promise<string>
): (...args: T) => Promise<string> {
  return async (...args: T) => {
    const result = await fn(...args);
    return stripFormatting(result);
  };
}
