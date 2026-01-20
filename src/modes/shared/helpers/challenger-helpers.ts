/**
 * Challenger Helper Functions
 *
 * Pure, composable functions for devil's advocate analysis.
 * Used by workflows/system/challenger.yaml
 *
 * Purpose: Expand perspectives, not find faults
 * - Challenge assumptions and basic truths
 * - Find counter-evidence and alternatives
 * - Explore opposite thinking ("what if we're backwards?")
 * - Discover third-way solutions beyond binary choices
 *
 * SOLID Principles:
 * - Single Responsibility: Each function does ONE transformation
 * - Open/Closed: Functions are closed for modification, open for extension
 * - Liskov Substitution: All functions are predictable pure functions
 * - Interface Segregation: Small, focused function signatures
 * - Dependency Inversion: Functions depend on types, not concrete implementations
 */

// import { icon } from '../../../utils/ink-renderer.js';
// Ink disabled - using plain emojis instead
const icon = (name: string): string => {
  const icons: Record<string, string> = {
    target: '>',
    comment: '#',
    warning: '!',
    check: '+',
    search: '?',
    list: '-',
    error: 'x',
  };
  return icons[name] || '*';
};

// ============================================================================
// Type Definitions (no 'any')
// ============================================================================

export interface UncontestedToneResult {
  readonly detected: boolean;
  readonly phrases: readonly string[];
  readonly severity: 'low' | 'medium' | 'high';
  readonly message: string;
}

export interface Claim {
  readonly claim: string;
  readonly context: string;
  readonly testable: boolean;
  readonly priority: number;
}

export interface FactCheckResult {
  readonly claim: string;
  readonly status: 'verified' | 'refuted' | 'uncertain' | 'insufficient-data';
  readonly supporting_evidence: readonly string[];
  readonly contradicting_evidence: readonly string[];
  readonly sources: readonly string[];
  readonly reliability: number;
}

export interface CounterEvidenceResult {
  readonly claim: string;
  readonly counter_arguments: readonly string[];
  readonly dissenting_experts: readonly string[];
  readonly alternative_interpretations: readonly string[];
  readonly edge_cases: readonly string[];
}

export interface OppositeView {
  readonly original_claim: string;
  readonly opposite_view: string;
  readonly plausibility: number;
  readonly evidence: readonly string[];
  readonly source: 'research';
}

export interface ThirdWayAlternative {
  readonly original_claim: string;
  readonly alternatives: readonly string[];
  readonly confidence: number;
  readonly source: 'research';
}

export interface ChallengerResult {
  readonly synthesis: string;
  readonly tone_analysis: UncontestedToneResult;
  readonly claims_analyzed: number;
  readonly challenge_score: number;
  readonly fact_check_results?: readonly FactCheckResult[];
  readonly counter_evidence_results?: readonly CounterEvidenceResult[];
  readonly opposite_views?: readonly OppositeView[];
  readonly third_way_alternatives?: readonly ThirdWayAlternative[];
}

// ============================================================================
// Tone Detection
// ============================================================================

/**
 * Flag uncontested tone - authoritarian language that shuts down dissent
 *
 * Detects phrases like:
 * - "obviously", "clearly", "everyone knows"
 * - "the only way", "undeniably", "without question"
 * - "unanimous", "no disagreement", "settled science"
 *
 * Severity:
 * - high: 3+ phrases (strong groupthink indicators)
 * - medium: 2 phrases
 * - low: 1 phrase
 */
export const flagUncontestedTone = (config: {
  text: string;
}): UncontestedToneResult => {
  const uncontestedPhrases = [
    'obviously',
    'clearly',
    'everyone knows',
    'everyone agrees',
    'the only way',
    'undeniably',
    'without question',
    'unanimous',
    'no disagreement',
    'settled science',
    'beyond doubt',
    'no alternative',
    'must',
    'always',
    'never'
  ] as const;

  const foundPhrases = uncontestedPhrases.filter(phrase =>
    config.text.toLowerCase().includes(phrase)
  );

  const severity: 'low' | 'medium' | 'high' =
    foundPhrases.length >= 3 ? 'high'
    : foundPhrases.length >= 2 ? 'medium'
    : 'low';

  const message = foundPhrases.length === 0
    ? 'No uncontested tone detected - healthy room for debate'
    : `Detected ${foundPhrases.length} authoritarian phrase(s) that may shut down dissent`;

  return {
    detected: foundPhrases.length > 0,
    phrases: foundPhrases,
    severity,
    message
  };
};

// ============================================================================
// Claim Extraction
// ============================================================================

/**
 * Extract testable claims from text
 *
 * Claims are statements that can be verified or challenged:
 * - Factual assertions
 * - Predictions
 * - Causal relationships
 * - Generalizations
 */
export const extractClaims = (config: {
  text: string;
  thoroughness: 'minimal' | 'standard' | 'deep';
}): readonly Claim[] => {
  const sentences = config.text.split(/[.!?]+/)
    .map(s => s.trim())
    .filter(s => s.length > 10);

  const claims: Claim[] = [];

  for (const sentence of sentences) {
    const testable = isTestable(sentence);
    const priority = calculateClaimPriority(sentence);

    if (testable && (priority > 0.3 || config.thoroughness === 'deep')) {
      claims.push({
        claim: sentence,
        context: extractContext(sentence, config.text),
        testable,
        priority
      });
    }
  }

  return claims;
};

/**
 * Prioritize claims for fact-checking
 *
 * Returns top N claims by priority score
 */
export const prioritizeClaims = (config: {
  claims: readonly Claim[];
  max_claims: number;
}): readonly Claim[] => {
  return [...config.claims]
    .sort((a, b) => b.priority - a.priority)
    .slice(0, config.max_claims);
};

// ============================================================================
// Opposite Thinking
// ============================================================================

/**
 * Explore "what if we're backwards?" perspective
 *
 * For each claim, explore the opposite view and assess plausibility
 */
export const exploreOppositeThinking = (config: {
  claims: readonly Claim[];
  fact_check?: string | null;
  counter_evidence?: string | null;
}): readonly OppositeView[] => {
  return config.claims.map(claim => {
    const oppositeView = generateOppositeView(claim.claim);
    const evidence = extractRelevantEvidence(claim.claim, config.counter_evidence || '');
    const plausibility = assessOppositeViewPlausibility(
      claim.claim,
      oppositeView,
      config.fact_check || '',
      config.counter_evidence || ''
    );

    return {
      original_claim: claim.claim,
      opposite_view: oppositeView,
      plausibility,
      evidence,
      source: 'research' as const
    };
  });
};

/**
 * Find "third way" alternatives beyond binary thinking
 *
 * When everyone sees only A vs B, find option C, D, E
 */
export const findThirdWay = (config: {
  claims: readonly Claim[];
  fact_check?: string | null;
  counter_evidence?: string | null;
  context: string;
}): readonly ThirdWayAlternative[] => {
  const binaryClaims = config.claims.filter(claim =>
    isBinaryChoice(claim.claim)
  );

  return binaryClaims.map(claim => {
    const alternatives = generateThirdWayAlternatives(
      claim.claim,
      config.fact_check || '',
      config.counter_evidence || ''
    );

    const confidence = calculateAlternativeConfidence(
      alternatives,
      config.fact_check || '',
      config.counter_evidence || ''
    );

    return {
      original_claim: claim.claim,
      alternatives,
      confidence,
      source: 'research' as const
    };
  });
};

// ============================================================================
// Synthesis
// ============================================================================

/**
 * Synthesize all challenges into coherent report
 */
export const synthesizeChallengerReport = (config: {
  tone_analysis: UncontestedToneResult;
  claims: readonly Claim[];
  fact_check?: string | null;
  counter_evidence?: string | null;
  opposite_views?: readonly OppositeView[] | null;
  third_way?: readonly ThirdWayAlternative[] | null;
  thoroughness: 'minimal' | 'standard' | 'deep';
}): string => {
  let synthesis = `## ${icon('target')} Devil's Advocate Analysis\n\n`;

  // Tone Analysis Section
  synthesis += `### ${icon('comment')} Tone Analysis\n\n`;
  synthesis += `**Status:** ${config.tone_analysis.detected ? `${icon('warning')} Uncontested Tone Detected` : `${icon('check')} Healthy Debate Room`}\n`;
  synthesis += `**Severity:** ${config.tone_analysis.severity.toUpperCase()}\n`;
  synthesis += `**Message:** ${config.tone_analysis.message}\n\n`;

  if (config.tone_analysis.phrases.length > 0) {
    synthesis += `**Authoritarian phrases found:**\n`;
    config.tone_analysis.phrases.forEach(phrase => {
      synthesis += `- "${phrase}"\n`;
    });
    synthesis += `\n`;
  }

  // Claims Analysis
  synthesis += `### ${icon('search')} Claims Analyzed: ${config.claims.length}\n\n`;

  if (config.claims.length > 0) {
    synthesis += buildClaimsTable(config.claims.slice(0, 5));
    synthesis += `\n`;
  }

  // Fact-Check Results
  if (config.fact_check) {
    synthesis += `### ${icon('check')} Fact-Check Results\n\n`;
    synthesis += formatFactCheckResults(config.fact_check);
    synthesis += `\n`;
  }

  // Counter-Evidence
  if (config.counter_evidence) {
    synthesis += `### ⚡ Counter-Evidence\n\n`;
    synthesis += formatCounterEvidence(config.counter_evidence);
    synthesis += `\n`;
  }

  // Opposite Views
  if (config.opposite_views && config.opposite_views.length > 0) {
    synthesis += `### 🔄 Opposite Thinking ("What if we're backwards?")\n\n`;
    config.opposite_views.forEach(view => {
      synthesis += `**Original:** ${view.original_claim}\n`;
      synthesis += `**Opposite:** ${view.opposite_view}\n`;
      synthesis += `**Plausibility:** ${(view.plausibility * 100).toFixed(0)}%\n\n`;
    });
  }

  // Third-Way Alternatives
  if (config.third_way && config.third_way.length > 0) {
    synthesis += `### 🌟 Third-Way Alternatives (Beyond Binary Thinking)\n\n`;
    config.third_way.forEach(alt => {
      synthesis += `**Original:** ${alt.original_claim}\n`;
      synthesis += `**Alternatives:**\n`;
      alt.alternatives.forEach(a => synthesis += `- ${a}\n`);
      synthesis += `**Confidence:** ${(alt.confidence * 100).toFixed(0)}%\n\n`;
    });
  }

  // Summary
  synthesis += `### ${icon('list')} Summary\n\n`;
  synthesis += `\`\`\`\n`;
  synthesis += `Thoroughness:        ${config.thoroughness}\n`;
  synthesis += `Claims Analyzed:     ${config.claims.length}\n`;
  synthesis += `Tone Detected:       ${config.tone_analysis.detected ? `YES ${icon('warning')}` : `NO ${icon('check')}`}\n`;
  synthesis += `Fact-Checked:        ${config.fact_check ? `YES ${icon('check')}` : 'NO'}\n`;
  synthesis += `Counter-Evidence:    ${config.counter_evidence ? `YES ${icon('check')}` : 'NO'}\n`;
  synthesis += `Opposite Views:      ${config.opposite_views?.length || 0}\n`;
  synthesis += `Third-Way Options:   ${config.third_way?.length || 0}\n`;
  synthesis += `\`\`\`\n`;

  return synthesis;
};

/**
 * Calculate overall challenge score (strength of counter-arguments)
 *
 * Score based on:
 * - Fact-check contradictions (40%)
 * - Counter-evidence strength (30%)
 * - Opposite view plausibility (15%)
 * - Third-way alternatives (15%)
 */
export const calculateChallengeScore = (config: {
  fact_check?: string | null;
  counter_evidence?: string | null;
  opposite_views?: readonly OppositeView[] | null;
  third_way?: readonly ThirdWayAlternative[] | null;
}): number => {
  let score = 0;

  // Fact-check contradictions (40%)
  if (config.fact_check) {
    const contradictions = (config.fact_check.match(/refuted|false|incorrect/gi) || []).length;
    score += Math.min(contradictions * 0.1, 0.4);
  }

  // Counter-evidence strength (30%)
  if (config.counter_evidence) {
    const counterArgs = (config.counter_evidence.match(/however|but|alternative|dissent/gi) || []).length;
    score += Math.min(counterArgs * 0.05, 0.3);
  }

  // Opposite view plausibility (15%)
  if (config.opposite_views && config.opposite_views.length > 0) {
    const avgPlausibility = config.opposite_views.reduce((sum, v) => sum + v.plausibility, 0) / config.opposite_views.length;
    score += avgPlausibility * 0.15;
  }

  // Third-way alternatives (15%)
  if (config.third_way && config.third_way.length > 0) {
    const avgConfidence = config.third_way.reduce((sum, t) => sum + t.confidence, 0) / config.third_way.length;
    score += avgConfidence * 0.15;
  }

  return Math.min(score, 1.0);
};

/**
 * Format final challenger result
 */
export const formatChallengerResult = (config: {
  synthesis: string;
  tone_analysis: UncontestedToneResult;
  claims_analyzed: number;
  challenge_score: number;
  fact_check_results?: string | null;
  counter_evidence_results?: string | null;
  opposite_views?: readonly OppositeView[] | null;
  third_way_alternatives?: readonly ThirdWayAlternative[] | null;
}): ChallengerResult => {
  return {
    synthesis: config.synthesis,
    tone_analysis: config.tone_analysis,
    claims_analyzed: config.claims_analyzed,
    challenge_score: config.challenge_score,
    fact_check_results: config.fact_check_results ? parseFactCheckResults(config.fact_check_results) : undefined,
    counter_evidence_results: config.counter_evidence_results ? parseCounterEvidenceResults(config.counter_evidence_results) : undefined,
    opposite_views: config.opposite_views || undefined,
    third_way_alternatives: config.third_way_alternatives || undefined
  };
};

// ============================================================================
// Internal Utilities
// ============================================================================

/**
 * Check if sentence is testable (can be verified or challenged)
 */
const isTestable = (sentence: string): boolean => {
  const testableIndicators = [
    /\b(is|are|was|were|will|would|can|could|should|must)\b/i,
    /\b(all|every|always|never|most|many|some|few)\b/i,
    /\b(cause|result|lead|increase|decrease|improve|reduce)\b/i,
    /\b(better|worse|faster|slower|more|less)\b/i
  ];

  return testableIndicators.some(pattern => pattern.test(sentence));
};

/**
 * Calculate claim priority score (0-1)
 *
 * Higher priority for:
 * - Causal claims ("X causes Y")
 * - Generalizations ("all", "never", "always")
 * - Comparative claims ("better than", "more effective")
 * - Predictions ("will", "going to")
 */
const calculateClaimPriority = (sentence: string): number => {
  let priority = 0;

  // Causal language (+0.4)
  if (/\b(cause|result|lead|due to|because of)\b/i.test(sentence)) {
    priority += 0.4;
  }

  // Generalizations (+0.3)
  if (/\b(all|every|always|never|none)\b/i.test(sentence)) {
    priority += 0.3;
  }

  // Comparatives (+0.2)
  if (/\b(better|worse|more|less|faster|slower|superior|inferior)\b/i.test(sentence)) {
    priority += 0.2;
  }

  // Predictions (+0.2)
  if (/\b(will|going to|predict|forecast|expect)\b/i.test(sentence)) {
    priority += 0.2;
  }

  return Math.min(priority, 1.0);
};

/**
 * Extract context around a claim
 */
const extractContext = (claim: string, fullText: string): string => {
  const index = fullText.indexOf(claim);
  if (index === -1) return claim;

  const start = Math.max(0, index - 100);
  const end = Math.min(fullText.length, index + claim.length + 100);

  return fullText.substring(start, end);
};

/**
 * Generate opposite view for a claim
 */
const generateOppositeView = (claim: string): string => {
  // Simple negation (in real implementation, this would be more sophisticated)
  if (claim.toLowerCase().includes('should')) {
    return claim.replace(/should/i, 'should not');
  }
  if (claim.toLowerCase().includes('must')) {
    return claim.replace(/must/i, 'must not');
  }
  if (claim.toLowerCase().includes('always')) {
    return claim.replace(/always/i, 'never');
  }
  if (claim.toLowerCase().includes('never')) {
    return claim.replace(/never/i, 'always');
  }

  return `The opposite view: ${claim} may not be true`;
};

/**
 * Extract relevant evidence from counter-evidence text
 */
const extractRelevantEvidence = (claim: string, counterEvidence: string): readonly string[] => {
  if (!counterEvidence) return [];

  const keywords = claim.toLowerCase().split(/\s+/).filter(w => w.length > 3);
  const sentences = counterEvidence.split(/[.!?]+/);

  const relevant = sentences.filter(sentence =>
    keywords.some(keyword => sentence.toLowerCase().includes(keyword))
  );

  return relevant.slice(0, 3);
};

/**
 * Assess plausibility of opposite view
 */
const assessOppositeViewPlausibility = (
  claim: string,
  oppositeView: string,
  factCheck: string,
  counterEvidence: string
): number => {
  let plausibility = 0.3; // Base plausibility

  // Check if counter-evidence supports opposite view
  const keywords = oppositeView.toLowerCase().split(/\s+/).filter(w => w.length > 3);
  const matches = keywords.filter(keyword =>
    counterEvidence.toLowerCase().includes(keyword)
  ).length;

  plausibility += Math.min(matches * 0.1, 0.4);

  // Check fact-check contradictions
  if (factCheck.toLowerCase().includes('refuted') || factCheck.toLowerCase().includes('false')) {
    plausibility += 0.3;
  }

  return Math.min(plausibility, 1.0);
};

/**
 * Check if claim represents binary choice
 */
const isBinaryChoice = (claim: string): boolean => {
  return /\b(or|versus|vs|either|choice|alternative)\b/i.test(claim);
};

/**
 * Generate third-way alternatives
 */
const generateThirdWayAlternatives = (
  claim: string,
  factCheck: string,
  counterEvidence: string
): readonly string[] => {
  const alternatives: string[] = [];

  // Extract alternative approaches from evidence
  const altPattern = /alternative|another way|instead|different approach/gi;
  const sentences = (factCheck + ' ' + counterEvidence).split(/[.!?]+/);

  sentences.forEach(sentence => {
    if (altPattern.test(sentence) && sentence.length > 20) {
      alternatives.push(sentence.trim());
    }
  });

  // Add synthetic alternatives if needed
  if (alternatives.length === 0) {
    alternatives.push(`Hybrid approach combining elements of both perspectives`);
    alternatives.push(`Context-dependent solution varying by situation`);
    alternatives.push(`Gradual transition rather than binary switch`);
  }

  return alternatives.slice(0, 5);
};

/**
 * Calculate confidence in alternatives
 */
const calculateAlternativeConfidence = (
  alternatives: readonly string[],
  factCheck: string,
  counterEvidence: string
): number => {
  // Higher confidence if alternatives are derived from evidence
  const evidenceBased = alternatives.filter(alt =>
    factCheck.includes(alt.substring(0, 20)) || counterEvidence.includes(alt.substring(0, 20))
  ).length;

  return Math.min(0.5 + (evidenceBased * 0.15), 0.95);
};

/**
 * Build claims table
 */
const buildClaimsTable = (claims: readonly Claim[]): string => {
  let table = '| Priority | Claim | Testable |\n';
  table += '|---------:|:------|:--------:|\n';

  claims.forEach(claim => {
    const priority = (claim.priority * 100).toFixed(0) + '%';
    const claimText = claim.claim.length > 80 ? claim.claim.substring(0, 77) + '...' : claim.claim;
    const testable = claim.testable ? icon('check') : icon('error');

    table += `| ${priority} | ${claimText} | ${testable} |\n`;
  });

  return table;
};

/**
 * Format fact-check results
 */
const formatFactCheckResults = (factCheck: string): string => {
  return factCheck.substring(0, 500) + (factCheck.length > 500 ? '...' : '');
};

/**
 * Format counter-evidence
 */
const formatCounterEvidence = (counterEvidence: string): string => {
  return counterEvidence.substring(0, 500) + (counterEvidence.length > 500 ? '...' : '');
};

/**
 * Parse fact-check results into structured format
 */
const parseFactCheckResults = (factCheck: string): readonly FactCheckResult[] => {
  // Simplified parsing (real implementation would be more sophisticated)
  return [{
    claim: 'Sample claim',
    status: 'uncertain',
    supporting_evidence: [],
    contradicting_evidence: [],
    sources: [],
    reliability: 0.5
  }];
};

/**
 * Parse counter-evidence into structured format
 */
const parseCounterEvidenceResults = (counterEvidence: string): readonly CounterEvidenceResult[] => {
  // Simplified parsing
  return [{
    claim: 'Sample claim',
    counter_arguments: [],
    dissenting_experts: [],
    alternative_interpretations: [],
    edge_cases: []
  }];
};
