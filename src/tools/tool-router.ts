/**
 * Smart Tool Router for Focus MCP Server
 * Manages tool selection based on availability, preferences, and capabilities
 */

import { z } from "zod";

// Tool capability categories
export enum ToolCategory {
  REASONING = "reasoning",
  CODE = "code",
  BRAINSTORM = "brainstorm",
  SEARCH = "search",
  ANALYSIS = "analysis",
  DEBUG = "debug"
}

// Tool provider types
export enum ToolProvider {
  OPENAI = "openai",
  GROK = "grok",
  PERPLEXITY = "perplexity",
  GEMINI = "gemini",
  OPENROUTER = "openrouter",
  LMSTUDIO = "lmstudio",
  INTERNAL = "internal"
}

// Tool capability definition
export interface ToolCapability {
  name: string;
  provider: ToolProvider;
  categories: ToolCategory[];
  priority: number; // 1 = highest priority
  costTier: "free" | "low" | "medium" | "high";
  speedTier: "fast" | "medium" | "slow";
  qualityTier: "basic" | "good" | "excellent";
  checkAvailability: () => boolean;
  execute?: (args: any, context?: any) => Promise<string>;
}

// Tool registry type
export type ToolRegistry = Record<ToolCategory, ToolCapability[]>;

// User preferences for tool selection
export interface ToolPreferences {
  preferredProvider?: ToolProvider;
  costOptimization?: boolean;
  speedPriority?: boolean;
  qualityPriority?: boolean;
  fallbackEnabled?: boolean;
  verboseLogging?: boolean;
}

/**
 * Smart Tool Router Class
 */
export class ToolRouter {
  private registry: ToolRegistry;
  private preferences: ToolPreferences;
  private toolCache: Map<string, ToolCapability>;
  
  constructor(preferences: ToolPreferences = {}) {
    this.preferences = {
      fallbackEnabled: true,
      costOptimization: false,
      speedPriority: false,
      qualityPriority: true,
      verboseLogging: false,
      ...preferences
    };
    
    this.registry = this.initializeRegistry();
    this.toolCache = new Map();
  }
  
  /**
   * Initialize the tool registry with all available tools
   */
  private initializeRegistry(): ToolRegistry {
    return {
      [ToolCategory.REASONING]: [
        {
          name: "gpt5_reason",
          provider: ToolProvider.OPENAI,
          categories: [ToolCategory.REASONING],
          priority: 1,
          costTier: "high",
          speedTier: "medium",
          qualityTier: "excellent",
          checkAvailability: () => !!process.env.OPENAI_API_KEY && process.env.ENABLE_GPT5 === 'true'
        },
        {
          name: "gpt5_mini_reason",
          provider: ToolProvider.OPENAI,
          categories: [ToolCategory.REASONING],
          priority: 2,
          costTier: "medium",
          speedTier: "fast",
          qualityTier: "excellent",
          checkAvailability: () => !!process.env.OPENAI_API_KEY
        },
        {
          name: "qwq_reason",
          provider: ToolProvider.OPENROUTER,
          categories: [ToolCategory.REASONING],
          priority: 3,
          costTier: "medium",
          speedTier: "medium",
          qualityTier: "excellent",
          checkAvailability: () => !!process.env.OPENROUTER_API_KEY
        },
        {
          name: "grok_reason",
          provider: ToolProvider.GROK,
          categories: [ToolCategory.REASONING],
          priority: 4,
          costTier: "medium",
          speedTier: "fast",
          qualityTier: "excellent",
          checkAvailability: () => !!process.env.GROK_API_KEY
        },
        {
          name: "perplexity_reason",
          provider: ToolProvider.PERPLEXITY,
          categories: [ToolCategory.REASONING, ToolCategory.SEARCH],
          priority: 5,
          costTier: "medium",
          speedTier: "fast",
          qualityTier: "good",
          checkAvailability: () => !!process.env.PERPLEXITY_API_KEY
        },
        {
          name: "gemini_query",
          provider: ToolProvider.GEMINI,
          categories: [ToolCategory.REASONING],
          priority: 6,
          costTier: "low",
          speedTier: "fast",
          qualityTier: "good",
          checkAvailability: () => !!process.env.GOOGLE_API_KEY
        }
      ],
      
      [ToolCategory.CODE]: [
        {
          name: "qwen_coder",
          provider: ToolProvider.OPENROUTER,
          categories: [ToolCategory.CODE],
          priority: 1,
          costTier: "medium",
          speedTier: "medium",
          qualityTier: "excellent",
          checkAvailability: () => !!process.env.OPENROUTER_API_KEY
        },
        {
          name: "grok_code",
          provider: ToolProvider.GROK,
          categories: [ToolCategory.CODE, ToolCategory.ANALYSIS],
          priority: 2,
          costTier: "medium",
          speedTier: "fast",
          qualityTier: "excellent",
          checkAvailability: () => !!process.env.GROK_API_KEY
        },
        {
          name: "gpt5_code",
          provider: ToolProvider.OPENAI,
          categories: [ToolCategory.CODE, ToolCategory.ANALYSIS],
          priority: 3,
          costTier: "medium",
          speedTier: "fast",
          qualityTier: "excellent",
          checkAvailability: () => !!process.env.OPENAI_API_KEY
        },
        {
          name: "gemini_analyze_code",
          provider: ToolProvider.GEMINI,
          categories: [ToolCategory.CODE, ToolCategory.ANALYSIS],
          priority: 4,
          costTier: "low",
          speedTier: "fast",
          qualityTier: "good",
          checkAvailability: () => !!process.env.GOOGLE_API_KEY
        }
      ],
      
      [ToolCategory.BRAINSTORM]: [
        {
          name: "grok_brainstorm",
          provider: ToolProvider.GROK,
          categories: [ToolCategory.BRAINSTORM],
          priority: 1,
          costTier: "medium",
          speedTier: "medium",
          qualityTier: "excellent",
          checkAvailability: () => !!process.env.GROK_API_KEY
        },
        {
          name: "openai_brainstorm",
          provider: ToolProvider.OPENAI,
          categories: [ToolCategory.BRAINSTORM],
          priority: 2,
          costTier: "high",
          speedTier: "medium",
          qualityTier: "excellent",
          checkAvailability: () => !!process.env.OPENAI_API_KEY
        },
        {
          name: "gemini_brainstorm",
          provider: ToolProvider.GEMINI,
          categories: [ToolCategory.BRAINSTORM],
          priority: 3,
          costTier: "low",
          speedTier: "fast",
          qualityTier: "good",
          checkAvailability: () => !!process.env.GOOGLE_API_KEY
        }
      ],
      
      [ToolCategory.SEARCH]: [
        {
          name: "perplexity_ask",
          provider: ToolProvider.PERPLEXITY,
          categories: [ToolCategory.SEARCH],
          priority: 1,
          costTier: "medium",
          speedTier: "fast",
          qualityTier: "excellent",
          checkAvailability: () => !!process.env.PERPLEXITY_API_KEY
        },
        {
          name: "perplexity_research",
          provider: ToolProvider.PERPLEXITY,
          categories: [ToolCategory.SEARCH, ToolCategory.ANALYSIS],
          priority: 2,
          costTier: "medium",
          speedTier: "medium",
          qualityTier: "excellent",
          checkAvailability: () => !!process.env.PERPLEXITY_API_KEY
        }
      ],
      
      [ToolCategory.ANALYSIS]: [
        {
          name: "gpt5_mini_analyze",
          provider: ToolProvider.OPENAI,
          categories: [ToolCategory.ANALYSIS],
          priority: 1,
          costTier: "medium",
          speedTier: "fast",
          qualityTier: "excellent",
          checkAvailability: () => !!process.env.OPENAI_API_KEY
        },
        {
          name: "openai_compare",
          provider: ToolProvider.OPENAI,
          categories: [ToolCategory.ANALYSIS],
          priority: 2,
          costTier: "medium",
          speedTier: "medium",
          qualityTier: "excellent",
          checkAvailability: () => !!process.env.OPENAI_API_KEY
        },
        {
          name: "gemini_analyze_text",
          provider: ToolProvider.GEMINI,
          categories: [ToolCategory.ANALYSIS],
          priority: 3,
          costTier: "low",
          speedTier: "fast",
          qualityTier: "good",
          checkAvailability: () => !!process.env.GOOGLE_API_KEY
        }
      ],
      
      [ToolCategory.DEBUG]: [
        {
          name: "grok_debug",
          provider: ToolProvider.GROK,
          categories: [ToolCategory.DEBUG],
          priority: 1,
          costTier: "medium",
          speedTier: "fast",
          qualityTier: "excellent",
          checkAvailability: () => !!process.env.GROK_API_KEY
        },
        {
          name: "gpt5_code",
          provider: ToolProvider.OPENAI,
          categories: [ToolCategory.DEBUG, ToolCategory.CODE],
          priority: 2,
          costTier: "medium",
          speedTier: "fast",
          qualityTier: "excellent",
          checkAvailability: () => !!process.env.OPENAI_API_KEY
        }
      ]
    };
  }
  
  /**
   * Set user preferences
   */
  setPreferences(preferences: Partial<ToolPreferences>): void {
    this.preferences = { ...this.preferences, ...preferences };
  }
  
  /**
   * Get the best tool for a category
   */
  getBestTool(
    category: ToolCategory,
    userPreference?: string
  ): ToolCapability | null {
    const tools = this.registry[category] || [];
    const availableTools = tools.filter(t => t.checkAvailability());
    
    if (availableTools.length === 0) {
      if (this.preferences.verboseLogging) {
        console.error(`No available tools for category: ${category}`);
      }
      return null;
    }
    
    // Check for user preference
    if (userPreference) {
      const preferredTool = availableTools.find(t => 
        t.name === userPreference || 
        t.provider === userPreference as ToolProvider
      );
      if (preferredTool) {
        if (this.preferences.verboseLogging) {
          console.error(`Using preferred tool: ${preferredTool.name}`);
        }
        return preferredTool;
      }
    }
    
    // Check for provider preference
    if (this.preferences.preferredProvider) {
      const providerTools = availableTools.filter(t => 
        t.provider === this.preferences.preferredProvider
      );
      if (providerTools.length > 0) {
        return this.selectByPriority(providerTools);
      }
    }
    
    // Apply optimization preferences
    let sortedTools = [...availableTools];
    
    if (this.preferences.costOptimization) {
      sortedTools.sort((a, b) => {
        const costOrder = { "free": 0, "low": 1, "medium": 2, "high": 3 };
        return costOrder[a.costTier] - costOrder[b.costTier];
      });
    } else if (this.preferences.speedPriority) {
      sortedTools.sort((a, b) => {
        const speedOrder = { "fast": 0, "medium": 1, "slow": 2 };
        return speedOrder[a.speedTier] - speedOrder[b.speedTier];
      });
    } else if (this.preferences.qualityPriority) {
      sortedTools.sort((a, b) => {
        const qualityOrder = { "excellent": 0, "good": 1, "basic": 2 };
        return qualityOrder[a.qualityTier] - qualityOrder[b.qualityTier];
      });
    }
    
    // Return best by priority within the sorted group
    return this.selectByPriority(sortedTools);
  }
  
  /**
   * Select tool by priority from a list
   */
  private selectByPriority(tools: ToolCapability[]): ToolCapability | null {
    if (tools.length === 0) return null;
    
    tools.sort((a, b) => a.priority - b.priority);
    const selected = tools[0];
    
    if (this.preferences.verboseLogging) {
      console.error(`Selected tool: ${selected.name} (${selected.provider})`);
    }
    
    return selected;
  }
  
  /**
   * Get fallback chain for a category
   */
  getFallbackChain(category: ToolCategory): ToolCapability[] {
    const tools = this.registry[category] || [];
    const availableTools = tools
      .filter(t => t.checkAvailability())
      .sort((a, b) => a.priority - b.priority);
    
    if (this.preferences.verboseLogging) {
      console.error(`Fallback chain for ${category}:`, 
        availableTools.map(t => t.name).join(" -> "));
    }
    
    return availableTools;
  }
  
  /**
   * Get all available tools
   */
  getAllAvailableTools(): ToolCapability[] {
    const allTools: ToolCapability[] = [];
    
    Object.values(this.registry).forEach(categoryTools => {
      categoryTools.forEach(tool => {
        if (tool.checkAvailability() && !allTools.some(t => t.name === tool.name)) {
          allTools.push(tool);
        }
      });
    });
    
    return allTools;
  }
  
  /**
   * Get tool by name
   */
  getToolByName(name: string): ToolCapability | null {
    // Check cache first
    if (this.toolCache.has(name)) {
      return this.toolCache.get(name)!;
    }
    
    // Search in registry
    for (const categoryTools of Object.values(this.registry)) {
      const tool = categoryTools.find(t => t.name === name);
      if (tool) {
        this.toolCache.set(name, tool);
        return tool;
      }
    }
    
    return null;
  }
  
  /**
   * Get status report
   */
  getStatus(): string {
    const providers = new Set<ToolProvider>();
    const categories = Object.keys(this.registry) as ToolCategory[];
    let totalAvailable = 0;
    let totalTools = 0;
    
    const report: string[] = ["# Tool Router Status\n"];
    
    categories.forEach(category => {
      const tools = this.registry[category];
      const available = tools.filter(t => t.checkAvailability());
      
      report.push(`\n## ${category.toUpperCase()}`);
      report.push(`Available: ${available.length}/${tools.length}`);
      
      available.forEach(tool => {
        providers.add(tool.provider);
        report.push(`  ✓ ${tool.name} (${tool.provider})`);
      });
      
      const unavailable = tools.filter(t => !t.checkAvailability());
      if (unavailable.length > 0) {
        unavailable.forEach(tool => {
          report.push(`  ✗ ${tool.name} (${tool.provider}) - Not configured`);
        });
      }
      
      totalAvailable += available.length;
      totalTools += tools.length;
    });
    
    report.unshift(`\nTotal: ${totalAvailable}/${totalTools} tools available`);
    report.unshift(`Providers: ${Array.from(providers).join(", ")}`);
    
    return report.join("\n");
  }
  
  /**
   * Get recommendation for a task
   */
  getRecommendation(task: string): {
    category: ToolCategory;
    tool: ToolCapability | null;
    alternatives: ToolCapability[];
  } {
    // Simple keyword-based category detection
    const taskLower = task.toLowerCase();
    
    let category: ToolCategory;
    if (taskLower.includes("code") || taskLower.includes("implement") || taskLower.includes("function")) {
      category = ToolCategory.CODE;
    } else if (taskLower.includes("debug") || taskLower.includes("fix") || taskLower.includes("error")) {
      category = ToolCategory.DEBUG;
    } else if (taskLower.includes("brainstorm") || taskLower.includes("idea") || taskLower.includes("creative")) {
      category = ToolCategory.BRAINSTORM;
    } else if (taskLower.includes("search") || taskLower.includes("find") || taskLower.includes("research")) {
      category = ToolCategory.SEARCH;
    } else if (taskLower.includes("analyze") || taskLower.includes("compare") || taskLower.includes("review")) {
      category = ToolCategory.ANALYSIS;
    } else {
      category = ToolCategory.REASONING;
    }
    
    const tool = this.getBestTool(category);
    const alternatives = this.getFallbackChain(category).slice(1, 4); // Top 3 alternatives
    
    return {
      category,
      tool,
      alternatives
    };
  }
}

// Export singleton instance with default preferences
export const toolRouter = new ToolRouter();