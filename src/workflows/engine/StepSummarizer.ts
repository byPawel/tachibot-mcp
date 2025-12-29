/**
 * Step Summarizer & Distiller - Context management for step chaining
 * Implements the "Anchor & Reference" pattern recommended by Gemini
 *
 * Key features:
 * - Summarization: Compress narrative (gist)
 * - Distillation: Extract structured signals (facts, decisions, issues)
 * - Strips code blocks (code = token-heavy, summaries = intent)
 * - Fixed token cap (500-800, not percentage-based)
 * - Caches results per step (generate once, reuse)
 * - XML tagging: <context_primer> + <reference_material>
 */

import { hasGeminiApiKey } from '../../utils/api-keys.js';

// Cache: stepName -> summary/distillation
const summaryCache = new Map<string, string>();
const distillCache = new Map<string, DistilledStepOutput>();

/**
 * Distilled step output - structured extraction of key signals
 * Better for step chaining than narrative summarization
 */
export interface DistilledStepOutput {
  keyFindings: string[];      // Top 3-5 key discoveries/results
  decisions: string[];        // Any decisions or conclusions made
  dataTypes: string[];        // Types of data/info in output
  issues: string[];           // Warnings, errors, concerns
  nextStepHints?: string[];   // Suggestions for follow-up
}

/**
 * Configuration for summary generation
 */
export interface SummaryConfig {
  maxTokens?: number;      // Default: 800
  stripCode?: boolean;     // Default: true
  format?: 'text' | 'json'; // Default: 'text'
}

/**
 * Configuration for distillation
 */
export interface DistillConfig {
  maxFindings?: number;    // Default: 5
  maxDecisions?: number;   // Default: 3
  stripCode?: boolean;     // Default: true
  includeHints?: boolean;  // Default: true
}

/**
 * Strip code blocks from text to create cleaner summaries
 * Code is token-heavy and summaries should explain intent, not syntax
 */
export function stripCodeBlocks(text: string): string {
  // Remove fenced code blocks (```...```)
  let result = text.replace(/```[\s\S]*?```/g, '[CODE BLOCK REMOVED]');

  // Remove inline code that's longer than 50 chars (likely code snippets)
  result = result.replace(/`[^`]{50,}`/g, '[CODE REMOVED]');

  // Remove common code patterns that might slip through
  result = result.replace(/^(const|let|var|function|class|import|export|async|await)\s+.+$/gm, '[CODE LINE REMOVED]');

  // Collapse multiple [CODE REMOVED] markers
  result = result.replace(/(\[CODE[^\]]+\]\s*)+/g, '[CODE OMITTED - see full output]\n');

  return result.trim();
}

/**
 * Estimate token count (rough approximation: 1 token ≈ 4 chars)
 */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

/**
 * Truncate text to approximate token limit
 */
export function truncateToTokens(text: string, maxTokens: number): string {
  const maxChars = maxTokens * 4;
  if (text.length <= maxChars) return text;

  // Try to cut at sentence boundary
  const truncated = text.slice(0, maxChars);
  const lastPeriod = truncated.lastIndexOf('.');
  const lastNewline = truncated.lastIndexOf('\n');
  const cutPoint = Math.max(lastPeriod, lastNewline);

  if (cutPoint > maxChars * 0.7) {
    return truncated.slice(0, cutPoint + 1) + '\n[TRUNCATED - see full output]';
  }

  return truncated + '... [TRUNCATED]';
}

/**
 * Generate a summary of step output for chaining
 * Uses fast model (gemini-flash) for efficiency
 */
export async function generateStepSummary(
  stepName: string,
  output: string,
  config: SummaryConfig = {},
  toolExecutor?: (toolName: string, args: Record<string, any>) => Promise<any>
): Promise<string> {
  const {
    maxTokens = 800,
    stripCode = true,
    format = 'text'
  } = config;

  // Check cache first
  const cacheKey = `${stepName}:${output.slice(0, 100)}`;
  if (summaryCache.has(cacheKey)) {
    return summaryCache.get(cacheKey)!;
  }

  // Preprocess: strip code if configured
  let processedOutput = stripCode ? stripCodeBlocks(output) : output;

  // If output is already small enough, just clean it up
  if (estimateTokens(processedOutput) <= maxTokens) {
    summaryCache.set(cacheKey, processedOutput);
    return processedOutput;
  }

  // If no tool executor or no API key, fall back to truncation
  if (!toolExecutor || !hasGeminiApiKey()) {
    const truncated = truncateToTokens(processedOutput, maxTokens);
    summaryCache.set(cacheKey, truncated);
    return truncated;
  }

  // Use Gemini to generate intelligent summary
  try {
    const prompt = format === 'json'
      ? `Summarize this step output in structured JSON format. Focus on:
- key_findings: Top 3-5 key points
- intent: What this step accomplished
- data_types: What kind of data/info is in the output
- potential_issues: Any warnings or concerns

Keep total output under ${maxTokens} tokens. NO CODE in summary.

OUTPUT TO SUMMARIZE:
${processedOutput}`
      : `Summarize this step output concisely for the next AI in a workflow chain.
Focus on:
1. Key findings (top 3-5 points)
2. What this step accomplished
3. Any warnings or issues found

Keep under ${maxTokens} tokens. NO CODE BLOCKS - describe intent, not syntax.
This summary will be used to prime the next step's understanding.

OUTPUT TO SUMMARIZE:
${processedOutput}`;

    const result = await toolExecutor('gemini_analyze_text', {
      text: processedOutput.slice(0, 15000), // Limit input to avoid token overflow
      type: 'summary'
    });

    const summary = typeof result === 'string' ? result : JSON.stringify(result);
    const finalSummary = truncateToTokens(summary, maxTokens);

    summaryCache.set(cacheKey, finalSummary);
    return finalSummary;
  } catch (error) {
    // Fallback to truncation on error
    console.warn(`Summary generation failed for ${stepName}, using truncation:`, error);
    const truncated = truncateToTokens(processedOutput, maxTokens);
    summaryCache.set(cacheKey, truncated);
    return truncated;
  }
}

/**
 * Distill step output into structured signals
 * Better for step chaining than narrative summarization
 */
export async function distillStepOutput(
  stepName: string,
  output: string,
  config: DistillConfig = {},
  toolExecutor?: (toolName: string, args: Record<string, any>) => Promise<any>
): Promise<DistilledStepOutput> {
  const {
    maxFindings = 5,
    maxDecisions = 3,
    stripCode = true,
    includeHints = true
  } = config;

  // Check cache first
  const cacheKey = `distill:${stepName}:${output.slice(0, 100)}`;
  if (distillCache.has(cacheKey)) {
    return distillCache.get(cacheKey)!;
  }

  // Preprocess: strip code if configured
  const processedOutput = stripCode ? stripCodeBlocks(output) : output;

  // If no tool executor or no API key, fall back to heuristic extraction
  if (!toolExecutor || !hasGeminiApiKey()) {
    const heuristic = heuristicDistill(processedOutput, maxFindings, maxDecisions);
    distillCache.set(cacheKey, heuristic);
    return heuristic;
  }

  // Use Gemini for intelligent distillation
  try {
    const prompt = `Extract structured signals from this step output for the next AI in a workflow chain.

Return ONLY valid JSON with these exact fields:
{
  "keyFindings": ["finding1", "finding2", ...],  // Top ${maxFindings} key discoveries (max ${maxFindings})
  "decisions": ["decision1", ...],               // Conclusions made (max ${maxDecisions})
  "dataTypes": ["type1", "type2"],               // Types of data in output
  "issues": ["issue1", ...],                     // Warnings, errors, concerns
  ${includeHints ? `"nextStepHints": ["hint1", ...]   // Suggestions for follow-up` : ''}
}

Be concise - each item should be 1 sentence max. NO CODE.

OUTPUT TO DISTILL:
${processedOutput.slice(0, 12000)}`;

    const result = await toolExecutor('gemini_analyze_text', {
      text: prompt,
      type: 'general'
    });

    // Parse JSON from response
    const jsonMatch = typeof result === 'string'
      ? result.match(/\{[\s\S]*\}/)
      : null;

    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]) as DistilledStepOutput;
      // Enforce limits
      parsed.keyFindings = parsed.keyFindings?.slice(0, maxFindings) || [];
      parsed.decisions = parsed.decisions?.slice(0, maxDecisions) || [];
      parsed.dataTypes = parsed.dataTypes || [];
      parsed.issues = parsed.issues || [];

      distillCache.set(cacheKey, parsed);
      return parsed;
    }

    // Fallback if JSON parsing fails
    const heuristic = heuristicDistill(processedOutput, maxFindings, maxDecisions);
    distillCache.set(cacheKey, heuristic);
    return heuristic;
  } catch (error) {
    console.warn(`Distillation failed for ${stepName}, using heuristic:`, error);
    const heuristic = heuristicDistill(processedOutput, maxFindings, maxDecisions);
    distillCache.set(cacheKey, heuristic);
    return heuristic;
  }
}

/**
 * Heuristic distillation when no AI is available
 * Extracts signals using pattern matching
 */
function heuristicDistill(text: string, maxFindings: number, maxDecisions: number): DistilledStepOutput {
  const lines = text.split('\n').filter(l => l.trim().length > 10);

  // Find key findings (lines with key indicators)
  const findingPatterns = /\b(found|discovered|identified|key|important|significant|result|shows?|reveals?)\b/i;
  const keyFindings = lines
    .filter(l => findingPatterns.test(l))
    .slice(0, maxFindings)
    .map(l => l.trim().slice(0, 200));

  // Find decisions (lines with decision indicators)
  const decisionPatterns = /\b(should|must|recommend|conclude|decide|chosen?|selected?|best|prefer)\b/i;
  const decisions = lines
    .filter(l => decisionPatterns.test(l))
    .slice(0, maxDecisions)
    .map(l => l.trim().slice(0, 200));

  // Find issues (lines with warning indicators)
  const issuePatterns = /\b(warning|error|issue|problem|concern|risk|caution|note|caveat|however|but)\b/i;
  const issues = lines
    .filter(l => issuePatterns.test(l))
    .slice(0, 3)
    .map(l => l.trim().slice(0, 200));

  // Guess data types from content
  const dataTypes: string[] = [];
  if (/\b(api|endpoint|http|url)\b/i.test(text)) dataTypes.push('API/web data');
  if (/\b(code|function|class|method)\b/i.test(text)) dataTypes.push('code analysis');
  if (/\b(search|result|found)\b/i.test(text)) dataTypes.push('search results');
  if (/\b(analysis|review|assessment)\b/i.test(text)) dataTypes.push('analysis');

  return {
    keyFindings: keyFindings.length > 0 ? keyFindings : ['Step completed successfully'],
    decisions,
    dataTypes: dataTypes.length > 0 ? dataTypes : ['general text'],
    issues
  };
}

/**
 * Format step output with Anchor & Reference pattern
 * Primer first (distilled or summary), then full output (reference material)
 */
export function formatAnchorReference(
  primer: string | DistilledStepOutput,
  fullOutput: string,
  stepName: string
): string {
  const primerContent = typeof primer === 'string'
    ? primer
    : JSON.stringify(primer, null, 2);

  return `<context_primer step="${stepName}">
${primerContent}
</context_primer>

<reference_material step="${stepName}">
${fullOutput}
</reference_material>`;
}

/**
 * Format with distillation specifically - cleaner output
 */
export function formatDistilledContext(
  distilled: DistilledStepOutput,
  fullOutput: string,
  stepName: string,
  options: { includeFullOutput?: boolean; maxOutputTokens?: number } = {}
): string {
  const { includeFullOutput = true, maxOutputTokens = 5000 } = options;

  let result = `<distilled_context step="${stepName}">
KEY FINDINGS:
${distilled.keyFindings.map(f => `• ${f}`).join('\n')}

${distilled.decisions.length > 0 ? `DECISIONS:
${distilled.decisions.map(d => `• ${d}`).join('\n')}

` : ''}${distilled.issues.length > 0 ? `ISSUES:
${distilled.issues.map(i => `⚠ ${i}`).join('\n')}

` : ''}DATA TYPES: ${distilled.dataTypes.join(', ')}
${distilled.nextStepHints?.length ? `\nNEXT STEP HINTS:\n${distilled.nextStepHints.map(h => `→ ${h}`).join('\n')}` : ''}
</distilled_context>`;

  if (includeFullOutput) {
    const truncatedOutput = truncateToTokens(fullOutput, maxOutputTokens);
    result += `\n\n<reference_material step="${stepName}">
${truncatedOutput}
</reference_material>`;
  }

  return result;
}

/**
 * Clear all caches (useful for testing or memory management)
 */
export function clearCaches(): void {
  summaryCache.clear();
  distillCache.clear();
}

/**
 * Get cache stats
 */
export function getCacheStats(): {
  summary: { size: number; keys: string[] };
  distill: { size: number; keys: string[] };
} {
  return {
    summary: {
      size: summaryCache.size,
      keys: Array.from(summaryCache.keys())
    },
    distill: {
      size: distillCache.size,
      keys: Array.from(distillCache.keys())
    }
  };
}
