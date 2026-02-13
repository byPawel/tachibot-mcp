/**
 * Prompt Technique Tools
 * Transparent prompt engineering - discover, preview, and execute with full visibility
 */

import { z } from "zod";
import { PromptEngineerLite } from "../prompt-engineer-lite.js";
import { stripFormatting } from "../utils/format-stripper.js";
import { randomBytes } from "crypto";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";

// Token cache for preview→execute bridge (15 minute TTL)
const TOKEN_TTL_MS = 15 * 60 * 1000;
const CACHE_FILE = path.join(os.tmpdir(), 'tachibot-prompt-tokens.json');
const LAST_TOKEN_KEY = '_last_'; // Special key for "last" shortcut

interface TokenEntry {
  technique: string;
  tool: string;
  query: string;
  prompt: string;
  expires: number;
}

// Persistent token cache with atomic writes
function loadTokenCache(): Record<string, TokenEntry> {
  try {
    if (!fs.existsSync(CACHE_FILE)) return {};
    const raw = fs.readFileSync(CACHE_FILE, 'utf-8');
    const data = JSON.parse(raw) as Record<string, TokenEntry>;
    const now = Date.now();
    const clean: Record<string, TokenEntry> = {};
    let changed = false;

    // Prune expired entries during read
    for (const [key, entry] of Object.entries(data)) {
      if (entry.expires > now) {
        clean[key] = entry;
      } else {
        changed = true;
      }
    }

    // Only write back if we pruned something
    if (changed) saveTokenCache(clean);
    return clean;
  } catch {
    return {}; // Corrupt file, start fresh
  }
}

function saveTokenCache(data: Record<string, TokenEntry>): void {
  try {
    const tempPath = `${CACHE_FILE}.tmp`;
    fs.writeFileSync(tempPath, JSON.stringify(data), { mode: 0o600 });
    fs.renameSync(tempPath, CACHE_FILE); // Atomic rename
  } catch {
    // Silently fail - cache is optional
  }
}

function getToken(key: string): TokenEntry | null {
  const cache = loadTokenCache();
  const entry = cache[key];
  if (!entry || Date.now() > entry.expires) return null;
  return entry;
}

function setToken(key: string, entry: Omit<TokenEntry, 'expires'>): void {
  const cache = loadTokenCache();
  const fullEntry = { ...entry, expires: Date.now() + TOKEN_TTL_MS };
  cache[key] = fullEntry;
  cache[LAST_TOKEN_KEY] = fullEntry; // Always save as "last" for easy recall
  saveTokenCache(cache);
}

function deleteToken(key: string): void {
  const cache = loadTokenCache();
  delete cache[key];
  saveTokenCache(cache);
}

// Technique type definition
interface Technique {
  name: string;
  alias: string | null;
  description: string;
}

// Technique definitions organized by category
const TECHNIQUES: Record<string, Technique[]> = {
  creative: [
    { name: "what_if", alias: null, description: "Explore wild possibilities without limits" },
    { name: "alt_view", alias: "perspectives", description: "5 angles: child, scientist, artist, strategist, futurist" },
    { name: "creative_use", alias: "applications", description: "Cross-domain creative applications" },
    { name: "innovate", alias: "solutions", description: "Unconventional solutions, 3+ approaches" },
  ],
  research: [
    { name: "investigate", alias: "5w1h", description: "Who/What/When/Where/Why/How analysis" },
    { name: "evidence", alias: "facts", description: "Support, contradict, cases, stats, experts" },
  ],
  analytical: [
    { name: "analyze", alias: "systematic", description: "Components, relationships, patterns, conclusions" },
    { name: "first_principles", alias: "first_prin", description: "Truths, assumptions, atomic units, rebuild" },
    { name: "feasibility", alias: "feasible", description: "Technical/economic/time/resources/risks" },
  ],
  reflective: [
    { name: "reflect", alias: null, description: "Patterns, surprises, key insight, gaps" },
    { name: "patterns", alias: "connections", description: "Themes, causality, cycles, anomalies" },
    { name: "decompose", alias: "breakdown", description: "Core, sub-problems, dependencies, steps" },
    { name: "integrate", alias: "synthesize", description: "Convergent themes, contradictions, meta-pattern" },
  ],
  reasoning: [
    { name: "chain_of_thought", alias: "step_by_step", description: "Think step-by-step: identify, breakdown, logic, conclude" },
    { name: "tree_of_thoughts", alias: "explore_paths", description: "Branch 3 paths, explore, evaluate, prune, synthesize" },
    { name: "graph_of_thoughts", alias: "idea_map", description: "Map as graph: nodes=ideas, edges=connections, find loops" },
  ],
  verification: [
    { name: "self_consistency", alias: "consensus", description: "Generate 3 solutions, compare, vote best, explain confidence" },
    { name: "constitutional", alias: "principles", description: "Solve, critique against accuracy/safety/helpfulness, revise" },
  ],
  meta: [
    { name: "meta_prompting", alias: "improve_prompt", description: "Write better prompt for this, then solve using it" },
  ],
  debate: [
    { name: "adversarial", alias: "critic", description: "Argue FOR then AGAINST, find counterarguments, synthesize" },
    { name: "persona_simulation", alias: "debate", description: "Simulate experts debating (single prompt, not real multi-agent)" },
  ],
  judgment: [
    { name: "council_of_experts", alias: "judge", description: "Multi-model council: gather diverse perspectives, extract best elements, synthesize final verdict" },
  ],
  engineering: [
    { name: "reflexion", alias: "iterate", description: "Generate→Critique→Revise loop (2-3 rounds, score each criterion 1-10)" },
    { name: "react", alias: "thought_action", description: "Thought→Action→Observation loops for multi-step coding tasks" },
    { name: "rubber_duck", alias: "explain_code", description: "Explain code line-by-line to a novice, flag bugs/assumptions" },
    { name: "test_driven", alias: "tdd", description: "List edge cases→Write tests→Minimal code→Refactor. Tests before code." },
  ],
  research_advanced: [
    { name: "least_to_most", alias: "build_up", description: "Decompose to atomic sub-problems, solve simplest first, build up to hardest" },
  ],
  decision: [
    { name: "pre_mortem", alias: "failure_analysis", description: "Assume project failed → brainstorm 7-10 causes → rank → mitigate top 5" },
  ],
  structured_coding: [
    { name: "scot", alias: "structured_cot", description: "Structured CoT: reason in code structures (sequence/branch/loop) before writing code (Li et al. 2025, +13.79%)" },
    { name: "pre_post", alias: "contracts", description: "Design by contract: state preconditions + postconditions before implementing" },
    { name: "bdd_spec", alias: "given_when_then", description: "Behavioral specs: Given/When/Then scenarios before code. Each scenario = a test." },
  ],
};

// All technique names for validation
const ALL_TECHNIQUE_NAMES = Object.values(TECHNIQUES)
  .flat()
  .flatMap(t => [t.name, t.alias].filter(Boolean)) as string[];

// Initialize prompt engineer
const promptEngineer = new PromptEngineerLite();

/**
 * Generate execution token
 */
function generateToken(): string {
  return `pt_${randomBytes(16).toString('hex')}`;
}

/**
 * Tool 1: list_prompt_techniques
 * Discovery tool - shows all 21 techniques organized by category
 */
export const listPromptTechniquesTool = {
  name: "list_prompt_techniques",
  description: "Discover available prompt engineering techniques. Shows all 31 techniques organized by category.",
  parameters: z.object({
    filter: z.enum(["all", "creative", "research", "analytical", "reflective", "reasoning", "verification", "meta", "debate", "judgment", "engineering", "research_advanced", "decision", "structured_coding"])
      .optional()
      .default("all")
      .describe("Filter by category (default: all)")
  }),
  execute: async (args: { filter?: string }): Promise<string> => {
    const { filter = "all" } = args;

    const categories: [string, Technique[]][] = filter === "all"
      ? Object.entries(TECHNIQUES)
      : [[filter, TECHNIQUES[filter] || []]];

    let output = `PROMPT TECHNIQUES\n${'='.repeat(50)}\n\n`;

    let totalCount = 0;
    for (const [category, techniques] of categories) {
      if (!techniques || techniques.length === 0) continue;

      output += `${category.toUpperCase()}\n${'-'.repeat(category.length)}\n`;

      for (const tech of techniques) {
        const aliasStr = tech.alias ? ` (alias: ${tech.alias})` : '';
        output += `  ${tech.name}${aliasStr}\n`;
        output += `    ${tech.description}\n\n`;
        totalCount++;
      }
    }

    output += `${'-'.repeat(50)}\n`;
    output += `Total: ${totalCount} techniques\n\n`;
    output += `Usage:\n`;
    output += `  preview_prompt_technique --technique first_principles --tool grok_reason --query "your question"\n`;
    output += `  execute_prompt_technique --execution_token "pt_..." (from preview)\n`;

    return stripFormatting(output);
  }
};

/**
 * Tool 2: preview_prompt_technique
 * Read-only preview - shows enhanced prompt WITHOUT execution
 */
export const previewPromptTechniqueTool = {
  name: "preview_prompt_technique",
  description: "Preview how a technique enhances your prompt WITHOUT executing. Returns an execution_token for later use.",
  parameters: z.object({
    technique: z.string().describe("Technique name (e.g., first_principles, tree_of_thoughts)"),
    tool: z.string().describe("Target tool (e.g., grok_reason, gemini_brainstorm)"),
    query: z.string().describe("Your query or problem")
  }),
  execute: async (args: { technique: string; tool: string; query: string }): Promise<string> => {
    const { technique, tool, query } = args;

    // Validate technique exists
    const normalizedTechnique = technique.toLowerCase().replace(/-/g, '_');
    if (!ALL_TECHNIQUE_NAMES.includes(normalizedTechnique)) {
      // Try to find a close match
      const suggestions = ALL_TECHNIQUE_NAMES
        .filter(t => t.includes(normalizedTechnique) || normalizedTechnique.includes(t))
        .slice(0, 3);

      return stripFormatting(`ERROR: Unknown technique "${technique}"\n\n` +
        (suggestions.length > 0 ? `Did you mean: ${suggestions.join(', ')}?\n\n` : '') +
        `Use list_prompt_techniques to see all available techniques.`);
    }

    // Generate enhanced prompt
    const enhancedPrompt = promptEngineer.applyTechnique(tool, normalizedTechnique, query);

    // Find technique details
    let techniqueDetails: (Technique & { category: string }) | null = null;
    for (const [category, techniques] of Object.entries(TECHNIQUES)) {
      const found = techniques.find(t => t.name === normalizedTechnique || t.alias === normalizedTechnique);
      if (found) {
        techniqueDetails = { ...found, category };
        break;
      }
    }

    // Generate and cache token (persistent, survives server restarts)
    const token = generateToken();
    setToken(token, {
      technique: normalizedTechnique,
      tool,
      query,
      prompt: enhancedPrompt
    });

    // Format output
    const aliasStr = techniqueDetails?.alias ? ` (alias: ${techniqueDetails.alias})` : '';

    let output = `PROMPT TECHNIQUE PREVIEW\n${'='.repeat(50)}\n\n`;
    output += `Technique: ${normalizedTechnique}${aliasStr}\n`;
    output += `Category: ${techniqueDetails?.category || 'unknown'}\n`;
    output += `Target Tool: ${tool}\n\n`;
    output += `--- ORIGINAL QUERY ---\n`;
    output += `${query}\n\n`;
    output += `--- ENHANCED PROMPT ---\n`;
    output += `${enhancedPrompt}\n\n`;
    output += `--- EXECUTION TOKEN ---\n`;
    output += `${token}\n\n`;
    output += `Use execute_prompt_technique with this token to run.\n`;
    output += `Token expires in 5 minutes.\n`;

    return stripFormatting(output);
  }
};

/**
 * Tool 3: execute_prompt_technique
 * Executes tool with technique. Accepts token OR full params.
 */
export const executePromptTechniqueTool = {
  name: "execute_prompt_technique",
  description: "Execute a prompt technique. Use execution_token from preview, OR provide full params (technique, tool, query). Use \"last\" as token to execute most recent preview.",
  parameters: z.object({
    execution_token: z.string().optional().describe("Token from preview, or \"last\" for most recent preview"),
    technique: z.string().optional().describe("Or provide full params: technique name"),
    tool: z.string().optional().describe("Target tool name"),
    query: z.string().optional().describe("Your query or problem")
  }),
  execute: async (args: {
    execution_token?: string;
    technique?: string;
    tool?: string;
    query?: string;
  }, context: any): Promise<string> => {
    const { execution_token, technique, tool, query } = args;

    let finalTechnique: string;
    let finalTool: string;
    let enhancedPrompt: string;

    // Resolve params from token or direct args
    if (execution_token) {
      // Support "last" as shortcut for most recent preview
      const tokenKey = execution_token.toLowerCase() === 'last' ? LAST_TOKEN_KEY : execution_token;
      const cached = getToken(tokenKey);
      if (!cached) {
        const hint = execution_token.toLowerCase() === 'last'
          ? `No recent preview found. Run preview_prompt_technique first.`
          : `Tokens expire after 15 minutes. Use preview_prompt_technique to get a new token,\nor provide full params (technique, tool, query) directly.\n\nTip: Use "last" to execute the most recent preview.`;
        return stripFormatting(`ERROR: Invalid or expired token "${execution_token}"\n\n${hint}`);
      }

      finalTechnique = cached.technique;
      finalTool = cached.tool;
      enhancedPrompt = cached.prompt;

      // Clean up used token (but keep "last" reference)
      if (tokenKey !== LAST_TOKEN_KEY) {
        deleteToken(tokenKey);
      }
    } else {
      // Validate required params
      if (!technique || !tool || !query) {
        return stripFormatting(`ERROR: Missing required parameters\n\n` +
          `Either provide execution_token (from preview_prompt_technique),\n` +
          `OR provide all three: technique, tool, query`);
      }

      // Validate technique exists
      const normalizedTechnique = technique.toLowerCase().replace(/-/g, '_');
      if (!ALL_TECHNIQUE_NAMES.includes(normalizedTechnique)) {
        return stripFormatting(`ERROR: Unknown technique "${technique}"\n\n` +
          `Use list_prompt_techniques to see all available techniques.`);
      }

      finalTechnique = normalizedTechnique;
      finalTool = tool;
      enhancedPrompt = promptEngineer.applyTechnique(tool, normalizedTechnique, query);
    }

    // Find technique details for output
    let techniqueDetails: (Technique & { category: string }) | null = null;
    for (const [category, techniques] of Object.entries(TECHNIQUES)) {
      const found = techniques.find(t => t.name === finalTechnique || t.alias === finalTechnique);
      if (found) {
        techniqueDetails = { ...found, category };
        break;
      }
    }

    // Execute the tool with enhanced prompt
    // Import the tool dynamically based on name
    let result: string;
    try {
      result = await executeTargetTool(finalTool, enhancedPrompt, context);
    } catch (error) {
      return stripFormatting(`ERROR: Failed to execute tool "${finalTool}"\n\n` +
        `Error: ${error instanceof Error ? error.message : String(error)}\n\n` +
        `Enhanced prompt was:\n${enhancedPrompt}`);
    }

    // Format output
    const aliasStr = techniqueDetails?.alias ? ` (alias: ${techniqueDetails.alias})` : '';

    let output = `PROMPT TECHNIQUE EXECUTION\n${'='.repeat(50)}\n\n`;
    output += `Technique: ${finalTechnique}${aliasStr}\n`;
    output += `Tool: ${finalTool}\n\n`;
    output += `--- ENHANCED PROMPT ---\n`;
    output += `${enhancedPrompt}\n\n`;
    output += `--- RESULT ---\n`;
    output += `${result}\n`;

    return stripFormatting(output);
  }
};

/**
 * Execute target tool with the enhanced prompt
 */
async function executeTargetTool(toolName: string, prompt: string, context: any): Promise<string> {
  // Map tool names to their execution functions
  // We'll use dynamic imports to avoid circular dependencies

  const toolMappings: Record<string, () => Promise<string>> = {
    // Grok tools
    'grok_reason': async () => {
      const { grokReasonTool } = await import('./grok-tools.js');
      return grokReasonTool.execute({ problem: prompt }, context);
    },
    'grok_brainstorm': async () => {
      const { grokBrainstormTool } = await import('./grok-tools.js');
      return grokBrainstormTool.execute({ topic: prompt }, context);
    },
    'grok_architect': async () => {
      const { grokArchitectTool } = await import('./grok-tools.js');
      return grokArchitectTool.execute({ requirements: prompt }, context);
    },
    'grok_debug': async () => {
      const { grokDebugTool } = await import('./grok-tools.js');
      return grokDebugTool.execute({ issue: prompt }, context);
    },
    'grok_code': async () => {
      const { grokCodeTool } = await import('./grok-tools.js');
      return grokCodeTool.execute({ task: 'analyze', code: prompt }, context);
    },

    // Gemini tools
    'gemini_brainstorm': async () => {
      const { geminiBrainstormTool } = await import('./gemini-tools.js');
      return geminiBrainstormTool.execute({ prompt }, context);
    },
    'gemini_analyze_code': async () => {
      const { geminiAnalyzeCodeTool } = await import('./gemini-tools.js');
      return geminiAnalyzeCodeTool.execute({ code: prompt }, context);
    },
    'gemini_analyze_text': async () => {
      const { geminiAnalyzeTextTool } = await import('./gemini-tools.js');
      return geminiAnalyzeTextTool.execute({ text: prompt }, context);
    },

    // OpenAI tools
    'openai_reason': async () => {
      const { openaiGpt5ReasonTool } = await import('./openai-tools.js');
      return openaiGpt5ReasonTool.execute({ query: prompt }, context);
    },
    'openai_brainstorm': async () => {
      const { openAIBrainstormTool } = await import('./openai-tools.js');
      return openAIBrainstormTool.execute({ problem: prompt }, context);
    },

    // Perplexity tools
    'perplexity_ask': async () => {
      const { perplexityAskTool } = await import('./perplexity-tools.js');
      return perplexityAskTool.execute({ query: prompt }, context);
    },
    'perplexity_reason': async () => {
      const { perplexityReasonTool } = await import('./perplexity-tools.js');
      return perplexityReasonTool.execute({ problem: prompt }, context);
    },
    'perplexity_research': async () => {
      const { perplexityResearchTool } = await import('./perplexity-tools.js');
      return perplexityResearchTool.execute({ topic: prompt }, context);
    },

    // OpenRouter tools (Qwen, Kimi)
    'qwen_coder': async () => {
      const { qwenCoderTool } = await import('./openrouter-tools.js');
      return qwenCoderTool.execute({ task: 'analyze', code: prompt }, context);
    },
    'qwen_algo': async () => {
      const { qwenAlgoTool } = await import('./openrouter-tools.js');
      return qwenAlgoTool.execute({ problem: prompt }, context);
    },
    'kimi_thinking': async () => {
      const { kimiThinkingTool } = await import('./openrouter-tools.js');
      return kimiThinkingTool.execute({ problem: prompt }, context);
    },
  };

  const executor = toolMappings[toolName];
  if (!executor) {
    throw new Error(`Tool "${toolName}" is not supported for prompt techniques. ` +
      `Supported tools: ${Object.keys(toolMappings).join(', ')}`);
  }

  return executor();
}

/**
 * Get all prompt technique tools
 */
export function getPromptTechniqueTools() {
  return [
    listPromptTechniquesTool,
    previewPromptTechniqueTool,
    executePromptTechniqueTool
  ];
}
