/**
 * FocusTool Service - Orchestrator for Focus modes
 * Uses Strategy Pattern + Registry + Delegate Map for mode management
 * Phase 2 of SOLID refactoring (reduces 431-line switch statement)
 *
 * Architecture:
 * 1. FocusModeRegistry - For complex extracted modes (FocusDeepMode, TachibotStatusMode)
 * 2. Delegate Map - For simple orchestrator calls
 * 3. FocusExecutionService - For executeNow mode (actual model execution)
 * 4. Legacy fallback - For modes with complex conditional logic (handled by server.ts)
 */

import { ITool } from '../../../domain/interfaces/ITool.js';
import { FocusModeRegistry } from './FocusModeRegistry.js';
import { FocusResult } from '../../../domain/interfaces/IFocusMode.js';
import type { CollaborativeOrchestrator } from '../../../collaborative-orchestrator.js';
import { TechnicalDomain } from '../../../reasoning-chain.js';
import { stripFormatting } from '../../../utils/format-stripper.js';
import { FocusExecutionService } from './FocusExecutionService.js';
// import { renderBigText } from '../../../utils/ink-renderer.js';

type ModeHandler = (params: Record<string, unknown>) => Promise<string>;

export class FocusToolService implements ITool {
  readonly name = 'focus';
  readonly description = 'Multi-model reasoning with various modes';
  private readonly delegateHandlers: Map<string, ModeHandler>;
  private executionService: FocusExecutionService | null = null;

  constructor(
    private readonly modeRegistry: FocusModeRegistry,
    private readonly collaborativeOrchestrator: CollaborativeOrchestrator,
    executionService?: FocusExecutionService
  ) {
    this.delegateHandlers = this.createDelegateHandlers();
    this.executionService = executionService || null;
  }

  /**
   * Set the execution service (for lazy initialization)
   */
  setExecutionService(service: FocusExecutionService): void {
    this.executionService = service;
  }

  async execute(params: Record<string, unknown>): Promise<FocusResult> {
    const modeName = params.mode as string || 'simple';
    const executeNow = params.executeNow !== false; // Default to true

    // BigText header disabled - plain text only
    const header = '';

    // 0. For focus-deep mode with executeNow, use the execution service
    if (modeName === 'focus-deep' && executeNow && this.executionService) {
      const result = await this.executionService.startFocusSession({
        query: params.query as string,
        mode: modeName,
        domain: params.domain as string | undefined,
        context: params.context as string | undefined,
        rounds: params.rounds as number | undefined,
        models: params.models as string[] | undefined,
        temperature: params.temperature as number | undefined,
        maxTokensPerRound: params.maxTokensPerRound as number | undefined,
        pingPongStyle: params.pingPongStyle as 'competitive' | 'collaborative' | 'debate' | 'build-upon' | undefined,
        tokenEfficient: params.tokenEfficient as boolean | undefined,
        saveSession: params.saveSession as boolean | undefined,
      });

      return {
        output: stripFormatting(header + result.output),
        metadata: {
          mode: modeName,
          sessionId: result.sessionId,
          status: result.status,
          progress: result.progress,
          hasMoreSteps: result.hasMoreSteps,
          totalSteps: result.totalSteps,
          currentStep: result.currentStep,
          timestamp: Date.now()
        }
      };
    }

    // 1. Try extracted modes first (Strategy Pattern)
    // For focus-deep with executeNow: false, this returns the plan visualization
    const mode = this.modeRegistry.get(modeName);
    if (mode) {
      // Pass executeNow to the mode for conditional behavior
      const result = await mode.execute({ ...params, executeNow });
      return {
        ...result,
        output: stripFormatting(header + result.output)
      };
    }

    // 2. Try delegate handlers (simple orchestrator calls)
    const handler = this.delegateHandlers.get(modeName);
    if (handler) {
      const output = await handler(params);
      return {
        output: stripFormatting(header + output),
        metadata: {
          mode: modeName,
          timestamp: Date.now()
        }
      };
    }

    // 3. Mode not found in service - fallback to legacy server.ts
    // This allows gradual migration of complex conditional modes
    throw new Error(
      `Mode "${modeName}" not handled by FocusToolService. ` +
      `Available: [${[...this.modeRegistry.getAllNames(), ...this.delegateHandlers.keys()].join(', ')}]`
    );
  }

  validate(params: Record<string, unknown>): boolean {
    const mode = params.mode;
    return typeof mode === 'string' && mode.length > 0;
  }

  /**
   * Create delegate handlers for simple orchestrator modes
   * These modes just call a single collaborativeOrchestrator method
   */
  private createDelegateHandlers(): Map<string, ModeHandler> {
    const handlers = new Map<string, ModeHandler>();

    // Helper to parse domain parameter
    const parseDomain = (domainParam: unknown): any => {
      if (!domainParam || typeof domainParam !== 'string') {
        return TechnicalDomain.ARCHITECTURE; // Default fallback
      }
      const domainKey = domainParam.toUpperCase();
      return TechnicalDomain[domainKey as keyof typeof TechnicalDomain] || TechnicalDomain.ARCHITECTURE;
    };

    // Deep reasoning & code brainstorming
    handlers.set('deep-reasoning', async (params) => {
      const query = params.query as string;
      const domain = parseDomain(params.domain);
      const plan = await this.collaborativeOrchestrator.startDeepReasoning(query, domain);
      return `🧠 DEEP COLLABORATIVE REASONING\n${'═'.repeat(40)}\n\n${plan}\n\n🔄 How it works: Models collaborate, critique, and build upon each other's ideas to find optimal solutions.`;
    });

    handlers.set('code-brainstorm', async (params) => {
      const query = params.query as string;
      const domain = parseDomain(params.domain);
      const plan = await this.collaborativeOrchestrator.startDeepReasoning(query, domain);
      return `💡 CODE BRAINSTORMING SESSION\n${'═'.repeat(40)}\n\n${plan}\n\n🔄 How it works: Models collaborate, critique, and build upon each other's ideas to find optimal solutions.`;
    });

    // Dynamic debate
    handlers.set('dynamic-debate', async (params) => {
      const query = params.query as string;
      const domain = parseDomain(params.domain);
      const plan = await this.collaborativeOrchestrator.startDynamicDebate(query, domain);
      return `⚔️ DYNAMIC DEBATE SESSION\n${'═'.repeat(40)}\n\n${plan}\n\n🥊 How it works: Models take opposing positions, argue their cases, provide rebuttals, and engage in intellectual combat to explore all angles of complex problems.`;
    });

    // Template-based modes
    const templateModes: Array<[string, string]> = [
      ['architecture-debate', 'architecture_debate'],
      ['algorithm-optimize', 'algorithm_optimize'],
      ['security-audit', 'security_audit'],
      ['api-design', 'api_design'],
      ['debug-detective', 'debug_detective'],
      ['performance-council', 'performance_council']
    ];

    for (const [modeName, templateKey] of templateModes) {
      handlers.set(modeName, async (params) => {
        const query = params.query as string;
        const domain = parseDomain(params.domain);
        return await this.collaborativeOrchestrator.startTemplateSession(
          templateKey as any,
          query,
          domain
        );
      });
    }

    // Simple utility modes
    handlers.set('list-templates', async () => {
      return this.collaborativeOrchestrator.getAvailableTemplates();
    });

    handlers.set('examples', async () => {
      return this.collaborativeOrchestrator.getExampleWorkflows();
    });

    return handlers;
  }
}
