/**
 * Challenger - Functional TypeScript Implementation
 *
 * Purpose: Devil's advocate tool that expands perspectives and finds hidden paths.
 * Not a "fault finder" but a "perspective expander" that challenges assumptions.
 *
 * Flow:
 * 1. Extract claims
 * 2. Generate counter-arguments
 * 3. Research alternative perspectives (Perplexity)
 * 4. Find counter-evidence (Grok)
 * 5. Multi-model verification (optional, for high-severity only)
 * 6. Flag uncontested tone (warning only)
 * 7. Find third way (creative alternatives)
 * 8. Explore opposite (what if we're backwards?)
 * 9. Synthesize report
 */

import { ModelRouter } from '../workflows/model-router.js';
import { getChallengerModels } from '../config/model-defaults.js';
import { createProgressStream } from '../utils/progress-stream.js';
import { smartAPIClient } from '../utils/smart-api-client.js';
import { providerRouter, ProviderConfig } from '../utils/provider-router.js';
import { getSmartTimeout } from '../config/timeout-config.js';
import { execSync } from 'child_process';

// ============================================
// CONSTANTS
// ============================================

const PROVIDER_PERPLEXITY = 'perplexity' as const;
const PROVIDER_GROK = 'grok' as const;

const DEFAULT_CONFIG = {
  model: 'gpt-5-mini',
  maxTokens: 2000,
  temperature: 0.9,
  thoroughness: 'standard' as const
} as const;

// ============================================
// PURE UTILITY FUNCTIONS
// ============================================

/**
 * Get current date from system using bash
 * Returns date in format: "October 20, 2025"
 */
const getCurrentDate = (): string => {
  try {
    const dateStr = execSync('date "+%B %d, %Y"', { encoding: 'utf8' }).trim();
    return dateStr;
  } catch (error) {
    console.error('[Challenger] Failed to get current date:', error);
    const now = new Date();
    return now.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  }
};

const contextToText = (context: string | Record<string, unknown>): string =>
  typeof context === 'string' ? context : JSON.stringify(context, null, 2);

// ============================================
// TYPE DEFINITIONS (no 'any')
// ============================================

export interface ChallengeOptions {
  readonly model?: string;
  readonly maxTokens?: number;
  readonly temperature?: number;
  readonly thoroughness?: 'quick' | 'standard' | 'deep';
  readonly enableFactChecking?: boolean;
  readonly enableDocVerification?: boolean;
  readonly enableMultiModelVerification?: boolean;
}

export interface Claim {
  readonly id: string;
  readonly text: string;
  readonly confidence: number;
  readonly type: 'fact' | 'opinion' | 'assumption' | 'conclusion';
}

export interface CounterArgument {
  readonly claimId: string;
  readonly argument: string;
  readonly challenge?: string;  // Alias for argument (backwards compatibility)
  readonly evidence?: string;
  readonly severity: 'low' | 'medium' | 'high';
  readonly alternativeView?: string;
}

export interface UncontestedToneResult {
  readonly detected: boolean;
  readonly phrases: readonly string[];
  readonly severity: 'low' | 'medium' | 'high';
  readonly message: string;
}

export interface ThirdWayAlternative {
  readonly originalClaim: string;
  readonly alternatives: readonly string[];
  readonly confidence: number;
  readonly source: 'perplexity-research';
}

export interface OppositeView {
  readonly originalClaim: string;
  readonly oppositeView: string;
  readonly plausibility: number;
  readonly evidence: readonly string[];
  readonly source: 'grok-search';
}

export interface ResearchFinding {
  readonly claim: string;
  readonly verified: boolean;
  readonly confidence: number;
  readonly findings: string;
  readonly source: 'perplexity' | 'grok';
}

export interface FactCheckResult {
  readonly claim: string;
  readonly status?: 'verified' | 'refuted' | 'uncertain';
  readonly verified: boolean;  // For compatibility with existing code
  readonly evidence?: readonly string[];
  readonly sources?: readonly string[];
  readonly confidence: number;
  readonly findings: string;
}

export interface DocVerificationResult {
  readonly claim: string;
  readonly foundInDocs: boolean;
  readonly docsFound: boolean;  // Alias for foundInDocs
  readonly docReferences: readonly string[];
  readonly officialSources?: readonly string[];
  readonly summary?: string;
  readonly confidence: number;
}

export interface MultiModelConsensus {
  readonly models: readonly string[];
  readonly responses: readonly string[];
  readonly agreement: number;
  readonly majorityView: string;
}

export interface ChallengeResult {
  readonly claims: readonly Claim[];
  readonly counterArguments: readonly CounterArgument[];
  readonly uncontestedTone: UncontestedToneResult;
  readonly thirdWay: readonly ThirdWayAlternative[];
  readonly oppositeViews: readonly OppositeView[];
  readonly researchFindings?: readonly ResearchFinding[];
  readonly factCheckResults?: readonly FactCheckResult[];
  readonly docVerificationResults?: readonly DocVerificationResult[];
  readonly multiModelConsensus?: MultiModelConsensus;
  readonly thinkingProcess: readonly string[];
  readonly synthesis: string;
  readonly groupthinkDetected?: boolean;  // For backwards compatibility with advanced-modes.ts
  readonly challenges?: readonly CounterArgument[];  // Alias for counterArguments
  readonly alternativePerspectives?: readonly string[];  // For alternative perspectives
}

// Internal context (replaces class state)
interface ChallengerContext {
  readonly config: Required<ChallengeOptions> & { readonly thoroughness: 'quick' | 'standard' | 'deep' };
  readonly modelRouter: ModelRouter;
  readonly currentDate: string;
  thinkingProcess: string[];  // Mutable for sequential logging
}

// ============================================
// PURE FUNCTIONS - CORE LOGIC
// ============================================

/**
 * Create challenger context with defaults
 */
const createContext = (options: ChallengeOptions): ChallengerContext => ({
  config: {
    model: options.model ?? DEFAULT_CONFIG.model,
    maxTokens: options.maxTokens ?? DEFAULT_CONFIG.maxTokens,
    temperature: options.temperature ?? DEFAULT_CONFIG.temperature,
    thoroughness: options.thoroughness ?? DEFAULT_CONFIG.thoroughness,
    enableFactChecking: options.enableFactChecking ?? true,
    enableDocVerification: options.enableDocVerification ?? true,
    enableMultiModelVerification: options.enableMultiModelVerification ?? true
  },
  modelRouter: new ModelRouter(),
  currentDate: getCurrentDate(),
  thinkingProcess: []
});

/**
 * Log thinking process (side effect contained)
 */
const addThought = (ctx: ChallengerContext, thought: string): void => {
  ctx.thinkingProcess.push(thought);
  if (process.env.DEBUG === 'true') {
    console.error(`[CHALLENGER] ${thought}`);
  }
};

/**
 * Flag uncontested tone in text
 * Detects authoritarian language that shuts down debate
 */
const flagUncontestedTone = (text: string): UncontestedToneResult => {
  const uncontestedPhrases = [
    'obviously', 'clearly', 'everyone knows', 'everyone agrees',
    'the only way', 'undeniably', 'without question', 'unanimous',
    'no disagreement', 'settled science', 'beyond doubt'
  ] as const;

  const foundPhrases = uncontestedPhrases.filter(phrase =>
    text.toLowerCase().includes(phrase)
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

/**
 * Extract claims from text
 */
const extractClaims = (text: string): readonly Claim[] => {
  const sentences = text
    .split(/[.!?]+/)
    .filter(s => s.trim().length > 10)
    .map(s => s.trim());

  const claims = sentences
    .slice(0, 10)
    .map((sentence, index) => analyzeSentence(sentence, index))
    .filter((claim): claim is Claim => claim !== null);

  return claims;
};

/**
 * Analyze sentence to determine claim type
 */
const analyzeSentence = (sentence: string, index: number): Claim | null => {
  const patterns = {
    fact: ['is', 'are', 'was', 'were', 'has', 'have', 'will'],
    opinion: ['believe', 'think', 'feel', 'seems', 'appears', 'might'],
    assumption: ['assume', 'presumably', 'probably', 'likely'],
    conclusion: ['therefore', 'thus', 'hence', 'so', 'conclusion']
  } as const;

  const lowerSentence = sentence.toLowerCase();

  const type = (Object.entries(patterns).find(([_, indicators]) =>
    indicators.some(indicator => lowerSentence.includes(indicator))
  )?.[0] as Claim['type']) ?? 'fact';

  const confidence =
    type === 'fact' ? 0.7
    : type === 'conclusion' ? 0.6
    : type === 'assumption' ? 0.4
    : 0.3;

  return {
    id: `claim-${index}`,
    text: sentence,
    type,
    confidence
  };
};

// Export class for backward compatibility with MCP tool registration
export class Challenger {
  private defaultModel = 'gpt-5-mini';
  private defaultMaxTokens = 2000;
  private defaultTemperature = 0.9;
  private modelRouter: ModelRouter;
  private thinkingProcess: string[] = [];

  constructor() {
    this.modelRouter = new ModelRouter();
  }

  async challenge(context: any, options: ChallengeOptions = {}): Promise<ChallengeResult> {
    const model = options.model || this.defaultModel;
    const maxTokens = options.maxTokens || this.defaultMaxTokens;
    const temperature = options.temperature || this.defaultTemperature;
    const thoroughness = options.thoroughness || 'standard';
    const enableFactChecking = options.enableFactChecking !== false; // Default true
    const enableDocVerification = options.enableDocVerification !== false; // Default true
    const enableMultiModelVerification = options.enableMultiModelVerification !== false; // Default true

    // Reset thinking process
    this.thinkingProcess = [];

    // Create progress stream
    const totalSteps = 6 + (enableFactChecking ? 1 : 0) + (enableDocVerification ? 1 : 0) + (enableMultiModelVerification ? 1 : 0);
    const progressStream = createProgressStream(totalSteps);
    progressStream.start(`Challenger (${thoroughness} mode)`);

    // Step 1: Extract claims with sequential thinking
    progressStream.step(`Extracting claims from context...`, 1);
    await this.think("Starting critical analysis. First, I'll extract all claims from the provided context...");
    const claims = await this.extractClaims(context, 500);
    await this.think(`Extracted ${claims.length} claims. Types: ${claims.filter(c => c.type === 'fact').length} facts, ${claims.filter(c => c.type === 'opinion').length} opinions, ${claims.filter(c => c.type === 'assumption').length} assumptions, ${claims.filter(c => c.type === 'conclusion').length} conclusions.`);

    // Step 2: Generate challenges
    progressStream.step(`Generating counter-arguments...`, 2);
    await this.think("Now generating counter-arguments for each claim using devil's advocate approach...");
    const challenges = await this.generateChallenges(
      claims,
      model,
      maxTokens,
      temperature
    );
    await this.think(`Generated ${challenges.length} challenges. ${challenges.filter(c => c.severity === 'high').length} high severity, ${challenges.filter(c => c.severity === 'medium').length} medium severity.`);

    // Step 3: Fact-checking (Perplexity) for fact-type claims
    let factCheckResults: FactCheckResult[] | undefined;
    let currentStep = 3;
    if (enableFactChecking && thoroughness !== 'quick') {
      progressStream.step(`Fact-checking with Perplexity...`, currentStep++);
      await this.think("Verifying factual claims using Perplexity search with up-to-date information...");
      factCheckResults = await this.verifyFactsWithPerplexity(claims, thoroughness);
      await this.think(`Fact-checked ${factCheckResults.length} claims. ${factCheckResults.filter(r => r.verified).length} verified, ${factCheckResults.filter(r => !r.verified).length} disputed.`);
    }

    // Step 4: Documentation verification (Grok) for technical claims
    let docVerificationResults: DocVerificationResult[] | undefined;
    if (enableDocVerification && thoroughness === 'deep') {
      progressStream.step(`Verifying documentation with Grok...`, currentStep++);
      await this.think("Cross-verifying technical claims against official documentation using Grok search...");
      docVerificationResults = await this.verifyDocsWithGrok(claims);
      await this.think(`Checked ${docVerificationResults.length} claims against official docs. ${docVerificationResults.filter(r => r.docsFound).length} found supporting documentation.`);
    }

    // Step 5: Multi-model verification (Verifier) for high-severity challenges
    let multiModelConsensus: any;
    if (enableMultiModelVerification && thoroughness === 'deep') {
      const highSeverityChallenges = challenges.filter(c => c.severity === 'high');
      if (highSeverityChallenges.length > 0) {
        progressStream.step(`Multi-model consensus on high-severity challenges...`, currentStep++);
        await this.think(`Running multi-model verification on ${highSeverityChallenges.length} high-severity challenges for consensus...`);
        multiModelConsensus = await this.getMultiModelConsensus(highSeverityChallenges, claims);
        await this.think("Multi-model verification complete. Consensus analysis integrated.");
      }
    }

    // Step 6: Detect groupthink
    progressStream.step(`Analyzing for echo chamber effects...`, currentStep++);
    await this.think("Analyzing input for echo chamber effects and groupthink patterns...");
    const groupthinkDetected = this.detectGroupthink(context);
    await this.think(`Groupthink risk: ${groupthinkDetected ? 'HIGH' : 'LOW'}. ${groupthinkDetected ? 'Echo chamber detected - diverse perspectives needed.' : 'Healthy diversity of thought detected.'}`);

    // Step 7: Generate alternatives
    progressStream.step(`Generating alternative perspectives...`, currentStep++);
    await this.think("Generating alternative perspectives to challenge dominant narratives...");
    const alternativePerspectives = await this.generateAlternatives(
      claims,
      challenges,
      model
    );
    await this.think(`Generated ${alternativePerspectives.length} alternative perspectives.`);

    // Step 8: Synthesize findings
    progressStream.step(`Synthesizing final report...`, currentStep++);
    await this.think("Synthesizing all findings into comprehensive critical analysis report...");
    const synthesis = this.synthesizeChallenges(
      claims,
      challenges,
      alternativePerspectives,
      factCheckResults,
      docVerificationResults,
      multiModelConsensus
    );
    await this.think("Critical analysis complete. Report generated with all verification results.");

    // Complete progress
    progressStream.complete(`Critical analysis complete: ${claims.length} claims, ${challenges.length} challenges`);

    return {
      claims,
      counterArguments: challenges,
      challenges,  // Alias for backwards compatibility
      uncontestedTone: { detected: groupthinkDetected, phrases: [], severity: 'low', message: '' },
      thirdWay: [],  // TODO: implement third-way logic
      oppositeViews: [],  // TODO: implement opposite views logic
      groupthinkDetected,
      alternativePerspectives,
      factCheckResults,
      docVerificationResults,
      multiModelConsensus,
      thinkingProcess: this.thinkingProcess,
      synthesis
    };
  }

  private async think(thought: string): Promise<void> {
    this.thinkingProcess.push(thought);
    // Could optionally log to console if DEBUG=true
    if (process.env.DEBUG === 'true') {
      console.error(`[CHALLENGER THINK] ${thought}`);
    }
  }

  async extractClaims(context: any, maxTokens: number): Promise<Claim[]> {
    const text = this.contextToText(context);
    const claims: Claim[] = [];
    
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 10);
    
    for (let i = 0; i < sentences.length && claims.length < 10; i++) {
      const sentence = sentences[i].trim();
      const claim = this.analyzeSentence(sentence, i);
      if (claim) {
        claims.push(claim);
      }
    }
    
    return claims;
  }

  private analyzeSentence(sentence: string, index: number): Claim | null {
    const factIndicators = ['is', 'are', 'was', 'were', 'has', 'have', 'will'];
    const opinionIndicators = ['believe', 'think', 'feel', 'seems', 'appears', 'might'];
    const assumptionIndicators = ['assume', 'presumably', 'probably', 'likely'];
    const conclusionIndicators = ['therefore', 'thus', 'hence', 'so', 'conclusion'];
    
    let type: Claim['type'] = 'fact';
    let confidence = 0.5;
    
    const lowerSentence = sentence.toLowerCase();
    
    if (opinionIndicators.some(ind => lowerSentence.includes(ind))) {
      type = 'opinion';
      confidence = 0.3;
    } else if (assumptionIndicators.some(ind => lowerSentence.includes(ind))) {
      type = 'assumption';
      confidence = 0.4;
    } else if (conclusionIndicators.some(ind => lowerSentence.includes(ind))) {
      type = 'conclusion';
      confidence = 0.6;
    } else if (factIndicators.some(ind => lowerSentence.includes(ind))) {
      type = 'fact';
      confidence = 0.7;
    }
    
    if (sentence.length < 20) {
      return null;
    }
    
    return {
      id: `claim-${index}`,
      text: sentence,
      confidence,
      type
    };
  }

  private async generateChallenges(
    claims: Claim[],
    model: string,
    maxTokens: number,
    temperature: number
  ): Promise<CounterArgument[]> {
    const challenges: CounterArgument[] = [];
    
    for (const claim of claims) {
      const prompt = this.buildChallengePrompt(claim);
      const response = await this.queryModel(model, prompt, maxTokens, temperature);
      const challenge = this.parseChallenge(response, claim.id);
      if (challenge) {
        challenges.push(challenge);
      }
    }
    
    return challenges;
  }

  private buildChallengePrompt(claim: Claim): string {
    return `You are a critical analyst. Challenge this ${claim.type}:

"${claim.text}"

Respond in this exact format (replace everything after the colon with your actual analysis):

COUNTER-ARGUMENT: Your specific counter-argument goes here
ALTERNATIVE VIEW: Your alternative interpretation goes here
EVIDENCE NEEDED: What evidence would verify or refute this

Write concrete, specific analysis. Do NOT include brackets or placeholders.`;
  }

  private async queryModel(
    model: string,
    prompt: string,
    maxTokens: number,
    temperature: number
  ): Promise<string> {
    try {
      const { modelRouter } = await import('../utils/model-router.js');

      const response = await modelRouter.callModel({
        model,
        prompt,
        maxTokens,
        temperature
      });

      return response.content;
    } catch (error: any) {
      console.error(`Error querying ${model} for challenge:`, error);
      throw new Error(`Failed to generate challenge: ${error.message}`);
    }
  }

  private parseChallenge(response: string, claimId: string): CounterArgument | null {
    const lines = response.split('\n').filter(l => l.trim());
    
    const challenge = lines.find(l => l.toLowerCase().includes('counter-argument'))?.split(':')[1]?.trim() || 
                     lines[0] || 
                     'This claim requires further examination';
    
    const alternativeView = lines.find(l => l.toLowerCase().includes('alternative'))?.split(':')[1]?.trim();
    const evidence = lines.find(l => l.toLowerCase().includes('evidence'))?.split(':')[1]?.trim();
    
    const severity = this.assessChallengeSeverity(challenge);
    
    return {
      claimId,
      argument: challenge,
      challenge,
      evidence,
      severity,
      alternativeView
    };
  }

  private assessChallengeSeverity(challenge: string): 'low' | 'medium' | 'high' {
    const highSeverityWords = ['false', 'incorrect', 'wrong', 'dangerous', 'misleading'];
    const mediumSeverityWords = ['questionable', 'uncertain', 'unclear', 'debatable'];
    
    const lowerChallenge = challenge.toLowerCase();
    
    if (highSeverityWords.some(word => lowerChallenge.includes(word))) {
      return 'high';
    }
    if (mediumSeverityWords.some(word => lowerChallenge.includes(word))) {
      return 'medium';
    }
    return 'low';
  }

  detectGroupthink(context: any): boolean {
    if (Array.isArray(context)) {
      const responses = context.map(c => this.contextToText(c));
      const uniqueViews = new Set(responses.map(r => this.extractKeyView(r)));
      const consensusRatio = 1 - (uniqueViews.size / responses.length);
      return consensusRatio > 0.8;
    }
    
    const text = this.contextToText(context);
    const agreementPhrases = [
      'all agree', 'consensus is', 'everyone thinks', 
      'unanimous', 'no disagreement', 'clearly'
    ];
    
    return agreementPhrases.some(phrase => 
      text.toLowerCase().includes(phrase)
    );
  }

  private async generateAlternatives(
    claims: Claim[],
    challenges: CounterArgument[],
    model: string
  ): Promise<string[]> {
    const alternatives: string[] = [];

    const mainClaims = claims.filter(c => c.type === 'conclusion' || c.confidence > 0.6);

    for (const claim of mainClaims.slice(0, 3)) {
      const challenge = challenges.find(ch => ch.claimId === claim.id);
      if (challenge?.alternativeView) {
        alternatives.push(challenge.alternativeView);
      } else {
        alternatives.push(`Alternative to "${claim.text.substring(0, 50)}...": Consider the opposite perspective`);
      }
    }

    if (alternatives.length === 0) {
      alternatives.push('Consider approaching this problem from a different angle');
      alternatives.push('What if the fundamental assumptions are incorrect?');
      alternatives.push('There may be unconsidered factors at play');
    }

    return alternatives;
  }

  private async verifyFactsWithPerplexity(claims: Claim[], thoroughness: string): Promise<FactCheckResult[]> {
    const results: FactCheckResult[] = [];
    const factClaims = claims.filter(c => c.type === 'fact' || c.type === 'conclusion');
    const limit = thoroughness === 'deep' ? factClaims.length : Math.min(factClaims.length, 5);

    // Get current date for temporal context
    const currentDate = getCurrentDate();

    for (const claim of factClaims.slice(0, limit)) {
      try {
        // Add date context to query
        const dateAwareQuery = `[Current date: ${currentDate}] Verify this claim: "${claim.text}". Is it factually accurate? Provide evidence.`;
        console.log(`[Challenger] Fact-checking with date context: ${currentDate}`);

        // Use SmartAPIClient with retry logic
        const timeoutConfig = getSmartTimeout(PROVIDER_PERPLEXITY, 'batch');
        const response = await smartAPIClient.callWithRetries(
          () => this.queryModel('sonar-pro', dateAwareQuery, 1000, 0.3),
          {
            provider: PROVIDER_PERPLEXITY,
            priority: 'batch',
            baseTimeoutMs: timeoutConfig.base,
            maxTimeoutMs: timeoutConfig.max,
            maxRetries: timeoutConfig.retries
          }
        );

        // Parse response for verification
        const verified = this.parseVerificationResult(response);
        const confidence = this.parseConfidenceScore(response);

        results.push({
          claim: claim.text,
          verified,
          confidence,
          findings: response
        });
      } catch (error: any) {
        console.error(`[Challenger] Error fact-checking claim with Perplexity:`, error);
        results.push({
          claim: claim.text,
          verified: false,
          confidence: 0,
          findings: `Verification failed: ${error.message}`
        });
      }
    }

    return results;
  }

  private async verifyDocsWithGrok(claims: Claim[]): Promise<DocVerificationResult[]> {
    const results: DocVerificationResult[] = [];
    const technicalClaims = claims.filter(c => this.isTechnicalClaim(c.text));

    for (const claim of technicalClaims) {
      try {
        // Smart domain detection
        const domains = this.detectDomainsFromClaim(claim.text);

        // Skip if no programming-specific domains were found
        // This prevents false positives where generic words triggered technical detection
        if (domains.length === 0) {
          console.log(`Skipping doc verification for claim (no programming domains found): ${claim.text.substring(0, 50)}...`);
          continue;
        }

        // Use Grok search with domain restrictions
        const query = `Find official documentation for: "${claim.text}"`;
        const response = await this.queryGrokWithDomains(query, domains);

        results.push({
          claim: claim.text,
          foundInDocs: response.found,
          docsFound: response.found,
          docReferences: domains,
          officialSources: domains,
          summary: response.summary,
          confidence: response.found ? 0.8 : 0.3
        });
      } catch (error: any) {
        console.error(`Error verifying docs with Grok:`, error);
        results.push({
          claim: claim.text,
          foundInDocs: false,
          docsFound: false,
          docReferences: [],
          officialSources: [],
          summary: `Doc verification failed: ${error.message}`,
          confidence: 0
        });
      }
    }

    return results;
  }

  private async getMultiModelConsensus(challenges: CounterArgument[], claims: Claim[]): Promise<any> {
    try {
      // Use multiple models for consensus - can't use verifier tool directly
      // So we'll query 3 different models and compare their responses
      const challengeTexts = challenges.map((ch, i) => {
        const claim = claims.find(c => c.id === ch.claimId);
        return `Challenge ${i + 1}: ${ch.challenge}\nOriginal Claim: ${claim?.text}`;
      }).join('\n\n');

      const query = `Verify these critical challenges and provide your assessment:\n\n${challengeTexts}`;

      // Query models from configuration
      const models = getChallengerModels();
      const responses = await Promise.allSettled(
        models.map(model => this.queryModel(model, query, 2000, 0.5))
      );

      // Collect successful responses
      const successfulResponses = responses
        .filter((r): r is PromiseFulfilledResult<string> => r.status === 'fulfilled')
        .map(r => r.value);

      if (successfulResponses.length === 0) {
        throw new Error('All consensus queries failed');
      }

      // Combine responses
      const combined = successfulResponses.join('\n\n---\n\n');
      const agreement = this.parseAgreementLevel(combined);

      return {
        consensus: combined,
        modelsUsed: models.slice(0, successfulResponses.length),
        agreement
      };
    } catch (error: any) {
      console.error(`Error getting multi-model consensus:`, error);
      return {
        consensus: 'Consensus verification unavailable',
        modelsUsed: [],
        agreement: 0
      };
    }
  }

  private detectDomainsFromClaim(text: string): string[] {
    const domains: string[] = [];
    const lowerText = text.toLowerCase();

    // Programming languages
    if (lowerText.includes('python')) domains.push('python.org', 'docs.python.org');
    if (lowerText.includes('javascript') || lowerText.includes('js')) domains.push('developer.mozilla.org', 'javascript.info');
    if (lowerText.includes('typescript') || lowerText.includes('ts')) domains.push('typescriptlang.org');
    if (lowerText.includes('react')) domains.push('react.dev', 'reactjs.org');
    if (lowerText.includes('vue')) domains.push('vuejs.org');
    if (lowerText.includes('angular')) domains.push('angular.io');
    if (lowerText.includes('node')) domains.push('nodejs.org');
    if (lowerText.includes('rust')) domains.push('rust-lang.org', 'doc.rust-lang.org');
    if (lowerText.includes('go') || lowerText.includes('golang')) domains.push('go.dev', 'golang.org');
    if (lowerText.includes('java')) domains.push('docs.oracle.com', 'openjdk.org');

    // Frameworks & Libraries
    if (lowerText.includes('django')) domains.push('djangoproject.com');
    if (lowerText.includes('flask')) domains.push('flask.palletsprojects.com');
    if (lowerText.includes('express')) domains.push('expressjs.com');
    if (lowerText.includes('nextjs') || lowerText.includes('next.js')) domains.push('nextjs.org');
    if (lowerText.includes('tailwind')) domains.push('tailwindcss.com');

    // Databases
    if (lowerText.includes('postgres') || lowerText.includes('postgresql')) domains.push('postgresql.org');
    if (lowerText.includes('mysql')) domains.push('dev.mysql.com');
    if (lowerText.includes('mongodb')) domains.push('mongodb.com');
    if (lowerText.includes('redis')) domains.push('redis.io');

    // Cloud & DevOps
    if (lowerText.includes('aws') || lowerText.includes('amazon web')) domains.push('docs.aws.amazon.com');
    if (lowerText.includes('azure')) domains.push('docs.microsoft.com');
    if (lowerText.includes('gcp') || lowerText.includes('google cloud')) domains.push('cloud.google.com');
    if (lowerText.includes('docker')) domains.push('docs.docker.com');
    if (lowerText.includes('kubernetes') || lowerText.includes('k8s')) domains.push('kubernetes.io');

    // AI & ML
    if (lowerText.includes('tensorflow')) domains.push('tensorflow.org');
    if (lowerText.includes('pytorch')) domains.push('pytorch.org');
    if (lowerText.includes('openai')) domains.push('platform.openai.com');
    if (lowerText.includes('anthropic') || lowerText.includes('claude')) domains.push('docs.anthropic.com');

    // Don't add fallback domains - if no programming-specific domains were detected,
    // this claim likely isn't technical and shouldn't trigger documentation verification
    // Empty array will cause verifyDocsWithGrok to skip this claim appropriately

    return domains;
  }

  private isTechnicalClaim(text: string): boolean {
    // Only consider claims technical if they contain programming-specific keywords
    // Removed generic words like 'system', 'performance', 'optimization' that appear in non-tech contexts
    const technicalKeywords = [
      'api', 'code', 'function', 'class', 'method', 'library', 'framework',
      'database', 'server', 'client', 'algorithm', 'data structure',
      'programming', 'software', 'application', 'authentication', 'authorization',
      // Programming languages
      'javascript', 'python', 'typescript', 'java', 'rust', 'golang', 'cpp',
      // Tech-specific terms
      'endpoint', 'middleware', 'compiler', 'runtime', 'repository', 'git',
      'docker', 'kubernetes', 'deployment', 'ci/cd', 'testing framework'
    ];

    const lowerText = text.toLowerCase();
    return technicalKeywords.some(keyword => lowerText.includes(keyword));
  }

  private async queryGrokWithDomains(query: string, domains: string[]): Promise<{ found: boolean; summary: string }> {
    try {
      // Import callGrokEnhanced directly to use searchDomains parameter
      const { callGrokEnhanced, GrokModel } = await import('../tools/grok-enhanced.js');

      const messages = [
        {
          role: 'system',
          content: 'You are Grok-3 with live search. Find official documentation and verify technical claims.'
        },
        {
          role: 'user',
          content: query
        }
      ];

      // Use SmartAPIClient with retry logic
      const timeoutConfig = getSmartTimeout(PROVIDER_GROK, 'batch');
      const response = await smartAPIClient.callWithRetries(
        () => callGrokEnhanced(messages, {
          model: GrokModel.GROK_3,
          enableLiveSearch: true,
          searchSources: 20,
          searchDomains: domains.length > 0 ? domains : undefined,
          temperature: 0.3,
          maxTokens: 2000
        }),
        {
          provider: PROVIDER_GROK,
          priority: 'batch',
          baseTimeoutMs: timeoutConfig.base,
          maxTimeoutMs: timeoutConfig.max,
          maxRetries: timeoutConfig.retries
        }
      );

      return {
        found: response.content.length > 100,
        summary: response.content
      };
    } catch (error: any) {
      console.error(`[Challenger] Error querying Grok with domains:`, error);
      return {
        found: false,
        summary: `Search failed: ${error.message}`
      };
    }
  }

  private parseVerificationResult(response: string): boolean {
    const lowerResponse = response.toLowerCase();
    const positiveIndicators = ['verified', 'accurate', 'correct', 'true', 'confirmed', 'supported'];
    const negativeIndicators = ['false', 'incorrect', 'inaccurate', 'disputed', 'unverified', 'misleading'];

    const positiveCount = positiveIndicators.filter(ind => lowerResponse.includes(ind)).length;
    const negativeCount = negativeIndicators.filter(ind => lowerResponse.includes(ind)).length;

    return positiveCount > negativeCount;
  }

  private parseConfidenceScore(response: string): number {
    // Look for explicit confidence mentions
    const confidenceMatch = response.match(/(\d+)%?\s*confidence/i);
    if (confidenceMatch) {
      return parseInt(confidenceMatch[1]) / 100;
    }

    // Parse from language cues
    const lowerResponse = response.toLowerCase();
    if (lowerResponse.includes('definitely') || lowerResponse.includes('certainly')) return 0.9;
    if (lowerResponse.includes('likely') || lowerResponse.includes('probably')) return 0.7;
    if (lowerResponse.includes('possibly') || lowerResponse.includes('might')) return 0.5;
    if (lowerResponse.includes('unlikely') || lowerResponse.includes('doubtful')) return 0.3;

    return 0.5; // Default neutral
  }

  private parseAgreementLevel(response: string): number {
    const lowerResponse = response.toLowerCase();
    if (lowerResponse.includes('unanimous') || lowerResponse.includes('all agree')) return 1.0;
    if (lowerResponse.includes('strong consensus') || lowerResponse.includes('majority agree')) return 0.8;
    if (lowerResponse.includes('mixed') || lowerResponse.includes('divided')) return 0.5;
    if (lowerResponse.includes('disagreement') || lowerResponse.includes('conflicting')) return 0.3;
    return 0.6; // Default moderate agreement
  }

  private synthesizeChallenges(
    claims: Claim[],
    challenges: CounterArgument[],
    alternatives: string[],
    factCheckResults?: FactCheckResult[],
    docVerificationResults?: DocVerificationResult[],
    multiModelConsensus?: any
  ): string {
    let synthesis = `## 🔍 Critical Analysis Report\n\n`;

    // Show thinking process if available
    if (this.thinkingProcess.length > 0) {
      synthesis += `### 🧠 Reasoning Process\n\n`;
      this.thinkingProcess.forEach((thought, i) => {
        synthesis += `${i + 1}. ${thought}\n`;
      });
      synthesis += `\n---\n\n`;
    }

    // Show extracted claims FIRST
    synthesis += `### 📋 Claims Identified\n\n`;
    claims.forEach((claim, i) => {
      const icon = claim.type === 'fact' ? '📊' : claim.type === 'opinion' ? '💭' : claim.type === 'assumption' ? '🤔' : '📌';
      synthesis += `${icon} **Claim ${i + 1}** [${claim.type.toUpperCase()}] (${Math.round(claim.confidence * 100)}% confidence)\n`;
      synthesis += `> "${claim.text}"\n\n`;
    });

    // Show actual challenges with full context
    if (challenges.length > 0) {
      synthesis += `### ⚠️ Counter-Arguments Generated\n\n`;
      challenges.forEach((ch, i) => {
        const claim = claims.find(c => c.id === ch.claimId);
        const severityIcon = ch.severity === 'high' ? '🔴' : ch.severity === 'medium' ? '🟡' : '🟢';

        synthesis += `${severityIcon} **Challenge #${i + 1}** (${ch.severity} severity)\n`;
        synthesis += `**Original Claim:** "${claim?.text}"\n\n`;
        synthesis += `**Counter-Argument:**\n${ch.challenge}\n\n`;

        if (ch.alternativeView) {
          synthesis += `**Alternative View:** ${ch.alternativeView}\n\n`;
        }
        if (ch.evidence) {
          synthesis += `**Evidence Needed:** ${ch.evidence}\n\n`;
        }
        synthesis += `---\n\n`;
      });
    }

    // Show fact-check results from Perplexity
    if (factCheckResults && factCheckResults.length > 0) {
      synthesis += `### ✅ Fact Verification (Perplexity)\n\n`;
      const verified = factCheckResults.filter(r => r.verified).length;
      const disputed = factCheckResults.filter(r => !r.verified).length;

      synthesis += `**Summary:** ${verified} verified, ${disputed} disputed (out of ${factCheckResults.length} checked)\n\n`;

      factCheckResults.forEach((result, i) => {
        const icon = result.verified ? '✅' : '❌';
        const confidencePercent = Math.round(result.confidence * 100);
        synthesis += `${icon} **Fact Check #${i + 1}** (${confidencePercent}% confidence)\n`;
        synthesis += `**Claim:** "${result.claim.substring(0, 100)}${result.claim.length > 100 ? '...' : ''}"\n`;
        synthesis += `**Status:** ${result.verified ? 'VERIFIED' : 'DISPUTED'}\n`;
        if (result.findings) {
          synthesis += `**Findings:** ${result.findings.substring(0, 300)}...\n`;
        }
        synthesis += `\n`;
      });
      synthesis += `---\n\n`;
    }

    // Show documentation verification from Grok
    if (docVerificationResults && docVerificationResults.length > 0) {
      synthesis += `### 📚 Documentation Verification (Grok)\n\n`;
      const docsFound = docVerificationResults.filter(r => r.docsFound).length;

      synthesis += `**Summary:** ${docsFound} out of ${docVerificationResults.length} technical claims have supporting documentation\n\n`;

      docVerificationResults.forEach((result, i) => {
        const icon = result.docsFound ? '📖' : '❓';
        synthesis += `${icon} **Doc Check #${i + 1}**\n`;
        synthesis += `**Claim:** "${result.claim.substring(0, 100)}${result.claim.length > 100 ? '...' : ''}"\n`;
        synthesis += `**Official Sources Checked:** ${result.officialSources?.join(', ') || 'None'}\n`;
        synthesis += `**Status:** ${result.docsFound ? 'Documentation found' : 'No official docs found'}\n`;
        if (result.summary) {
          synthesis += `**Summary:** ${result.summary.substring(0, 250)}...\n`;
        }
        synthesis += `\n`;
      });
      synthesis += `---\n\n`;
    }

    // Show multi-model consensus
    if (multiModelConsensus && multiModelConsensus.consensus) {
      synthesis += `### 🤖 Multi-Model Consensus\n\n`;
      const agreementPercent = Math.round(multiModelConsensus.agreement * 100);
      synthesis += `**Models Used:** ${multiModelConsensus.modelsUsed.join(', ')}\n`;
      synthesis += `**Agreement Level:** ${agreementPercent}%\n\n`;
      synthesis += `**Consensus Analysis:**\n${multiModelConsensus.consensus}\n\n`;
      synthesis += `---\n\n`;
    }

    // Explain groupthink in human terms
    const groupthinkRisk = this.detectGroupthink(claims) ? 'HIGH' : 'LOW';
    synthesis += `### 🎭 Echo Chamber Detection\n\n`;

    if (groupthinkRisk === 'HIGH') {
      synthesis += `⚠️ **HIGH GROUPTHINK RISK DETECTED**\n\n`;
      synthesis += `**What this means:** The input shows signs of "echo chamber" thinking - where everyone agrees without challenging assumptions. This is risky because:\n`;
      synthesis += `- No diverse perspectives are considered\n`;
      synthesis += `- Potential flaws go unexamined\n`;
      synthesis += `- Confirmation bias may be at play\n\n`;
      synthesis += `**Alternative perspectives to consider:**\n`;
      alternatives.slice(0, 3).forEach(alt => synthesis += `- ${alt}\n`);

      // Visual indicator
      synthesis += `\n📊 **Diversity Score:**\n`;
      synthesis += `\`\`\`\n`;
      synthesis += `[████████░░] 80%+ agreement → Echo chamber likely\n`;
      synthesis += `\`\`\`\n`;
    } else {
      synthesis += `✅ **LOW GROUPTHINK RISK**\n\n`;
      synthesis += `**What this means:** The input shows healthy diversity of thought. Different perspectives are present, reducing the risk of echo chamber effects.\n\n`;
      synthesis += `📊 **Diversity Score:**\n`;
      synthesis += `\`\`\`\n`;
      synthesis += `[███░░░░░░░] <80% agreement → Healthy diversity\n`;
      synthesis += `\`\`\`\n`;
    }
    synthesis += `\n`;

    // Visual summary with stats
    const factClaims = claims.filter(c => c.type === 'fact');
    const opinionClaims = claims.filter(c => c.type === 'opinion');
    const assumptionClaims = claims.filter(c => c.type === 'assumption');
    const conclusionClaims = claims.filter(c => c.type === 'conclusion');
    const highSeverity = challenges.filter(c => c.severity === 'high').length;
    const mediumSeverity = challenges.filter(c => c.severity === 'medium').length;
    const lowSeverity = challenges.filter(c => c.severity === 'low').length;

    synthesis += `### 📊 Analysis Summary\n\n`;
    synthesis += `**Claims Breakdown:**\n`;
    synthesis += `\`\`\`\n`;
    synthesis += `Total Claims: ${claims.length}\n`;
    if (factClaims.length > 0) synthesis += `  ├─ 📊 Facts: ${factClaims.length}\n`;
    if (opinionClaims.length > 0) synthesis += `  ├─ 💭 Opinions: ${opinionClaims.length}\n`;
    if (assumptionClaims.length > 0) synthesis += `  ├─ 🤔 Assumptions: ${assumptionClaims.length}\n`;
    if (conclusionClaims.length > 0) synthesis += `  └─ 📌 Conclusions: ${conclusionClaims.length}\n`;
    synthesis += `\`\`\`\n\n`;

    synthesis += `**Challenges Generated:**\n`;
    synthesis += `\`\`\`\n`;
    synthesis += `Total Challenges: ${challenges.length}\n`;
    if (highSeverity > 0) synthesis += `  ├─ 🔴 High Severity: ${highSeverity}\n`;
    if (mediumSeverity > 0) synthesis += `  ├─ 🟡 Medium Severity: ${mediumSeverity}\n`;
    if (lowSeverity > 0) synthesis += `  └─ 🟢 Low Severity: ${lowSeverity}\n`;
    synthesis += `\`\`\`\n\n`;

    synthesis += `**Alternative Perspectives:** ${alternatives.length} generated\n`;
    synthesis += `**Groupthink Risk:** ${groupthinkRisk}\n`;

    return synthesis;
  }

  private contextToText(context: any): string {
    if (typeof context === 'string') return context;
    if (typeof context === 'object' && context.query) return context.query;
    if (typeof context === 'object' && context.text) return context.text;
    if (typeof context === 'object' && context.content) return context.content;
    return JSON.stringify(context);
  }

  private extractKeyView(text: string): string {
    const sentences = text.split(/[.!?]+/);
    const conclusionSentence = sentences.find(s => 
      s.toLowerCase().includes('conclusion') ||
      s.toLowerCase().includes('therefore') ||
      s.toLowerCase().includes('believe')
    );
    return conclusionSentence || sentences[0] || text.substring(0, 100);
  }
}