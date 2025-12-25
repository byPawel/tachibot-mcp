import { IExtendedVisualizationRenderer } from "../../interfaces/IVisualizationRenderer.js";
import { CollaborationSession } from "../../types/session-types.js"; // ✅ Break circular dependency
import { ReasoningMode, REASONING_TEMPLATES, MODEL_PERSONAS } from "../../../../reasoning-chain.js";

/**
 * Visualization Service
 * Handles rendering of orchestration plans, progress, and TachiBot visualizations
 * Extracted from CollaborativeOrchestrator for better separation of concerns
 */
export class VisualizationService implements IExtendedVisualizationRenderer {
  private modelTurnTaking: boolean;
  private enableVisualization: boolean;

  constructor(options?: {
    modelTurnTaking?: boolean;
    enableVisualization?: boolean;
  }) {
    this.modelTurnTaking = options?.modelTurnTaking ?? true;
    this.enableVisualization = options?.enableVisualization ?? true;
  }

  /**
   * Generate visual orchestration plan for a session
   */
  generateOrchestrationPlan(session: CollaborationSession): string {
    const steps = session.chain.steps;
    const personas = MODEL_PERSONAS;

    let plan = `# 🧠 Collaborative Reasoning Session\n\n`;
    plan += `**Objective**: ${session.objective}\n`;
    plan += `**Domain**: ${session.domain}\n`;
    plan += `**Session ID**: ${session.id}\n\n`;

    if (session.metadata?.templateName) {
      plan += `**Template**: ${session.metadata.templateDescription}\n\n`;
    }

    plan += `## 🔄 Reasoning Chain\n\n`;

    // Visual flow diagram
    plan += "```\n";
    steps.forEach((step, index) => {
      const persona = Object.values(personas).find(p => p.model === step.model);
      const arrow = index < steps.length - 1 ? " ──► " : "";
      const icon = this.getModeIcon(step.mode);

      if (index % 3 === 0 && index > 0) plan += "\n     ⬇\n";

      plan += `[${icon} ${step.model}]${arrow}`;
    });
    plan += "\n```\n\n";

    // Detailed steps
    plan += `## 📋 Execution Steps\n\n`;
    steps.forEach((step, index) => {
      const persona = Object.values(personas).find(p => p.model === step.model);
      const icon = this.getModeIcon(step.mode);

      plan += `### Step ${index + 1}: ${icon} ${step.mode.toUpperCase()}\n`;
      plan += `**Model**: ${step.model}`;
      if (persona) {
        plan += ` (${persona.role})`;
      }
      plan += `\n`;
      plan += `**Prompt**: ${step.prompt}\n\n`;
    });

    // Execution instructions
    plan += `## 🚀 To Execute This Chain:\n\n`;
    plan += `1. Each model will process the prompt with context from previous responses\n`;
    plan += `2. Models will ${this.modelTurnTaking ? 'take turns' : 'work in parallel when possible'}\n`;
    plan += `3. Final synthesis will combine all insights\n`;
    plan += `4. Use \`focus --mode focus-deep-execute --session ${session.id}\` to run\n\n`;

    // TachiBot visualization
    if (this.enableVisualization) {
      plan += this.generateTachiBotVisualization(session);
    }

    return plan;
  }

  /**
   * Generate TachiBot visualization for the session
   */
  generateTachiBotVisualization(session: CollaborationSession): string {
    const stage = session.currentStep;
    const totalSteps = session.chain.steps.length;

    let viz = `## 🤖 TachiBot Collective Status\n\n`;
    viz += "```\n";

    // Different TachiBot expressions based on reasoning mode
    const currentMode = session.chain.steps[stage]?.mode || ReasoningMode.BRAINSTORM;

    switch (currentMode) {
      case ReasoningMode.BRAINSTORM:
        viz += `@@@@@@@@@@@@@@@
@  ★    ★  @ 💡 Brainstorming...
@     !     @
@ \\\\___// @
@@@@@@@@@@@@@@@`;
        break;
      case ReasoningMode.CRITIQUE:
        viz += `@@@@@@@@@@@@@@@
@  ◉    ◉  @ 🔍 Analyzing critically...
@     ~     @
@   -----   @
@@@@@@@@@@@@@@@`;
        break;
      case ReasoningMode.ENHANCE:
        viz += `@@@@@@@@@@@@@@@
@  ◎    ◎  @ ⚡ Enhancing ideas...
@     ^     @
@   \\__/    @
@@@@@@@@@@@@@@@`;
        break;
      case ReasoningMode.DEEP_REASONING:
        viz += `@@@@@@@@@@@@@@@
@  ◉    ◉  @ 🧠 DEEP REASONING...
@     ≈     @
@   =====   @
@@@@@@@@@@@@@@@`;
        break;
      default:
        viz += `@@@@@@@@@@@@@@@
@  ●    ●  @ 🤔 Processing...
@     ∧     @
@    ___    @
@@@@@@@@@@@@@@@`;
    }

    viz += `\n\nProgress: [${'█'.repeat(stage)}${'░'.repeat(totalSteps - stage)}] ${stage}/${totalSteps}\n`;
    viz += "```\n\n";

    return viz;
  }

  /**
   * Get icon for reasoning mode
   */
  getModeIcon(mode: ReasoningMode): string {
    const icons: Record<ReasoningMode, string> = {
      [ReasoningMode.BRAINSTORM]: "💡",
      [ReasoningMode.CRITIQUE]: "🔍",
      [ReasoningMode.ENHANCE]: "⚡",
      [ReasoningMode.VALIDATE]: "✅",
      [ReasoningMode.SYNTHESIZE]: "🎯",
      [ReasoningMode.DEBATE]: "⚔️",
      [ReasoningMode.CONSENSUS]: "🤝",
      [ReasoningMode.DEEP_REASONING]: "🧠",
      [ReasoningMode.PINGPONG]: "🏓"
    };
    return icons[mode] || "🤖";
  }

  /**
   * Generate example workflows for different technical domains
   */
  getExampleWorkflows(): string {
    let examples = `# 🎯 Example Collaborative Workflows\n\n`;

    examples += `## 1. Deep Reasoning for System Design\n`;
    examples += `\`\`\`typescript\n`;
    examples += `focus --mode deep-reasoning "Design a distributed cache system"\n`;
    examples += `// Gemini brainstorms → Claude critiques → Grok enhances → Perplexity validates → Claude synthesizes\n`;
    examples += `\`\`\`\n\n`;

    examples += `## 2. Architecture Debate\n`;
    examples += `\`\`\`typescript\n`;
    examples += `focus --mode architecture-debate "Microservices vs Monolith for startup MVP"\n`;
    examples += `// Models debate pros/cons → Grok analyzes → Gemini optimizes → Claude consensus\n`;
    examples += `\`\`\`\n\n`;

    examples += `## 3. Algorithm Optimization Chain\n`;
    examples += `\`\`\`typescript\n`;
    examples += `focus --mode algorithm-optimize "Optimize graph traversal for social network"\n`;
    examples += `// Claude implements → Grok optimizes time → Gemini optimizes space → Claude validates\n`;
    examples += `\`\`\`\n\n`;

    examples += `## 4. Security Audit Council\n`;
    examples += `\`\`\`typescript\n`;
    examples += `focus --mode security-audit "Review authentication system"\n`;
    examples += `// Claude finds vulnerabilities → Grok analyzes vectors → Perplexity researches → Gemini fixes\n`;
    examples += `\`\`\`\n\n`;

    examples += `## 5. Custom Chain Builder\n`;
    examples += `\`\`\`typescript\n`;
    examples += `const chain = createReasoningChain(\n`;
    examples += `  TechnicalDomain.API_DESIGN,\n`;
    examples += `  "Design GraphQL API for e-commerce"\n`;
    examples += `)\n`;
    examples += `.addBrainstorm("claude-sonnet", "Design schema and types")\n`;
    examples += `.addDebate("gemini", "grok", "REST vs GraphQL for this use case")\n`;
    examples += `.addEnhancement("claude-opus", "Add security and performance")\n`;
    examples += `.addValidation("perplexity")\n`;
    examples += `.addSynthesis("claude-sonnet")\n`;
    examples += `.build();\n`;
    examples += `\`\`\`\n\n`;

    examples += `## 6. Debugging Detective Squad\n`;
    examples += `\`\`\`typescript\n`;
    examples += `focus --mode debug-detective "Memory leak in React app after route changes"\n`;
    examples += `// Claude identifies causes → Grok traces flow → Perplexity finds solutions → Claude fixes\n`;
    examples += `\`\`\`\n\n`;

    examples += `## 7. Performance Council\n`;
    examples += `\`\`\`typescript\n`;
    examples += `focus --mode performance-council "Optimize database queries for dashboard"\n`;
    examples += `// Gemini profiles → Claude adds caching → Grok improves algorithms → GPT benchmarks\n`;
    examples += `\`\`\`\n`;

    return examples;
  }

  /**
   * Get available templates
   */
  getAvailableTemplates(): string {
    let output = `# 🎨 Available Reasoning Templates\n\n`;

    Object.entries(REASONING_TEMPLATES).forEach(([key, template]) => {
      output += `## ${template.name}\n`;
      output += `**Key**: \`${key}\`\n`;
      output += `**Description**: ${template.description}\n`;
      output += `**Chain Length**: ${template.chain.length} steps\n`;
      output += `**Models**: ${Array.from(new Set(template.chain.map(s => s.model))).join(", ")}\n\n`;
    });

    return output;
  }

  /**
   * Update settings
   */
  updateSettings(options: {
    modelTurnTaking?: boolean;
    enableVisualization?: boolean;
  }): void {
    if (options.modelTurnTaking !== undefined) {
      this.modelTurnTaking = options.modelTurnTaking;
    }
    if (options.enableVisualization !== undefined) {
      this.enableVisualization = options.enableVisualization;
    }
  }
}

// Singleton instance for convenience
export const visualizationService = new VisualizationService();
