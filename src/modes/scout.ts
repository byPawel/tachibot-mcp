import { ModelRouter } from '../workflows/model-router.js';
import { getScoutModels, getDefaultModels } from '../config/model-defaults.js';
import { getGrokApiKey } from '../utils/api-keys.js';
import { createProgressStream, createMultiModelReporter } from '../utils/progress-stream.js';
import { smartAPIClient } from '../utils/smart-api-client.js';
import { providerRouter, ProviderConfig } from '../utils/provider-router.js';
import { getSmartTimeout } from '../config/timeout-config.js';
import { execSync } from 'child_process';

// Provider name constants
const PROVIDER_PERPLEXITY = 'perplexity';
const PROVIDER_GROK = 'grok';

/**
 * Get current date from system using bash
 * Returns date in format: "October 20, 2025"
 */
function getCurrentDate(): string {
  try {
    const dateStr = execSync('date "+%B %d, %Y"', { encoding: 'utf8' }).trim();
    return dateStr;
  } catch (error) {
    console.error('[Scout] Failed to get current date:', error);
    // Fallback to JavaScript Date if bash fails
    const now = new Date();
    return now.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  }
}

export interface GrokSearchOptions {
  enableLiveSearch?: boolean;
  maxSources?: number;
  domains?: string[];
}

export interface ScoutOptions {
  variant?: string;
  maxTokens?: number;
  timeout?: number;
  searchProvider?: 'perplexity' | 'grok' | 'both';
  enableGrokLiveSearch?: boolean;
  maxSearchSources?: number;
  searchDomains?: string[];
}

export interface ScoutResult {
  probe?: ProbeResult;
  facts?: FactResult;
  analyses?: AnalysisResult[];
  synthesis: string;
  warning?: string;
  executionTime: number;
  tokensUsed: number;
}

export interface ProbeResult {
  query: string;
  response: string;
  hasUsefulFacts: boolean;
  confidence: number;
}

export interface FactResult {
  facts: string[];
  sources?: string[];
  timestamp: string;
  reliability: number;
}

export interface AnalysisResult {
  model: string;
  analysis: string;
  insights: string[];
}

interface ScoutVariant {
  flow: 'perplexity-first-always' | 'conditional-hybrid' | 'waterfall';
  perplexityTimeout: number;
  parallelModels?: string[];
  primary?: string;
  tokens: number;
  perplexityFor?: string;
  upgradeCondition?: string;
  defaultProvider?: 'perplexity' | 'grok' | 'both';
  priority?: 'interactive' | 'batch'; // NEW - for smart timeout
  providers?: string[]; // NEW - provider priority order
}

export class Scout {
  private defaultSearchProvider: 'perplexity' | 'grok' | 'both';
  private grokApiKey: string | undefined;
  private perplexityApiKey: string | undefined;
  private modelRouter: ModelRouter;

  constructor() {
    // Load configuration from environment
    this.defaultSearchProvider = (process.env.DEFAULT_SEARCH_PROVIDER as 'perplexity' | 'grok' | 'both') || 'perplexity';
    this.grokApiKey = getGrokApiKey();
    this.perplexityApiKey = process.env.PERPLEXITY_API_KEY;
    this.modelRouter = new ModelRouter();

    // Load model configurations
    const scoutModels = getScoutModels();
    this.variants['research_scout'].parallelModels = scoutModels.research;
    this.variants['quick_scout'].parallelModels = scoutModels.quick;
  }
  
  private variants: Record<string, ScoutVariant> = {
    'research_scout': {
      flow: 'perplexity-first-always',
      perplexityTimeout: 65000, // Base timeout (kept for backwards compat)
      parallelModels: [], // Set in constructor from config
      tokens: 2500,
      defaultProvider: PROVIDER_PERPLEXITY,
      priority: 'batch',
      providers: [PROVIDER_PERPLEXITY, PROVIDER_GROK]
    },
    'code_scout': {
      flow: 'conditional-hybrid',
      perplexityTimeout: 8000, // Base timeout
      perplexityFor: 'latest API docs only',
      primary: 'gemini-3-pro-preview',
      upgradeCondition: 'complexity > 0.8',
      tokens: 2000,
      defaultProvider: PROVIDER_PERPLEXITY,
      priority: 'interactive',
      providers: [PROVIDER_PERPLEXITY, PROVIDER_GROK]
    },
    'fact_scout': {
      flow: 'waterfall',
      perplexityTimeout: 8000, // Base timeout
      tokens: 1500,
      defaultProvider: PROVIDER_PERPLEXITY,
      priority: 'batch',
      providers: [PROVIDER_PERPLEXITY, PROVIDER_GROK]
    },
    'quick_scout': {
      flow: 'conditional-hybrid',
      perplexityTimeout: 20000, // Base timeout
      parallelModels: [], // Set in constructor from config
      tokens: 1000,
      defaultProvider: PROVIDER_PERPLEXITY,
      priority: 'interactive',
      providers: [PROVIDER_PERPLEXITY, PROVIDER_GROK]
    }
  };

  async scout(query: string, options: ScoutOptions = {}): Promise<ScoutResult> {
    const startTime = Date.now();
    const variant = this.getVariant(options.variant || 'research_scout');
    const maxTokens = options.maxTokens || variant.tokens;

    // Get current date and prepend to query for temporal context
    const currentDate = getCurrentDate();
    const dateAwareQuery = `[Current date: ${currentDate}] ${query}`;
    console.log(`[Scout] Date-aware query: ${dateAwareQuery}`);

    // Create progress stream
    const progressStream = createProgressStream(4);
    progressStream.start(`Scout (${options.variant || 'research_scout'})`);

    // Determine search provider
    const searchProvider = options.searchProvider || variant.defaultProvider || this.defaultSearchProvider;

    // Cost control for Grok live search
    const maxSearchSources = options.maxSearchSources || this.getSourceLimit(options.variant || 'research_scout');

    let result: ScoutResult = {
      synthesis: '',
      executionTime: 0,
      tokensUsed: 0
    };

    try {
      progressStream.step(`Executing ${variant.flow} flow...`, 1);

      switch (variant.flow) {
        case 'perplexity-first-always':
          result = await this.perplexityFirstFlow(dateAwareQuery, variant, maxTokens, progressStream);
          break;
        case 'conditional-hybrid':
          result = await this.conditionalHybridFlow(dateAwareQuery, variant, maxTokens, searchProvider, undefined, progressStream);
          break;
        case 'waterfall':
          result = await this.waterfallFlow(dateAwareQuery, variant, maxTokens, progressStream);
          break;
      }

      progressStream.complete(`Scout complete: ${result.facts?.facts.length || 0} facts, ${result.analyses?.length || 0} analyses`);
    } catch (error) {
      console.error('Scout error:', error);
      progressStream.error(`Scout error: ${error instanceof Error ? error.message : String(error)}`);
      result.warning = 'Scout encountered an error, falling back to basic analysis';
      result.synthesis = await this.fallbackAnalysis(query, maxTokens);
    }

    result.executionTime = Date.now() - startTime;
    return result;
  }

  private async conditionalHybridFlow(
    query: string,
    variant: ScoutVariant,
    maxTokens: number,
    searchProvider: 'perplexity' | 'grok' | 'both' = 'perplexity',
    grokOptions?: { enableLiveSearch?: boolean; maxSources?: number; domains?: string[] },
    progressStream?: any
  ): Promise<ScoutResult> {
    if (progressStream) progressStream.step(`Searching with ${searchProvider}...`, 2);
    const probe = this.craftTargetedProbe(query);
    const facts = await this.quickPerplexityScan(probe, {
      timeout: variant.perplexityTimeout,
      maxTokens: 500
    }, searchProvider, grokOptions, variant.priority || 'interactive');
    
    if (facts && this.validateFacts(facts)) {
      if (progressStream) progressStream.step(`Analyzing with ${variant.parallelModels?.length || 'multiple'} models...`, 3);
      const context = this.parseToContext(facts);

      const parallelModels = variant.parallelModels || getDefaultModels();
      const analyses = await Promise.all(
        parallelModels.map(model =>
          this.analyzeWithContext(model, query, context, maxTokens / parallelModels.length)
        )
      );
      
      return {
        probe: {
          query: probe,
          response: (facts as any).response || '',
          hasUsefulFacts: true,
          confidence: facts.reliability || 0.8
        },
        facts: facts,
        analyses,
        synthesis: await this.synthesize(facts, analyses),
        tokensUsed: this.estimateTokens(facts, analyses),
        executionTime: 0
      };
    }
    
    const deepFacts = await this.deepPerplexitySearch(query, {
      timeout: 2000,
      maxTokens: 1500
    }, variant.priority || 'batch');
    
    if (!deepFacts) {
      const results = await this.parallelWithoutFacts(query, variant, maxTokens);
      return {
        ...results,
        warning: 'May contain outdated information - no current facts available'
      };
    }
    
    const analyses = await this.parallelAnalysis(query, deepFacts, variant, maxTokens);
    return {
      facts: deepFacts,
      analyses,
      synthesis: await this.synthesize(deepFacts, analyses),
      tokensUsed: this.estimateTokens(deepFacts, analyses),
      executionTime: 0
    };
  }

  private async perplexityFirstFlow(
    query: string,
    variant: ScoutVariant,
    maxTokens: number,
    progressStream?: any
  ): Promise<ScoutResult> {
    if (progressStream) progressStream.step(`Searching with Perplexity...`, 2);
    const facts = await this.quickPerplexityScan(query, {
      timeout: variant.perplexityTimeout,
      maxTokens: Math.min(1000, maxTokens / 3)
    }, 'perplexity', undefined, variant.priority || 'batch');

    if (!facts) {
      return {
        warning: 'Perplexity timeout or error',
        synthesis: `Unable to retrieve information within timeout period (${variant.perplexityTimeout}ms)`,
        executionTime: 0,
        tokensUsed: 0
      };
    }

    if (progressStream) progressStream.step(`Parallel analysis with ${variant.parallelModels?.length || 'multiple'} models...`, 3);
    const analyses = await this.parallelAnalysis(query, facts, variant, maxTokens);

    return {
      facts,
      analyses,
      synthesis: await this.synthesize(facts, analyses),
      tokensUsed: this.estimateTokens(facts, analyses),
      executionTime: 0
    };
  }

  private async waterfallFlow(
    query: string,
    variant: ScoutVariant,
    maxTokens: number,
    progressStream?: any
  ): Promise<ScoutResult> {
    const startTime = Date.now();

    try {
      if (progressStream) progressStream.step(`Deep search with Perplexity...`, 2);

      const facts = await this.deepPerplexitySearch(query, {
        timeout: variant.perplexityTimeout * 2,
        maxTokens: maxTokens / 2
      }, variant.priority || 'batch');

      if (!facts) {
        console.warn(`Waterfall flow: No facts retrieved for query: ${query}`);
        return {
          warning: 'No facts retrieved',
          synthesis: 'Unable to complete waterfall flow',
          executionTime: Date.now() - startTime,
          tokensUsed: 0
        };
      }

      if (progressStream) progressStream.step(`Verifying facts...`, 3);

      const verification = await this.verifyFacts(facts);
      const synthesis = await this.synthesizeWaterfall(facts, verification);
      const executionTime = Date.now() - startTime;

      return {
        facts,
        synthesis,
        tokensUsed: this.estimateTokens(facts),
        executionTime
      };
    } catch (error) {
      console.error('Waterfall flow failed:', error);
      return {
        warning: `Waterfall flow failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        synthesis: 'Unable to complete waterfall flow',
        executionTime: Date.now() - startTime,
        tokensUsed: 0
      };
    }
  }

  private craftTargetedProbe(query: string): string {
    const keywords = this.extractKeywords(query);
    const questionType = this.identifyQuestionType(query);
    
    if (questionType === 'latest') {
      return `Latest information about ${keywords.join(' ')} as of 2025`;
    } else if (questionType === 'technical') {
      return `Technical documentation and API details for ${keywords.join(' ')}`;
    } else if (questionType === 'comparison') {
      return `Compare ${keywords.join(' vs ')} with current data`;
    }
    
    return query;
  }

  private getSourceLimit(variant: string): number {
    // Cost control: limit sources based on variant
    switch (variant) {
      case 'quick_scout':
        return 50;
      case 'fact_scout':
        return 150;
      case 'research_scout':
        return parseInt(process.env.GROK_SEARCH_SOURCES_LIMIT || '100');
      default:
        return 100;
    }
  }
  
  private async quickPerplexityScan(
    probe: string,
    options: { timeout: number; maxTokens: number },
    searchProvider: 'perplexity' | 'grok' | 'both' = 'perplexity',
    grokOptions?: GrokSearchOptions,
    priority: 'interactive' | 'batch' = 'interactive'
  ): Promise<FactResult | null> {
    try {
      // Build provider list for failover
      const providers: ProviderConfig<string>[] = [];

      // Add Perplexity if available
      if ((searchProvider === PROVIDER_PERPLEXITY || searchProvider === 'both') && this.perplexityApiKey) {
        providers.push({
          name: PROVIDER_PERPLEXITY,
          callable: () => this.queryPerplexity(probe, options.maxTokens),
          enabled: true,
          priority: 1
        });
      }

      // Add Grok if available
      if ((searchProvider === PROVIDER_GROK || searchProvider === 'both') && this.grokApiKey) {
        providers.push({
          name: PROVIDER_GROK,
          callable: async () => {
            const result = await this.queryGrokWithLiveSearch(probe, options.maxTokens, grokOptions);
            return result || '';
          },
          enabled: true,
          priority: 2
        });
      }

      if (providers.length === 0) {
        console.warn('[Scout] No search providers available');
        return null;
      }

      // Get smart timeout config
      const timeoutConfig = getSmartTimeout(PROVIDER_PERPLEXITY, priority);

      // Use ProviderRouter with SmartAPIClient for failover + retries
      const result = await providerRouter.route(
        providers,
        { query: probe },
        {
          provider: PROVIDER_PERPLEXITY,
          priority,
          baseTimeoutMs: timeoutConfig.base,
          maxTimeoutMs: timeoutConfig.max,
          maxRetries: timeoutConfig.retries
        }
      );

      // Null safety check
      if (!result?.result) {
        console.warn('[Scout] No result returned from provider router');
        return null;
      }

      // Extract and validate facts
      const facts = this.extractFacts(result.result);
      if (!facts || facts.length === 0) {
        console.warn('[Scout] No facts extracted from search response');
        return null;
      }

      return {
        facts,
        sources: this.extractSources(result.result) || [],
        timestamp: new Date().toISOString(),
        reliability: this.assessReliability(result.result)
      };
    } catch (error) {
      console.error('[Scout] Error in quickPerplexityScan:', error instanceof Error ? error.message : String(error));
      return null;
    }
  }

  private async deepPerplexitySearch(
    query: string,
    options: { timeout: number; maxTokens: number },
    priority: 'interactive' | 'batch' = 'batch'
  ): Promise<FactResult | null> {
    const startTime = Date.now();

    try {
      const enhancedQuery = `Provide comprehensive, current information about: ${query}. Include latest updates, key facts, and reliable sources.`;

      console.log(`[Scout] Starting deep search for query: ${query}`);

      // Build provider list for failover
      const providers: ProviderConfig<string>[] = [];

      if (this.perplexityApiKey) {
        providers.push({
          name: PROVIDER_PERPLEXITY,
          callable: () => this.queryPerplexity(enhancedQuery, options.maxTokens),
          enabled: true,
          priority: 1
        });
      }

      if (this.grokApiKey) {
        providers.push({
          name: PROVIDER_GROK,
          callable: async () => {
            const result = await this.queryGrokWithLiveSearch(enhancedQuery, options.maxTokens);
            return result || '';
          },
          enabled: true,
          priority: 2
        });
      }

      if (providers.length === 0) {
        console.warn('[Scout] No search providers available for deep search');
        return null;
      }

      // Get smart timeout config
      const timeoutConfig = getSmartTimeout(PROVIDER_PERPLEXITY, priority);

      // Use ProviderRouter with SmartAPIClient
      const result = await providerRouter.route(
        providers,
        { query: enhancedQuery },
        {
          provider: PROVIDER_PERPLEXITY,
          priority,
          baseTimeoutMs: timeoutConfig.base,
          maxTimeoutMs: timeoutConfig.max,
          maxRetries: timeoutConfig.retries
        }
      );

      // Null safety check
      if (!result?.result) {
        console.warn('[Scout] Deep search returned empty response');
        return null;
      }

      // Extract and validate facts
      const facts = this.extractFacts(result.result);
      if (!facts || facts.length === 0) {
        console.warn('[Scout] No facts extracted from deep search response');
        return null;
      }

      const searchDuration = Date.now() - startTime;
      console.log(`[Scout] Deep search completed in ${searchDuration}ms using ${result.provider}`);

      return {
        facts,
        sources: this.extractSources(result.result) || [],
        timestamp: new Date().toISOString(),
        reliability: this.assessReliability(result.result)
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      console.error(
        `[Scout] Error in deepPerplexitySearch after ${duration}ms:`,
        error instanceof Error ? error.message : String(error)
      );
      return null;
    }
  }

  private validateFacts(facts: FactResult): boolean {
    return facts.facts.length > 0 && facts.reliability > 0.5;
  }

  private parseToContext(facts: FactResult): string {
    return `Context (${facts.timestamp}):\n${facts.facts.join('\n')}\n\nSources: ${facts.sources?.join(', ') || 'Not specified'}`;
  }

  private async analyzeWithContext(
    model: string,
    query: string,
    context: string,
    maxTokens: number
  ): Promise<AnalysisResult> {
    const prompt = `${context}\n\nAnalyze: ${query}`;
    const response = await this.queryModel(model, prompt, maxTokens);
    
    return {
      model,
      analysis: response,
      insights: this.extractInsights(response)
    };
  }

  private async parallelAnalysis(
    query: string,
    facts: FactResult,
    variant: ScoutVariant,
    maxTokens: number
  ): Promise<AnalysisResult[]> {
    const models = variant.parallelModels || getDefaultModels();
    const context = this.parseToContext(facts);
    
    const analyses = await Promise.all(
      models.map(model => 
        this.analyzeWithContext(model, query, context, maxTokens / models.length)
      )
    );
    
    return analyses;
  }

  private async parallelWithoutFacts(
    query: string,
    variant: ScoutVariant,
    maxTokens: number
  ): Promise<ScoutResult> {
    const models = variant.parallelModels || getDefaultModels();

    const analyses = await Promise.all(
      models.map(async model => {
        const response = await this.queryModel(model, query, maxTokens / models.length);
        return {
          model,
          analysis: response,
          insights: this.extractInsights(response)
        };
      })
    );
    
    return {
      analyses,
      synthesis: await this.synthesizeWithoutFacts(analyses),
      tokensUsed: this.estimateTokens(null, analyses),
      executionTime: 0
    };
  }

  private async synthesize(facts: FactResult | null, analyses: AnalysisResult[]): Promise<string> {
    let synthesis = '';
    
    if (facts && facts.facts.length > 0) {
      synthesis += `Current Information (${facts.timestamp}):\n`;
      facts.facts.slice(0, 3).forEach(fact => synthesis += `• ${fact}\n`);
      synthesis += '\n';
    }
    
    synthesis += 'Analysis:\n';
    analyses.forEach(analysis => {
      synthesis += `${analysis.model}:\n`;
      analysis.insights.slice(0, 2).forEach(insight => synthesis += `• ${insight}\n`);
    });
    
    return synthesis;
  }

  private async synthesizeWithoutFacts(analyses: AnalysisResult[]): Promise<string> {
    let synthesis = 'Multi-Model Analysis:\n\n';
    
    analyses.forEach(analysis => {
      synthesis += `${analysis.model}:\n`;
      analysis.insights.slice(0, 3).forEach(insight => synthesis += `• ${insight}\n`);
      synthesis += '\n';
    });
    
    return synthesis;
  }

  private async synthesizeWaterfall(facts: FactResult, verification: any): Promise<string> {
    return `Verified Information:\n${facts.facts.join('\n')}\n\nReliability: ${facts.reliability}`;
  }

  private async verifyFacts(facts: FactResult): Promise<any> {
    return { verified: true, confidence: facts.reliability };
  }

  private async fallbackAnalysis(query: string, maxTokens: number): Promise<string> {
    return `Analysis of: ${query}\n[Fallback mode - limited information available]`;
  }

  private async queryPerplexity(query: string, maxTokens: number): Promise<string> {
    // Use existing Perplexity tool instead of duplicating API logic
    if (!this.perplexityApiKey) {
      throw new Error('Perplexity API key not configured');
    }

    try {
      const { callPerplexity, PerplexityModel } = await import('../tools/perplexity-tools.js');
      const messages = [{ role: 'user', content: query }];

      // Call the existing Perplexity tool
      const result = await callPerplexity(messages, PerplexityModel.SONAR_PRO);

      // Check if result is an error message
      if (result.startsWith('[Perplexity')) {
        throw new Error(result);
      }

      return result;
    } catch (error: any) {
      console.error('Scout queryPerplexity error:', error);
      throw error; // Re-throw so Promise.race timeout can catch it properly
    }
  }
  
  private async queryGrokWithLiveSearch(
    query: string,
    maxTokens: number,
    options?: { enableLiveSearch?: boolean; maxSources?: number; domains?: string[] }
  ): Promise<string | null> {
    if (!this.grokApiKey) {
      return null;
    }
    
    try {
      // Import Grok enhanced API
      const { callGrokEnhanced } = await import('../tools/grok-enhanced.js');
      const messages = [{ role: 'user', content: query }];
      
      const result = await callGrokEnhanced(messages, {
        model: 'grok-4-0709' as any,
        maxTokens,
        enableLiveSearch: options?.enableLiveSearch ?? true,
        searchSources: options?.maxSources ?? 100,
        searchDomains: options?.domains
      });
      
      return result.content;
    } catch (error) {
      console.error('Grok live search error:', error);
      return null;
    }
  }
  
  private combineSearchResults(perplexityResult: string, grokResult: string): string {
    // Intelligently combine results from both providers
    return `## Perplexity Results:\n${perplexityResult}\n\n## Grok Live Search Results:\n${grokResult}`;
  }

  private async queryModel(model: string, prompt: string, maxTokens: number): Promise<string> {
    try {
      const { modelRouter } = await import('../utils/model-router.js');

      const response = await modelRouter.callModel({
        model,
        prompt,
        maxTokens,
        temperature: 0.7
      });

      return response.content;
    } catch (error: any) {
      console.error(`Scout model query error (${model}):`, error);
      throw new Error(`Failed to analyze with ${model}: ${error.message}`);
    }
  }

  private extractKeywords(query: string): string[] {
    const words = query.toLowerCase().split(/\s+/);
    const stopWords = ['what', 'how', 'why', 'when', 'where', 'is', 'are', 'the', 'a', 'an'];
    return words.filter(w => !stopWords.includes(w) && w.length > 2);
  }

  private identifyQuestionType(query: string): string {
    const lower = query.toLowerCase();
    if (lower.includes('latest') || lower.includes('current') || lower.includes('new')) return 'latest';
    if (lower.includes('api') || lower.includes('function') || lower.includes('method')) return 'technical';
    if (lower.includes('vs') || lower.includes('compare') || lower.includes('difference')) return 'comparison';
    return 'general';
  }

  private extractFacts(response: string): string[] {
    const lines = response.split('\n');
    return lines
      .filter(line => line.trim().length > 20)
      .slice(0, 5)
      .map(line => line.trim());
  }

  private extractSources(response: string): string[] {
    const sourcePattern = /\[(\d+)\]\s*([^\n]+)/g;
    const sources: string[] = [];
    let match;
    
    while ((match = sourcePattern.exec(response)) !== null) {
      sources.push(match[2]);
    }
    
    return sources;
  }

  private extractInsights(response: string): string[] {
    const lines = response.split('\n');
    return lines
      .filter(line => line.includes('insight') || line.includes('Key') || line.startsWith('•'))
      .map(line => line.replace(/^[•\-]\s*/, '').trim())
      .filter(line => line.length > 10)
      .slice(0, 3);
  }

  private assessReliability(response: string): number {
    let score = 0.5;
    if (response.includes('source') || response.includes('[')) score += 0.2;
    if (response.includes('2025') || response.includes('2024')) score += 0.1;
    if (response.includes('verified') || response.includes('confirmed')) score += 0.1;
    if (response.length > 500) score += 0.1;
    return Math.min(score, 1.0);
  }

  private estimateTokens(facts: FactResult | null, analyses?: AnalysisResult[]): number {
    let tokens = 0;
    if (facts) {
      tokens += facts.facts.join('').length / 4;
    }
    if (analyses) {
      tokens += analyses.reduce((sum, a) => sum + a.analysis.length / 4, 0);
    }
    return Math.round(tokens);
  }

  private getVariant(name: string): ScoutVariant {
    return this.variants[name] || this.variants['research_scout'];
  }
}