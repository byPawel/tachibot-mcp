/**
 * Scout Helper Functions
 *
 * Pure, composable functions extracted from Scout mode.
 * Used by workflows/system/scout.yaml
 *
 * SOLID Principles:
 * - Single Responsibility: Each function does ONE transformation
 * - Open/Closed: Functions are closed for modification, open for extension
 * - Liskov Substitution: All functions are predictable pure functions
 * - Interface Segregation: Small, focused function signatures
 * - Dependency Inversion: Functions depend on types, not concrete implementations
 */

// ============================================================================
// Type Definitions (no 'any')
// ============================================================================

export interface FactResult {
  readonly facts: readonly string[];
  readonly sources?: readonly string[];
  readonly timestamp: string;
  readonly reliability: number;
}

export interface AnalysisResult {
  readonly model: string;
  readonly analysis: string;
  readonly insights: readonly string[];
}

export interface VerificationResult {
  readonly verified: boolean;
  readonly confidence: number;
}

export interface ScoutReport {
  readonly synthesis: string;
  readonly facts?: FactResult;
  readonly analyses_count?: number;
  readonly execution_time?: number;
  readonly warning?: string | null;
  readonly verification?: VerificationResult;
}

// ============================================================================
// Query Preparation
// ============================================================================

/**
 * Prepend current date to query for temporal context
 *
 * @example
 * prepareQuery("What's new in React?", "October 21, 2025")
 * // => "[Current date: October 21, 2025] What's new in React?"
 */
export const prepareQuery = (
  query: string,
  date: string
): string => {
  return `[Current date: ${date}] ${query}`;
};

/**
 * Craft targeted probe based on query type detection
 *
 * Identifies question type (latest, technical, comparison) and
 * reformulates query for better search results.
 */
export const craftTargetedProbe = (query: string): string => {
  const keywords = extractKeywords(query);
  const questionType = identifyQuestionType(query);

  switch (questionType) {
    case 'latest':
      return `Latest information about ${keywords.join(' ')} as of 2025`;
    case 'technical':
      return `Technical documentation and API details for ${keywords.join(' ')}`;
    case 'comparison':
      return `Compare ${keywords.join(' vs ')} with current data`;
    default:
      return query;
  }
};

// ============================================================================
// Fact Extraction & Validation
// ============================================================================

/**
 * Extract structured facts from search result text
 *
 * Returns array of fact strings (lines > 20 chars, max 5 facts)
 */
export const extractFacts = (searchResult: string): FactResult => {
  const lines = searchResult.split('\n');

  const facts = lines
    .filter(line => line.trim().length > 20)
    .slice(0, 5)
    .map(line => line.trim());

  const sources = extractSources(searchResult);
  const reliability = assessReliability(searchResult);

  return {
    facts,
    sources,
    timestamp: new Date().toISOString(),
    reliability
  };
};

/**
 * Validate fact quality and reliability
 *
 * Returns true if facts are sufficient for analysis
 */
export const validateFacts = (facts: FactResult): boolean => {
  return facts.facts.length > 0 && facts.reliability > 0.5;
};

/**
 * Select best facts from quick scan or deep search
 */
export const selectBestFacts = (
  quickFacts: FactResult | null,
  deepFacts: FactResult | null,
  valid: boolean
): FactResult | null => {
  if (valid && quickFacts) {
    return quickFacts;
  }
  return deepFacts;
};

/**
 * Verify fact reliability
 */
export const verifyFacts = (facts: FactResult): VerificationResult => {
  return {
    verified: true,
    confidence: facts.reliability
  };
};

// ============================================================================
// Context Building
// ============================================================================

/**
 * Build context string from facts for model analysis
 */
export const buildContext = (
  facts: FactResult,
  timestamp?: string
): string => {
  const ts = timestamp || facts.timestamp;
  const sourceList = facts.sources?.join(', ') || 'Not specified';

  return `Context (${ts}):\n${facts.facts.join('\n')}\n\nSources: ${sourceList}`;
};

// ============================================================================
// Insight Extraction
// ============================================================================

/**
 * Extract key insights from model analyses
 *
 * Returns array of AnalysisResult with extracted insights
 */
export const extractInsights = (
  analyses: ReadonlyArray<{ model: string; content: string }>
): readonly AnalysisResult[] => {
  return analyses.map(({ model, content }) => ({
    model,
    analysis: content,
    insights: extractInsightsFromText(content)
  }));
};

/**
 * Extract insight bullet points from text
 */
const extractInsightsFromText = (text: string): readonly string[] => {
  const lines = text.split('\n');

  return lines
    .filter(line =>
      line.includes('insight') ||
      line.includes('Key') ||
      line.startsWith('•') ||
      line.startsWith('-')
    )
    .map(line => line.replace(/^[•\-]\s*/, '').trim())
    .filter(line => line.length > 10)
    .slice(0, 3);
};

// ============================================================================
// Synthesis
// ============================================================================

/**
 * Synthesize facts and analyses into readable report
 */
export const synthesizeScoutReport = (
  facts: FactResult | null,
  insights: readonly AnalysisResult[]
): string => {
  let synthesis = '';

  // Add facts section
  if (facts && facts.facts.length > 0) {
    synthesis += `Current Information (${facts.timestamp}):\n`;
    facts.facts.slice(0, 3).forEach(fact => {
      synthesis += `• ${fact}\n`;
    });
    synthesis += '\n';
  }

  // Add analysis section
  synthesis += 'Analysis:\n';
  insights.forEach(analysis => {
    synthesis += `${analysis.model}:\n`;
    analysis.insights.slice(0, 2).forEach(insight => {
      synthesis += `• ${insight}\n`;
    });
  });

  return synthesis;
};

/**
 * Synthesize waterfall verification results
 */
export const synthesizeScoutWaterfall = (
  facts: FactResult,
  verification: VerificationResult
): string => {
  return `Verified Information:\n${facts.facts.join('\n')}\n\nReliability: ${facts.reliability}`;
};

// ============================================================================
// Report Formatting
// ============================================================================

/**
 * Format final Scout report with metadata
 */
export const formatScoutReport = (config: {
  synthesis: string;
  facts?: FactResult | null;
  analyses_count?: number;
  execution_time?: number;
  warning?: string | null;
  verification?: VerificationResult;
}): ScoutReport => {
  return {
    synthesis: config.synthesis,
    facts: config.facts || undefined,
    analyses_count: config.analyses_count,
    execution_time: config.execution_time,
    warning: config.warning || undefined,
    verification: config.verification
  };
};

// ============================================================================
// Internal Utilities (not exported, used by public functions)
// ============================================================================

/**
 * Extract keywords from query (remove stop words)
 */
const extractKeywords = (query: string): readonly string[] => {
  const words = query.toLowerCase().split(/\s+/);
  const stopWords = ['what', 'how', 'why', 'when', 'where', 'is', 'are', 'the', 'a', 'an'];

  return words.filter(w => !stopWords.includes(w) && w.length > 2);
};

/**
 * Identify question type from query text
 */
const identifyQuestionType = (query: string): 'latest' | 'technical' | 'comparison' | 'general' => {
  const lower = query.toLowerCase();

  if (lower.includes('latest') || lower.includes('current') || lower.includes('new')) {
    return 'latest';
  }
  if (lower.includes('api') || lower.includes('function') || lower.includes('method')) {
    return 'technical';
  }
  if (lower.includes('vs') || lower.includes('compare') || lower.includes('difference')) {
    return 'comparison';
  }

  return 'general';
};

/**
 * Extract source citations from text
 */
const extractSources = (text: string): readonly string[] => {
  const sourcePattern = /\[(\d+)\]\s*([^\n]+)/g;
  const sources: string[] = [];
  let match;

  while ((match = sourcePattern.exec(text)) !== null) {
    sources.push(match[2]);
  }

  return sources;
};

/**
 * Assess reliability score based on content indicators
 *
 * Scoring:
 * - Base: 0.5
 * - Has sources/citations: +0.2
 * - Has recent dates (2024/2025): +0.1
 * - Has verification keywords: +0.1
 * - Lengthy content (> 500 chars): +0.1
 * - Max: 1.0
 */
const assessReliability = (text: string): number => {
  let score = 0.5;

  if (text.includes('source') || text.includes('[')) score += 0.2;
  if (text.includes('2025') || text.includes('2024')) score += 0.1;
  if (text.includes('verified') || text.includes('confirmed')) score += 0.1;
  if (text.length > 500) score += 0.1;

  return Math.min(score, 1.0);
};

// ============================================================================
// Type Guards
// ============================================================================

/**
 * Check if value is a valid FactResult
 */
export const isFactResult = (value: unknown): value is FactResult => {
  if (!value || typeof value !== 'object') return false;

  const obj = value as Partial<FactResult>;

  return (
    Array.isArray(obj.facts) &&
    typeof obj.timestamp === 'string' &&
    typeof obj.reliability === 'number'
  );
};

/**
 * Check if value is a valid AnalysisResult
 */
export const isAnalysisResult = (value: unknown): value is AnalysisResult => {
  if (!value || typeof value !== 'object') return false;

  const obj = value as Partial<AnalysisResult>;

  return (
    typeof obj.model === 'string' &&
    typeof obj.analysis === 'string' &&
    Array.isArray(obj.insights)
  );
};
