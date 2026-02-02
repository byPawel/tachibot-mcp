/**
 * Stream + Distill: The core token-saving mechanism.
 *
 * Pattern:
 *   1. Tool calls external API → gets full response (1000-3000 tokens)
 *   2. Stream full response to user via context.streamContent() — user sees everything
 *   3. Return distilled summary (100-300 tokens) — Claude sees only summary
 *   4. Token savings: 85-90% reduction on tool result context
 *
 * streamContent() chunks go to the CLIENT (terminal display only).
 * Only the final return value enters Claude's context window.
 * Streaming has ZERO additional token cost for Claude.
 *
 * Configurable via environment variables:
 *   TACHIBOT_DISTILL=true|false        (default: true)
 *   TACHIBOT_DISTILL_THRESHOLD=800     chars — only distill responses longer than this
 *   TACHIBOT_DISTILL_MAX=1200          chars — max summary length
 */

// ─── Configuration ───

const isDistillEnabled = (): boolean =>
  process.env.TACHIBOT_DISTILL !== 'false';

const getDistillThreshold = (): number =>
  parseInt(process.env.TACHIBOT_DISTILL_THRESHOLD || '800', 10);

const getDistillMax = (): number =>
  parseInt(process.env.TACHIBOT_DISTILL_MAX || '1200', 10);

// ─── Smart Truncation ───

/**
 * Smart truncation: cuts at paragraph/sentence boundary, never mid-word.
 * Adapted from planner-tools.ts pattern.
 */
export function truncateSmart(text: string | undefined, limit: number): string {
  if (!text) return "";
  if (text.length <= limit) return text;

  // Reserve space for the marker so total output never exceeds limit
  const marker = '\n\n[…truncated]';
  const cap = limit - marker.length;
  const truncated = text.substring(0, cap);

  // Try paragraph boundary first
  const lastParagraph = truncated.lastIndexOf('\n\n');
  if (lastParagraph > cap * 0.7)
    return truncated.substring(0, lastParagraph) + marker;

  // Try sentence boundary
  const lastSentence = truncated.lastIndexOf('. ');
  if (lastSentence > cap * 0.7)
    return truncated.substring(0, lastSentence + 1) + ' […truncated]';

  // Fall back to newline
  const lastNewline = truncated.lastIndexOf('\n');
  if (lastNewline > cap * 0.7)
    return truncated.substring(0, lastNewline) + '\n[…truncated]';

  return truncated + '…';
}

// ─── Summary Extraction ───

/**
 * Extract a structured summary block if present.
 * Models sometimes produce ---SUMMARY--- blocks (especially via planner).
 */
function extractSummaryBlock(text: string): string | null {
  const match = text.match(/---SUMMARY---\s*([\s\S]*?)\s*---END SUMMARY---/);
  if (match && match[1].trim().length > 50) {
    return match[1].trim();
  }
  return null;
}

/**
 * Extract key information from a response for distillation.
 * Strategy:
 *   1. If response has ---SUMMARY--- block → use it
 *   2. Otherwise: first paragraph + bullet points + conclusion
 *   3. Cap at DISTILL_MAX chars
 */
export function distillResponse(text: string, toolName: string): string {
  const maxLen = getDistillMax();

  // 1. Try structured summary block
  const summaryBlock = extractSummaryBlock(text);
  if (summaryBlock) {
    return truncateSmart(`[${toolName} summary]\n${summaryBlock}`, maxLen);
  }

  // 2. Auto-distill: extract key sections
  const lines = text.split('\n');
  const parts: string[] = [];
  let charCount = 0;

  // Always include first non-empty paragraph (usually the main answer)
  let firstParagraphEnd = 0;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].trim() === '' && i > 0 && lines[i - 1].trim() !== '') {
      firstParagraphEnd = i;
      break;
    }
  }
  if (firstParagraphEnd === 0) firstParagraphEnd = Math.min(5, lines.length);

  const firstParagraph = lines.slice(0, firstParagraphEnd).join('\n').trim();
  if (firstParagraph) {
    parts.push(firstParagraph);
    charCount += firstParagraph.length;
  }

  // Extract bullet points and headers (key structural elements)
  for (let i = firstParagraphEnd; i < lines.length && charCount < maxLen * 0.8; i++) {
    const line = lines[i].trim();
    // Keep headers
    if (line.startsWith('#')) {
      parts.push(line);
      charCount += line.length;
    }
    // Keep bullet points (key findings)
    else if (line.startsWith('- ') || line.startsWith('* ') || /^\d+\.\s/.test(line)) {
      parts.push(line);
      charCount += line.length;
    }
    // Keep "Key" / "Summary" / "Conclusion" sections
    else if (/^(key|summary|conclusion|result|finding|recommendation)/i.test(line)) {
      parts.push(line);
      charCount += line.length;
    }
  }

  // Include last paragraph if different from first (often a conclusion)
  const lastParagraphStart = text.lastIndexOf('\n\n');
  if (lastParagraphStart > 0 && lastParagraphStart > text.length * 0.7) {
    const lastParagraph = text.substring(lastParagraphStart).trim();
    if (lastParagraph.length > 30 && lastParagraph !== firstParagraph) {
      parts.push(lastParagraph);
    }
  }

  const distilled = `[${toolName} result]\n${parts.join('\n')}`;
  return truncateSmart(distilled, maxLen);
}

// ─── Main Entry Point ───

/**
 * Check if a response should be distilled based on length and config.
 */
export function shouldDistill(text: string): boolean {
  return isDistillEnabled() && text.length > getDistillThreshold();
}
