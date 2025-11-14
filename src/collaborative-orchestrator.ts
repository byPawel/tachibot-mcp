import { z } from "zod";
import {
  ReasoningMode,
  TechnicalDomain,
  ReasoningChainConfig,
  ModelResponse,
  REASONING_TEMPLATES,
  MODEL_PERSONAS,
  createReasoningChain
} from "./reasoning-chain.js";
import { sessionLogger, SessionConfig } from "./session/session-logger.js";
import { sessionManager } from "./session/session-manager.js";
import { ToolRouter, ToolCategory } from "./tools/tool-router.js";
import { FastMCP } from "fastmcp";
import {
  HierarchicalMemoryManager,
  getMemoryManager,
  MemoryTier,
  ContextualMemory
} from "./memory/index.js";
import { createProgressStream, createMultiModelReporter } from "./utils/progress-stream.js";
import { modelProviderRegistry } from "./orchestrators/collaborative/registries/ModelProviderRegistry.js";
import { VisualizationService } from "./orchestrators/collaborative/services/visualization/VisualizationService.js";
import { ToolExecutionService } from "./orchestrators/collaborative/services/tool-execution/ToolExecutionService.js";
import type { CollaborationSession, OrchestrationResult } from "./orchestrators/collaborative/types/session-types.js";

/**
 * Collaborative Orchestrator for Multi-Model Reasoning
 * Manages the flow of ideas between different AI models
 */

// Re-export types for backward compatibility
export type { CollaborationSession, OrchestrationResult };

export class CollaborativeOrchestrator {
  private sessions: Map<string, CollaborationSession> = new Map();
  private modelTurnTaking: boolean = true;
  private enableVisualization: boolean = true;
  private modelPreferences: Record<string, string> = {}; // Global model preferences
  private sessionConfig: Partial<SessionConfig> = {
    verbose: false,
    saveSession: false,
    outputFormat: "markdown",
    includeTimestamps: true,
    includeModelMetadata: true
  };
  private toolRouter: ToolRouter;
  private mcpServer: FastMCP | null = null;
  private memoryManager: HierarchicalMemoryManager | null = null;
  private enableMemory: boolean = false;
  private visualizationService: VisualizationService; // Phase 2: Extracted visualization service
  private toolExecutionService: ToolExecutionService; // Phase 4: Extracted tool execution service

  constructor() {
    this.toolRouter = new ToolRouter({
      verboseLogging: false,
      qualityPriority: true,
      fallbackEnabled: true
    });

    // Phase 2: Initialize visualization service
    this.visualizationService = new VisualizationService({
      modelTurnTaking: this.modelTurnTaking,
      enableVisualization: this.enableVisualization
    });

    // Phase 4: Initialize tool execution service
    this.toolExecutionService = new ToolExecutionService({
      toolRouter: this.toolRouter,
      memoryManager: this.memoryManager || undefined, // Convert null to undefined
      enableMemory: this.enableMemory,
      verbose: this.sessionConfig.verbose || false
    });

    // Initialize memory manager if configured
    this.initializeMemory().catch(console.error);
  }

  /**
   * Initialize memory manager
   */
  private async initializeMemory(): Promise<void> {
    try {
      // Check if memory is enabled via environment variable
      if (process.env.ENABLE_MEMORY === 'true' || process.env.MEMORY_PROVIDER) {
        this.memoryManager = await getMemoryManager();
        this.enableMemory = true;
        console.error('🧠 Memory system initialized');
      }
    } catch (error) {
      console.error('Failed to initialize memory:', error);
      this.enableMemory = false;
    }
  }

  /**
   * Set MCP server reference for tool execution
   */
  setMCPServer(server: FastMCP): void {
    this.mcpServer = server;
  }

  /**
   * Configure session logging
   */
  configureSessionLogging(config: Partial<SessionConfig>): void {
    this.sessionConfig = { ...this.sessionConfig, ...config };
  }

  /**
   * Start a Deep Reasoning session - multi-model collaborative thinking
   */
  async startDeepReasoning(
    problem: string,
    domain: TechnicalDomain = TechnicalDomain.ARCHITECTURE,
    modelOverrides?: Record<string, string>,
    sessionOptions?: Partial<SessionConfig>
  ): Promise<string> {
    const template = REASONING_TEMPLATES.deep_reasoning;
    const sessionId = this.generateSessionId();

    // Merge session options
    const config = { ...this.sessionConfig, ...sessionOptions };

    // Start session logging if enabled
    if (config.verbose || config.saveSession) {
      // Update sessionLogger config to match the request config
      sessionLogger.updateConfig({
        saveSession: config.saveSession ?? true,
        verbose: config.verbose ?? false
      });
      await sessionManager.startSession("deep-reasoning", problem, config);
    }

    // Apply model overrides to the chain
    const steps = template.chain.map(step => {
      const model = modelOverrides?.[step.model] || this.modelPreferences[step.model] || step.model;
      return {
        ...step,
        model,
        prompt: step.prompt.replace("{problem}", problem)
      };
    });

    const session: CollaborationSession = {
      id: sessionId,
      domain,
      objective: problem,
      chain: {
        domain,
        objective: problem,
        steps,
        maxRounds: 5
      },
      responses: [],
      currentStep: 0,
      status: "active",
      startTime: new Date(),
      modelOverrides
    };

    this.sessions.set(sessionId, session);

    return this.generateOrchestrationPlan(session);
  }

  /**
   * Start a custom reasoning chain
   */
  async startCustomChain(
    chainConfig: ReasoningChainConfig
  ): Promise<string> {
    const sessionId = this.generateSessionId();

    const session: CollaborationSession = {
      id: sessionId,
      domain: chainConfig.domain,
      objective: chainConfig.objective,
      chain: chainConfig,
      responses: [],
      currentStep: 0,
      status: "active",
      startTime: new Date()
    };

    this.sessions.set(sessionId, session);

    return this.generateOrchestrationPlan(session);
  }

  /**
   * Start a ping-pong brainstorm session
   */
  async startPingPongBrainstorm(
    problem: string,
    domain: TechnicalDomain = TechnicalDomain.ARCHITECTURE,
    sessionOptions?: Partial<SessionConfig>
  ): Promise<string> {
    return this.startTemplateSession("pingpong_brainstorm", problem, domain);
  }

  /**
   * Start a dynamic debate session
   */
  async startDynamicDebate(
    debateTopic: string,
    domain: TechnicalDomain = TechnicalDomain.ARCHITECTURE,
    sessionOptions?: Partial<SessionConfig>
  ): Promise<string> {
    return this.startTemplateSession("dynamic_debate", debateTopic, domain);
  }

  /**
   * Start a template-based reasoning session
   */
  async startTemplateSession(
    templateName: keyof typeof REASONING_TEMPLATES,
    problem: string,
    domain?: TechnicalDomain
  ): Promise<string> {
    const template = REASONING_TEMPLATES[templateName];
    if (!template) {
      throw new Error(`Template ${templateName} not found`);
    }

    const sessionId = this.generateSessionId();
    const actualDomain = domain || TechnicalDomain.ARCHITECTURE;

    const session: CollaborationSession = {
      id: sessionId,
      domain: actualDomain,
      objective: problem,
      chain: {
        domain: actualDomain,
        objective: problem,
        steps: template.chain.map(step => ({
          ...step,
          prompt: step.prompt
            .replace("{problem}", problem)
            .replace("{system}", problem)
            .replace("{algorithm_problem}", problem)
            .replace("{code}", problem)
            .replace("{feature}", problem)
            .replace("{bug_description}", problem)
        })),
        maxRounds: 5
      },
      responses: [],
      currentStep: 0,
      status: "active",
      startTime: new Date(),
      metadata: {
        templateName,
        templateDescription: template.description
      }
    };

    this.sessions.set(sessionId, session);

    return this.generateOrchestrationPlan(session);
  }

  /**
   * Generate visual orchestration plan for a session
   * Phase 2: Delegates to VisualizationService
   */
  private generateOrchestrationPlan(session: CollaborationSession): string {
    return this.visualizationService.generateOrchestrationPlan(session);
  }

  /**
   * Generate TachiBot visualization for the session
   * Phase 2: Delegates to VisualizationService
   */
  private generateTachiBotVisualization(session: CollaborationSession): string {
    return this.visualizationService.generateTachiBotVisualization(session);
  }

  /**
   * Get icon for reasoning mode
   * Phase 2: Delegates to VisualizationService
   */
  private getModeIcon(mode: ReasoningMode): string {
    return this.visualizationService.getModeIcon(mode);
  }

  /**
   * Generate example workflows for different technical domains
   * Phase 2: Delegates to VisualizationService
   */
  getExampleWorkflows(): string {
    return this.visualizationService.getExampleWorkflows();
  }

  /**
   * Get available templates
   * Phase 2: Delegates to VisualizationService
   */
  getAvailableTemplates(): string {
    return this.visualizationService.getAvailableTemplates();
  }

  /**
   * Set global model preferences
   */
  setModelPreferences(preferences: Record<string, string>): void {
    this.modelPreferences = { ...this.modelPreferences, ...preferences };
  }

  /**
   * Use Grok 4 Heavy for all Grok operations
   */
  useGrok4Heavy(): void {
    // Use GROK_4_0709 as the "heavy" model (reasoning model)
    this.modelPreferences['grok'] = 'grok-4-0709';
    this.modelPreferences['grok-4'] = 'grok-4-0709';
  }

  /**
   * Generate session ID
   */
  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get session status
   */
  getSessionStatus(sessionId: string): CollaborationSession | null {
    return this.sessions.get(sessionId) || null;
  }

  /**
   * List active sessions
   */
  listActiveSessions(): string {
    const activeSessions = Array.from(this.sessions.values())
      .filter(s => s.status === "active");

    if (activeSessions.length === 0) {
      return "No active reasoning sessions.";
    }

    let output = `# Active Reasoning Sessions\n\n`;
    activeSessions.forEach(session => {
      output += `- **${session.id}**: ${session.objective} (Step ${session.currentStep}/${session.chain.steps.length})\n`;
    });

    return output;
  }

  /**
   * Execute reasoning chain with session logging
   */
  async executeWithLogging(
    session: CollaborationSession,
    verbose: boolean = false,
    saveSession: boolean = false
  ): Promise<OrchestrationResult> {
    const config = { ...this.sessionConfig, verbose, saveSession };

    // Start session logging
    if (config.verbose || config.saveSession) {
      // Update sessionLogger config to match the request config
      sessionLogger.updateConfig({
        saveSession: config.saveSession ?? true,
        verbose: config.verbose ?? false
      });
      await sessionManager.startSession(
        session.chain.steps[0]?.mode || "reasoning",
        session.objective,
        config
      );
    }

    const modelContributions = new Map<string, string[]>();
    const insights: string[] = [];
    const actionItems: string[] = [];

    // Execute each step in the chain
    for (let i = 0; i < session.chain.steps.length; i++) {
      const step = session.chain.steps[i];
      session.currentStep = i;

      // Log step if verbose
      if (config.verbose) {
        console.error(`\n📍 Step ${i + 1}/${session.chain.steps.length}: ${step.mode}`);
        console.error(`Model: ${step.model}`);
      }

      // Execute real tool instead of simulation
      const response = await this.executeRealTool(step.model, step.prompt, step.mode);

      // Log to session
      if (config.verbose || config.saveSession) {
        await sessionLogger.logStep(
          step.model,
          this.getProviderForModel(step.model),
          step.mode,
          step.prompt,
          response,
          { stepNumber: i + 1 }
        );
      }

      // Store response
      session.responses.push({
        model: step.model,
        content: response,
        reasoning: `Mode: ${step.mode}`
      });

      // Track contributions
      const contributions = modelContributions.get(step.model) || [];
      contributions.push(response);
      modelContributions.set(step.model, contributions);
    }

    // Generate synthesis
    const finalSynthesis = this.generateSynthesis(session.responses);

    // Log synthesis
    if (config.verbose || config.saveSession) {
      await sessionLogger.addSynthesis(finalSynthesis);
      await sessionManager.endSession(config.saveSession);
    }

    session.status = "completed";

    return {
      session,
      finalSynthesis,
      modelContributions,
      consensusScore: this.calculateConsensus(session.responses),
      insights,
      actionItems
    };
  }

  /**
   * Execute real tool based on model and reasoning mode
   * Phase 4: Delegates to ToolExecutionService (extracted 842 lines!)
   */
  private async executeRealTool(
    model: string,
    prompt: string,
    mode: ReasoningMode,
    context?: any
  ): Promise<string> {
    // Update service with current settings
    this.toolExecutionService.setVerbose(this.sessionConfig.verbose || false);

    // Delegate to tool execution service
    return await this.toolExecutionService.executeRealTool(model, prompt, mode, context);
  }

  /**
   * Set memory context for the session
   */
  setMemoryContext(context: {
    projectId?: string;
    userId?: string;
    teamId?: string;
  }): void {
    if (this.memoryManager) {
      this.memoryManager.setContext(context);
    }
  }

  /**
   * Get memory metrics
   */
  async getMemoryMetrics(): Promise<any> {
    if (!this.memoryManager) return null;
    return await this.memoryManager.getMetrics();
  }

  /**
   * Get provider name for a model
   */
  private getProviderForModel(model: string): string {
    if (model.startsWith('gpt')) return 'openai';
    if (model.startsWith('claude')) return 'anthropic';
    if (model.startsWith('gemini')) return 'google';
    if (model.startsWith('grok')) return 'xai';
    if (model.startsWith('kimi')) return 'moonshot';
    if (model.includes('perplexity')) return 'perplexity';
    return 'unknown';
  }

  /**
   * Generate synthesis from model responses
   */
  private generateSynthesis(responses: ModelResponse[]): string {
    if (responses.length === 0) return '';

    // Simple synthesis - combine all responses
    const combined = responses.map((r, i) =>
      `### ${i + 1}. ${r.model}\n\n${r.content}`
    ).join('\n\n---\n\n');

    return `# Synthesis of ${responses.length} Model Responses\n\n${combined}`;
  }

  /**
   * Calculate consensus score from responses
   */
  private calculateConsensus(responses: ModelResponse[]): number {
    if (responses.length < 2) return 1.0;

    // Simple consensus score based on response similarity
    // For now, return a fixed score - can be enhanced later
    return 0.85;
  }
}

// Export singleton instance
export const collaborativeOrchestrator = new CollaborativeOrchestrator();
