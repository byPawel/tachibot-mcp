/**
 * Sequential Thinking Implementation
 * Based on the official MCP Sequential Thinking server
 * Enhanced with multi-model orchestration capabilities
 */

import { z } from "zod";
import { randomBytes } from "crypto";

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
      guidance += "🔍 **Early Stage**: Focus on understanding and decomposing the problem.\n";
      guidance += "Consider: What are the key components? What constraints exist?\n";
    } else if (progress < 60) {
      guidance += "🔧 **Middle Stage**: Explore solutions and alternatives.\n";
      guidance += "Consider: What approaches could work? What are the trade-offs?\n";
      guidance += "You may want to branch to explore alternatives.\n";
    } else if (progress < 90) {
      guidance += "🎯 **Late Stage**: Refine and validate your approach.\n";
      guidance += "Consider: Are there edge cases? Can we optimize further?\n";
      guidance += "You may want to revise earlier thoughts with new insights.\n";
    } else {
      guidance += "✨ **Final Stage**: Synthesize and conclude.\n";
      guidance += "Consider: What's the final solution? What are the next steps?\n";
    }

    // Check if revision might be helpful
    if (thoughtsSoFar > 3 && !session.thoughts.some(t => t.isRevision)) {
      guidance += "\n💡 **Tip**: Consider revising earlier thoughts if new insights emerged.\n";
    }

    return guidance;
  }

  /**
   * Generate a summary of the thinking session
   */
  private generateSummary(session: ThinkingSession): string {
    let summary = `## 🎯 Thinking Session Complete\n\n`;
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
}

// Export singleton instance
export const sequentialThinking = new SequentialThinking();

// Schema for tool parameters
export const NextThoughtSchema = z.object({
  thought: z.string(),
  nextThoughtNeeded: z.boolean(),
  thoughtNumber: z.number().optional(),
  totalThoughts: z.number().optional(),
  isRevision: z.boolean().optional(),
  revisesThought: z.number().optional(),
  branchFromThought: z.number().optional(),
  model: z.string().optional()
});