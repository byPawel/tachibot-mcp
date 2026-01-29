/**
 * OpenRouter Tools Implementation
 * Provides access to Qwen3, QwQ, and other models via OpenRouter
 */

import { z } from "zod";
import { FORMAT_INSTRUCTION } from "../utils/format-constants.js";
import { stripFormatting } from "../utils/format-stripper.js";
import { withHeartbeat } from "../utils/streaming-helper.js";
import { getTimeoutConfig } from "../config/timeout-config.js";

// NOTE: dotenv is loaded in server.ts before any imports
// No need to reload here - just read from process.env
// OpenRouter API configuration
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const OPENROUTER_API_URL = "https://openrouter.ai/api/v1/chat/completions";

// Available OpenRouter models (verified names)
export enum OpenRouterModel {
  // Qwen models - Use QWEN3_CODER (routes via Google, not broken Alibaba)
  QWEN3_CODER = "qwen/qwen3-coder",                      // 480B MoE - PRIMARY (routes via Google)
  QWEN3_CODER_PLUS = "qwen/qwen3-coder-plus",           // Alibaba-only, BROKEN free tier issues
  QWEN3_CODER_FLASH = "qwen/qwen3-coder-flash",          // Fast/cheap alternative
  QWEN3_30B = "qwen/qwen3-30b-a3b-instruct-2507",        // 30B MoE model
  QWEN3_235B_THINKING = "qwen/qwen3-235b-a22b-thinking-2507", // 235B thinking model
  QWQ_32B = "qwen/qwq-32b",                              // Deep reasoning - CodeElo 1261
  QWEN3_MAX_THINKING = "qwen/qwen3-235b-a22b-thinking-2507", // 235B MoE thinking - heavy reasoning

  // Moonshot AI models (Kimi)
  KIMI_K2_THINKING = "moonshotai/kimi-k2-thinking",     // 1T MoE, 32B active - agentic reasoning
  KIMI_K2_5 = "moonshotai/kimi-k2.5",                   // Multimodal, Agent Swarm

  // MiniMax models - VERY CHEAP, best agentic
  MINIMAX_M2_1 = "minimax/minimax-m2.1",               // 230B/10B MoE - SWE 72.5%, τ²-Bench 77.2%
  MINIMAX_M2 = "minimax/minimax-m2",                   // Fallback
}

// Fallback map for when providers hit quota limits
const MODEL_FALLBACKS: Partial<Record<OpenRouterModel, OpenRouterModel>> = {
  [OpenRouterModel.QWEN3_CODER]: OpenRouterModel.QWEN3_CODER,
};

// Get timeout from centralized config (default: 180s for thinking models)
const getOpenRouterTimeout = () => getTimeoutConfig().openrouter;

/**
 * Optional parameters for OpenRouter API calls
 */
interface OpenRouterOptions {
  top_p?: number;           // Nucleus sampling (0-1)
  top_k?: number;           // Top-k sampling
  presence_penalty?: number; // Reduce repetition (-2 to 2)
  frequency_penalty?: number; // Reduce word frequency (-2 to 2)
}

/**
 * Call OpenRouter API with auto-fallback on provider quota errors
 * Includes timeout to prevent indefinite hangs
 */
export async function callOpenRouter(
  messages: Array<{ role: string; content: string }>,
  model: OpenRouterModel = OpenRouterModel.QWEN3_CODER,
  temperature: number = 0.7,
  maxTokens: number = 8192,
  optionsOrRetry: OpenRouterOptions | boolean = false,
  timeoutMs?: number
): Promise<string> {
  // Handle backward compatibility: boolean = _isRetry, object = options
  const _isRetry = typeof optionsOrRetry === 'boolean' ? optionsOrRetry : false;
  const options: OpenRouterOptions = typeof optionsOrRetry === 'object' ? optionsOrRetry : {};

  if (!OPENROUTER_API_KEY) {
    return `[OpenRouter API key not configured. Add OPENROUTER_API_KEY to .env file]`;
  }

  // Create AbortController for timeout (use provided timeout or config default)
  const effectiveTimeout = timeoutMs ?? getOpenRouterTimeout();
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), effectiveTimeout);

  try {
    const requestBody: any = {
      model,
      messages,
      temperature,
      max_tokens: maxTokens,
      stream: false,
      // Optional sampling parameters (only add if specified)
      ...(options.top_p !== undefined && { top_p: options.top_p }),
      ...(options.top_k !== undefined && { top_k: options.top_k }),
      ...(options.presence_penalty !== undefined && { presence_penalty: options.presence_penalty }),
      ...(options.frequency_penalty !== undefined && { frequency_penalty: options.frequency_penalty }),
    };

    const response = await fetch(OPENROUTER_API_URL, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://tachibot-mcp.local",
        "X-Title": "Tachibot MCP Server"
      },
      body: JSON.stringify(requestBody),
      signal: controller.signal
    });

    if (!response.ok) {
      const errorText = await response.text();

      // Check for Alibaba free tier quota error - auto-fallback
      if (!_isRetry && errorText.includes("FreeTierOnly") && MODEL_FALLBACKS[model]) {
        const fallback = MODEL_FALLBACKS[model]!;
        console.error(`[OpenRouter] ${model} hit provider quota, falling back to ${fallback}`);
        return callOpenRouter(messages, fallback, temperature, maxTokens, true);
      }

      throw new Error(`OpenRouter API error: ${response.statusText} - ${errorText}`);
    }

    const data = await response.json() as any;
    const choice = data.choices?.[0];
    // Reasoning models (Kimi K2.5, etc.) may return content in different fields:
    // - message.content: standard final answer
    // - message.reasoning_content: native thinking model format (provider-specific)
    // - message.reasoning: OpenRouter's canonical reasoning tokens field
    // - choice.reasoning: choice-level reasoning fallback
    const content = choice?.message?.content
      || choice?.message?.reasoning_content
      || choice?.message?.reasoning
      || choice?.reasoning
      || "No response from OpenRouter";
    return stripFormatting(content);
  } catch (error) {
    // Handle abort/timeout
    if (error instanceof Error && error.name === 'AbortError') {
      return `[OpenRouter timeout: Request exceeded ${effectiveTimeout / 1000}s limit for model ${model}]`;
    }

    const errorMsg = error instanceof Error ? error.message : String(error);

    // Also catch quota errors from thrown exceptions
    if (!_isRetry && errorMsg.includes("FreeTierOnly") && MODEL_FALLBACKS[model]) {
      const fallback = MODEL_FALLBACKS[model]!;
      console.error(`[OpenRouter] ${model} hit provider quota, falling back to ${fallback}`);
      return callOpenRouter(messages, fallback, temperature, maxTokens, true);
    }

    return `[OpenRouter error: ${errorMsg}]`;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Qwen Coder Tool
 * Advanced code generation with 480B MoE model
 */
export const qwenCoderTool = {
  name: "qwen_coder",
  description: "Code generation. Put CODE in 'code' parameter and REQUIREMENTS in 'requirements' parameter.",
  parameters: z.object({
    task: z.enum(["generate", "review", "optimize", "debug", "refactor", "explain", "analyze"])
      .describe("Code task - must be one of: generate, review, optimize, debug, refactor, explain, analyze"),
    code: z.string().optional().describe("The actual source code (for review/optimize/debug/refactor/explain/analyze tasks)"),
    requirements: z.string().optional().default("").describe("Requirements or description for the task (for generate task, put your request here)"),
    language: z.string().optional().describe("Programming language (e.g., 'typescript', 'python')"),
    useFree: z.boolean().optional().default(false).describe("Use free tier model instead of premium")
  }),
  execute: async (args: {
    task: string;
    code?: string;
    requirements?: string; // Changed: Optional
    language?: string;
    useFree?: boolean
  }, { log, reportProgress }: any) => {
    const taskPrompts = {
      generate: "Generate new code according to requirements",
      review: "Review code for quality, bugs, and improvements",
      optimize: "Optimize code for performance and efficiency",
      debug: "Debug and fix issues in the code",
      refactor: "Refactor code for better structure and maintainability",
      explain: "Explain how the code works in detail",
      analyze: "Analyze code for patterns, complexity, architecture, and provide insights"
    };

    const systemPrompt = `You are Qwen3-Coder, an advanced code generation model.
Task: ${taskPrompts[args.task as keyof typeof taskPrompts]}
${args.language ? `Language: ${args.language}` : ''}
Focus on: clean code, best practices, performance, and maintainability.
${FORMAT_INSTRUCTION}`;

    const requirementsText = args.requirements || "Analyze and provide insights";
    const userPrompt = args.code
      ? `Code:\n\`\`\`${args.language || ''}\n${args.code}\n\`\`\`\n\nRequirements: ${requirementsText}`
      : requirementsText;

    const messages = [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt }
    ];

    const model = args.useFree === true ? OpenRouterModel.QWEN3_30B : OpenRouterModel.QWEN3_CODER;
    // Use heartbeat to prevent MCP timeout
    const reportFn = reportProgress ?? (async () => {});
    return await withHeartbeat(
      () => callOpenRouter(messages, model, 0.2, 8000),
      reportFn
    );
  }
};

/**
 * QwQ Reasoning Tool
 * Deep reasoning with QwQ-32B model
 */
export const qwqReasoningTool = {
  name: "qwq_reason",
  description: "Deep reasoning. Put your PROBLEM in the 'problem' parameter.",
  parameters: z.object({
    problem: z.string().describe("The problem to reason about (REQUIRED - put your question here)"),
    context: z.string().optional().describe("Additional context for the reasoning task"),
    approach: z.string()
      .optional()
      .default("step-by-step")
      .describe("Reasoning approach (e.g., step-by-step, mathematical, logical, creative)"),
    useFree: z.boolean().optional().default(true).describe("Use free tier model (default: true)")
  }),
  execute: async (args: { 
    problem: string; 
    context?: string; 
    approach?: string;
    useFree?: boolean 
  }, { log }: any) => {
    const approachPrompts = {
      "step-by-step": "Break down the problem and solve it step by step",
      mathematical: "Apply mathematical reasoning and proofs",
      logical: "Use formal logic and deductive reasoning",
      creative: "Think creatively and explore unconventional solutions"
    };
    
    const messages = [
      {
        role: "system",
        content: `You are QwQ, specialized in deep reasoning and problem-solving.
${approachPrompts[args.approach as keyof typeof approachPrompts || 'step-by-step']}.
Show your thinking process clearly.
${args.context ? `Context: ${args.context}` : ''}
${FORMAT_INSTRUCTION}`
      },
      {
        role: "user",
        content: args.problem
      }
    ];
    
    const model = args.useFree !== false ? OpenRouterModel.QWQ_32B : OpenRouterModel.QWQ_32B;
    return await callOpenRouter(messages, model, 0.3, 6000);
  }
};

/**
 * Qwen General Tool
 * General-purpose assistance with Qwen3-32B
 */
export const qwenGeneralTool = {
  name: "qwen_general",
  description: "General-purpose assistance with Qwen3. Put your QUERY in the 'query' parameter.",
  parameters: z.object({
    query: z.string().describe("Your question or request (REQUIRED - put your question here)"),
    mode: z.string()
      .optional()
      .default("chat")
      .describe("Interaction mode (e.g., chat, analysis, creative, technical)"),
    useFree: z.boolean().optional().default(true).describe("Use free tier model (default: true)")
  }),
  execute: async (args: { query: string; mode?: string; useFree?: boolean }, { log }: any) => {
    const modePrompts = {
      chat: "Provide helpful, conversational responses",
      analysis: "Provide detailed analysis and insights",
      creative: "Be creative and innovative in your response",
      technical: "Focus on technical accuracy and detail"
    };
    
    const messages = [
      {
        role: "system",
        content: `You are Qwen3, a helpful AI assistant.
${modePrompts[args.mode as keyof typeof modePrompts || 'chat']}.
${FORMAT_INSTRUCTION}`
      },
      {
        role: "user",
        content: args.query
      }
    ];
    
    const model = args.useFree === true ? OpenRouterModel.QWEN3_30B : OpenRouterModel.QWEN3_CODER;
    return await callOpenRouter(messages, model, 0.7, 3000);
  }
};

/**
 * Multi-Model Tool
 * Access various models via OpenRouter
 */
export const openRouterMultiModelTool = {
  name: "openrouter_multi",
  description: "Access Qwen and Kimi models. Put your QUERY in the 'query' parameter.",
  parameters: z.object({
    query: z.string().describe("Your question or request (REQUIRED - put your question here)"),
    model: z.enum([
      "qwen-coder", "qwen-coder-plus",
      "qwq-32b", "kimi-k2-thinking"
    ]).describe("Model to use - must be one of: qwen-coder, qwen-coder-plus, qwq-32b, kimi-k2-thinking"),
    temperature: z.coerce.number().optional().default(0.7).describe("Response temperature (0-1, default: 0.7)")
  }),
  execute: async (args: { query: string; model: string; temperature?: number }, { log }: any) => {
    const modelMap = {
      "qwen-coder": OpenRouterModel.QWEN3_CODER,
      "qwen-coder-plus": OpenRouterModel.QWEN3_CODER,
      "qwq-32b": OpenRouterModel.QWQ_32B,
      "kimi-k2-thinking": OpenRouterModel.KIMI_K2_THINKING
    };

    const messages = [
      {
        role: "system",
        content: "You are a helpful AI assistant. Provide clear, accurate responses."
      },
      {
        role: "user",
        content: args.query
      }
    ];

    const selectedModel = modelMap[args.model as keyof typeof modelMap];
    if (!selectedModel) {
      return `[Model ${args.model} not available]`;
    }

    return await callOpenRouter(messages, selectedModel, args.temperature || 0.7, 4000);
  }
};

/**
 * Algorithm Optimization Tool
 * Principal Algorithm Engineer & Competitive Programming Coach
 * Deep algorithmic reasoning with QwQ-32B
 */
export const qwenAlgoTool = {
  name: "qwen_algo",
  description: "Expert algorithm analysis: complexity profiling, optimization tiers, constraint-driven recommendations, competitive programming patterns. Put PROBLEM/CODE in 'problem' parameter.",
  parameters: z.object({
    problem: z.string().describe("The algorithm problem or code to analyze (REQUIRED - put your question/code here)"),
    constraints: z.string().optional().describe("Input constraints: N size, time limit, memory limit (e.g., 'N≤10^5, 1s, 256MB')"),
    context: z.string().optional().describe("Additional context: current performance, environment, language"),
    focus: z.string()
      .optional()
      .default("general")
      .describe("Analysis focus: optimize, complexity, data-structure, memory, correctness, competitive, cache, general")
  }),
  execute: async (args: {
    problem: string;
    constraints?: string;
    context?: string;
    focus?: string;
  }, { log, reportProgress }: any) => {
    // Enhanced focus prompts with deep expertise
    const focusPrompts: Record<string, string> = {
      optimize: `FOCUS: Performance Optimization
- Identify bottlenecks and hot loops
- Tier A: Can we reduce complexity class? (O(N²)→O(N log N))
- Tier B: Better data structure? (map→unordered_map, vector+binary search)
- Tier C: Micro-optimizations (cache locality, branch prediction, SIMD)
- Quantify expected speedup for each suggestion`,

      complexity: `FOCUS: Complexity Profiling
- Time: Best, Average, Worst case with Big-O
- Space: Auxiliary stack vs heap allocation
- Amortized analysis for dynamic structures (vector push_back, union-find, monotonic stack)
- Recurrences: Apply Master Theorem or Akra-Bazzi
- Empirical: What input sizes trigger worst case?`,

      "data-structure": `FOCUS: Data Structure Selection
Use this decision framework:
- Point update + prefix sum? → Fenwick Tree
- Range query + updates? → Segment Tree (lazy for range updates)
- Connectivity/merges? → DSU (Union-Find) with path compression
- Sliding window min/max? → Monotonic Deque
- Sparse keys, O(1) access? → unordered_map (warn about worst-case, use reserve())
- Dense boolean DP? → bitset (64x speedup)
- Static set + many queries? → Sorted vector + binary search (cache-friendly)
Explain WHY based on operation mix, N, and memory constraints`,

      memory: `FOCUS: Memory Optimization
- Peak heap usage and when it occurs
- Allocation churn (bytes allocated per operation)
- Top allocating call sites
- Reduce pointer chasing (linked list → vector)
- SoA vs AoS layout for field scanning
- Small-object optimization (indices vs pointers)
- Preallocate and reuse buffers
- GC pressure in managed languages`,

      correctness: `FOCUS: Correctness Verification
- Loop invariants: What must be true at each iteration?
- Off-by-one errors: Check boundary conditions
- Edge cases: Empty input, single element, max input, sorted/reverse sorted
- Integer overflow: Check multiplication, sum accumulation
- Floating point precision issues
- Recursion termination conditions
- Concurrent access issues (if applicable)`,

      competitive: `FOCUS: Competitive Programming Patterns
Apply constraint-driven algorithm selection:
- N ≤ 20: O(2^N) or O(N·2^N) → Bitmask DP, recursion with memoization
- N ≤ 40: O(2^(N/2)) → Meet-in-the-middle
- N ≤ 100: O(N³) or O(N⁴) → Floyd-Warshall, dense matrix ops
- N ≤ 2000: O(N²) → 2D DP, pairwise iteration
- N ≤ 2×10⁵: O(N log N) or O(N) → Sorting, segment trees, hash maps, two pointers
- N ≤ 10⁹: O(√N) or O(log N) → Math formulas, binary search, matrix exponentiation
Recommend: sliding window, two pointers, monotonic stack, binary search on answer`,

      cache: `FOCUS: Cache & Hardware Optimization
- Cache locality: Sequential access patterns
- Reduce cache misses: Profile L1/L2/L3 hit rates
- Data-oriented design: SoA layout for scanning
- Batch operations: Fewer passes over memory
- Prefetching hints where supported
- Branch prediction: Reduce unpredictable branches
- Memory alignment for SIMD operations
- False sharing in concurrent code`,

      general: `FOCUS: Comprehensive Algorithm Analysis
Provide full analysis covering:
1. CONSTRAINT ANALYSIS - Map input size to max acceptable complexity
2. COMPLEXITY PROFILING - Time/Space (best/avg/worst), recurrences
3. OPTIMIZATION TIERS - A: Algorithmic, B: Data Structure, C: Micro
4. CORRECTNESS - Invariants, edge cases, overflow risks
5. RECOMMENDATIONS - Ranked by impact with expected improvement`
    };

    // Core system prompt with competitive programming wisdom
    const systemPrompt = `You are a Principal Algorithm Engineer and Competitive Programming Coach (ICPC/IOI/Codeforces expert level).

${focusPrompts[args.focus || 'general']}

CONSTRAINT-TO-COMPLEXITY MAPPING (memorize this):
┌─────────────┬────────────────────┬─────────────────────────────────┐
│ Input Size  │ Max Complexity     │ Typical Algorithms              │
├─────────────┼────────────────────┼─────────────────────────────────┤
│ N ≤ 10      │ O(N!)              │ Brute force permutations        │
│ N ≤ 20      │ O(2^N), O(N·2^N)   │ Bitmask DP, backtracking        │
│ N ≤ 40      │ O(2^(N/2))         │ Meet-in-the-middle              │
│ N ≤ 100     │ O(N³), O(N⁴)       │ Floyd-Warshall, 3D DP           │
│ N ≤ 500     │ O(N³)              │ 3D DP, matrix operations        │
│ N ≤ 2000    │ O(N²)              │ 2D DP, pairwise comparisons     │
│ N ≤ 10⁵     │ O(N log N)         │ Sorting, segment tree, FFT      │
│ N ≤ 10⁶     │ O(N)               │ Linear DP, two pointers, hashing│
│ N ≤ 10⁹     │ O(√N), O(log N)    │ Math, binary search, matrix exp │
└─────────────┴────────────────────┴─────────────────────────────────┘

OPTIMIZATION HIERARCHY (always label which tier):
• Tier A - ALGORITHMIC (10-1000x): Change complexity class
• Tier B - DATA STRUCTURE (2-20x): Better container/access pattern
• Tier C - MICRO (1.1-5x): Cache, branches, memory layout

OUTPUT STRUCTURE:
1. Current Analysis: What the code/algorithm does now
2. Complexity: Time/Space with Best/Avg/Worst
3. ${args.constraints ? 'Constraint Check: Is current complexity viable?' : 'Viable For: What input sizes work?'}
4. Improvements: Tiered recommendations with expected gains
5. Edge Cases: 3 critical test cases to verify
${args.focus === 'competitive' || args.focus === 'general' ? '6. CP Patterns: Applicable competitive programming techniques' : ''}

${FORMAT_INSTRUCTION}`;

    // Build user prompt with all available context
    let userPrompt = args.problem;
    if (args.constraints || args.context) {
      const parts = [];
      if (args.constraints) parts.push(`CONSTRAINTS: ${args.constraints}`);
      if (args.context) parts.push(`CONTEXT: ${args.context}`);
      userPrompt = `${parts.join('\n')}\n\nPROBLEM/CODE:\n${args.problem}`;
    }

    const messages = [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt }
    ];

    // Use heartbeat to prevent MCP timeout
    const reportFn = reportProgress ?? (async () => {});
    return await withHeartbeat(
      () => callOpenRouter(messages, OpenRouterModel.QWQ_32B, 0.25, 6000),
      reportFn
    );
  }
};

/**
 * Code Competition Tool
 * Competitive programming and algorithm challenges
 */
export const qwenCompetitiveTool = {
  name: "qwen_competitive",
  description: "Competitive programming. Put the PROBLEM in the 'problem' parameter.",
  parameters: z.object({
    problem: z.string().describe("The competitive programming problem (REQUIRED - put your problem here)"),
    constraints: z.string().optional().describe("Problem constraints (e.g., 'n <= 10^5')"),
    language: z.enum(["python", "cpp", "java", "javascript", "rust"])
      .optional()
      .default("python")
      .describe("Programming language - must be one of: python, cpp, java, javascript, rust"),
    optimize: z.boolean().optional().default(true).describe("Optimize for time and space complexity")
  }),
  execute: async (args: {
    problem: string;
    constraints?: string;
    language?: string;
    optimize?: boolean
  }, { log }: any) => {
    const messages = [
      {
        role: "system",
        content: `You are an expert competitive programmer.
Solve the problem efficiently with clean, optimized code.
Language: ${args.language}
${args.optimize ? 'Optimize for both time and space complexity.' : ''}
${args.constraints ? `Constraints: ${args.constraints}` : ''}
Provide:
1. Approach explanation
2. Complete working code
3. Time and space complexity analysis
${FORMAT_INSTRUCTION}`
      },
      {
        role: "user",
        content: args.problem
      }
    ];

    return await callOpenRouter(messages, OpenRouterModel.QWEN3_CODER, 0.1, 6000);
  }
};

/**
 * Kimi K2.5 Thinking Tool
 * Multimodal model with Agent Swarm (100 sub-agents) and built-in reasoning
 * $0.60/$3.00 per M tokens, 262K context
 */
export const kimiThinkingTool = {
  name: "kimi_thinking",
  description: "Kimi K2.5 multimodal reasoning with Agent Swarm. Put your PROBLEM in the 'problem' parameter.",
  parameters: z.object({
    problem: z.string().describe("The problem to reason about (REQUIRED - put your question here)"),
    context: z.string().optional().describe("Additional context for the reasoning task"),
    approach: z.string()
      .optional()
      .default("step-by-step")
      .describe("Reasoning approach (e.g., step-by-step, analytical, creative, systematic)"),
    maxSteps: z.coerce.number().int().min(1).max(10).optional().default(3).describe("Maximum reasoning steps (1-10, default: 3)")
  }),
  execute: async (args: {
    problem: string;
    context?: string;
    approach?: string;
    maxSteps?: number
  }, { log, reportProgress }: any) => {
    const approachPrompts = {
      "step-by-step": "Break down the problem into clear steps and solve systematically",
      analytical: "Analyze the problem deeply, considering multiple perspectives and implications",
      creative: "Think creatively and explore unconventional solutions and approaches",
      systematic: "Apply systematic reasoning with clear logic chains and verification"
    };

    const messages = [
      {
        role: "system",
        content: `You are Kimi K2, an expert reasoning model. Be concise and direct.
${approachPrompts[args.approach as keyof typeof approachPrompts || 'step-by-step']}.
Use ${args.maxSteps} reasoning steps max. ${args.context ? `Context: ${args.context}` : ''}
${FORMAT_INSTRUCTION}`
      },
      {
        role: "user",
        content: args.problem
      }
    ];

    // Use heartbeat to prevent MCP timeout during reasoning
    // Kimi K2.5 thinking needs extra time — 240s (was 180s default, caused timeouts)
    const reportFn = reportProgress ?? (async () => {});
    return await withHeartbeat(
      () => callOpenRouter(messages, OpenRouterModel.KIMI_K2_5, 0.4, 3000, {
        top_p: 0.9,
        presence_penalty: 0.1,
        frequency_penalty: 0.2
      }, 240000),
      reportFn
    );
  }
};

/**
 * Kimi Code Tool
 * SWE-focused code generation/fixing with Kimi K2.5 (SWE-Bench 76.8%)
 * Best for: code generation, bug fixing, refactoring, repo-level understanding
 */
export const kimiCodeTool = {
  name: "kimi_code",
  description: "SWE-focused code generation/fixing with Kimi K2.5 (SWE-Bench 76.8%). Put CODE in 'code' parameter.",
  parameters: z.object({
    task: z.enum(["generate", "fix", "review", "optimize", "debug", "refactor"])
      .describe("Code task - must be one of: generate, fix, review, optimize, debug, refactor"),
    code: z.string().optional().describe("The source code (for fix/review/optimize/debug/refactor tasks)"),
    requirements: z.string().optional().default("").describe("Requirements or description (for generate task)"),
    language: z.string().optional().describe("Programming language (e.g., 'typescript', 'python')")
  }),
  execute: async (args: {
    task: string;
    code?: string;
    requirements?: string;
    language?: string;
  }, { log, reportProgress }: any) => {
    const taskPrompts: Record<string, string> = {
      generate: "Generate clean, production-ready code",
      fix: "Fix bugs and issues in the code",
      review: "Review code for quality, bugs, and improvements",
      optimize: "Optimize for performance and efficiency",
      debug: "Debug and identify root causes",
      refactor: "Refactor for better structure and maintainability"
    };

    const systemPrompt = `You are Kimi K2.5, an expert SWE model (SWE-Bench 76.8%). You excel at repo-level code understanding and changes.
Task: ${taskPrompts[args.task]}
${args.language ? `Language: ${args.language}` : ''}
Focus: Clean code, correct solutions, minimal changes for fixes. Understand the full repo context when reviewing.
${FORMAT_INSTRUCTION}`;

    const userPrompt = args.code
      ? `Code:\n\`\`\`${args.language || ''}\n${args.code}\n\`\`\`\n\nRequirements: ${args.requirements || 'Fix/improve the code'}`
      : args.requirements || "Generate code";

    const messages = [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt }
    ];

    const reportFn = reportProgress ?? (async () => {});
    return await withHeartbeat(
      () => callOpenRouter(messages, OpenRouterModel.KIMI_K2_5, 0.3, 4000),
      reportFn,
      240000
    );
  }
};

/**
 * Kimi Decompose Tool
 * Structured task decomposition using Kimi K2.5's Agent Swarm reasoning
 * Best for: breaking complex tasks into subtasks with dependencies and acceptance criteria
 */
export const kimiDecomposeTool = {
  name: "kimi_decompose",
  description: "Structured task decomposition with Kimi K2.5 Agent Swarm reasoning. Breaks tasks into subtasks with IDs, dependencies, and acceptance criteria.",
  parameters: z.object({
    task: z.string().describe("The task to decompose (REQUIRED - describe the complex task)"),
    context: z.string().optional().describe("Additional context about the project, codebase, or constraints"),
    depth: z.coerce.number().int().min(1).max(5).optional().default(3)
      .describe("Maximum decomposition depth levels (1-5, default: 3)"),
    outputFormat: z.enum(["tree", "flat", "dependencies"]).optional().default("tree")
      .describe("Output format: tree (hierarchical), flat (numbered list), dependencies (with dependency graph)")
  }),
  execute: async (args: {
    task: string;
    context?: string;
    depth?: number;
    outputFormat?: string;
  }, { log, reportProgress }: any) => {
    const formatInstructions: Record<string, string> = {
      tree: "Output as a hierarchical tree with indentation showing parent-child relationships",
      flat: "Output as a flat numbered list with subtask IDs (e.g., 1, 1.1, 1.2, 2, 2.1)",
      dependencies: "Output with dependency graph: each subtask has ID, dependencies (blockedBy), and can-parallel flags"
    };

    const systemPrompt = `You are Kimi K2.5, expert at structured task decomposition using Agent Swarm reasoning.

Decompose the given task into subtasks following these rules:
1. Each subtask gets a unique ID (e.g., T1, T1.1, T1.2, T2)
2. Identify dependencies between subtasks (what blocks what)
3. Mark which subtasks can run in parallel
4. Each subtask must have clear acceptance criteria
5. Decompose to ${args.depth || 3} levels of depth maximum
6. ${formatInstructions[args.outputFormat || "tree"]}

For each subtask provide:
- **ID**: Unique identifier
- **Title**: Brief description
- **Dependencies**: List of subtask IDs that must complete first (or "none")
- **Parallel**: Can this run in parallel with siblings? (yes/no)
- **Acceptance Criteria**: How to know this subtask is done
- **Complexity**: Low / Medium / High

${FORMAT_INSTRUCTION}`;

    const userPrompt = `Task to decompose: ${args.task}${args.context ? `\n\nContext: ${args.context}` : ''}`;

    const messages = [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt }
    ];

    const reportFn = reportProgress ?? (async () => {});
    return await withHeartbeat(
      () => callOpenRouter(messages, OpenRouterModel.KIMI_K2_5, 0.5, 6000),
      reportFn,
      240000
    );
  }
};

/**
 * Kimi Long Context Tool
 * Long-context analysis leveraging Kimi K2.5's 256K context window
 * Best for: analyzing large documents, codebases, or text bodies
 */
export const kimiLongContextTool = {
  name: "kimi_long_context",
  description: "Long-context analysis with Kimi K2.5 (256K context window, best-effort). Analyzes large documents, codebases, or text. Put CONTENT in 'content' parameter.",
  parameters: z.object({
    content: z.string().describe("The long text/document to analyze (REQUIRED)"),
    task: z.enum(["summarize", "extract", "analyze", "compare", "find"])
      .describe("Analysis task: summarize, extract (key info), analyze (deep), compare (sections), find (specific info)"),
    query: z.string().optional().describe("Specific question about the content (for extract/find tasks)"),
    outputFormat: z.enum(["brief", "detailed", "structured"]).optional().default("detailed")
      .describe("Output format: brief (TL;DR), detailed (thorough), structured (sections with headers)")
  }),
  execute: async (args: {
    content: string;
    task: string;
    query?: string;
    outputFormat?: string;
  }, { log, reportProgress }: any) => {
    const taskPrompts: Record<string, string> = {
      summarize: "Create a comprehensive summary capturing all key points",
      extract: "Extract specific information, facts, and data points",
      analyze: "Perform deep analysis identifying patterns, themes, and insights",
      compare: "Compare and contrast different sections, arguments, or perspectives",
      find: "Find specific information matching the query"
    };

    const formatPrompts: Record<string, string> = {
      brief: "Keep output concise - TL;DR style, bullet points, key takeaways only",
      detailed: "Provide thorough analysis with supporting evidence and examples",
      structured: "Use clear sections with headers, bullet points, and structured formatting"
    };

    const systemPrompt = `You are Kimi K2.5, expert at processing and analyzing large documents (best-effort 256K context window).
Task: ${taskPrompts[args.task]}
Format: ${formatPrompts[args.outputFormat || "detailed"]}
${args.query ? `Specific query: ${args.query}` : ''}

Be thorough and systematic. Reference specific parts of the content when making claims.
${FORMAT_INSTRUCTION}`;

    const messages = [
      { role: "system", content: systemPrompt },
      { role: "user", content: args.content }
    ];

    const reportFn = reportProgress ?? (async () => {});
    return await withHeartbeat(
      () => callOpenRouter(messages, OpenRouterModel.KIMI_K2_5, 0.2, 8000),
      reportFn,
      300000
    );
  }
};

/**
 * Qwen Reason Tool
 * Heavy reasoning with Qwen3-Max-Thinking (>1T params, 98% HMMT math)
 * Best for: math-heavy tasks, proofs, complex logic
 */
export const qwenReasonTool = {
  name: "qwen_reason",
  description: "Heavy mathematical reasoning with Qwen3-Max-Thinking (>1T params, 98% HMMT). Put your PROBLEM in the 'problem' parameter.",
  parameters: z.object({
    problem: z.string().describe("The problem to reason about (REQUIRED - put your question here)"),
    context: z.string().optional().describe("Additional context for the reasoning task"),
    approach: z.string()
      .optional()
      .default("mathematical")
      .describe("Reasoning approach (e.g., mathematical, logical, proof, step-by-step)")
  }),
  execute: async (args: {
    problem: string;
    context?: string;
    approach?: string;
  }, { log, reportProgress }: any) => {
    const approachPrompts: Record<string, string> = {
      mathematical: "Apply rigorous mathematical reasoning with proofs",
      logical: "Use formal logic and deductive reasoning",
      proof: "Construct formal proofs with clear steps",
      "step-by-step": "Break down systematically showing all work"
    };

    const messages = [
      {
        role: "system",
        content: `You are Qwen3-Max-Thinking, a flagship reasoning model with >1T parameters.
${approachPrompts[args.approach || 'mathematical']}.
Show your complete reasoning process.
${args.context ? `Context: ${args.context}` : ''}
${FORMAT_INSTRUCTION}`
      },
      {
        role: "user",
        content: args.problem
      }
    ];

    const reportFn = reportProgress ?? (async () => {});
    return await withHeartbeat(
      () => callOpenRouter(messages, OpenRouterModel.QWEN3_MAX_THINKING, 0.3, 8000),
      reportFn
    );
  }
};

/**
 * MiniMax Code Tool
 * Code fixing and SWE tasks with MiniMax M2.1 (SWE-Bench 72.5%)
 * Best for: bug fixes, code generation, SWE tasks - VERY CHEAP
 */
export const minimaxCodeTool = {
  name: "minimax_code",
  description: "Code generation/fixing with MiniMax M2.1 (SWE-Bench 72.5%, very cheap). Put CODE in 'code' parameter.",
  parameters: z.object({
    task: z.enum(["generate", "fix", "review", "optimize", "debug", "refactor"])
      .describe("Code task - must be one of: generate, fix, review, optimize, debug, refactor"),
    code: z.string().optional().describe("The source code (for fix/review/optimize/debug/refactor tasks)"),
    requirements: z.string().optional().default("").describe("Requirements or description (for generate task)"),
    language: z.string().optional().describe("Programming language (e.g., 'typescript', 'python')")
  }),
  execute: async (args: {
    task: string;
    code?: string;
    requirements?: string;
    language?: string;
  }, { log, reportProgress }: any) => {
    const taskPrompts: Record<string, string> = {
      generate: "Generate clean, production-ready code",
      fix: "Fix bugs and issues in the code",
      review: "Review code for quality and issues",
      optimize: "Optimize for performance",
      debug: "Debug and identify issues",
      refactor: "Refactor for better structure"
    };

    const systemPrompt = `You are MiniMax M2.1, a highly efficient code model (SWE-Bench 72.5%).
Task: ${taskPrompts[args.task]}
${args.language ? `Language: ${args.language}` : ''}
Focus: Clean code, best practices, minimal changes for fixes.
${FORMAT_INSTRUCTION}`;

    const userPrompt = args.code
      ? `Code:\n\`\`\`${args.language || ''}\n${args.code}\n\`\`\`\n\nRequirements: ${args.requirements || 'Fix/improve the code'}`
      : args.requirements || "Generate code";

    const messages = [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt }
    ];

    const reportFn = reportProgress ?? (async () => {});
    return await withHeartbeat(
      () => callOpenRouter(messages, OpenRouterModel.MINIMAX_M2_1, 0.3, 4000),
      reportFn
    );
  }
};

/**
 * MiniMax Agent Tool
 * Agentic workflows and tool-calling with MiniMax M2.1 (τ²-Bench 77.2%)
 * Best for: multi-step tasks, tool orchestration, agentic workflows - VERY CHEAP
 */
export const minimaxAgentTool = {
  name: "minimax_agent",
  description: "Agentic task execution with MiniMax M2.1 (τ²-Bench 77.2%, best agentic, very cheap). Put TASK in 'task' parameter.",
  parameters: z.object({
    task: z.string().describe("The task to execute (REQUIRED - describe what needs to be done)"),
    context: z.string().optional().describe("Additional context about the environment or constraints"),
    steps: z.coerce.number().int().min(1).max(20).optional().default(5).describe("Maximum steps to plan (1-20, default: 5)"),
    outputFormat: z.enum(["plan", "execute", "both"]).optional().default("both")
      .describe("Output: 'plan' (just steps), 'execute' (just results), 'both' (plan + results)")
  }),
  execute: async (args: {
    task: string;
    context?: string;
    steps?: number;
    outputFormat?: string;
  }, { log, reportProgress }: any) => {
    const formatInstructions: Record<string, string> = {
      plan: "Output ONLY a numbered plan of steps to accomplish the task.",
      execute: "Execute the task directly and output the results.",
      both: "First output a brief plan, then execute each step and show results."
    };

    const messages = [
      {
        role: "system",
        content: `You are MiniMax M2.1, an expert agentic model (τ²-Bench 77.2%, BrowseComp 44%).
You excel at multi-step task execution and tool orchestration.
${formatInstructions[args.outputFormat || 'both']}
Maximum steps: ${args.steps || 5}
${args.context ? `Context: ${args.context}` : ''}
Be efficient and focused. Complete tasks in minimal steps.
${FORMAT_INSTRUCTION}`
      },
      {
        role: "user",
        content: args.task
      }
    ];

    const reportFn = reportProgress ?? (async () => {});
    return await withHeartbeat(
      () => callOpenRouter(messages, OpenRouterModel.MINIMAX_M2_1, 0.5, 4000),
      reportFn
    );
  }
};

/**
 * Check if OpenRouter is available
 */
export function isOpenRouterAvailable(): boolean {
  return !!OPENROUTER_API_KEY;
}

/**
 * Get all OpenRouter tools
 */
export function getAllOpenRouterTools() {
  if (!isOpenRouterAvailable()) {
    return [];
  }

  return [
    qwenCoderTool,
    qwqReasoningTool,
    qwenGeneralTool,
    openRouterMultiModelTool,
    qwenAlgoTool,
    qwenCompetitiveTool,
    kimiThinkingTool,
    kimiCodeTool,        // Kimi K2.5 - SWE-focused code (76.8%)
    kimiDecomposeTool,   // Kimi K2.5 - task decomposition
    kimiLongContextTool, // Kimi K2.5 - long-context analysis (256K)
    // NEW tools (Jan 2026)
    qwenReasonTool,      // Qwen3-Max-Thinking - heavy reasoning
    minimaxCodeTool,     // MiniMax M2.1 - SWE tasks (cheap)
    minimaxAgentTool,    // MiniMax M2.1 - agentic workflows (cheap)
  ];
}