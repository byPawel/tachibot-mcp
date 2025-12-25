import { ModelRouter } from '../workflows/model-router.js';
import { TokenTracker } from '../optimization/token-tracker.js';
import { BatchExecutor } from '../optimization/batch-executor.js';

export interface ArchitectOptions {
  path?: string;
  maxTokens?: number;
  depth?: 'shallow' | 'normal' | 'deep';
  focusAreas?: string[];
  includeTests?: boolean;
  includeDocs?: boolean;
}

export interface ArchitectResult {
  architecture: ArchitectureSummary;
  hotspots: Hotspot[];
  recommendations: Recommendation[];
  dependencies: DependencyGraph;
  metrics: CodeMetrics;
  synthesis: string;
  tokensUsed: number;
  cost: number;
}

export interface ArchitectureSummary {
  overview: string;
  patterns: string[];
  components: Component[];
  layers: Layer[];
  concerns: string[];
}

export interface Hotspot {
  type: HotspotType;
  file: string;
  line?: number;
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  complexity: number;
  suggestedModel?: string;
}

export type HotspotType = 
  | 'syntax_error'
  | 'type_error'
  | 'algorithmic_complexity'
  | 'performance_issue'
  | 'architectural_smell'
  | 'security_vulnerability'
  | 'dependency_conflict'
  | 'outdated_dependency'
  | 'design_pattern_violation'
  | 'memory_leak'
  | 'race_condition'
  | 'code_duplication'
  | 'circular_dependency';

export interface Component {
  name: string;
  type: string;
  responsibilities: string[];
  dependencies: string[];
  issues: string[];
}

export interface Layer {
  name: string;
  components: string[];
  purpose: string;
}

export interface DependencyGraph {
  nodes: DependencyNode[];
  edges: DependencyEdge[];
  cycles: string[][];
  externalDeps: ExternalDependency[];
}

export interface DependencyNode {
  id: string;
  name: string;
  type: 'module' | 'class' | 'function' | 'package';
  complexity: number;
}

export interface DependencyEdge {
  from: string;
  to: string;
  type: 'import' | 'extends' | 'implements' | 'uses';
}

export interface ExternalDependency {
  name: string;
  version?: string;
  isOutdated?: boolean;
  hasVulnerabilities?: boolean;
}

export interface CodeMetrics {
  totalFiles: number;
  totalLines: number;
  complexity: number;
  testCoverage?: number;
  techDebt: number;
  maintainabilityIndex: number;
}

export interface Recommendation {
  type: 'refactor' | 'security' | 'performance' | 'architecture' | 'dependency';
  priority: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string;
  affectedFiles: string[];
  estimatedEffort: string;
}

interface StageResult {
  stage: string;
  model: string;
  result: any;
  tokens: number;
  duration: number;
}

export class Architect {
  private modelRouter: ModelRouter;
  private tokenTracker: TokenTracker;
  private batchExecutor: BatchExecutor;
  
  private stages = {
    gemini_analysis: {
      model: 'gemini-3-pro-preview',
      maxTokens: 1000000,
      tasks: [
        'fullCodebaseAnalysis',
        'dependencyMapping',
        'hotspotIdentification',
        'architectureExtraction',
        'metricsCalculation'
      ]
    },
    
    specialized_verification: {
      models: {
        'syntax_error': 'gpt-4-mini',
        'type_error': 'gpt-4-mini',
        'algorithmic_complexity': 'qwq-32b',
        'performance_issue': 'qwq-32b',
        'architectural_smell': 'claude-opus-4.1',
        'security_vulnerability': 'claude-opus-4.1',
        'dependency_conflict': 'perplexity-reasoning',
        'outdated_dependency': 'perplexity-reasoning',
        'design_pattern_violation': 'claude-opus-4.1',
        'memory_leak': 'qwq-32b',
        'race_condition': 'claude-opus-4.1',
        'code_duplication': 'gpt-4-mini',
        'circular_dependency': 'claude-opus-4.1'
      },
      dynamicTokens: {
        min: 5000,
        max: 50000,
        allocation: 'based_on_complexity'
      }
    },
    
    synthesis: {
      model: 'think',
      maxTokens: 10000
    }
  };

  constructor() {
    this.modelRouter = new ModelRouter();
    this.tokenTracker = new TokenTracker();
    this.batchExecutor = new BatchExecutor();
  }

  async analyze(query: string, options: ArchitectOptions = {}): Promise<ArchitectResult> {
    const startTime = Date.now();
    const stageResults: StageResult[] = [];
    
    // Stage 1: Gemini Full Analysis
    const geminiResult = await this.executeGeminiAnalysis(query, options);
    stageResults.push(geminiResult);
    
    // Extract hotspots and areas for deep analysis
    const hotspots = this.extractHotspots(geminiResult.result);
    const filesForReview = this.identifyFilesForReview(geminiResult.result, hotspots);
    
    // Stage 2: Specialized Verification (Parallel)
    const specializedResults = await this.executeSpecializedAnalysis(
      hotspots,
      filesForReview,
      options
    );
    stageResults.push(...specializedResults);
    
    // Stage 3: Synthesis
    const synthesis = await this.executeSynthesis(stageResults);
    stageResults.push(synthesis);
    
    // Compile final result
    return this.compileFinalResult(stageResults, hotspots, startTime);
  }

  private async executeGeminiAnalysis(
    query: string,
    options: ArchitectOptions
  ): Promise<StageResult> {
    const startTime = Date.now();
    const model = this.selectGeminiModel(options);
    const maxTokens = this.calculateGeminiTokens(options);
    
    const prompt = this.buildGeminiPrompt(query, options);
    const result = await this.queryGemini(model, prompt, maxTokens);
    
    return {
      stage: 'gemini_analysis',
      model,
      result,
      tokens: maxTokens,
      duration: Date.now() - startTime
    };
  }

  private selectGeminiModel(options: ArchitectOptions): string {
    // Always use Gemini 3 Pro Preview for RAW POWER
    return 'gemini-3-pro-preview';
  }

  private calculateGeminiTokens(options: ArchitectOptions): number {
    const depthMultiplier = {
      'shallow': 0.3,
      'normal': 0.6,
      'deep': 1.0
    };
    
    const baseTokens = 1000000;
    const multiplier = depthMultiplier[options.depth || 'normal'];
    return Math.floor(baseTokens * multiplier);
  }

  private buildGeminiPrompt(query: string, options: ArchitectOptions): string {
    let prompt = `Analyze the following codebase comprehensively:\n\n`;
    prompt += `Query: ${query}\n\n`;
    
    if (options.path) {
      prompt += `Path: ${options.path}\n`;
    }
    
    prompt += `Please provide:\n`;
    prompt += `1. Architecture overview with patterns and components\n`;
    prompt += `2. Dependency graph and external dependencies\n`;
    prompt += `3. Hotspots requiring attention (security, performance, architecture)\n`;
    prompt += `4. Code metrics and quality assessment\n`;
    prompt += `5. Specific files needing deep review\n`;
    
    if (options.focusAreas && options.focusAreas.length > 0) {
      prompt += `\nFocus particularly on: ${options.focusAreas.join(', ')}\n`;
    }
    
    prompt += `\nOutput format: Structured JSON with clear categorization`;
    
    return prompt;
  }

  private async queryGemini(model: string, prompt: string, maxTokens: number): Promise<any> {
    // Simulated Gemini response for now
    return {
      architecture: {
        overview: "Modern microservices architecture with event-driven communication",
        patterns: ["Repository", "CQRS", "Event Sourcing", "API Gateway"],
        components: [
          {
            name: "AuthService",
            type: "microservice",
            responsibilities: ["Authentication", "Authorization", "Token management"],
            dependencies: ["DatabaseService", "CacheService"],
            issues: ["Potential race condition in token refresh"]
          }
        ],
        layers: [
          {
            name: "Presentation",
            components: ["WebUI", "MobileAPI"],
            purpose: "User interaction and API exposure"
          }
        ]
      },
      hotspots: [
        {
          type: "security_vulnerability",
          file: "src/auth/token.ts",
          line: 145,
          severity: "high",
          description: "JWT token validation missing expiry check"
        },
        {
          type: "performance_issue",
          file: "src/database/queries.ts",
          line: 89,
          severity: "medium",
          description: "N+1 query problem in user fetching"
        }
      ],
      dependencies: {
        internal: ["auth", "database", "cache", "messaging"],
        external: [
          { name: "express", version: "4.17.1", isOutdated: true },
          { name: "jsonwebtoken", version: "8.5.1", hasVulnerabilities: true }
        ]
      },
      metrics: {
        totalFiles: 156,
        totalLines: 25000,
        complexity: 7.8,
        techDebt: 45,
        maintainabilityIndex: 72
      },
      filesForReview: [
        "src/auth/token.ts",
        "src/database/queries.ts",
        "src/api/routes.ts"
      ]
    };
  }

  private extractHotspots(geminiResult: any): Hotspot[] {
    const hotspots: Hotspot[] = geminiResult.hotspots || [];
    
    // Add complexity scores
    return hotspots.map(h => ({
      ...h,
      complexity: this.calculateHotspotComplexity(h),
      suggestedModel: this.routeHotspotToModel(h.type)
    }));
  }

  private calculateHotspotComplexity(hotspot: any): number {
    const severityScore: Record<string, number> = {
      'low': 2,
      'medium': 4,
      'high': 6,
      'critical': 8
    };
    
    const typeComplexity: Record<string, number> = {
      'syntax_error': 1,
      'type_error': 2,
      'code_duplication': 2,
      'performance_issue': 5,
      'algorithmic_complexity': 7,
      'architectural_smell': 6,
      'security_vulnerability': 8,
      'race_condition': 9
    };
    
    const severity = severityScore[hotspot.severity as string] || 5;
    const type = typeComplexity[hotspot.type as string] || 5;
    
    return (severity + type) / 2;
  }

  private routeHotspotToModel(type: HotspotType): string {
    return this.stages.specialized_verification.models[type] || 'claude-opus-4.1';
  }

  private identifyFilesForReview(
    geminiResult: any,
    hotspots: Hotspot[]
  ): Map<string, string[]> {
    const filesByModel = new Map<string, string[]>();
    
    // Group files by suggested model
    for (const hotspot of hotspots) {
      const model = hotspot.suggestedModel || 'claude-opus-4.1';
      if (!filesByModel.has(model)) {
        filesByModel.set(model, []);
      }
      if (hotspot.file) {
        filesByModel.get(model)!.push(hotspot.file);
      }
    }
    
    // Add general files for review
    const generalFiles = geminiResult.filesForReview || [];
    for (const file of generalFiles) {
      if (!Array.from(filesByModel.values()).flat().includes(file)) {
        const defaultModel = 'claude-opus-4.1';
        if (!filesByModel.has(defaultModel)) {
          filesByModel.set(defaultModel, []);
        }
        filesByModel.get(defaultModel)!.push(file);
      }
    }
    
    return filesByModel;
  }

  private async executeSpecializedAnalysis(
    hotspots: Hotspot[],
    filesForReview: Map<string, string[]>,
    options: ArchitectOptions
  ): Promise<StageResult[]> {
    const tasks = [];
    
    // Create parallel tasks for each model
    for (const [model, files] of filesForReview) {
      const relevantHotspots = hotspots.filter(h => h.suggestedModel === model);
      const tokens = this.allocateTokensForModel(model, relevantHotspots, options);
      
      tasks.push({
        id: `verify_${model}`,
        type: 'verification',
        fn: () => this.verifyWithModel(model, files, relevantHotspots, tokens),
        priority: this.getModelPriority(model),
        timeout: 30000
      });
    }
    
    // Execute in parallel
    const results = await this.batchExecutor.execute(tasks);
    
    // Convert to StageResult format
    return results.map((r: any) => ({
      stage: 'specialized_verification',
      model: r.id.replace('verify_', ''),
      result: r.result,
      tokens: r.result?.tokens || 0,
      duration: r.duration
    }));
  }

  private allocateTokensForModel(
    model: string,
    hotspots: Hotspot[],
    options: ArchitectOptions
  ): number {
    const baseTokens = this.stages.specialized_verification.dynamicTokens.min;
    const maxTokens = this.stages.specialized_verification.dynamicTokens.max;
    
    // Calculate based on hotspot complexity
    const avgComplexity = hotspots.reduce((sum, h) => sum + h.complexity, 0) / (hotspots.length || 1);
    const complexityMultiplier = 1 + (avgComplexity / 10) * 4;
    
    // Depth multiplier
    const depthMultiplier = options.depth === 'deep' ? 2 : options.depth === 'shallow' ? 0.5 : 1;
    
    const allocated = Math.floor(baseTokens * complexityMultiplier * depthMultiplier);
    return Math.min(allocated, maxTokens);
  }

  private getModelPriority(model: string): number {
    const priorities: Record<string, number> = {
      'claude-opus-4.1': 10,
      'qwq-32b': 8,
      'perplexity-reasoning': 7,
      'gpt-4-mini': 5
    };
    return priorities[model] || 5;
  }

  private async verifyWithModel(
    model: string,
    files: string[],
    hotspots: Hotspot[],
    tokens: number
  ): Promise<any> {
    // Simulated model verification
    const prompt = this.buildVerificationPrompt(model, files, hotspots);
    
    return {
      model,
      files: files.length,
      hotspots: hotspots.length,
      findings: [
        {
          type: 'verification',
          confidence: 0.85,
          details: `Analyzed ${files.length} files with ${model}`
        }
      ],
      tokens
    };
  }

  private buildVerificationPrompt(
    model: string,
    files: string[],
    hotspots: Hotspot[]
  ): string {
    let prompt = `Please verify and deep-analyze the following:\n\n`;
    
    prompt += `Files to review:\n`;
    files.forEach(f => prompt += `- ${f}\n`);
    
    prompt += `\nIdentified issues:\n`;
    hotspots.forEach(h => {
      prompt += `- ${h.type} in ${h.file}: ${h.description}\n`;
    });
    
    prompt += `\nProvide detailed analysis and recommendations.`;
    
    return prompt;
  }

  private async executeSynthesis(stageResults: StageResult[]): Promise<StageResult> {
    const startTime = Date.now();
    
    // Use free think tool for synthesis
    const synthesisInput = this.prepareSynthesisInput(stageResults);
    const synthesis = await this.synthesizeWithThink(synthesisInput);
    
    return {
      stage: 'synthesis',
      model: 'think',
      result: synthesis,
      tokens: 0, // Free!
      duration: Date.now() - startTime
    };
  }

  private prepareSynthesisInput(stageResults: StageResult[]): any {
    return {
      geminiAnalysis: stageResults.find(r => r.stage === 'gemini_analysis')?.result,
      verifications: stageResults.filter(r => r.stage === 'specialized_verification')
        .map(r => ({ model: r.model, findings: r.result })),
      totalTokens: stageResults.reduce((sum, r) => sum + r.tokens, 0)
    };
  }

  private async synthesizeWithThink(input: any): Promise<string> {
    // Simulated synthesis
    let synthesis = `## Architecture Analysis Synthesis\n\n`;
    
    synthesis += `### Overview\n`;
    synthesis += `${input.geminiAnalysis?.architecture?.overview || 'Architecture analysis complete'}\n\n`;
    
    synthesis += `### Key Findings\n`;
    synthesis += `- Analyzed ${input.geminiAnalysis?.metrics?.totalFiles || 0} files\n`;
    synthesis += `- Identified ${input.geminiAnalysis?.hotspots?.length || 0} hotspots\n`;
    synthesis += `- Used ${input.verifications?.length || 0} specialized models for verification\n\n`;
    
    synthesis += `### Critical Issues\n`;
    const criticalHotspots = input.geminiAnalysis?.hotspots?.filter((h: any) => h.severity === 'high' || h.severity === 'critical') || [];
    criticalHotspots.forEach((h: any) => {
      synthesis += `- **${h.type}**: ${h.description} (${h.file})\n`;
    });
    
    synthesis += `\n### Recommendations\n`;
    synthesis += `1. Address security vulnerabilities immediately\n`;
    synthesis += `2. Optimize performance bottlenecks\n`;
    synthesis += `3. Update outdated dependencies\n`;
    synthesis += `4. Refactor complex components\n`;
    
    return synthesis;
  }

  private compileFinalResult(
    stageResults: StageResult[],
    hotspots: Hotspot[],
    startTime: number
  ): ArchitectResult {
    const geminiResult = stageResults.find(r => r.stage === 'gemini_analysis')?.result || {};
    const synthesisResult = stageResults.find(r => r.stage === 'synthesis')?.result || '';
    
    const totalTokens = stageResults.reduce((sum, r) => sum + r.tokens, 0);
    const totalCost = this.calculateTotalCost(stageResults);
    
    return {
      architecture: geminiResult.architecture || this.defaultArchitecture(),
      hotspots,
      recommendations: this.generateRecommendations(hotspots, geminiResult),
      dependencies: this.formatDependencyGraph(geminiResult.dependencies),
      metrics: geminiResult.metrics || this.defaultMetrics(),
      synthesis: synthesisResult,
      tokensUsed: totalTokens,
      cost: totalCost
    };
  }

  private calculateTotalCost(stageResults: StageResult[]): number {
    let cost = 0;
    
    for (const result of stageResults) {
      if (result.model === 'gemini-3-pro-preview') {
        cost += (result.tokens / 1000000) * 1.25; // Gemini 3 Pro Preview pricing
      } else if (result.model === 'think') {
        cost += 0; // Free!
      } else {
        cost += this.tokenTracker.calculateCost(result.model, result.tokens);
      }
    }
    
    return cost;
  }

  private generateRecommendations(hotspots: Hotspot[], geminiResult: any): Recommendation[] {
    const recommendations: Recommendation[] = [];
    
    // Security recommendations
    const securityHotspots = hotspots.filter(h => h.type === 'security_vulnerability');
    if (securityHotspots.length > 0) {
      recommendations.push({
        type: 'security',
        priority: 'critical',
        title: 'Address Security Vulnerabilities',
        description: `Found ${securityHotspots.length} security issues that need immediate attention`,
        affectedFiles: securityHotspots.map(h => h.file),
        estimatedEffort: '1-2 days'
      });
    }
    
    // Performance recommendations
    const perfHotspots = hotspots.filter(h => h.type === 'performance_issue');
    if (perfHotspots.length > 0) {
      recommendations.push({
        type: 'performance',
        priority: 'high',
        title: 'Optimize Performance Bottlenecks',
        description: `${perfHotspots.length} performance issues affecting system efficiency`,
        affectedFiles: perfHotspots.map(h => h.file),
        estimatedEffort: '2-3 days'
      });
    }
    
    // Dependency recommendations
    const outdatedDeps = geminiResult.dependencies?.external?.filter((d: any) => d.isOutdated) || [];
    if (outdatedDeps.length > 0) {
      recommendations.push({
        type: 'dependency',
        priority: 'medium',
        title: 'Update Outdated Dependencies',
        description: `${outdatedDeps.length} dependencies need updating`,
        affectedFiles: ['package.json', 'package-lock.json'],
        estimatedEffort: '0.5 days'
      });
    }
    
    return recommendations;
  }

  private formatDependencyGraph(dependencies: any): DependencyGraph {
    if (!dependencies) {
      return this.defaultDependencyGraph();
    }
    
    return {
      nodes: this.extractNodes(dependencies),
      edges: this.extractEdges(dependencies),
      cycles: dependencies.cycles || [],
      externalDeps: dependencies.external || []
    };
  }

  private extractNodes(dependencies: any): DependencyNode[] {
    const nodes: DependencyNode[] = [];
    
    if (dependencies.internal) {
      dependencies.internal.forEach((name: any) => {
        nodes.push({
          id: name,
          name,
          type: 'module',
          complexity: 5
        });
      });
    }
    
    return nodes;
  }

  private extractEdges(dependencies: any): DependencyEdge[] {
    // Would extract from actual dependency analysis
    return [];
  }

  private defaultArchitecture(): ArchitectureSummary {
    return {
      overview: 'Architecture analysis pending',
      patterns: [],
      components: [],
      layers: [],
      concerns: []
    };
  }

  private defaultMetrics(): CodeMetrics {
    return {
      totalFiles: 0,
      totalLines: 0,
      complexity: 0,
      techDebt: 0,
      maintainabilityIndex: 0
    };
  }

  private defaultDependencyGraph(): DependencyGraph {
    return {
      nodes: [],
      edges: [],
      cycles: [],
      externalDeps: []
    };
  }
}