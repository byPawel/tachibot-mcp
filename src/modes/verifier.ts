import { ModelRouter } from '../workflows/model-router.js';
import { getVerifierModels } from '../config/model-defaults.js';
import { createMultiModelReporter } from '../utils/progress-stream.js';
import { smartAPIClient } from '../utils/smart-api-client.js';
import { getSmartTimeout } from '../config/timeout-config.js';
import {
  renderTable,
  renderKeyValueTable,
  renderGradientBorderBox,
  renderGradientDivider,
  brailleBar,
  icons,
} from '../utils/ink-renderer.js';
import { TableBuilder } from '../utils/table-builder.js';

export interface VerifyOptions {
  model?: string | string[];
  maxTokens?: number;
  variant?: string;
  timeout?: number;
  includeSources?: boolean;
}

export interface VerifierResult {
  consensus: number;
  majority: any;
  outliers: any[];
  responses: ModelResponse[];
  synthesis: string;
  confidence: number;
  shouldTerminate?: boolean;
}

export interface ModelResponse {
  model: string;
  response: any;
  conclusion?: string;
  evidence?: string[];
  confidence?: number;
  tokens?: number;
}

export interface ConsensusAnalysis {
  agreement: number;
  clusters: Map<string, ModelResponse[]>;
  majorityCluster: string;
  outlierModels: string[];
}

export class Verifier {
  private modelRouter: ModelRouter;
  private variants: Record<string, VerifyVariant>;

  constructor() {
    this.modelRouter = new ModelRouter();

    // Load model configurations
    const verifierModels = getVerifierModels();

    this.variants = {
      'quick_verify': {
        models: verifierModels.quick,
        maxTokens: 2000,
        timeout: 10000
      },
      'deep_verify': {
        models: verifierModels.deep,
        maxTokens: 6000,
        timeout: 30000
      },
      'fact_check': {
        models: verifierModels.standard,
        maxTokens: 3000,
        timeout: 15000,
        includeSources: true
      },
      'code_verify': {
        models: verifierModels.standard,
        maxTokens: 4000,
        timeout: 20000
      },
      'security_verify': {
        models: verifierModels.standard,
        maxTokens: 4000,
        timeout: 20000
      }
    };
  }

  async verify(query: string, options: VerifyOptions = {}): Promise<VerifierResult> {
    const variant = this.getVariant(options.variant || 'quick_verify');
    const models = options.model ?
      (Array.isArray(options.model) ? options.model : [options.model]) :
      variant.models;

    const maxTokens = options.maxTokens || variant.maxTokens;
    const timeout = options.timeout || variant.timeout;

    // Create progress reporter
    const reporter = createMultiModelReporter(models, `Verifier (${options.variant || 'quick_verify'})`);

    const responses = await this.gatherResponses(
      query,
      models,
      maxTokens,
      timeout,
      options.includeSources || variant.includeSources,
      reporter
    );

    const consensus = this.calculateTrueConsensus(responses);
    const synthesis = await this.synthesizeVerified(responses, consensus);

    // Complete progress reporting
    reporter.complete(`Verification complete: ${(consensus.agreement * 100).toFixed(0)}% consensus`);

    return {
      consensus: consensus.agreement,
      majority: consensus.majorityCluster,
      outliers: consensus.outlierModels.map(m =>
        responses.find(r => r.model === m)
      ).filter(Boolean),
      responses,
      synthesis,
      confidence: this.calculateConfidence(consensus, responses),
      shouldTerminate: consensus.agreement >= 0.8
    };
  }

  private async gatherResponses(
    query: string,
    models: string[],
    maxTokens: number,
    timeout: number,
    includeSources?: boolean,
    reporter?: any
  ): Promise<ModelResponse[]> {
    // Determine priority based on timeout (lower timeout = interactive)
    const priority: 'interactive' | 'batch' = timeout <= 15000 ? 'interactive' : 'batch';

    const responsePromises = models.map(async (model) => {
      if (reporter) {
        reporter.modelStarted(model);
      }

      try {
        // Determine provider from model name
        const provider = this.getProviderFromModel(model);
        const timeoutConfig = getSmartTimeout(provider, priority);

        // Use SmartAPIClient with retry logic
        const result = await smartAPIClient.callWithRetries(
          () => this.queryModel(model, query, maxTokens, includeSources),
          {
            provider,
            priority,
            baseTimeoutMs: timeoutConfig.base,
            maxTimeoutMs: timeoutConfig.max,
            maxRetries: timeoutConfig.retries
          }
        );

        if (reporter) {
          reporter.modelCompleted(model, result.response?.substring(0, 200) || 'No response');
        }

        return { status: 'fulfilled' as const, value: result };
      } catch (error) {
        if (reporter) {
          reporter.modelFailed(model, error instanceof Error ? error.message : String(error));
        }
        return { status: 'rejected' as const, reason: error };
      }
    });

    const responses = await Promise.all(responsePromises);

    return responses
      .filter((r): r is PromiseFulfilledResult<ModelResponse> =>
        r.status === 'fulfilled'
      )
      .map(r => r.value);
  }

  /**
   * Determine provider name from model identifier
   */
  private getProviderFromModel(model: string): string {
    const lowerModel = model.toLowerCase();
    if (lowerModel.includes('gpt') || lowerModel.includes('openai')) return 'openai';
    if (lowerModel.includes('claude') || lowerModel.includes('anthropic')) return 'anthropic';
    if (lowerModel.includes('gemini') || lowerModel.includes('google')) return 'google';
    if (lowerModel.includes('grok')) return 'grok';
    if (lowerModel.includes('sonar') || lowerModel.includes('perplexity')) return 'perplexity';
    return 'openai'; // Default fallback
  }

  private async queryModel(
    model: string,
    query: string,
    maxTokens: number,
    includeSources?: boolean
  ): Promise<ModelResponse> {
    const prompt = this.buildVerificationPrompt(query, includeSources);
    
    try {
      const response = await this.executeModelQuery(model, prompt, maxTokens);
      
      return {
        model,
        response: response.content,
        conclusion: this.extractConclusion(response.content),
        evidence: includeSources ? this.extractEvidence(response.content) : undefined,
        confidence: this.extractConfidence(response.content),
        tokens: response.tokens
      };
    } catch (error) {
      console.error(`Error querying ${model}:`, error);
      throw error;
    }
  }

  private buildVerificationPrompt(query: string, includeSources?: boolean): string {
    const basePrompt = `Analyze the following query/statement critically and provide your assessment.

Query: ${query}

Please provide:
1. Your conclusion (true/false/uncertain/needs-context)
2. Key reasoning points
3. Confidence level (0-100%)`;

    if (includeSources) {
      return basePrompt + `
4. Supporting evidence or sources
5. Any contradicting information found`;
    }

    return basePrompt;
  }

  private async executeModelQuery(
    model: string,
    prompt: string,
    maxTokens: number
  ): Promise<{ content: string; tokens: number }> {
    try {
      const { modelRouter } = await import('../utils/model-router.js');

      const response = await modelRouter.callModel({
        model,
        prompt,
        maxTokens,
        temperature: 0.7
      });

      return {
        content: response.content,
        tokens: response.tokens || Math.floor(response.content.length / 4)
      };
    } catch (error: any) {
      console.error(`Error querying ${model}:`, error);
      throw new Error(`Failed to query ${model}: ${error.message}`);
    }
  }

  calculateTrueConsensus(responses: ModelResponse[]): ConsensusAnalysis {
    const clusters = new Map<string, ModelResponse[]>();
    
    for (const response of responses) {
      const conclusion = response.conclusion || 'unknown';
      if (!clusters.has(conclusion)) {
        clusters.set(conclusion, []);
      }
      clusters.get(conclusion)!.push(response);
    }
    
    const sortedClusters = Array.from(clusters.entries())
      .sort((a, b) => b[1].length - a[1].length);
    
    const majorityCluster = sortedClusters[0][0];
    const majorityCount = sortedClusters[0][1].length;
    const agreement = majorityCount / responses.length;
    
    const outlierModels = sortedClusters
      .slice(1)
      .flatMap(([_, responses]) => responses.map(r => r.model));
    
    return {
      agreement,
      clusters,
      majorityCluster,
      outlierModels
    };
  }

  findOutliers(responses: ModelResponse[]): ModelResponse[] {
    const consensus = this.calculateTrueConsensus(responses);
    return responses.filter(r => 
      consensus.outlierModels.includes(r.model)
    );
  }

  async synthesizeVerified(
    responses: ModelResponse[],
    consensus: ConsensusAnalysis
  ): Promise<string> {
    const majorityResponses = consensus.clusters.get(consensus.majorityCluster) || [];
    const outlierCount = responses.length - majorityResponses.length;
    const consensusPercent = (consensus.agreement * 100).toFixed(1);

    const lines: string[] = [];

    // Header with gradient border box
    lines.push(renderGradientBorderBox(
      `${icons.search} Multi-Model Verification Report`,
      { width: 60, gradient: 'mind' }
    ));
    lines.push('');

    // Consensus indicator with braille bar
    lines.push(`${icons.chartBar} Consensus: ${consensusPercent}%`);
    lines.push(brailleBar(consensus.agreement * 100, 100, 30));
    lines.push('');

    // Show all model responses in a beautiful table
    lines.push(`${icons.brain} Model Responses`);
    lines.push(renderGradientDivider(50, 'cristal'));
    lines.push('');

    const tableData = responses.map((resp) => {
      const isMajority = majorityResponses.includes(resp);
      const statusIcon = isMajority ? '✅' : '⚠️';
      const conclusionIcon =
        resp.conclusion === 'true' ? '✓' :
        resp.conclusion === 'false' ? '✗' :
        resp.conclusion === 'uncertain' ? '❓' : '❔';

      const confidence = resp.confidence ? `${Math.round(resp.confidence * 100)}%` : 'N/A';

      // Clean up response preview - remove markdown, newlines, and increase length
      const cleanResponse = (resp.response || '')
        .replace(/\*+/g, '') // Remove asterisks
        .replace(/#+/g, '')   // Remove headers
        .replace(/\n/g, ' ')  // Replace newlines with spaces
        .replace(/\s+/g, ' ') // Collapse multiple spaces
        .trim();

      const preview = cleanResponse.substring(0, 120); // Increased from 60 to 120
      const previewText = preview ? `${preview}${cleanResponse.length > 120 ? '...' : ''}` : 'No response';

      // Clean conclusion display
      const cleanConclusion = (resp.conclusion || 'unknown').replace(/\*+/g, '').trim();

      return {
        Status: statusIcon,
        Model: resp.model,
        Conclusion: `${conclusionIcon} ${cleanConclusion}`,
        Confidence: confidence,
        Preview: previewText
      };
    });

    lines.push(renderTable(tableData));
    lines.push('');

    // Detailed model responses
    lines.push(`${icons.file} Detailed Model Responses`);
    lines.push(renderGradientDivider(50, 'teen'));
    lines.push('');

    responses.forEach((resp, index) => {
      const isMajority = majorityResponses.includes(resp);
      const statusBadge = isMajority ? '✅ Majority' : '⚠️ Dissenting';

      lines.push(`**${index + 1}. ${resp.model}** ${statusBadge}`);
      lines.push(`Conclusion: ${(resp.conclusion || 'unknown').replace(/\*+/g, '').trim()}`);
      lines.push(`Confidence: ${resp.confidence ? `${Math.round(resp.confidence * 100)}%` : 'N/A'}`);
      lines.push('');
      lines.push(`${resp.response || 'No response provided'}`);
      lines.push('');
      lines.push(renderGradientDivider(40, 'cristal'));
      lines.push('');
    });

    // Majority analysis
    lines.push(`${icons.starFilled} Majority View`);
    lines.push(renderGradientDivider(50, 'passion'));
    lines.push('');

    const cleanMajorityConclusion = (consensus.majorityCluster || 'unknown').replace(/\*+/g, '').trim();
    lines.push(`Conclusion: ${cleanMajorityConclusion}`);
    lines.push(`Models in agreement: ${majorityResponses.length}/${responses.length}`);
    lines.push('');

    if (majorityResponses.length > 0) {
      lines.push('Key reasoning points:');
      const points = this.extractKeyPoints(majorityResponses);
      if (points.length > 0) {
        points.forEach(point => lines.push(`  • ${point}`));
      } else {
        majorityResponses.slice(0, 3).forEach(resp => {
          const firstSentence = resp.response.split(/[.!?]/)[0];
          if (firstSentence && firstSentence.length > 10) {
            lines.push(`  • ${firstSentence.trim()}.`);
          }
        });
      }
      lines.push('');
    }

    // Dissenting views
    if (outlierCount > 0) {
      lines.push(`${icons.alertCircle} Dissenting Views (${outlierCount})`);
      lines.push(renderGradientDivider(50, 'passion'));
      lines.push('');

      const outliers = this.findOutliers(responses);
      outliers.forEach(outlier => {
        lines.push(`**${outlier.model}:** "${outlier.conclusion || 'unknown'}"`);
        const preview = (outlier.response || '').substring(0, 150).replace(/\n/g, ' ');
        if (preview) {
          lines.push(`> ${preview}${outlier.response.length > 150 ? '...' : ''}`);
          lines.push('');
        }
      });
    }

    // Summary with key-value table
    lines.push(`${icons.chartBar} Summary`);
    lines.push(renderGradientDivider(50, 'rainbow'));
    lines.push('');

    lines.push(renderKeyValueTable({
      'Total Models': String(responses.length),
      'Consensus': `${consensusPercent}%`,
      'Majority View': consensus.majorityCluster || 'unknown',
      'Agreeing Models': String(majorityResponses.length),
      'Dissenting': String(outlierCount),
      'High Confidence': consensus.agreement >= 0.8 ? 'YES ✓' : 'NO',
    }));

    return lines.join('\n');
  }

  private extractConclusion(content: string): string {
    const patterns = [
      /conclusion:\s*([^\n]+)/i,
      /answer:\s*([^\n]+)/i,
      /verdict:\s*([^\n]+)/i,
      /result:\s*([^\n]+)/i
    ];

    for (const pattern of patterns) {
      const match = content.match(pattern);
      if (match) {
        // Clean up markdown artifacts and extra asterisks
        return match[1].trim().toLowerCase().replace(/\*+/g, '').trim();
      }
    }

    if (content.toLowerCase().includes('true')) return 'true';
    if (content.toLowerCase().includes('false')) return 'false';
    if (content.toLowerCase().includes('uncertain')) return 'uncertain';

    return 'unknown';
  }

  private extractEvidence(content: string): string[] {
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
  }

  private extractConfidence(content: string): number {
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
    
    return 0.5;
  }

  private extractKeyPoints(responses: ModelResponse[]): string[] {
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
  }

  private calculateConfidence(
    consensus: ConsensusAnalysis,
    responses: ModelResponse[]
  ): number {
    const agreementScore = consensus.agreement;
    
    const avgModelConfidence = responses
      .map(r => r.confidence || 0.5)
      .reduce((a, b) => a + b, 0) / responses.length;
    
    const responseCount = responses.length;
    const responseScore = Math.min(responseCount / 5, 1);
    
    return (agreementScore * 0.5 + avgModelConfidence * 0.3 + responseScore * 0.2);
  }

  private getVariant(name: string): VerifyVariant {
    return this.variants[name] || this.variants['quick_verify'];
  }
}

interface VerifyVariant {
  models: string[];
  maxTokens: number;
  timeout: number;
  includeSources?: boolean;
}