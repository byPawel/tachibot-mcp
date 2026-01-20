/**
 * Sequential Thinking Implementation
 * Based on the official MCP Sequential Thinking server
 * Enhanced with multi-model orchestration capabilities
 */

import { z } from "zod";
import { randomBytes } from "crypto";
import { ToolExecutionService } from "./orchestrators/collaborative/services/tool-execution/ToolExecutionService.js";
import { ReasoningMode } from "./reasoning-chain.js";
import { isModelAvailable, getAvailableModelNames } from "./utils/model-availability.js";
import { formatMemorySaveHint, MemorySaveData, MemorySaveHint } from "./utils/memory-provider.js";
import { stripFormatting } from "./utils/format-stripper.js";
import { FORMAT_INSTRUCTION } from "./utils/format-constants.js";
// import { icon } from "./utils/ink-renderer.js";
// Ink disabled - using plain emojis instead
const icon = (name: string): string => {
  const icons: Record<string, string> = {
    search: '🔍',
    wrench: '🔧',
    target: '🎯',
    sparkle: '✨',
    lightbulb: '💡',
  };
  return icons[name] || '•';
};

export interface Thought {
  number: number;
  content: string;
  model?: string;
  timestamp: Date;
  isRevision?: boolean;
  revisesThought?: number;
  branchFromThought?: number;
  confidence?: number;
  metadata?: Record<string, any>;
  modelResponse?: string; // Response from executed model tool
}

/**
 * Distilled context structure for efficient MCP tool calls
 * Transforms raw thought dumps into structured, token-efficient context
 */
export interface DistilledContext {
  task: string;              // Current prompt/objective
  constraints: string[];     // Rules extracted from session objective
  workingMemory: {
    keyInsights: string[];   // Important findings from thoughts
    decisions: string[];     // What was decided
    openQuestions: string[]; // Unresolved items
  };
  tokenEstimate: number;     // Approximate token count
}

/**
 * Distillation mode for context compression
 * - "off": No distillation, raw context (default)
 * - "light": Light distillation, preserves details (5 items, 200 char limit)
 */
export type DistillationMode = "off" | "light";

/**
 * Context window aliases for better DX
 * - "none": No previous context (fresh start)
 * - "recent": Last 3 thoughts (default)
 * - "all": All thoughts (for final judge/synthesis)
 */
export type ContextWindowAlias = "none" | "recent" | "all";
export type ContextWindow = number | ContextWindowAlias;

/** Map string aliases to numeric values */
const CONTEXT_WINDOW_MAP: Record<ContextWindowAlias, number> = {
  none: 0,
  recent: 3,
  all: -1,
};

/** Resolve context window value (string alias or number) to number */
export function resolveContextWindow(value: ContextWindow | undefined): number {
  if (value === undefined) return 3; // default: recent
  if (typeof value === "string") {
    return CONTEXT_WINDOW_MAP[value] ?? 3;
  }
  return value;
}

/** Reverse map: numeric values to string aliases */
const CONTEXT_WINDOW_REVERSE_MAP: Record<number, ContextWindowAlias> = {
  0: "none",
  3: "recent",
  [-1]: "all",
};

/** Format context window value for display (number -> friendly string) */
export function formatContextWindow(value: number): string {
  return CONTEXT_WINDOW_REVERSE_MAP[value] ?? String(value);
}

/**
 * Memory provider configuration for pluggable memory MCPs
 * Supports devlog-mcp, mem0, or any custom memory MCP
 */
export interface MemoryProviderConfig {
  provider: string;           // e.g., "devlog", "mem0", "custom"
  saveToMemory?: boolean;     // Auto-save session to memory on complete
  loadFromMemory?: boolean;   // Load relevant context from memory
}

/**
 * Enhanced options for nextThought with model execution
 */
export interface NextThoughtOptions {
  thought: string;
  nextThoughtNeeded: boolean;
  thoughtNumber?: number;
  totalThoughts?: number;
  isRevision?: boolean;
  revisesThought?: number;
  branchFromThought?: number;
  model?: string;
  executeModel?: boolean;      // Actually call the model's tool
  contextWindow?: ContextWindow;  // "none" (0), "recent" (3), "all" (-1), or a number
  objective?: string;          // For auto-session creation
  distillContext?: DistillationMode;  // Distillation mode: "off" (default), "light"
  finalJudge?: string;         // Model to use as final judge when nextThoughtNeeded=false (e.g., "gemini")
  memoryProvider?: MemoryProviderConfig;  // Pluggable memory MCP integration
}

/**
 * Enhanced result from nextThought with model response
 */
export interface NextThoughtEnhancedResult {
  thoughtAdded: Thought;
  sessionStatus: ThinkingSession;
  guidance: string;
  modelResponse?: string;      // Actual response from model (if executeModel=true)
  availableModels?: string[];  // Dynamic list of available models
  distilledContext?: DistilledContext; // Structured context if distillContext=true
  finalJudgeResponse?: string; // Response from final judge model (if finalJudge set and session complete)
  memorySaveHint?: MemorySaveHint; // Hint for Claude to save to memory (Claude calls the tool, not tachibot)
}

export interface ThinkingSession {
  id: string;
  thoughts: Thought[];
  currentThought: number;
  totalThoughts: number;
  status: "active" | "completed" | "branched";
  branches?: ThinkingSession[];
  context?: string;
  objective?: string;
}

/** Context window value to include ALL thoughts (no limit) */
const ALL_THOUGHTS = -1;

export class SequentialThinking {
  private sessions: Map<string, ThinkingSession> = new Map();
  private currentSessionId: string | null = null;

  /**
   * Start a new sequential thinking session
   */
  startSession(objective: string, estimatedThoughts: number = 5): string {
    const sessionId = this.generateSessionId();
    const session: ThinkingSession = {
      id: sessionId,
      thoughts: [],
      currentThought: 0,
      totalThoughts: estimatedThoughts,
      status: "active",
      objective
    };
    
    this.sessions.set(sessionId, session);
    this.currentSessionId = sessionId;
    
    return sessionId;
  }

  /**
   * Add a next thought to the session
   */
  nextThought(
    thought: string,
    nextThoughtNeeded: boolean,
    thoughtNumber?: number,
    totalThoughts?: number,
    isRevision?: boolean,
    revisesThought?: number,
    branchFromThought?: number,
    model?: string
  ): { 
    thoughtAdded: Thought; 
    sessionStatus: ThinkingSession;
    guidance: string;
  } {
    const session = this.getCurrentSession();
    if (!session) {
      throw new Error("No active thinking session");
    }

    // Handle branching
    if (branchFromThought !== undefined) {
      return this.branchThinking(session, thought, branchFromThought, model);
    }

    // Create the thought object
    const newThought: Thought = {
      number: thoughtNumber || session.currentThought + 1,
      content: thought,
      model: model || "default",
      timestamp: new Date(),
      isRevision,
      revisesThought
    };

    // Handle revision
    if (isRevision && revisesThought !== undefined) {
      // Mark the original thought as revised
      const originalThought = session.thoughts.find(t => t.number === revisesThought);
      if (originalThought) {
        originalThought.metadata = {
          ...originalThought.metadata,
          revisedBy: newThought.number
        };
      }
    }

    // Add the thought
    session.thoughts.push(newThought);
    session.currentThought = newThought.number;

    // Update total thoughts if provided
    if (totalThoughts !== undefined) {
      session.totalThoughts = totalThoughts;
    }

    // Check if we're done
    if (!nextThoughtNeeded) {
      session.status = "completed";
    }

    // Generate guidance for next step
    const guidance = this.generateGuidance(session, nextThoughtNeeded);

    return {
      thoughtAdded: newThought,
      sessionStatus: session,
      guidance
    };
  }

  /**
   * Branch the thinking into an alternative path
   */
  private branchThinking(
    session: ThinkingSession,
    thought: string,
    branchFromThought: number,
    model?: string
  ): any {
    // Create a new branch session
    const branchId = `${session.id}_branch_${Date.now()}`;
    
    // Copy thoughts up to branch point
    const branchSession: ThinkingSession = {
      id: branchId,
      thoughts: session.thoughts
        .filter(t => t.number <= branchFromThought)
        .map(t => ({...t})),
      currentThought: branchFromThought,
      totalThoughts: session.totalThoughts,
      status: "active",
      objective: session.objective,
      context: `Branch from thought ${branchFromThought}`
    };

    // Add the new branching thought
    const newThought: Thought = {
      number: branchFromThought + 1,
      content: thought,
      model: model || "default",
      timestamp: new Date(),
      branchFromThought
    };

    branchSession.thoughts.push(newThought);
    branchSession.currentThought = newThought.number;

    // Store the branch
    if (!session.branches) {
      session.branches = [];
    }
    session.branches.push(branchSession);
    this.sessions.set(branchId, branchSession);

    return {
      thoughtAdded: newThought,
      sessionStatus: branchSession,
      guidance: `Branched from thought ${branchFromThought}. New branch ID: ${branchId}`
    };
  }

  /**
   * Generate guidance for the next thinking step
   */
  private generateGuidance(session: ThinkingSession, continueThinking: boolean): string {
    if (!continueThinking) {
      return this.generateSummary(session);
    }

    const progress = (session.currentThought / session.totalThoughts) * 100;
    const thoughtsSoFar = session.thoughts.length;

    let guidance = `## Thinking Progress: ${progress.toFixed(0)}%\n\n`;
    guidance += `Thoughts completed: ${thoughtsSoFar}/${session.totalThoughts}\n\n`;

    // Suggest next steps based on progress
    if (progress < 30) {
      guidance += `${icon('search')} **Early Stage**: Focus on understanding and decomposing the problem.\n`;
      guidance += "Consider: What are the key components? What constraints exist?\n";
    } else if (progress < 60) {
      guidance += `${icon('wrench')} **Middle Stage**: Explore solutions and alternatives.\n`;
      guidance += "Consider: What approaches could work? What are the trade-offs?\n";
      guidance += "You may want to branch to explore alternatives.\n";
    } else if (progress < 90) {
      guidance += `${icon('target')} **Late Stage**: Refine and validate your approach.\n`;
      guidance += "Consider: Are there edge cases? Can we optimize further?\n";
      guidance += "You may want to revise earlier thoughts with new insights.\n";
    } else {
      guidance += `${icon('sparkle')} **Final Stage**: Synthesize and conclude.\n`;
      guidance += "Consider: What's the final solution? What are the next steps?\n";
    }

    // Check if revision might be helpful
    if (thoughtsSoFar > 3 && !session.thoughts.some(t => t.isRevision)) {
      guidance += `\n${icon('lightbulb')} **Tip**: Consider revising earlier thoughts if new insights emerged.\n`;
    }

    return guidance;
  }

  /**
   * Generate a summary of the thinking session
   */
  private generateSummary(session: ThinkingSession): string {
    let summary = `## ${icon('target')} Thinking Session Complete\n\n`;
    summary += `**Objective**: ${session.objective || "Not specified"}\n`;
    summary += `**Total Thoughts**: ${session.thoughts.length}\n`;
    
    // Count revisions and branches
    const revisions = session.thoughts.filter(t => t.isRevision).length;
    const branches = session.branches?.length || 0;
    
    if (revisions > 0) {
      summary += `**Revisions Made**: ${revisions}\n`;
    }
    if (branches > 0) {
      summary += `**Alternative Branches**: ${branches}\n`;
    }

    summary += `\n### Thought Progression:\n\n`;
    
    // Group thoughts by model if multi-model
    const modelGroups = new Map<string, Thought[]>();
    session.thoughts.forEach(thought => {
      const model = thought.model || "default";
      if (!modelGroups.has(model)) {
        modelGroups.set(model, []);
      }
      modelGroups.get(model)!.push(thought);
    });

    if (modelGroups.size > 1) {
      summary += "**Multi-Model Contributions**:\n";
      modelGroups.forEach((thoughts, model) => {
        summary += `- ${model}: ${thoughts.length} thoughts\n`;
      });
      summary += "\n";
    }

    // Key thoughts
    summary += "### Key Insights:\n\n";
    
    // First thought (problem understanding)
    if (session.thoughts[0]) {
      summary += `1. **Initial Understanding** (Thought 1):\n   ${session.thoughts[0].content.substring(0, 200)}...\n\n`;
    }

    // Middle insight (if exists)
    const middleIdx = Math.floor(session.thoughts.length / 2);
    if (session.thoughts[middleIdx] && session.thoughts.length > 2) {
      summary += `2. **Mid-Process Insight** (Thought ${middleIdx + 1}):\n   ${session.thoughts[middleIdx].content.substring(0, 200)}...\n\n`;
    }

    // Final conclusion
    const lastThought = session.thoughts[session.thoughts.length - 1];
    if (lastThought) {
      summary += `3. **Final Conclusion** (Thought ${lastThought.number}):\n   ${lastThought.content.substring(0, 300)}...\n\n`;
    }

    // Branches summary
    if (session.branches && session.branches.length > 0) {
      summary += "### Alternative Paths Explored:\n";
      session.branches.forEach((branch, idx) => {
        summary += `- Branch ${idx + 1}: ${branch.context || "Alternative approach"}\n`;
      });
    }

    return summary;
  }

  /**
   * Get current session
   */
  getCurrentSession(): ThinkingSession | null {
    if (!this.currentSessionId) return null;
    return this.sessions.get(this.currentSessionId) || null;
  }

  /**
   * List all sessions
   */
  listSessions(): { active: ThinkingSession[]; completed: ThinkingSession[] } {
    const all = Array.from(this.sessions.values());
    return {
      active: all.filter(s => s.status === "active"),
      completed: all.filter(s => s.status === "completed")
    };
  }

  /**
   * Generate session ID
   */
  private generateSessionId(): string {
    return `think_${Date.now()}_${randomBytes(6).toString('hex')}`;
  }

  /**
   * Create multi-model thinking chain
   */
  createMultiModelChain(
    objective: string,
    models: string[]
  ): { sessionId: string; plan: string } {
    const sessionId = this.startSession(objective, models.length);
    
    let plan = `## Multi-Model Sequential Thinking Plan\n\n`;
    plan += `**Objective**: ${objective}\n`;
    plan += `**Models**: ${models.join(" → ")}\n\n`;
    plan += `### Execution Steps:\n\n`;
    
    models.forEach((model, idx) => {
      const stage = this.getStageDescription(idx, models.length);
      plan += `${idx + 1}. **${model}**: ${stage}\n`;
    });
    
    plan += `\n### How to Execute:\n`;
    plan += `Use \`nextThought\` with each model in sequence.\n`;
    plan += `Each model builds on previous thoughts.\n`;
    plan += `Revise or branch as insights emerge.\n`;
    
    return { sessionId, plan };
  }

  /**
   * Get stage description based on position
   */
  private getStageDescription(index: number, total: number): string {
    const position = index / total;

    if (position === 0) {
      return "Initial analysis and problem decomposition";
    } else if (position < 0.3) {
      return "Explore approaches and identify constraints";
    } else if (position < 0.6) {
      return "Develop and evaluate solutions";
    } else if (position < 0.8) {
      return "Refine and optimize approach";
    } else {
      return "Synthesize insights and finalize solution";
    }
  }

  /**
   * Get or create a session (auto-session for barrier-free usage)
   */
  getOrCreateSession(objective?: string): ThinkingSession {
    if (this.currentSessionId) {
      const session = this.sessions.get(this.currentSessionId);
      if (session && session.status === "active") {
        return session;
      }
    }
    // Auto-create session with provided or default objective
    const sessionId = this.startSession(objective || "Sequential thinking session", 10);
    return this.sessions.get(sessionId)!;
  }

  /**
   * Build context string from previous thoughts
   * @param session - The thinking session
   * @param windowSize - How many thoughts to include (-1 for ALL, 0 for none)
   */
  buildContextFromThoughts(session: ThinkingSession, windowSize: number = 3): string {
    if (windowSize === 0 || session.thoughts.length === 0) {
      return "";
    }

    const thoughts = windowSize === -1
      ? session.thoughts
      : session.thoughts.slice(-windowSize);

    if (thoughts.length === 0) return "";

    return thoughts.map((t) =>
      `### Thought ${t.number} (${t.model || "default"}):\n${t.content}${t.modelResponse ? `\n\n**Model Response:**\n${t.modelResponse}` : ""}`
    ).join("\n\n---\n\n");
  }

  /**
   * Distill context from thoughts into structured format
   * Extracts Task + Constraints + Working Memory for efficient MCP calls
   *
   * Modes:
   * - "light": Preserves more details (5 insights, 5 decisions, 5 questions)
   * - "aggressive": Heavy compression (3 insights, 3 decisions, 3 questions)
   *
   * Benefits:
   * - 5x token reduction (3000 → 500 tokens)
   * - Constraints from session start never lost
   * - Key insights preserved, noise removed
   */
  distillContext(
    session: ThinkingSession,
    currentTask: string,
    windowSize: number = 3,
    mode: DistillationMode = "light"
  ): DistilledContext {
    const thoughts = windowSize === -1
      ? session.thoughts
      : session.thoughts.slice(-windowSize);

    // Extract constraints from session objective
    const constraints = this.extractConstraints(session.objective || "");

    // Extract working memory from thoughts (hybrid limits by type per Gemini/GPT review)
    const limits = {
      insights: 5,
      decisions: 5,
      questions: 5,
      // Different char limits by type (raised from flat 200)
      insightCharLimit: 400,   // Observation + implication
      decisionCharLimit: 600,  // Need rationale + constraints + impact
      questionCharLimit: 300,  // Question + what's missing
    };

    const workingMemory = this.extractWorkingMemory(thoughts, limits);

    // Build the distilled context
    const distilled: DistilledContext = {
      task: currentTask,
      constraints,
      workingMemory,
      tokenEstimate: this.estimateTokens(currentTask, constraints, workingMemory),
    };

    return distilled;
  }

  /**
   * Extract constraints from session objective
   * Looks for patterns like "must", "should", "don't", "only", "always", "never"
   */
  private extractConstraints(objective: string): string[] {
    const constraints: string[] = [];

    if (!objective) return constraints;

    // Split by sentences and look for constraint patterns
    const sentences = objective.split(/[.!?\n]+/).filter(s => s.trim());

    const constraintPatterns = [
      /\b(must|should|shall|need to|have to|required to)\b/i,
      /\b(don't|do not|never|avoid|cannot|can't)\b/i,
      /\b(only|always|ensure|make sure)\b/i,
      /\b(no\s+\w+|without\s+\w+)\b/i,
    ];

    for (const sentence of sentences) {
      const trimmed = sentence.trim();
      if (trimmed.length < 10) continue;

      for (const pattern of constraintPatterns) {
        if (pattern.test(trimmed)) {
          // Clean and add constraint
          const constraint = trimmed.length > 100
            ? trimmed.substring(0, 100) + "..."
            : trimmed;
          if (!constraints.includes(constraint)) {
            constraints.push(constraint);
          }
          break;
        }
      }
    }

    // If no constraints found, use objective summary
    if (constraints.length === 0 && objective.length > 0) {
      const summary = objective.length > 150
        ? objective.substring(0, 150) + "..."
        : objective;
      constraints.push(`Objective: ${summary}`);
    }

    return constraints.slice(0, 5); // Max 5 constraints
  }

  /**
   * Extract working memory from thoughts
   * Identifies key insights, decisions, and open questions
   * Uses hybrid char limits per type (decisions need more room than questions)
   */
  private extractWorkingMemory(
    thoughts: Thought[],
    limits: {
      insights: number;
      decisions: number;
      questions: number;
      insightCharLimit: number;
      decisionCharLimit: number;
      questionCharLimit: number;
    } = {
      insights: 5, decisions: 5, questions: 5,
      insightCharLimit: 400, decisionCharLimit: 600, questionCharLimit: 300
    }
  ): {
    keyInsights: string[];
    decisions: string[];
    openQuestions: string[];
  } {
    const keyInsights: string[] = [];
    const decisions: string[] = [];
    const openQuestions: string[] = [];

    // Patterns for different types of content
    const insightPatterns = [
      /\b(found|discovered|realized|key|important|critical|root cause|issue is)\b/i,
      /\b(because|therefore|thus|so|hence)\b/i,
    ];
    const decisionPatterns = [
      /\b(decided|chose|will use|going to|solution is|fix is|approach is)\b/i,
      /\b(implemented|added|created|using)\b/i,
    ];
    const questionPatterns = [
      /\?$/,
      /\b(unclear|unknown|need to check|investigate|todo|open question)\b/i,
    ];

    for (const thought of thoughts) {
      const content = thought.content;
      const response = thought.modelResponse || "";
      let combined = `${content}\n${response}`;

      // Skip code blocks to avoid extracting from comments (e.g., "// TODO: must fix")
      combined = combined.replace(/```[\s\S]*?```/g, ""); // Remove fenced code blocks
      combined = combined.replace(/`[^`]+`/g, "");        // Remove inline code

      // Split into sentences for analysis
      const sentences = combined.split(/[.!?\n]+/).filter(s => s.trim().length > 15);

      for (const sentence of sentences.slice(0, 10)) { // Limit sentences per thought
        const trimmed = sentence.trim();

        // Check for questions (300 char limit)
        if (questionPatterns.some(p => p.test(trimmed))) {
          const summary = trimmed.length > limits.questionCharLimit
            ? trimmed.substring(0, limits.questionCharLimit) + "..."
            : trimmed;
          if (openQuestions.length < limits.questions && !openQuestions.includes(summary)) {
            openQuestions.push(summary);
          }
          continue;
        }

        // Check for decisions (600 char limit - need rationale)
        if (decisionPatterns.some(p => p.test(trimmed))) {
          const summary = trimmed.length > limits.decisionCharLimit
            ? trimmed.substring(0, limits.decisionCharLimit) + "..."
            : trimmed;
          if (decisions.length < limits.decisions && !decisions.includes(summary)) {
            decisions.push(summary);
          }
          continue;
        }

        // Check for insights (400 char limit)
        if (insightPatterns.some(p => p.test(trimmed))) {
          const summary = trimmed.length > limits.insightCharLimit
            ? trimmed.substring(0, limits.insightCharLimit) + "..."
            : trimmed;
          if (keyInsights.length < limits.insights && !keyInsights.includes(summary)) {
            keyInsights.push(summary);
          }
        }
      }
    }

    // If no structured content found, extract from last thought
    if (keyInsights.length === 0 && thoughts.length > 0) {
      const lastThought = thoughts[thoughts.length - 1];
      const summary = lastThought.content.length > limits.insightCharLimit
        ? lastThought.content.substring(0, limits.insightCharLimit) + "..."
        : lastThought.content;
      keyInsights.push(`Latest: ${summary}`);
    }

    return { keyInsights, decisions, openQuestions };
  }

  /**
   * Estimate token count for distilled context
   * Rough estimation: ~4 chars per token
   */
  private estimateTokens(
    task: string,
    constraints: string[],
    workingMemory: { keyInsights: string[]; decisions: string[]; openQuestions: string[] }
  ): number {
    const totalChars =
      task.length +
      constraints.join("").length +
      workingMemory.keyInsights.join("").length +
      workingMemory.decisions.join("").length +
      workingMemory.openQuestions.join("").length +
      100; // Overhead for formatting

    return Math.ceil(totalChars / 4);
  }

  /**
   * Format distilled context as prompt string
   */
  formatDistilledContext(distilled: DistilledContext): string {
    let formatted = `## TASK\n${distilled.task}\n\n`;

    if (distilled.constraints.length > 0) {
      formatted += `## CONSTRAINTS\n`;
      distilled.constraints.forEach(c => {
        formatted += `- ${c}\n`;
      });
      formatted += "\n";
    }

    const wm = distilled.workingMemory;
    if (wm.keyInsights.length > 0 || wm.decisions.length > 0 || wm.openQuestions.length > 0) {
      formatted += `## WORKING MEMORY\n`;

      if (wm.keyInsights.length > 0) {
        formatted += `**Key Insights:**\n`;
        wm.keyInsights.forEach(i => formatted += `- ${i}\n`);
      }

      if (wm.decisions.length > 0) {
        formatted += `**Decisions:**\n`;
        wm.decisions.forEach(d => formatted += `- ${d}\n`);
      }

      if (wm.openQuestions.length > 0) {
        formatted += `**Open Questions:**\n`;
        wm.openQuestions.forEach(q => formatted += `- ${q}\n`);
      }
    }

    formatted += `\n[~${distilled.tokenEstimate} tokens]`;
    return formatted;
  }

  /**
   * Enhanced nextThought with optional model execution
   * Auto-creates session if needed, passes context between thoughts
   */
  async nextThoughtEnhanced(options: NextThoughtOptions): Promise<NextThoughtEnhancedResult> {
    const {
      thought,
      nextThoughtNeeded,
      thoughtNumber,
      totalThoughts,
      isRevision,
      revisesThought,
      branchFromThought,
      model,
      executeModel = false,
      contextWindow: rawContextWindow,
      objective,
      distillContext: distillMode = "off",
      finalJudge,
      memoryProvider,
    } = options;

    // Resolve context window (supports "none", "recent", "all" aliases)
    const contextWindow = resolveContextWindow(rawContextWindow);

    // Auto-create session if needed
    const session = this.getOrCreateSession(objective);

    // Handle branching (delegate to existing method)
    if (branchFromThought !== undefined) {
      const branchResult = this.branchThinking(session, thought, branchFromThought, model);
      return {
        ...branchResult,
        availableModels: getAvailableModelNames(),
      };
    }

    // Build context based on distillation mode
    let distilledContext: DistilledContext | undefined;
    let promptContext: string;

    // Check if we should auto-distill based on context size
    const rawContext = this.buildContextFromThoughts(session, contextWindow);
    const rawTokenEstimate = Math.ceil(rawContext.length / 4);
    const TOKEN_THRESHOLD = 8000; // Auto-distill if raw context exceeds this (raised from 2000 per Gemini review)

    // Determine effective mode: "auto" distills when over threshold
    let effectiveMode = distillMode;
    if (distillMode === "off" && rawTokenEstimate > TOKEN_THRESHOLD && session.thoughts.length > 0) {
      // Auto-upgrade to light distillation when context is large
      effectiveMode = "light";
    }

    if (effectiveMode !== "off" && session.thoughts.length > 0) {
      // Use Context Distillation for efficient MCP calls
      distilledContext = this.distillContext(session, thought, contextWindow, effectiveMode as DistillationMode);
      promptContext = `${this.formatDistilledContext(distilledContext)}\n\n${FORMAT_INSTRUCTION}`;
    } else {
      // Use raw context (original behavior)
      promptContext = rawContext
        ? `## Previous Thoughts Context:\n${rawContext}\n\n---\n\n## Current Task:\n${thought}\n\n${FORMAT_INSTRUCTION}`
        : `${thought}\n\n${FORMAT_INSTRUCTION}`;
    }

    // Execute model tool if requested
    let modelResponse: string | undefined;
    if (executeModel && model) {
      const availability = isModelAvailable(model);
      if (availability.isAvailable) {
        try {
          const toolService = new ToolExecutionService({ verbose: false });
          modelResponse = await toolService.executeRealTool(
            model,
            promptContext,
            ReasoningMode.DEEP_REASONING
          );
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : String(error);
          modelResponse = `[Error executing ${model}: ${errorMsg}]`;
        }
      } else {
        modelResponse = `[Model ${model} unavailable: ${availability.reason}]`;
      }
    }

    // Create the thought object with model response
    const newThought: Thought = {
      number: thoughtNumber || session.currentThought + 1,
      content: thought,
      model: model || "default",
      timestamp: new Date(),
      isRevision,
      revisesThought,
      modelResponse,
    };

    // Handle revision
    if (isRevision && revisesThought !== undefined) {
      const originalThought = session.thoughts.find(t => t.number === revisesThought);
      if (originalThought) {
        originalThought.metadata = {
          ...originalThought.metadata,
          revisedBy: newThought.number
        };
      }
    }

    // Add the thought
    session.thoughts.push(newThought);
    session.currentThought = newThought.number;

    // Update total thoughts if provided
    if (totalThoughts !== undefined) {
      session.totalThoughts = totalThoughts;
    }

    // Handle session completion
    let finalJudgeResponse: string | undefined;
    if (!nextThoughtNeeded) {
      session.status = "completed";
      // Update totalThoughts to actual count for accurate progress display
      session.totalThoughts = session.thoughts.length;
      session.currentThought = session.thoughts.length;

      // Execute final judge if configured
      if (finalJudge) {
        finalJudgeResponse = await this.executeFinalJudge(session, finalJudge, modelResponse);
      }
    }

    // Build memory save hint if configured (Claude calls the actual tool)
    let memorySaveHint: MemorySaveHint | undefined;
    if (memoryProvider?.saveToMemory && !nextThoughtNeeded) {
      const hint = this.buildMemorySaveHint(session, memoryProvider.provider, distilledContext, finalJudgeResponse);
      if (hint) {
        memorySaveHint = hint;
      }
    }

    // Generate guidance for next step
    const guidance = this.generateGuidance(session, nextThoughtNeeded);

    return {
      thoughtAdded: newThought,
      sessionStatus: session,
      guidance,
      modelResponse,
      availableModels: getAvailableModelNames(),
      distilledContext,
      finalJudgeResponse,
      memorySaveHint,
    };
  }

  /**
   * Build a structured prompt for the final judge model
   * Provides all context + asks for verdict
   */
  private buildFinalJudgePrompt(
    session: ThinkingSession,
    allContext: string,
    lastModelResponse?: string
  ): string {
    const parts: string[] = [];

    // Session objective
    if (session.objective) {
      parts.push(`## Objective\n${session.objective}`);
    }

    // All thoughts context
    parts.push(`## Reasoning Chain (${session.thoughts.length} thoughts)\n${allContext}`);

    // Last model response if available
    if (lastModelResponse) {
      parts.push(`## Most Recent Analysis\n${lastModelResponse}`);
    }

    // Judge instruction (no bold markers in instructions - clean formatting)
    parts.push(`## Your Task: Final Judgment
Analyze the complete reasoning chain above and provide:
1. Verdict: Is the conclusion sound? (Yes/No/Partial)
2. Confidence: How confident are you? (High/Medium/Low)
3. Key Strengths: What was done well?
4. Weaknesses/Gaps: What was missed or flawed?
5. Final Recommendation: Concise actionable summary

${FORMAT_INSTRUCTION}`);

    return parts.join("\n\n");
  }

  /**
   * Execute final judge model with full session context
   * Returns verdict or error message
   */
  private async executeFinalJudge(
    session: ThinkingSession,
    finalJudge: string,
    lastModelResponse?: string
  ): Promise<string> {
    const availability = isModelAvailable(finalJudge);

    if (!availability.isAvailable) {
      console.warn(`[nextThought] FinalJudge ${finalJudge} unavailable: ${availability.reason}`);
      return `[FinalJudge ${finalJudge} unavailable: ${availability.reason}]`;
    }

    try {
      const allContext = this.buildContextFromThoughts(session, ALL_THOUGHTS);
      const judgePrompt = this.buildFinalJudgePrompt(session, allContext, lastModelResponse);

      const toolService = new ToolExecutionService({ verbose: false });
      return await toolService.executeRealTool(
        finalJudge,
        judgePrompt,
        ReasoningMode.DEEP_REASONING
      );
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error(`[nextThought] FinalJudge ${finalJudge} failed:`, errorMsg);
      return `[Error executing finalJudge ${finalJudge}: ${errorMsg}]`;
    }
  }

  /**
   * Build memory save hint for Claude to act on
   * Returns structured hint - Claude calls the actual tool
   */
  private buildMemorySaveHint(
    session: ThinkingSession,
    provider: string,
    distilledContext?: DistilledContext,
    finalJudgeResponse?: string
  ): MemorySaveHint | null {
    const saveData: MemorySaveData = {
      sessionId: session.id,
      objective: session.objective,
      thoughts: session.thoughts.map(t => ({
        number: t.number,
        content: t.content,
        model: t.model,
        modelResponse: t.modelResponse,
      })),
      distilledContext: distilledContext ? {
        task: distilledContext.task,
        constraints: distilledContext.constraints,
        keyInsights: distilledContext.workingMemory.keyInsights,
        decisions: distilledContext.workingMemory.decisions,
      } : undefined,
      finalJudgeResponse,
      timestamp: new Date(),
    };

    return formatMemorySaveHint(provider, saveData);
  }
}

// Export singleton instance
export const sequentialThinking = new SequentialThinking();

// Schema for memory provider configuration
const MemoryProviderSchema = z.object({
  provider: z.string().describe("Memory provider name: 'devlog', 'mem0', or custom"),
  saveToMemory: z.boolean().optional().describe("Auto-save session to memory on complete"),
  loadFromMemory: z.boolean().optional().describe("Load relevant context from memory at start"),
}).optional();

// Schema for tool parameters (enhanced with model execution support)
export const NextThoughtSchema = z.object({
  thought: z.string().describe("The thought content or prompt for the model"),
  nextThoughtNeeded: z.boolean().describe("Whether more thoughts are needed in the chain"),
  thoughtNumber: z.number().optional().describe("Override the thought number"),
  totalThoughts: z.number().optional().describe("Update estimated total thoughts"),
  isRevision: z.boolean().optional().describe("Mark this as a revision of an earlier thought"),
  revisesThought: z.number().optional().describe("Which thought number this revises"),
  branchFromThought: z.number().optional().describe("Branch from this thought number"),
  model: z.string().optional().describe("Model to use: grok, gemini, openai, perplexity, kimi, qwen, think"),
  executeModel: z.boolean().optional().describe("Actually execute the model's tool and return response (default: false)"),
  contextWindow: z.union([
    z.number(),
    z.enum(["none", "recent", "all"])
  ]).optional().describe("Context window: 'none' (fresh), 'recent' (last 3), 'all' (full history). Prefer string names over numbers"),
  objective: z.string().optional().describe("Session objective (for auto-session creation)"),
  distillContext: z.enum(["off", "light"]).optional().describe("Distillation mode: off (default, auto-distills at 8000+ tokens), light (preserves detail)"),
  finalJudge: z.string().optional().describe("Model to use as final judge when session completes (e.g., 'gemini'). Called automatically when nextThoughtNeeded=false"),
  memoryProvider: MemoryProviderSchema.describe("Pluggable memory MCP: { provider: 'devlog'|'mem0', saveToMemory: true }"),
});