import { ToolResult } from './types.js';

/**
 * Enhanced context for prompt engineering
 * Phase 3: Makes prompts workflow-aware and context-sensitive
 */
export interface EnhancementContext {
  // Workflow state
  stepNumber?: number;
  totalSteps?: number;
  workflowName?: string;

  // Step history for context
  previousSteps?: Array<{
    name: string;
    output: string;
    technique?: string;
  }>;

  // Workflow variables
  workflowVariables?: Record<string, any>;

  // Model being used
  targetModel?: string;
}

/**
 * Model profile for tool-specific optimization
 */
interface ModelProfile {
  patterns: string[];  // Regex patterns to match model name
  strengths: string[];
  promptStyle: 'structured' | 'creative' | 'concise' | 'detailed';
  contextWindow: number;
  prefix?: string;  // Optional prefix to add
  suffix?: string;  // Optional suffix to add
}

export class PromptEngineer {
  private techniques: Map<string, PromptTechniqueHandler>;
  private modelProfiles: Map<string, ModelProfile>;

  constructor() {
    this.techniques = new Map();
    this.modelProfiles = new Map();
    this.initializeTechniques();
    this.initializeModelProfiles();
  }

  /**
   * Initialize model profiles for better prompt adaptation
   */
  private initializeModelProfiles() {
    // OpenAI models - structured, reasoning-focused
    this.modelProfiles.set('openai', {
      patterns: ['^gpt', '^o1', '^o3'],
      strengths: ['reasoning', 'structured-output', 'code-generation'],
      promptStyle: 'structured',
      contextWindow: 128000,
      suffix: '\n\nProvide a well-structured response with clear reasoning steps.'
    });

    // Gemini - creative, multimodal
    this.modelProfiles.set('gemini', {
      patterns: ['^gemini'],
      strengths: ['creativity', 'analysis', 'long-context'],
      promptStyle: 'creative',
      contextWindow: 1000000,
      suffix: '\n\nBe creative and think outside conventional boundaries.'
    });

    // Perplexity - research, factual
    this.modelProfiles.set('perplexity', {
      patterns: ['perplexity', 'sonar'],
      strengths: ['research', 'fact-checking', 'citations'],
      promptStyle: 'concise',
      contextWindow: 127000,
      suffix: '\n\nFocus on finding concrete data, statistics, and credible sources with citations.'
    });

    // Grok - reasoning, analysis
    this.modelProfiles.set('grok', {
      patterns: ['^grok'],
      strengths: ['reasoning', 'analysis', 'humor'],
      promptStyle: 'detailed',
      contextWindow: 131072,
      suffix: '\n\nProvide detailed analysis with clear reasoning and practical insights.'
    });

    // Moonshot Kimi - long context, Chinese/English
    this.modelProfiles.set('moonshot', {
      patterns: ['^kimi', '^moonshot'],
      strengths: ['long-context', 'bilingual', 'thinking'],
      promptStyle: 'structured',
      contextWindow: 1000000,
      suffix: '\n\nThink step-by-step and provide comprehensive analysis.'
    });

    // Claude - balanced, helpful
    this.modelProfiles.set('claude', {
      patterns: ['^claude'],
      strengths: ['reasoning', 'safety', 'helpfulness'],
      promptStyle: 'structured',
      contextWindow: 200000,
      suffix: '\n\nProvide clear, helpful analysis with attention to nuance.'
    });

    // Think MCP - metacognitive
    this.modelProfiles.set('think', {
      patterns: ['^think'],
      strengths: ['metacognition', 'reasoning', 'reflection'],
      promptStyle: 'structured',
      contextWindow: 32000
    });
  }

  private initializeTechniques() {
    // Creative techniques
    this.techniques.set('what_if_speculation', {
      apply: (query: string) => [
        `What if we approached "${query}" from a completely different angle?`,
        `Imagine a world where the constraints of "${query}" don't exist. What becomes possible?`,
        `What if the opposite of what we assume about "${query}" were true?`,
        `Consider the most ambitious version of solving "${query}". What would that look like?`
      ].join('\n\n')
    });

    this.techniques.set('alternative_perspectives', {
      apply: (query: string) => [
        `Analyze "${query}" from these different perspectives:`,
        `1. From a child's innocent viewpoint`,
        `2. From a skeptical scientist's perspective`,
        `3. From an artist's creative lens`,
        `4. From a business strategist's angle`,
        `5. From a futurist's vision`,
        `What unique insights does each perspective reveal?`
      ].join('\n')
    });

    this.techniques.set('creative_applications', {
      apply: (query: string, context?: string) => {
        const basePrompt = `Given ${context ? `the research findings about "${query}"` : `"${query}"`}, `;
        return basePrompt + [
          `brainstorm creative applications across different domains:`,
          `- How could this transform education?`,
          `- What entertainment possibilities does this open?`,
          `- How might this revolutionize healthcare?`,
          `- What environmental benefits could emerge?`,
          `- How could this enhance human creativity?`,
          `Think beyond obvious applications.`
        ].join('\n');
      }
    });

    this.techniques.set('innovative_solutions', {
      apply: (query: string) => [
        `Generate creative, unconventional solutions for "${query}".`,
        `Think creatively and explore multiple angles:`,
        `- How can existing processes be rethought or redesigned?`,
        `- What inspiration can we draw from other industries or domains?`,
        `- What becomes possible if we remove typical constraints?`,
        `- How might different methods or approaches be combined?`,
        `Provide at least 3 novel, practical approaches with clear reasoning.`
      ].join('\n')
    });

    // Research techniques
    this.techniques.set('comprehensive_investigation', {
      apply: (query: string) => [
        `Conduct a comprehensive investigation of "${query}" addressing:`,
        `WHO: Key players, stakeholders, and affected parties`,
        `WHAT: Core components, mechanisms, and definitions`,
        `WHEN: Timeline, historical context, and future projections`,
        `WHERE: Geographic relevance, applicable domains, and contexts`,
        `WHY: Root causes, motivations, and underlying principles`,
        `HOW: Processes, methods, and implementation details`,
        `Include recent developments, controversies, and expert opinions.`
      ].join('\n')
    });

    this.techniques.set('evidence_gathering', {
      apply: (query: string, context?: string) => {
        const focus = context ? `Based on the analysis of "${query}"` : `For "${query}"`;
        return [
          `${focus}, gather evidence to:`,
          `1. Support the main hypothesis or approach`,
          `2. Challenge assumptions with contradicting data`,
          `3. Find real-world case studies and examples`,
          `4. Identify statistical trends and patterns`,
          `5. Discover expert opinions and research papers`,
          `Prioritize recent, credible sources.`
        ].join('\n');
      }
    });

    // Analytical techniques
    this.techniques.set('systematic_analysis', {
      apply: (query: string, context?: string) => {
        const intro = context ? `Building on the research about "${query}"` : `Analyzing "${query}"`;
        return [
          `${intro}, provide a systematic analysis:`,
          `1. Break down the core components`,
          `2. Examine relationships and dependencies`,
          `3. Identify patterns and anomalies`,
          `4. Evaluate strengths and weaknesses`,
          `5. Assess risks and opportunities`,
          `6. Draw logical conclusions`,
          `Use structured reasoning and clear logic chains.`
        ].join('\n');
      }
    });

    this.techniques.set('first_principles', {
      apply: (query: string) => [
        `Apply first principles thinking to "${query}":`,
        `1. What are the fundamental truths we know for certain?`,
        `2. What assumptions are we making that might not be true?`,
        `3. If we built this from scratch, knowing only basic principles, what would we create?`,
        `4. What are the atomic units that cannot be broken down further?`,
        `5. How can we reconstruct a solution from these basic elements?`,
        `Challenge every assumption and rebuild from the ground up.`
      ].join('\n')
    });

    this.techniques.set('feasibility_analysis', {
      apply: (query: string, context?: string) => {
        const ideas = context ? `the creative ideas generated for "${query}"` : `"${query}"`;
        return [
          `Evaluate the feasibility of ${ideas} considering:`,
          `1. Technical feasibility: Can it be built with current/near-future technology?`,
          `2. Economic viability: Cost-benefit analysis and ROI potential`,
          `3. Time requirements: Realistic timeline for implementation`,
          `4. Resource needs: Human, financial, and material resources`,
          `5. Risk assessment: What could go wrong and mitigation strategies`,
          `6. Success metrics: How would we measure achievement?`,
          `Rank options by overall feasibility score.`
        ].join('\n');
      }
    });

    // Reflective techniques
    this.techniques.set('quick_reflection', {
      apply: (query: string, context?: string) => {
        const prompt = context ? 
          `Reflect on the insights gathered so far about "${query}":` :
          `Take a moment to reflect on "${query}":`;
        return [
          prompt,
          `- What patterns are emerging?`,
          `- What surprises or contradictions do we see?`,
          `- What's the most important insight so far?`,
          `- What questions remain unanswered?`,
          `- What should we explore next?`
        ].join('\n');
      }
    });

    this.techniques.set('pattern_recognition', {
      apply: (query: string, context?: string) => {
        const data = context ? `the research on "${query}"` : `"${query}"`;
        return [
          `Identify patterns and connections in ${data}:`,
          `1. Recurring themes across different sources`,
          `2. Cause-and-effect relationships`,
          `3. Cyclical or temporal patterns`,
          `4. Structural similarities to other domains`,
          `5. Anomalies that break expected patterns`,
          `What do these patterns reveal about the underlying system?`
        ].join('\n');
      }
    });

    this.techniques.set('problem_decomposition', {
      apply: (query: string) => [
        `Break down "${query}" into manageable components:`,
        `1. What is the core problem we're trying to solve?`,
        `2. What are the sub-problems that make up this challenge?`,
        `3. Which components are dependent on others?`,
        `4. What constraints limit our options?`,
        `5. What resources do we have available?`,
        `6. What would a step-by-step solution look like?`,
        `Create a clear problem hierarchy.`
      ].join('\n')
    });

    this.techniques.set('integration_reflection', {
      apply: (query: string, context?: string) => [
        `Synthesize all perspectives on "${query}" into unified insights:`,
        `1. What are the convergent themes across all analyses?`,
        `2. Where do different approaches complement each other?`,
        `3. What contradictions need to be resolved?`,
        `4. What is the meta-pattern that emerges?`,
        `5. What is the single most important takeaway?`,
        `Create a coherent narrative that incorporates all viewpoints.`
      ].join('\n')
    });

    // Default technique
    this.techniques.set('default', {
      apply: (query: string) => query
    });
  }

  /**
   * Apply prompt engineering technique with enhanced context
   *
   * @param tool - Tool/model name (e.g., 'gemini_brainstorm', 'perplexity_research')
   * @param technique - Technique to apply (e.g., 'first_principles', 'systematic_analysis')
   * @param query - Original query/prompt
   * @param previousResults - Legacy: Array of previous tool results (deprecated, use enhancementContext)
   * @param enhancementContext - NEW: Rich workflow context for better prompt adaptation
   */
  applyTechnique(
    tool: string,
    technique: string,
    query: string,
    previousResults?: ToolResult[],
    enhancementContext?: EnhancementContext
  ): string {
    const handler = this.techniques.get(technique) || this.techniques.get('default')!;

    // Extract context - use new context if available, otherwise legacy
    let context: string | undefined;

    if (enhancementContext && enhancementContext.previousSteps && enhancementContext.previousSteps.length > 0) {
      // NEW: Smart context extraction from workflow state
      context = this.extractWorkflowContext(enhancementContext);
    } else if (previousResults && previousResults.length > 0) {
      // LEGACY: Simple context extraction from results
      const recentResult = previousResults[previousResults.length - 1];
      context = this.extractRelevantContext(recentResult.output);
    }

    // Apply the technique with context
    const enhancedPrompt = handler.apply(query, context);

    // Add workflow progress indicator if available
    let promptWithContext = enhancedPrompt;
    if (enhancementContext?.stepNumber && enhancementContext?.totalSteps) {
      const progress = `[Workflow Step ${enhancementContext.stepNumber}/${enhancementContext.totalSteps}]`;
      promptWithContext = `${progress}\n\n${enhancedPrompt}`;
    }

    // Add tool-specific modifications using model profiles
    return this.adaptPromptForModel(tool, promptWithContext, query, enhancementContext);
  }

  /**
   * Extract context from workflow state (NEW - Phase 3)
   * Smarter than legacy extractRelevantContext()
   */
  private extractWorkflowContext(context: EnhancementContext): string {
    if (!context.previousSteps || context.previousSteps.length === 0) {
      return '';
    }

    const insights: string[] = [];

    // Get last 2-3 steps for recency
    const recentSteps = context.previousSteps.slice(-3);

    for (const step of recentSteps) {
      // Extract key insights using patterns
      const stepInsights = this.extractKeyInsights(step.output);
      if (stepInsights) {
        insights.push(`**From ${step.name}:**\n${stepInsights}`);
      }
    }

    // Add workflow variables if relevant
    if (context.workflowVariables && Object.keys(context.workflowVariables).length > 0) {
      const vars = Object.entries(context.workflowVariables)
        .slice(0, 3)  // Top 3 most relevant
        .map(([k, v]) => `${k}: ${v}`)
        .join(', ');
      insights.push(`**Context:** ${vars}`);
    }

    return insights.join('\n\n');
  }

  /**
   * Smart insight extraction using patterns
   * Extracts: conclusions, key findings, numbers, entities
   */
  private extractKeyInsights(output: string): string {
    const lines = output.split('\n').filter(line => line.trim());
    const insights: string[] = [];

    // Pattern 1: Look for conclusion/summary sections
    const summaryIndex = lines.findIndex(line =>
      /summary|conclusion|key findings|takeaways|insights/i.test(line)
    );
    if (summaryIndex >= 0 && summaryIndex < lines.length - 1) {
      // Get 2-3 lines after summary header
      const summaryLines = lines.slice(summaryIndex + 1, summaryIndex + 4)
        .filter(l => l.trim().length > 20);  // Meaningful lines only
      insights.push(...summaryLines);
    }

    // Pattern 2: Extract bullet points (likely key findings)
    const bullets = lines.filter(line =>
      /^[-*•]\s+/.test(line.trim()) && line.length > 30
    ).slice(0, 3);  // Top 3 bullets
    insights.push(...bullets);

    // Pattern 3: Extract numbered findings
    const numberedFindings = lines.filter(line =>
      /^\d+\.\s+/.test(line.trim()) && line.length > 30
    ).slice(0, 3);
    insights.push(...numberedFindings);

    // Pattern 4: Extract key metrics/numbers
    const metricsLines = lines.filter(line =>
      /\d+%|\$\d+|increase|decrease|improvement/i.test(line) && line.length > 20
    ).slice(0, 2);
    insights.push(...metricsLines);

    // Deduplicate and limit
    const uniqueInsights = [...new Set(insights)].slice(0, 5);

    return uniqueInsights.length > 0
      ? uniqueInsights.join('\n')
      : lines.slice(0, 3).join('\n');  // Fallback to first 3 lines
  }

  private extractRelevantContext(output: string): string {
    // Extract key insights or summary from previous output
    // Simple implementation - can be enhanced
    const lines = output.split('\n').filter(line => line.trim());
    
    // Look for summary sections
    const summaryIndex = lines.findIndex(line => 
      line.toLowerCase().includes('summary') || 
      line.toLowerCase().includes('key') ||
      line.toLowerCase().includes('conclusion')
    );
    
    if (summaryIndex >= 0) {
      return lines.slice(summaryIndex, summaryIndex + 5).join('\n');
    }
    
    // Otherwise, take first few meaningful lines
    return lines.slice(0, 3).join('\n');
  }

  /**
   * Adapt prompt for specific model using model profiles (NEW - Phase 3)
   * Replaces hardcoded adaptPromptForTool() with intelligent model matching
   */
  private adaptPromptForModel(
    tool: string,
    prompt: string,
    originalQuery: string,
    context?: EnhancementContext
  ): string {
    // Find matching model profile
    const profileEntry = Array.from(this.modelProfiles.entries()).find(([_key, profile]) =>
      profile.patterns.some(pattern => new RegExp(pattern, 'i').test(tool))
    );

    if (!profileEntry) {
      // No profile found - return as-is
      return prompt;
    }

    const [profileName, profile] = profileEntry;
    let adaptedPrompt = prompt;

    // Add prefix if specified
    if (profile.prefix) {
      adaptedPrompt = `${profile.prefix}\n\n${adaptedPrompt}`;
    }

    // Add suffix if specified
    if (profile.suffix) {
      adaptedPrompt = `${adaptedPrompt}${profile.suffix}`;
    }

    // Add context window hint for long-context models
    if (profile.contextWindow > 500000 && context?.previousSteps && context.previousSteps.length > 3) {
      adaptedPrompt = `[Long-context mode enabled]\n\n${adaptedPrompt}`;
    }

    return adaptedPrompt;
  }

  /**
   * Legacy method for backwards compatibility
   * @deprecated Use adaptPromptForModel() instead
   */
  private adaptPromptForTool(tool: string, prompt: string, originalQuery: string): string {
    return this.adaptPromptForModel(tool, prompt, originalQuery);
  }

  // Get a human-readable description of the current technique
  getTechniqueDescription(technique: string): string {
    const descriptions: Record<string, string> = {
      what_if_speculation: 'Exploring "What if..." possibilities',
      alternative_perspectives: 'Viewing from multiple angles',
      creative_applications: 'Finding innovative uses',
      innovative_solutions: 'Generating novel approaches',
      comprehensive_investigation: 'Deep systematic research',
      evidence_gathering: 'Finding supporting data',
      systematic_analysis: 'Structured examination',
      first_principles: 'Fundamental truth analysis',
      feasibility_analysis: 'Practical evaluation',
      quick_reflection: 'Pattern recognition',
      pattern_recognition: 'Identifying connections',
      problem_decomposition: 'Breaking down complexity',
      integration_reflection: 'Synthesizing insights'
    };
    
    return descriptions[technique] || technique;
  }
}

interface PromptTechniqueHandler {
  apply: (query: string, context?: string) => string;
}