import { z } from "zod";

/**
 * Multi-Model Reasoning Chain System
 * Enables LLMs to reason between each other, critique, and build upon ideas
 */

export enum ReasoningMode {
  BRAINSTORM = "brainstorm",         // Generate ideas
  CRITIQUE = "critique",             // Evaluate and critique ideas
  ENHANCE = "enhance",               // Build upon and improve ideas
  VALIDATE = "validate",             // Fact-check and verify
  SYNTHESIZE = "synthesize",         // Combine multiple perspectives
  DEBATE = "debate",                 // Models argue different positions
  CONSENSUS = "consensus",           // Find agreement between models
  DEEP_REASONING = "deep_reasoning", // Deep multi-model collaborative reasoning
  PINGPONG = "pingpong"             // Dynamic back-and-forth conversation
}

export enum TechnicalDomain {
  ARCHITECTURE = "architecture",     // System design, patterns
  ALGORITHMS = "algorithms",         // Algorithm design, optimization
  DEBUGGING = "debugging",           // Problem solving, bug fixing
  SECURITY = "security",            // Security analysis, vulnerabilities
  PERFORMANCE = "performance",       // Optimization, scaling
  API_DESIGN = "api_design",        // API patterns, REST/GraphQL
  DATABASE = "database",            // Schema design, queries
  FRONTEND = "frontend",            // UI/UX, React patterns
  BACKEND = "backend",              // Server architecture
  DEVOPS = "devops",               // CI/CD, deployment
  TESTING = "testing"              // Test strategies, TDD
}

export interface ModelPersona {
  name: string;
  model: string;
  role: string;
  strengths: string[];
  perspective: string;
  temperature?: number;
}

export interface ReasoningStep {
  model: string;
  mode: ReasoningMode;
  prompt: string;
  context?: any;
  previousResponses?: ModelResponse[];
  constraints?: string[];
}

export interface ModelResponse {
  model: string;
  content: string;
  confidence?: number;
  reasoning?: string;
  critiques?: string[];
  suggestions?: string[];
}

export interface ReasoningChainConfig {
  domain: TechnicalDomain;
  objective: string;
  steps: ReasoningStep[];
  maxRounds?: number;
  consensusThreshold?: number;
}

/**
 * Pre-configured reasoning chains for technical problem solving
 */
export const REASONING_TEMPLATES = {
  /**
   * Deep Reasoning: Multi-model collaboration for complex problems
   */
  deep_reasoning: {
    name: "Deep Collaborative Reasoning",
    description: "Multi-model reasoning with critique and synthesis",
    chain: [
      {
        model: "gemini",
        mode: ReasoningMode.BRAINSTORM,
        prompt: "Generate 3 innovative approaches to {problem}. Consider unconventional solutions."
      },
      {
        model: "reasoning",
        mode: ReasoningMode.CRITIQUE,
        prompt: "Analyze the proposed approaches. Identify strengths, weaknesses, and edge cases."
      },
      {
        model: "grok",
        mode: ReasoningMode.ENHANCE,
        prompt: "Using first principles thinking, improve the most promising approach."
      },
      {
        model: "perplexity",
        mode: ReasoningMode.VALIDATE,
        prompt: "Research and validate the technical feasibility. Find similar implementations."
      },
      {
        model: "think", // Uses the original think tool for synthesis
        mode: ReasoningMode.SYNTHESIZE,
        prompt: "Combine all insights from previous steps into a final solution with implementation plan."
      }
    ]
  },

  /**
   * Code Architecture Debate
   */
  architecture_debate: {
    name: "Architecture Design Debate",
    description: "Models debate different architectural approaches",
    chain: [
      {
        model: "reasoning",
        mode: ReasoningMode.BRAINSTORM,
        prompt: "Propose a microservices architecture for {system}."
      },
      {
        model: "gemini",
        mode: ReasoningMode.DEBATE,
        prompt: "Counter with a monolithic architecture. Argue why it's better for this use case."
      },
      {
        model: "grok",
        mode: ReasoningMode.CRITIQUE,
        prompt: "Analyze both approaches. What are the trade-offs?"
      },
      {
        model: "deepseek",
        mode: ReasoningMode.ENHANCE,
        prompt: "Propose a hybrid approach combining the best of both."
      },
      {
        model: "think", // Internal synthesis using think tool
        mode: ReasoningMode.CONSENSUS,
        prompt: "Synthesize all perspectives into a final recommendation with clear rationale."
      }
    ]
  },

  /**
   * Algorithm Optimization Chain
   */
  algorithm_optimization: {
    name: "Algorithm Enhancement Pipeline",
    description: "Iterative algorithm improvement",
    chain: [
      {
        model: "analysis",
        mode: ReasoningMode.BRAINSTORM,
        prompt: "Implement a basic solution for {algorithm_problem}."
      },
      {
        model: "grok",
        mode: ReasoningMode.ENHANCE,
        prompt: "Optimize for time complexity. Apply advanced data structures."
      },
      {
        model: "gemini",
        mode: ReasoningMode.ENHANCE,
        prompt: "Optimize for space complexity. Consider memory constraints."
      },
      {
        model: "reasoning",
        mode: ReasoningMode.VALIDATE,
        prompt: "Verify correctness. Add edge case handling."
      },
      {
        model: "think", // Think tool for final synthesis
        mode: ReasoningMode.SYNTHESIZE,
        prompt: "Create final optimized version with benchmarks and implementation notes."
      }
    ]
  },

  /**
   * Security Analysis Chain
   */
  security_audit: {
    name: "Security Vulnerability Analysis",
    description: "Multi-model security review",
    chain: [
      {
        model: "reasoning",
        mode: ReasoningMode.BRAINSTORM,
        prompt: "Identify potential security vulnerabilities in {code}."
      },
      {
        model: "grok",
        mode: ReasoningMode.ENHANCE,
        prompt: "Analyze attack vectors. How could these be exploited?"
      },
      {
        model: "perplexity",
        mode: ReasoningMode.VALIDATE,
        prompt: "Research known CVEs and security best practices."
      },
      {
        model: "gemini",
        mode: ReasoningMode.SYNTHESIZE,
        prompt: "Propose comprehensive security improvements."
      }
    ]
  },

  /**
   * API Design Workshop
   */
  api_design: {
    name: "API Design Collaboration",
    description: "Collaborative API design process",
    chain: [
      {
        model: "analysis",
        mode: ReasoningMode.BRAINSTORM,
        prompt: "Design RESTful API endpoints for {feature}."
      },
      {
        model: "gemini",
        mode: ReasoningMode.DEBATE,
        prompt: "Propose GraphQL alternative. Compare advantages."
      },
      {
        model: "grok",
        mode: ReasoningMode.ENHANCE,
        prompt: "Add authentication, rate limiting, and error handling."
      },
      {
        model: "reasoning",
        mode: ReasoningMode.VALIDATE,
        prompt: "Review for REST principles, idempotency, and scalability."
      }
    ]
  },

  /**
   * Debugging Detective Chain
   */
  debug_detective: {
    name: "Collaborative Debugging",
    description: "Multi-model debugging session",
    chain: [
      {
        model: "analysis",
        mode: ReasoningMode.BRAINSTORM,
        prompt: "Identify possible causes for {bug_description}."
      },
      {
        model: "grok",
        mode: ReasoningMode.ENHANCE,
        prompt: "Analyze the code flow. Where could the issue originate?"
      },
      {
        model: "perplexity",
        mode: ReasoningMode.VALIDATE,
        prompt: "Search for similar issues and known solutions."
      },
      {
        model: "reasoning",
        mode: ReasoningMode.SYNTHESIZE,
        prompt: "Propose fix with explanation and prevention strategy."
      }
    ]
  },

  /**
   * Performance Optimization Council
   */
  performance_council: {
    name: "Performance Optimization Team",
    description: "Collaborative performance tuning",
    chain: [
      {
        model: "gemini",
        mode: ReasoningMode.BRAINSTORM,
        prompt: "Profile and identify performance bottlenecks in {system}."
      },
      {
        model: "reasoning",
        mode: ReasoningMode.ENHANCE,
        prompt: "Propose caching strategies and query optimizations."
      },
      {
        model: "grok",
        mode: ReasoningMode.ENHANCE,
        prompt: "Suggest algorithmic improvements and data structure changes."
      },
      {
        model: "deepseek",
        mode: ReasoningMode.VALIDATE,
        prompt: "Benchmark proposals. Calculate expected improvements."
      },
      {
        model: "analysis",
        mode: ReasoningMode.CONSENSUS,
        prompt: "Create implementation plan prioritizing highest impact changes."
      }
    ]
  },

  /**
   * Ping-Pong Brainstorm: Dynamic conversation between models
   */
  pingpong_brainstorm: {
    name: "Ping-Pong Creative Brainstorm",
    description: "Dynamic back-and-forth idea generation between models",
    chain: [
      {
        model: "grok",
        mode: ReasoningMode.BRAINSTORM,
        prompt: "🚀 [Grok] Start creative brainstorm: {problem}. Propose 2-3 bold, unconventional ideas using first-principles thinking. Challenge: How would you scale this to millions of users?"
      },
      {
        model: "claude-code",
        mode: ReasoningMode.ENHANCE,
        prompt: "🧠 [Claude] Build on Grok's ideas with systematic analysis. Add architectural depth and consider edge cases. Challenge back: What are the security implications?"
      },
      {
        model: "qwen",
        mode: ReasoningMode.BRAINSTORM,
        prompt: "⚡ [Qwen] Code-focused view: Implement the most promising ideas with concrete architecture. Technical challenges? Counter-question: Performance vs complexity trade-offs?"
      },
      {
        model: "openai",
        mode: ReasoningMode.CRITIQUE,
        prompt: "🔍 [OpenAI] Analytical critique: What are the weaknesses in these approaches? Business viability? Challenge: How to MVP this?"
      },
      {
        model: "perplexity",
        mode: ReasoningMode.VALIDATE,
        prompt: "📚 [Perplexity] Research-backed reality check: Find real examples, precedents, and market validation. What does data say? Next question: Competitive landscape?"
      },
      {
        model: "gemini",
        mode: ReasoningMode.ENHANCE,
        prompt: "✨ [Gemini] Creative synthesis: Merge insights, address critiques, and add innovative elements. Final challenge: How to make this 10x better?"
      },
      {
        model: "think",
        mode: ReasoningMode.CONSENSUS,
        prompt: "🎯 [Synthesis] Final distillation: Combine all ping-pong insights into actionable roadmap with priorities, timelines, and success metrics."
      }
    ]
  },

  /**
   * Dynamic Debate: Models argue different sides
   */
  dynamic_debate: {
    name: "Multi-Model Debate",
    description: "Models debate different perspectives with real-time responses",
    chain: [
      {
        model: "grok",
        mode: ReasoningMode.DEBATE,
        prompt: "Argue FOR the approach: {problem}. Make your strongest case. End with a challenge to the opposition."
      },
      {
        model: "reasoning",
        mode: ReasoningMode.DEBATE,
        prompt: "Argue AGAINST the previous position. Counter their points directly. Present alternative approach. Challenge their assumptions."
      },
      {
        model: "gemini",
        mode: ReasoningMode.DEBATE,
        prompt: "Third perspective: Find the middle ground or propose a completely different angle. Question both previous arguments."
      },
      {
        model: "grok",
        mode: ReasoningMode.CRITIQUE,
        prompt: "Rebuttal round: Address the counter-arguments. Strengthen your original position or acknowledge valid points."
      },
      {
        model: "reasoning",
        mode: ReasoningMode.CRITIQUE,
        prompt: "Counter-rebuttal: Respond to the rebuttal. Find flaws in the logic. Present additional evidence."
      },
      {
        model: "perplexity",
        mode: ReasoningMode.VALIDATE,
        prompt: "Judge's perspective: Research evidence for all positions. What does real data and precedent say?"
      },
      {
        model: "think",
        mode: ReasoningMode.CONSENSUS,
        prompt: "Synthesis: Extract insights from the debate. What can we learn from each perspective? What's the nuanced truth?"
      }
    ]
  }
};

/**
 * Model Personas for different reasoning roles
 */
export const MODEL_PERSONAS: Record<string, ModelPersona> = {
  "gemini-innovator": {
    name: "Gemini Innovator",
    model: "gemini",
    role: "Creative Problem Solver",
    strengths: ["unconventional thinking", "pattern recognition", "synthesis"],
    perspective: "Think outside the box. Question assumptions. Find novel connections.",
    temperature: 0.8
  },
  
  "reasoning-architect": {
    name: "Reasoning Architect",
    model: "reasoning",
    role: "System Design Expert",
    strengths: ["systematic thinking", "comprehensive analysis", "best practices"],
    perspective: "Design for scalability, maintainability, and elegance.",
    temperature: 0.6
  },
  
  "grok-logician": {
    name: "Grok Logician",
    model: "grok",
    role: "First Principles Thinker",
    strengths: ["logical reasoning", "mathematical rigor", "proof construction"],
    perspective: "Break down to fundamentals. Build up with logic.",
    temperature: 0.4
  },
  
  "perplexity-researcher": {
    name: "Perplexity Researcher",
    model: "perplexity",
    role: "Evidence Gatherer",
    strengths: ["research", "fact-checking", "precedent finding"],
    perspective: "Find evidence. Validate claims. Learn from existing solutions.",
    temperature: 0.3
  },
  
  "deepseek-optimizer": {
    name: "DeepSeek Optimizer",
    model: "deepseek",
    role: "Efficiency Expert",
    strengths: ["optimization", "benchmarking", "cost analysis"],
    perspective: "Maximize efficiency. Minimize resource usage.",
    temperature: 0.5
  },
  
  "analysis-reviewer": {
    name: "Analysis Reviewer",
    model: "analysis",
    role: "Code Quality Guardian",
    strengths: ["code review", "best practices", "documentation"],
    perspective: "Ensure quality, readability, and maintainability.",
    temperature: 0.4
  }
};

/**
 * Dynamic Chain Builder
 */
export class ReasoningChainBuilder {
  private chain: ReasoningStep[] = [];
  private domain: TechnicalDomain;
  private objective: string;

  constructor(domain: TechnicalDomain, objective: string) {
    this.domain = domain;
    this.objective = objective;
  }

  addBrainstorm(model: string, focus?: string): this {
    this.chain.push({
      model,
      mode: ReasoningMode.BRAINSTORM,
      prompt: focus || `Generate innovative solutions for: ${this.objective}`
    });
    return this;
  }

  addCritique(model: string, target?: string): this {
    this.chain.push({
      model,
      mode: ReasoningMode.CRITIQUE,
      prompt: target || "Critically analyze the proposed solutions. Identify weaknesses."
    });
    return this;
  }

  addEnhancement(model: string, aspect?: string): this {
    this.chain.push({
      model,
      mode: ReasoningMode.ENHANCE,
      prompt: aspect || "Improve and build upon the best ideas."
    });
    return this;
  }

  addValidation(model: string): this {
    this.chain.push({
      model,
      mode: ReasoningMode.VALIDATE,
      prompt: "Validate feasibility and find supporting evidence."
    });
    return this;
  }

  addDebate(model1: string, model2: string, topic: string): this {
    this.chain.push(
      {
        model: model1,
        mode: ReasoningMode.DEBATE,
        prompt: `Argue FOR: ${topic}`
      },
      {
        model: model2,
        mode: ReasoningMode.DEBATE,
        prompt: `Argue AGAINST: ${topic}`
      }
    );
    return this;
  }

  addSynthesis(model: string): this {
    this.chain.push({
      model,
      mode: ReasoningMode.SYNTHESIZE,
      prompt: "Synthesize all perspectives into a comprehensive solution."
    });
    return this;
  }

  addDeepReasoning(models: string[]): this {
    // Add a complete deep reasoning cycle
    models.forEach((model, index) => {
      const modes = [
        ReasoningMode.BRAINSTORM,
        ReasoningMode.CRITIQUE,
        ReasoningMode.ENHANCE,
        ReasoningMode.VALIDATE,
        ReasoningMode.SYNTHESIZE
      ];
      
      this.chain.push({
        model,
        mode: modes[index % modes.length],
        prompt: `Round ${index + 1}: Apply ${modes[index % modes.length]} reasoning`
      });
    });
    return this;
  }

  build(): ReasoningChainConfig {
    return {
      domain: this.domain,
      objective: this.objective,
      steps: this.chain,
      maxRounds: 10,
      consensusThreshold: 0.7
    };
  }
}

/**
 * Create custom reasoning chain
 */
export function createReasoningChain(
  domain: TechnicalDomain,
  objective: string
): ReasoningChainBuilder {
  return new ReasoningChainBuilder(domain, objective);
}

/**
 * Example usage:
 * 
 * const chain = createReasoningChain(
 *   TechnicalDomain.ARCHITECTURE,
 *   "Design a real-time collaborative editing system"
 * )
 * .addBrainstorm("gemini", "Generate 3 architectural approaches")
 * .addCritique("claude-opus", "Evaluate scalability and latency")
 * .addDebate("grok", "gemini", "CRDT vs Operational Transform")
 * .addEnhancement("deepseek", "Optimize for cost")
 * .addSynthesis("claude-sonnet")
 * .build();
 */