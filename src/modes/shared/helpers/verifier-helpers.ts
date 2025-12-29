/**
 * Verifier Helper Functions
 *
 * Pure, composable functions for multi-model verification and consensus analysis.
 * Used by workflows/system/verifier.yaml
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

export interface ModelResponse {
  readonly model: string;
  readonly response: string;
  readonly conclusion?: string;
  readonly evidence?: readonly string[];
  readonly confidence?: number;
  readonly tokens?: number;
}

export interface ConsensusAnalysis {
  readonly agreement: number;
  readonly clusters: ReadonlyMap<string, readonly ModelResponse[]>;
  readonly majorityCluster: string;
  readonly outlierModels: readonly string[];
}

export interface VerifierResult {
  readonly consensus: number;
  readonly majority: string;
  readonly outliers: readonly ModelResponse[];
  readonly responses: readonly ModelResponse[];
  readonly synthesis: string;
  readonly confidence: number;
  readonly shouldTerminate: boolean;
}

// ============================================================================
// Prompt Building
// ============================================================================

/**
 * Build verification prompt with optional source requirements
 */
export const buildPrompt = (config: {
  query: string;
  include_sources?: boolean;
}): string => {
  const basePrompt = `Analyze the following query/statement critically and provide your assessment.

Query: ${config.query}

Please provide:
1. Your conclusion (true/false/uncertain/needs-context)
2. Key reasoning points
3. Confidence level (0-100%)`;

  if (config.include_sources) {
    return basePrompt + `
4. Supporting evidence or sources
5. Any contradicting information found`;
  }

  return basePrompt;
};

// ============================================================================
// Response Extraction
// ============================================================================

/**
 * Extract structured data from raw model responses
 */
export const extractModelResponses = (config: {
  raw_responses: ReadonlyArray<{ model: string; content: string }>;
  models: readonly string[];
  include_sources?: boolean;
}): readonly ModelResponse[] => {
  return config.raw_responses.map((response, index) => ({
    model: config.models[index] || response.model,
    response: response.content,
    conclusion: extractConclusion(response.content),
    evidence: config.include_sources ? extractEvidence(response.content) : undefined,
    confidence: extractConfidence(response.content),
    tokens: estimateTokens(response.content)
  }));
};

/**
 * Extract conclusion from response text
 *
 * Patterns checked (in order):
 * 1. "conclusion: ..." / "answer: ..." / "verdict: ..." / "result: ..."
 * 2. Keywords: "true", "false", "uncertain"
 * 3. Default: "unknown"
 */
export const extractConclusion = (content: string): string => {
  const patterns = [
    /conclusion:\s*([^\n]+)/i,
    /answer:\s*([^\n]+)/i,
    /verdict:\s*([^\n]+)/i,
    /result:\s*([^\n]+)/i
  ];

  for (const pattern of patterns) {
    const match = content.match(pattern);
    if (match) {
      return match[1].trim().toLowerCase();
    }
  }

  // Fallback keyword detection
  const lower = content.toLowerCase();
  if (lower.includes('true')) return 'true';
  if (lower.includes('false')) return 'false';
  if (lower.includes('uncertain')) return 'uncertain';

  return 'unknown';
};

/**
 * Extract evidence/sources from response text
 */
export const extractEvidence = (content: string): readonly string[] => {
  const evidence: string[] = [];
  const patterns = [
    /evidence:\s*([^\n]+)/gi,
    /source:\s*([^\n]+)/gi,
    /citation:\s*([^\n]+)/gi,
    /\[(\d+)\]\s*([^\n]+)/g
  ];

  for (const pattern of patterns) {
    const matches = content.matchAll(pattern);
    for (const match of matches) {
      evidence.push(match[1] || match[2]);
    }
  }

  return evidence;
};

/**
 * Extract confidence score from response text
 *
 * Patterns checked:
 * - "confidence: 80%" / "certainty: 80%"
 * - "80% confident"
 * - Default: 0.5 (50%)
 */
export const extractConfidence = (content: string): number => {
  const patterns = [
    /confidence:\s*(\d+)%?/i,
    /certainty:\s*(\d+)%?/i,
    /(\d+)%\s*confident/i
  ];

  for (const pattern of patterns) {
    const match = content.match(pattern);
    if (match) {
      return parseInt(match[1]) / 100;
    }
  }

  return 0.5; // Default 50% confidence
};

// ============================================================================
// Consensus Analysis
// ============================================================================

/**
 * Calculate consensus by clustering responses by conclusion
 *
 * Returns:
 * - agreement: ratio of models in majority cluster
 * - clusters: Map of conclusion → responses
 * - majorityCluster: conclusion with most models
 * - outlierModels: models not in majority cluster
 */
export const calculateConsensus = (config: {
  responses: readonly ModelResponse[];
}): ConsensusAnalysis => {
  const clusters = new Map<string, ModelResponse[]>();

  // Cluster responses by conclusion
  for (const response of config.responses) {
    const conclusion = response.conclusion || 'unknown';

    if (!clusters.has(conclusion)) {
      clusters.set(conclusion, []);
    }

    clusters.get(conclusion)!.push(response);
  }

  // Find majority cluster
  const sortedClusters = Array.from(clusters.entries())
    .sort((a, b) => b[1].length - a[1].length);

  const majorityCluster = sortedClusters[0][0];
  const majorityCount = sortedClusters[0][1].length;
  const agreement = majorityCount / config.responses.length;

  // Identify outliers (models not in majority cluster)
  const outlierModels = sortedClusters
    .slice(1)
    .flatMap(([_, responses]) => responses.map(r => r.model));

  return {
    agreement,
    clusters: new Map(clusters),  // Convert to readonly
    majorityCluster,
    outlierModels
  };
};

/**
 * Find outlier responses (dissenting views)
 */
export const findOutliers = (config: {
  responses: readonly ModelResponse[];
  consensus: ConsensusAnalysis;
}): readonly ModelResponse[] => {
  return config.responses.filter(r =>
    config.consensus.outlierModels.includes(r.model)
  );
};

/**
 * Calculate overall confidence score
 *
 * Weighted formula:
 * - 50% weight: consensus agreement
 * - 30% weight: average model confidence
 * - 20% weight: number of responses (more models = higher confidence)
 */
export const calculateConfidence = (config: {
  consensus: ConsensusAnalysis;
  responses: readonly ModelResponse[];
}): number => {
  const agreementScore = config.consensus.agreement;

  const avgModelConfidence = config.responses
    .map(r => r.confidence || 0.5)
    .reduce((a, b) => a + b, 0) / config.responses.length;

  const responseCount = config.responses.length;
  const responseScore = Math.min(responseCount / 5, 1); // Max at 5 models

  return (agreementScore * 0.5 + avgModelConfidence * 0.3 + responseScore * 0.2);
};

// ============================================================================
// Synthesis
// ============================================================================

/**
 * Generate beautiful verification report with table
 */
export const synthesizeVerifierReport = (config: {
  consensus: ConsensusAnalysis;
  responses: readonly ModelResponse[];
  outliers: readonly ModelResponse[];
}): string => {
  const majorityResponses = config.consensus.clusters.get(config.consensus.majorityCluster) || [];
  const outlierCount = config.responses.length - majorityResponses.length;
  const consensusPercent = (config.consensus.agreement * 100).toFixed(1);

  let synthesis = `## 🔍 Multi-Model Verification Report\n\n`;

  // Consensus indicator
  synthesis += `### 📊 Consensus: ${consensusPercent}%\n\n`;
  const consensusBar = Math.round(config.consensus.agreement * 10);
  synthesis += `\`\`\`\n`;
  synthesis += `[${'⣿'.repeat(consensusBar)}${'⣿'.repeat(10 - consensusBar)}] ${consensusPercent}% agreement\n`;
  synthesis += `\`\`\`\n\n`;

  // Model responses table
  synthesis += `### 🤖 Model Responses\n\n`;
  synthesis += buildResponseTable(config.responses, majorityResponses);

  // Majority analysis
  synthesis += `### 🎯 Majority View\n\n`;
  synthesis += `**Conclusion:** ${config.consensus.majorityCluster}\n`;
  synthesis += `**Models in agreement:** ${majorityResponses.length}/${config.responses.length}\n\n`;

  if (majorityResponses.length > 0) {
    synthesis += `**Key reasoning points:**\n`;
    const points = extractKeyPoints(majorityResponses);

    if (points.length > 0) {
      points.forEach(point => synthesis += `- ${point}\n`);
    } else {
      // Fallback: show first sentence from each response
      majorityResponses.slice(0, 3).forEach(resp => {
        const firstSentence = resp.response.split(/[.!?]/)[0];
        if (firstSentence && firstSentence.length > 10) {
          synthesis += `- ${firstSentence.trim()}.\n`;
        }
      });
    }
    synthesis += `\n`;
  }

  // Dissenting views
  if (outlierCount > 0) {
    synthesis += `### ⚠️ Dissenting Views (${outlierCount})\n\n`;
    config.outliers.forEach(outlier => {
      synthesis += `**${outlier.model}:** "${outlier.conclusion || 'unknown'}"\n`;
      const preview = (outlier.response || '').substring(0, 150).replace(/\n/g, ' ');
      if (preview) {
        synthesis += `> ${preview}${outlier.response.length > 150 ? '...' : ''}\n\n`;
      }
    });
  }

  // Summary
  synthesis += `### 📋 Summary\n\n`;
  synthesis += `\`\`\`\n`;
  synthesis += `Total Models:     ${config.responses.length}\n`;
  synthesis += `Consensus:        ${consensusPercent}%\n`;
  synthesis += `Majority View:    ${config.consensus.majorityCluster}\n`;
  synthesis += `Agreeing Models:  ${majorityResponses.length}\n`;
  synthesis += `Dissenting:       ${outlierCount}\n`;
  synthesis += `High Confidence:  ${config.consensus.agreement >= 0.8 ? 'YES ✓' : 'NO'}\n`;
  synthesis += `\`\`\`\n`;

  return synthesis;
};

/**
 * Format final verification result
 */
export const formatVerifierResult = (config: {
  consensus: number;
  majority: string;
  outliers: readonly ModelResponse[];
  responses: readonly ModelResponse[];
  synthesis: string;
  confidence: number;
  should_terminate: boolean;
}): VerifierResult => {
  return {
    consensus: config.consensus,
    majority: config.majority,
    outliers: config.outliers,
    responses: config.responses,
    synthesis: config.synthesis,
    confidence: config.confidence,
    shouldTerminate: config.should_terminate
  };
};

// ============================================================================
// Internal Utilities
// ============================================================================

/**
 * Build response table with status icons
 */
const buildResponseTable = (
  responses: readonly ModelResponse[],
  majorityResponses: readonly ModelResponse[]
): string => {
  // Simple table format (without TableBuilder dependency)
  let table = '| Status | Model | Conclusion | Confidence | Preview |\n';
  table += '|:------:|:------|:----------:|-----------:|:--------|\n';

  responses.forEach((resp) => {
    const isMajority = majorityResponses.includes(resp);
    const statusIcon = isMajority ? '✅' : '⚠️';
    const conclusionIcon =
      resp.conclusion === 'true' ? '✓' :
      resp.conclusion === 'false' ? '✗' :
      resp.conclusion === 'uncertain' ? '❓' : '❔';

    const confidence = resp.confidence ? `${Math.round(resp.confidence * 100)}%` : 'N/A';
    const preview = (resp.response || '').substring(0, 60).replace(/\n/g, ' ').trim();
    const previewText = preview ? `${preview}...` : 'No response';

    table += `| ${statusIcon} | ${resp.model} | ${conclusionIcon} ${resp.conclusion || 'unknown'} | ${confidence} | ${previewText} |\n`;
  });

  table += '\n';
  return table;
};

/**
 * Extract key reasoning points from responses
 */
const extractKeyPoints = (responses: readonly ModelResponse[]): readonly string[] => {
  const points = new Set<string>();

  for (const response of responses) {
    const content = response.response || '';
    const lines = content.split('\n')
      .filter((line: string) => line.trim().startsWith('-') || line.trim().startsWith('•'))
      .map((line: string) => line.replace(/^[-•]\s*/, '').trim())
      .filter((line: string) => line.length > 10 && line.length < 200);

    lines.forEach((line: string) => points.add(line));
  }

  return Array.from(points).slice(0, 5);
};

/**
 * Estimate tokens from text length
 */
const estimateTokens = (text: string): number => {
  return Math.floor(text.length / 4);
};

// ============================================================================
// Type Guards
// ============================================================================

/**
 * Check if value is a valid ModelResponse
 */
export const isModelResponse = (value: unknown): value is ModelResponse => {
  if (!value || typeof value !== 'object') return false;

  const obj = value as Partial<ModelResponse>;

  return (
    typeof obj.model === 'string' &&
    typeof obj.response === 'string'
  );
};

/**
 * Check if value is a valid ConsensusAnalysis
 */
export const isConsensusAnalysis = (value: unknown): value is ConsensusAnalysis => {
  if (!value || typeof value !== 'object') return false;

  const obj = value as Partial<ConsensusAnalysis>;

  return (
    typeof obj.agreement === 'number' &&
    typeof obj.majorityCluster === 'string' &&
    Array.isArray(obj.outlierModels)
  );
};
