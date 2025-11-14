/**
 * FocusTool Service - Orchestrator for Focus modes
 * Uses Strategy Pattern + Registry + Delegate Map for mode management
 * Phase 2 of SOLID refactoring (reduces 431-line switch statement)
 *
 * Architecture:
 * 1. FocusModeRegistry - For complex extracted modes (FocusDeepMode, TachibotStatusMode)
 * 2. Delegate Map - For simple orchestrator calls
 * 3. Legacy fallback - For modes with complex conditional logic (handled by server.ts)
 */

import { ITool } from '../../../domain/interfaces/ITool.js';
import { FocusModeRegistry } from './FocusModeRegistry.js';
import { FocusResult } from '../../../domain/interfaces/IFocusMode.js';
import type { CollaborativeOrchestrator } from '../../../collaborative-orchestrator.js';
import { TechnicalDomain } from '../../../reasoning-chain.js';

type ModeHandler = (params: Record<string, unknown>) => Promise<string>;

export class FocusToolService implements ITool {
  readonly name = 'focus';
  readonly description = 'Multi-model reasoning with various modes';
  private readonly delegateHandlers: Map<string, ModeHandler>;

  constructor(
    private readonly modeRegistry: FocusModeRegistry,
    private readonly collaborativeOrchestrator: CollaborativeOrchestrator
  ) {
    this.delegateHandlers = this.createDelegateHandlers();
  }

  async execute(params: Record<string, unknown>): Promise<FocusResult> {
    const modeName = params.mode as string || 'simple';

    // 1. Try extracted modes first (Strategy Pattern)
    const mode = this.modeRegistry.get(modeName);
    if (mode) {
      return mode.execute(params);
    }

    // 2. Try delegate handlers (simple orchestrator calls)
    const handler = this.delegateHandlers.get(modeName);
    if (handler) {
      const output = await handler(params);
      return {
        output,
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
      const title = "🧠 **DEEP COLLABORATIVE REASONING**";
      return `${title}\n\n${plan}\n\n🔄 **How it works**: Models collaborate, critique, and build upon each other's ideas to find optimal solutions.`;
    });

    handlers.set('code-brainstorm', async (params) => {
      const query = params.query as string;
      const domain = parseDomain(params.domain);
      const plan = await this.collaborativeOrchestrator.startDeepReasoning(query, domain);
      const title = "💡 **CODE BRAINSTORMING SESSION**";
      return `${title}\n\n${plan}\n\n🔄 **How it works**: Models collaborate, critique, and build upon each other's ideas to find optimal solutions.`;
    });

    // Dynamic debate
    handlers.set('dynamic-debate', async (params) => {
      const query = params.query as string;
      const domain = parseDomain(params.domain);
      const plan = await this.collaborativeOrchestrator.startDynamicDebate(query, domain);
      return `⚔️ **DYNAMIC DEBATE SESSION**\n\n${plan}\n\n🥊 **How it works**: Models take opposing positions, argue their cases, provide rebuttals, and engage in intellectual combat to explore all angles of complex problems.`;
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
