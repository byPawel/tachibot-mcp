/**
 * Planner Tools - Multi-model plan creation and execution
 *
 * COORDINATOR PATTERN: Each call returns ONE tool to execute
 * - Visible tool calls in terminal
 * - User can interrupt between steps
 * - Stays under 25k MCP limit
 *
 * planner_maker: Council-based plan synthesis
 * planner_runner: Execute plans with verification checkpoints
 */

import { z } from "zod";
import * as fs from "fs";
import * as path from "path";
import { readFilesIntoContext } from "../utils/file-reader.js";

// ═══════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════

type MCPContext = {
  log: {
    info: (message: string, metadata?: Record<string, any>) => void;
    error: (message: string, metadata?: Record<string, any>) => void;
    warn: (message: string, metadata?: Record<string, any>) => void;
    debug: (message: string, metadata?: Record<string, any>) => void;
  };
  reportProgress?: (progress: { progress: number; total: number }) => Promise<void>;
  [key: string]: any;
};

/**
 * Structured hint for devlog tool invocation
 */
export interface DevlogHint {
  tool: "devlog_session_log" | "devlog_plan_create" | "devlog_plan_check" | "devlog_plan_blocker" | "devlog_plan_validate";
  params: Record<string, any>;
  description?: string;
}

/**
 * Tool call instruction returned by coordinator
 */
export interface ToolInstruction {
  tool: string;
  params: Record<string, any>;
  maxTokens: number;
  description: string;
}

/**
 * Coordinator response - what planner_maker returns each step
 */
export interface CoordinatorResponse {
  phase: string;
  step: number;
  totalSteps: number;
  progress: string;  // e.g., "2/7 (29%)"
  nextTool?: ToolInstruction;
  devlogHint?: DevlogHint;
  isComplete: boolean;
  result?: string;  // Final result when isComplete=true
}

// ═══════════════════════════════════════════════════════════════════
// CONTEXT LIMITS
// ═══════════════════════════════════════════════════════════════════
//
// Research finding (5-model consensus, Jan 2026):
// "Lost in the middle" still exists — 20-40% recall loss on mid-context info.
// Passing 12k chars of cumulative context DEGRADES quality via attention dilution.
// Solution: pass distilled summaries (~500 tokens) between steps. Full outputs
// saved to disk accumulator for the plan file.
//
// Two tiers:
// - INTERMEDIATE: 2500 chars (~625 tokens) for step-to-step context passing
// - SYNTHESIS: 6000 chars (~1500 tokens) for final judgment steps that need more

const PRIOR_CONTEXT_LIMIT_INTERMEDIATE = 2500;  // ~625 tokens — distilled findings only
const PRIOR_CONTEXT_LIMIT_SYNTHESIS = 6000;      // ~1500 tokens — judgment/synthesis steps
const CODE_CONTEXT_LIMIT = 8000;                 // ~2k tokens for code snippets

/**
 * Instruction appended to intermediate steps to produce a distilled summary block.
 * The model outputs full analysis PLUS this summary at the end.
 * The summary is what gets extracted and passed to the next step.
 */
const DISTILL_SUFFIX = `

At the END of your response, add this summary block (the pipeline extracts it for the next step):

---SUMMARY---
FINDINGS: [3-5 bullet points of key findings]
CONCERNS: [top concerns or risks, if any]
RECOMMENDATION: [one-sentence recommendation]
CONFIDENCE: [high/medium/low]
---END SUMMARY---`;

/**
 * Extract the distilled summary from a step's output.
 * Falls back to truncated full output if no summary block found.
 */
function extractSummary(output: string, limit: number): string {
  if (!output) return "";

  // Try to extract the ---SUMMARY--- block
  const summaryMatch = output.match(/---SUMMARY---\s*([\s\S]*?)\s*---END SUMMARY---/);
  if (summaryMatch) {
    const summary = summaryMatch[1].trim();
    if (summary.length > 50) {
      return truncateSmart(summary, limit);
    }
  }

  // Fallback: truncate the full output
  return truncateSmart(output, limit);
}

/**
 * Smart truncation: cuts at paragraph/sentence boundary, never mid-word.
 * Preserves semantic integrity unlike raw .substring().
 */
function truncateSmart(text: string | undefined, limit: number): string {
  if (!text) return "";
  if (text.length <= limit) return text;

  const truncated = text.substring(0, limit);

  // Try to cut at paragraph boundary
  const lastParagraph = truncated.lastIndexOf('\n\n');
  if (lastParagraph > limit * 0.7) return truncated.substring(0, lastParagraph) + '\n\n[…truncated]';

  // Try sentence boundary
  const lastSentence = truncated.lastIndexOf('. ');
  if (lastSentence > limit * 0.7) return truncated.substring(0, lastSentence + 1) + ' […truncated]';

  // Fall back to newline
  const lastNewline = truncated.lastIndexOf('\n');
  if (lastNewline > limit * 0.7) return truncated.substring(0, lastNewline) + '\n[…truncated]';

  return truncated + '…';
}

// ═══════════════════════════════════════════════════════════════════
// TOKEN LIMITS (MAX, not fixed - outputs can be shorter)
// ═══════════════════════════════════════════════════════════════════

const TOOL_MAX_TOKENS: Record<string, number> = {
  // Search tools - need room for 10-20 sources
  grok_search: 3000,
  openai_search: 3000,
  gemini_search: 3000,

  // Analysis tools - medium verbosity
  qwen_coder: 2500,
  minimax_code: 2500,
  kimi_thinking: 2500,
  kimi_decompose: 3000,

  // Reasoning/Judge tools - can be longer
  openai_reason: 3000,
  qwen_reason: 3000,
  gemini_analyze_text: 3000,

  // Default fallback
  default: 2000,
};

function getMaxTokens(tool: string): number {
  return TOOL_MAX_TOKENS[tool] ?? TOOL_MAX_TOKENS.default;
}

// ═══════════════════════════════════════════════════════════════════
// PLAN FILE MANAGEMENT
// ═══════════════════════════════════════════════════════════════════

/**
 * Resolve devlog daily directory.
 * Uses DEVLOG_PATH env (same as devlog-mcp) or falls back to {cwd}/devlog.
 */
function getDevlogDailyDir(): string {
  const devlogPath = process.env.DEVLOG_PATH || path.join(process.cwd(), "devlog");
  return path.join(devlogPath, "daily");
}

/**
 * Generate plan filename: YYYY-MM-DD-HHhMMm-dayname-plan-slug.md
 * Example: 2026-01-28-16h30m-tuesday-plan-sidebar-refactor.md
 * Matches devlog_workspace_dump naming convention.
 */
function generatePlanFilename(task: string): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  const hours = String(now.getHours()).padStart(2, "0");
  const minutes = String(now.getMinutes()).padStart(2, "0");
  const dayName = now.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();

  // Create slug from task (first 40 chars, lowercase, alphanumeric + dashes)
  const slug = task
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .substring(0, 40);

  return `${year}-${month}-${day}-${hours}h${minutes}m-${dayName}-plan-${slug}.md`;
}

interface PlanMetadata {
  phases: string[];
  tools_used: string[];
  scores?: Record<string, number>;
  goal?: string;
}

/**
 * Save plan to devlog daily directory with proper frontmatter.
 * The file will be picked up by devlog-mcp migration and appear in devlog-ui.
 *
 * Called both incrementally (during creation) and at completion.
 * - During creation: planStatus = "in-progress", content = accumulated so far
 * - At completion: planStatus = "pending" (ready for review), content = full plan
 */
function savePlanToFile(
  task: string,
  plan: string,
  metadata: PlanMetadata,
  options?: { planStatus?: string; existingFilepath?: string }
): string {
  const dailyDir = getDevlogDailyDir();

  // Ensure daily directory exists
  if (!fs.existsSync(dailyDir)) {
    fs.mkdirSync(dailyDir, { recursive: true });
  }

  // Reuse existing filepath for incremental updates (same file, overwritten)
  const filepath = options?.existingFilepath || path.join(dailyDir, generatePlanFilename(task));
  const now = new Date();
  const status = options?.planStatus || "pending";

  // Build YAML frontmatter with plan-specific fields
  const lines: string[] = [];
  lines.push('---');
  lines.push(`title: "Plan: ${task.replace(/"/g, '\\"')}"`);
  lines.push(`date: "${now.toISOString()}"`);
  lines.push(`status: "${status === "in-progress" ? "in-progress" : "pending"}"`);
  lines.push(`type: "plan"`);
  lines.push(`docType: "plan"`);
  lines.push(`planStatus: "${status}"`);

  if (metadata.goal) {
    lines.push(`planGoal: "${metadata.goal.replace(/"/g, '\\"')}"`);
  }

  // Plan phases
  if (metadata.phases.length > 0) {
    const uniquePhases = [...new Set(metadata.phases)];
    lines.push(`planPhases: ${JSON.stringify(uniquePhases)}`);
  }

  // Tools used
  if (metadata.tools_used.length > 0) {
    const uniqueTools = [...new Set(metadata.tools_used)];
    lines.push(`planToolsUsed: ${JSON.stringify(uniqueTools)}`);
  }

  // Quality scores (parsed from plan text if available)
  if (metadata.scores && Object.keys(metadata.scores).length > 0) {
    lines.push(`planScores:`);
    for (const [key, value] of Object.entries(metadata.scores)) {
      lines.push(`  ${key}: ${value}`);
    }
  }

  lines.push('tags:');
  lines.push('  type: plan');
  lines.push(`  focus: "${task.replace(/"/g, '\\"').substring(0, 60)}"`);
  lines.push('---');
  lines.push('');
  lines.push(`# Plan: ${task}`);
  lines.push('');
  lines.push(plan);

  fs.writeFileSync(filepath, lines.join('\n'), "utf-8");
  return filepath;
}

/**
 * Build an incremental plan body from accumulated outputs so far.
 * Shows which steps are done and their full output.
 */
function buildIncrementalPlan(
  workflow: WorkflowStep[],
  accumulated: Record<string, string>,
  currentStep: number,
  totalSteps: number
): string {
  const sections: string[] = [];

  // Progress header
  const pct = Math.round((currentStep / totalSteps) * 100);
  sections.push(`Status: IN PROGRESS - ${currentStep}/${totalSteps} steps (${pct}%)\n`);

  // Completed steps with full output
  for (let i = 0; i < currentStep && i < workflow.length; i++) {
    const step = workflow[i];
    const content = accumulated[step.id];
    if (content && content.length > 20) {
      sections.push(`## ${step.phase}: ${step.description}\n\n${content}`);
    } else {
      sections.push(`## ${step.phase}: ${step.description}\n\n(awaiting output)`);
    }
  }

  // Remaining steps (just titles)
  if (currentStep < totalSteps) {
    sections.push(`\n---\n\n## Remaining Steps\n`);
    for (let i = currentStep; i < workflow.length; i++) {
      const step = workflow[i];
      sections.push(`- [ ] ${step.phase}: ${step.description}`);
    }
  }

  return sections.join('\n');
}

/**
 * Track the filepath for incremental plan saves across coordinator calls.
 * Keyed by task slug so concurrent plans don't collide.
 */
const _planFilePaths: Record<string, string> = {};

function getPlanFilePath(task: string): string | undefined {
  const slug = task.toLowerCase().replace(/[^a-z0-9]+/g, "-").substring(0, 40);
  return _planFilePaths[slug];
}

function setPlanFilePath(task: string, filepath: string): void {
  const slug = task.toLowerCase().replace(/[^a-z0-9]+/g, "-").substring(0, 40);
  _planFilePaths[slug] = filepath;
}

function clearPlanFilePath(task: string): void {
  const slug = task.toLowerCase().replace(/[^a-z0-9]+/g, "-").substring(0, 40);
  delete _planFilePaths[slug];
}

// ═══════════════════════════════════════════════════════════════════
// SERVER-SIDE OUTPUT ACCUMULATOR
// ═══════════════════════════════════════════════════════════════════
//
// Claude summarizes tool outputs before passing them to prior.
// We can't prevent that. So we accumulate on disk, keeping the
// LONGEST version of each step output (first pass is usually full).

const ACCUMULATOR_DIR = process.env.TACHIBOT_PLAN_CACHE_DIR || path.join(process.cwd(), ".plan-cache");

function getAccumulatorPath(task: string): string {
  const slug = task.toLowerCase().replace(/[^a-z0-9]+/g, "-").substring(0, 40);
  return path.join(ACCUMULATOR_DIR, `${slug}.json`);
}

/**
 * Read accumulated outputs from disk.
 */
function readAccumulator(task: string): Record<string, string> {
  const filePath = getAccumulatorPath(task);
  if (!fs.existsSync(filePath)) return {};
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf-8"));
  } catch {
    return {};
  }
}

/**
 * Save ONLY the just-completed step output to the accumulator.
 * We know which step just ran from the step number + workflow.
 * Only that key is fresh — everything else in prior is stale/summarized.
 */
function accumulateStepOutput(
  task: string,
  justCompletedStepId: string,
  prior: Record<string, string>,
): Record<string, string> {
  if (!fs.existsSync(ACCUMULATOR_DIR)) {
    fs.mkdirSync(ACCUMULATOR_DIR, { recursive: true });
  }

  const accumulated = readAccumulator(task);

  // Only save the just-completed step — that's the only fresh full output
  const freshValue = prior[justCompletedStepId];
  if (freshValue && freshValue.length > (accumulated[justCompletedStepId]?.length || 0)) {
    accumulated[justCompletedStepId] = freshValue;
  }

  fs.writeFileSync(getAccumulatorPath(task), JSON.stringify(accumulated), "utf-8");
  return accumulated;
}

/**
 * Clean up accumulator file after plan is complete.
 */
function cleanAccumulator(task: string): void {
  const filePath = getAccumulatorPath(task);
  try {
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  } catch { /* ignore */ }
}

/**
 * Parse quality scores from plan text.
 * Looks for patterns like "Code Quality: 8/10" or "Security: 7/10"
 */
function parseScoresFromPlan(planText: string): Record<string, number> {
  const scores: Record<string, number> = {};
  const scorePatterns: Array<[string, RegExp]> = [
    ['codeQuality', /code\s*quality[:\s]*(\d+)\s*\/\s*10/i],
    ['security', /security[:\s]*(\d+)\s*\/\s*10/i],
    ['performance', /performance[:\s]*(\d+)\s*\/\s*10/i],
    ['confidence', /confidence[:\s]*(\d+)\s*\/\s*10/i],
    ['overall', /overall[:\s]*(\d+)\s*\/\s*10/i],
  ];

  for (const [key, pattern] of scorePatterns) {
    const match = planText.match(pattern);
    if (match) {
      scores[key] = parseInt(match[1], 10);
    }
  }

  return scores;
}

/**
 * List recent plans from devlog daily directory (last N days)
 */
function listRecentPlans(days: number = 7): { filename: string; path: string; created: Date }[] {
  const dailyDir = getDevlogDailyDir();
  if (!fs.existsSync(dailyDir)) {
    return [];
  }

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);

  const files = fs.readdirSync(dailyDir)
    .filter(f => f.endsWith(".md") && f.includes("-plan-"))
    .map(f => {
      const filepath = path.join(dailyDir, f);
      const stats = fs.statSync(filepath);
      return { filename: f, path: filepath, created: stats.mtime };
    })
    .filter(f => f.created >= cutoff)
    .sort((a, b) => b.created.getTime() - a.created.getTime());

  return files;
}

// ═══════════════════════════════════════════════════════════════════
// WORKFLOW STEPS DEFINITION
// ═══════════════════════════════════════════════════════════════════

type WorkflowStep = {
  id: string;
  phase: string;
  tool: string;
  buildParams: (task: string, context: string, codeContext: string, answers: string, prior: Record<string, string>) => Record<string, any>;
  description: string;
  thinking: string;  // WHY this step, WHAT we expect, HOW it helps
  devlogType?: "progress" | "note";
  condition?: (task: string, context: string) => boolean;  // If set, step only runs when true
  isSynthesis?: boolean;  // If true, gets more context (PRIOR_CONTEXT_LIMIT_SYNTHESIS)
};

/**
 * Get context limit for a step. Synthesis steps get more context.
 */
function priorLimit(step?: WorkflowStep): number {
  return step?.isSynthesis ? PRIOR_CONTEXT_LIMIT_SYNTHESIS : PRIOR_CONTEXT_LIMIT_INTERMEDIATE;
}

/**
 * Get distilled prior context for a step.
 * Extracts summary blocks when available, falls back to truncation.
 */
function distilledPrior(key: string, prior: Record<string, string>, step?: WorkflowStep): string {
  const raw = prior[key];
  if (!raw) return "N/A";
  const limit = priorLimit(step);
  return extractSummary(raw, limit);
}

/**
 * Check if task involves UX/frontend work.
 * Detects keywords OR explicit ux:true parameter (set via _uxOverride flag).
 */
let _uxOverride = false;  // Set by planner_maker when ux param is true
function isUXTask(task: string, context: string): boolean {
  if (_uxOverride) return true;
  const text = `${task} ${context}`.toLowerCase();
  return /\bux\b|\bui\b|user experience|frontend|front-end|usability|accessibility|design system/.test(text);
}

/**
 * Check if task involves responsive/mobile work.
 * Detects keywords OR explicit responsive:true parameter.
 */
let _responsiveOverride = false;
function isResponsiveTask(task: string, context: string): boolean {
  if (_responsiveOverride) return true;
  const text = `${task} ${context}`.toLowerCase();
  return /\bresponsive\b|mobile|tablet|breakpoint|media quer|touch target|viewport|screen size/.test(text);
}

/**
 * Check if debate mode is enabled.
 * Only triggered by explicit debate:true parameter.
 */
let _debateOverride = false;
function isDebateEnabled(_task: string, _context: string): boolean {
  return _debateOverride;
}

/**
 * Build active workflow by filtering conditional steps
 */
function getActiveWorkflow(task: string, context: string): WorkflowStep[] {
  return ALL_WORKFLOW_STEPS.filter(
    step => !step.condition || step.condition(task, context)
  );
}

// All workflow steps (conditional ones filtered at runtime)
const ALL_WORKFLOW_STEPS: WorkflowStep[] = [
  // Phase 1: Search (with current date for fresh results)
  {
    id: "search",
    phase: "Search",
    tool: "grok_search",
    thinking: "Ground truth first. Before any AI analysis, we need real-world data - current best practices, existing solutions, recent changes. Grok searches to avoid hallucination and ensure our plan reflects reality, not outdated patterns.",
    buildParams: (task, _context, _codeContext, answers) => {
      const now = new Date();
      const dateStr = now.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      }); // e.g., "January 28, 2026"
      const baseQuery = answers ? `${task}\n\nUser clarifications:\n${answers}` : task;
      return {
        query: `${baseQuery} best practices as of ${dateStr}`,
        maxResults: 10,
      };
    },
    description: "Search for relevant information + best practices",
    devlogType: "progress",
  },

  // Phase 2: Analysis (2 tools - WITH actual code review when provided)
  {
    id: "analyze_qwen",
    phase: "Analysis",
    tool: "qwen_coder",
    thinking: "Code-focused analysis. Qwen excels at technical feasibility - understanding APIs, dependencies, data structures. When codeContext is provided, it reviews ACTUAL code to score quality and identify specific changes needed.",
    buildParams: (task, context, codeContext, answers, prior) => ({
      task: codeContext ? "review" : "analyze",
      ...(codeContext ? { code: codeContext } : {}),
      requirements: `Task: ${task}
${context ? `Context: ${context}` : ""}
${answers ? `User Clarifications:\n${answers}` : ""}
${prior.search ? `Research:\n${extractSummary(prior.search, PRIOR_CONTEXT_LIMIT_INTERMEDIATE)}` : ""}
${codeContext ? `
ACTUAL CODE TO REVIEW:
${truncateSmart(codeContext, CODE_CONTEXT_LIMIT)}

Analyze this code and provide:
1. Quality score /10 (readability, structure, patterns)
2. Security score /10 (vulnerabilities, input validation)
3. Performance score /10 (complexity, bottlenecks)
4. Specific issues found with line references
5. Implementation approach for the task` : "Analyze feasibility and provide implementation approach."}
${DISTILL_SUFFIX}`,
    }),
    description: "Analyze code feasibility + quality (Qwen)",
  },
  {
    id: "analyze_kimi",
    phase: "Analysis",
    tool: "kimi_thinking",
    thinking: "Step-by-step reasoning. Kimi's strength is methodical thinking - breaking complex tasks into ordered steps. When code is provided, it traces execution paths and identifies the exact sequence of changes needed.",
    buildParams: (task, context, codeContext, _answers, prior) => ({
      problem: `Task: ${task}
${context ? `Context: ${context}` : ""}
${prior.search ? `Research:\n${extractSummary(prior.search, PRIOR_CONTEXT_LIMIT_INTERMEDIATE)}` : ""}
${codeContext ? `
ACTUAL CODE:
${truncateSmart(codeContext, CODE_CONTEXT_LIMIT)}

Trace the execution flow and provide:
1. Current code flow (what happens now)
2. Required changes (step-by-step)
3. Files to modify with specific line ranges
4. Order of changes (dependencies)` : "Provide step-by-step reasoning for implementation."}
${DISTILL_SUFFIX}`,
      approach: "systematic",
    }),
    description: "Step-by-step reasoning (Kimi)",
  },

  // Phase 2c: Decomposition (structured subtask breakdown with dependencies)
  {
    id: "decompose_kimi",
    phase: "Decomposition",
    tool: "kimi_decompose",
    thinking: "Structured decomposition. Kimi K2.5 uses Agent Swarm reasoning to break the task into parallel subtasks with IDs, dependencies, and acceptance criteria. This dependency graph feeds into the synthesis phase for a more actionable, ordered plan.",
    buildParams: (task, context, _codeContext, answers, prior) => ({
      task: `${task}${answers ? `\n\nUser clarifications:\n${answers}` : ""}`,
      context: [
        context || "",
        prior.search ? `Research:\n${extractSummary(prior.search, PRIOR_CONTEXT_LIMIT_INTERMEDIATE)}` : "",
        prior.analyze_qwen ? `Code Analysis:\n${extractSummary(prior.analyze_qwen, PRIOR_CONTEXT_LIMIT_INTERMEDIATE)}` : "",
        prior.analyze_kimi ? `Step-by-step Analysis:\n${extractSummary(prior.analyze_kimi, PRIOR_CONTEXT_LIMIT_INTERMEDIATE)}` : "",
      ].filter(Boolean).join("\n\n"),
      depth: 3,
      outputFormat: "dependencies",
    }),
    description: "Task decomposition with dependencies (Kimi K2.5)",
    devlogType: "progress",
  },

  // Phase 2b: Debate (CONDITIONAL - lightweight pro/con, main points only)
  {
    id: "debate_pro",
    phase: "Debate",
    tool: "grok_reason",
    condition: isDebateEnabled,
    thinking: "Advocate perspective. Grok argues FOR the proposed approach — strongest arguments, best-case outcomes, why this is the right direction. Provides the 'pro' side of a structured debate.",
    buildParams: (task, context, _codeContext, _answers, prior) => ({
      query: `You are the ADVOCATE. Argue FOR this implementation approach.

TASK: ${task}
${context ? `CONTEXT: ${context}` : ""}

QWEN'S ANALYSIS: ${distilledPrior("analyze_qwen", prior) || "N/A"}
KIMI'S ANALYSIS: ${distilledPrior("analyze_kimi", prior) || "N/A"}

Argue the TOP 5 reasons this approach is correct:
1. Why this is the RIGHT architecture/design
2. Why the complexity is justified
3. Best-case outcomes and benefits
4. How it handles scale and edge cases well
5. Why alternatives would be worse

Be concise — main points only, 3-4 sentences each.
${DISTILL_SUFFIX}`,
      mode: "analytical",
    }),
    description: "Argue FOR the approach (Grok)",
  },
  {
    id: "debate_con",
    phase: "Debate",
    tool: "gemini_analyze_text",
    condition: isDebateEnabled,
    thinking: "Devil's advocate perspective. Gemini argues AGAINST the proposed approach — weaknesses, risks, overlooked alternatives. Then synthesizes both sides into key tensions the final plan must address.",
    buildParams: (task, context, _codeContext, _answers, prior) => ({
      text: `You are the CRITIC. First argue AGAINST, then synthesize both sides.

TASK: ${task}
${context ? `CONTEXT: ${context}` : ""}

PRO ARGUMENTS (Grok):
${distilledPrior("debate_pro", prior) || "N/A"}

QWEN'S ANALYSIS: ${distilledPrior("analyze_qwen", prior) || "N/A"}

PART 1 - AGAINST (TOP 5 risks):
1. Architecture/design weaknesses
2. Hidden complexity or tech debt
3. Scalability/performance risks
4. Security or reliability concerns
5. Better alternatives not considered

PART 2 - SYNTHESIS (3-5 key tensions):
For each tension, state: what PRO says, what CON says, and what the PLAN must address.

Be concise — main points only, no fluff.
${DISTILL_SUFFIX}`,
      type: "general",
    }),
    description: "Argue AGAINST + synthesize tensions (Gemini)",
    devlogType: "progress",
  },

  // Phase 3: Critique
  {
    id: "critique",
    phase: "Critique",
    tool: "openai_reason",
    thinking: "Pre-mortem + adversarial review. GPT assumes this implementation has FAILED in production, then works backward to find why. Combines pre-mortem analysis (Klein 2007) with devil's advocate critique. When code is provided, it hunts for security vulnerabilities and performance issues in the actual implementation.",
    buildParams: (task, _context, codeContext, answers, prior) => ({
      query: `PRE-MORTEM + CRITIQUE: Assume this implementation FAILED in production 3 months from now. Work backward to find why.

TASK: ${task}
${answers ? `USER CLARIFICATIONS:\n${answers}` : ""}

QWEN ANALYSIS: ${distilledPrior("analyze_qwen", prior) || "N/A"}
KIMI ANALYSIS: ${distilledPrior("analyze_kimi", prior) || "N/A"}
${prior.debate_con ? `
DEBATE SYNTHESIS (key tensions to address):
${distilledPrior("debate_con", prior)}` : ""}
${codeContext ? `
ACTUAL CODE BEING MODIFIED:
${truncateSmart(codeContext, CODE_CONTEXT_LIMIT)}` : ""}

TECHNIQUE [pre_mortem]: This project failed. Why? Brainstorm 5-7 specific failure causes. Rank by likelihood.

Find:
1. TOP 3 most likely failure causes (pre-mortem) with early warning signs
2. Missing considerations the analyses overlooked
3. Security vulnerabilities${codeContext ? " (check actual code)" : ""}
4. Performance issues${codeContext ? " (check O-complexity)" : ""}
5. Edge cases not covered
${prior.debate_con ? "6. Unresolved tensions from the debate" : ""}
7. For each failure cause: what mitigation should be in the plan?
8. Score the proposed approach /10
${DISTILL_SUFFIX}`,
      mode: "analytical",
    }),
    description: "Find holes and gaps (GPT)",
    devlogType: "progress",
  },

  // Phase 3b: UX Analysis (CONDITIONAL - Kimi systematic breakdown)
  {
    id: "ux_analyze",
    phase: "UX Review",
    tool: "kimi_thinking",
    condition: isUXTask,
    thinking: "Kimi traces UX flows systematically: what the user sees, clicks, waits for. Methodical step-by-step analysis catches interaction gaps that code reviewers miss — loading states, error recovery, empty states, edge cases.",
    buildParams: (task, context, codeContext, _answers, prior) => ({
      problem: `UX/FRONTEND ANALYSIS for this implementation:

TASK: ${task}
${context ? `CONTEXT: ${context}` : ""}

TECHNICAL ANALYSES:
- Code Review: ${distilledPrior("analyze_qwen", prior) || "N/A"}
- Critique: ${distilledPrior("critique", prior) || "N/A"}
${codeContext ? `
ACTUAL CODE:
${truncateSmart(codeContext, CODE_CONTEXT_LIMIT)}` : ""}

Trace the USER JOURNEY step by step:
1. What does the user see first? (initial state)
2. What can they interact with? (affordances)
3. What happens on each interaction? (state transitions)
4. What if something goes wrong? (error states)
5. What if there's no data? (empty states)
6. What if there's too much data? (overflow/pagination)
7. What about keyboard-only and screen reader users? (accessibility)

For each step, identify: friction points, missing states, accessibility gaps.
${DISTILL_SUFFIX}`,
      approach: "systematic",
      maxSteps: 4,
    }),
    description: "UX flow analysis (Kimi)",
  },

  // Phase 3c: UX Judgment (CONDITIONAL - Gemini final UX verdict)
  {
    id: "ux_judge",
    phase: "UX Review",
    tool: "gemini_analyze_text",
    condition: isUXTask,
    thinking: "Gemini synthesizes Kimi's UX flow analysis into scored criteria and actionable requirements. Produces the structured UX assessment that feeds into the final plan — scores, WCAG compliance, specific recommendations.",
    buildParams: (task, context, _codeContext, _answers, prior) => ({
      text: `UX FINAL JUDGMENT — synthesize into scored assessment:

TASK: ${task}
${context ? `CONTEXT: ${context}` : ""}

KIMI'S UX FLOW ANALYSIS:
${distilledPrior("ux_analyze", prior) || "N/A"}

GPT'S TECHNICAL CRITIQUE:
${distilledPrior("critique", prior) || "N/A"}

Score each UX dimension /10 with specific findings:
1. USABILITY: Intuitiveness, learnability, friction points
2. ACCESSIBILITY: WCAG 2.1 AA compliance, keyboard nav, screen readers, contrast
3. INTERACTION DESIGN: States (loading, error, empty, success), transitions, feedback
4. CONSISTENCY: Design system alignment, pattern reuse
5. RESPONSIVENESS: Mobile/tablet/desktop breakpoints
6. PERFORMANCE UX: Perceived speed, skeleton screens, optimistic updates
7. EDGE CASES: 0 items, 1000+ items, long text, RTL, offline

Provide:
- UX SCORE: X/10 (weighted average)
- TOP 3 UX REQUIREMENTS that MUST be in the implementation plan
- BLOCKERS: Any UX issues that would prevent shipping
${DISTILL_SUFFIX}`,
      type: "general",
    }),
    description: "UX scoring + requirements (Gemini)",
    devlogType: "progress",
  },

  // Phase 3d: Responsiveness Assessment (CONDITIONAL - only for responsive/mobile tasks)
  {
    id: "responsive_judge",
    phase: "Responsive Review",
    tool: "kimi_thinking",
    condition: isResponsiveTask,
    thinking: "Responsive design review. When the task involves mobile/responsive work, we need dedicated breakpoint analysis, touch target validation, and layout reflow verification. Kimi traces each breakpoint systematically.",
    buildParams: (task, context, codeContext, _answers, prior) => ({
      problem: `RESPONSIVE DESIGN ASSESSMENT:

TASK: ${task}
${context ? `CONTEXT: ${context}` : ""}
${codeContext ? `
CODE:
${truncateSmart(codeContext, CODE_CONTEXT_LIMIT)}` : ""}
${prior.ux_judge ? `UX FINDINGS:\n${truncateSmart(prior.ux_judge, PRIOR_CONTEXT_LIMIT_SYNTHESIS)}` : ""}

Systematically evaluate for each breakpoint:

MOBILE (≤640px):
1. Layout: Single column? Content stacking order?
2. Touch targets: All interactive elements ≥44x44px?
3. Typography: Base font ≥16px? Line length ≤45 chars?
4. Navigation: Collapsed? Hamburger/bottom nav?
5. Forms: Appropriate input types? Autofill support?

TABLET (641-1024px):
1. Layout: Two-column? Sidebar behavior?
2. Orientation: Portrait vs landscape handling?
3. Touch + cursor: Hover states for trackpad users?

DESKTOP (>1024px):
1. Max width: Content doesn't stretch beyond readable width?
2. Whitespace: Appropriate spacing at large viewports?
3. Multi-panel: Side panels, split views?

CROSS-CUTTING:
1. Images: srcset/responsive images? Aspect ratio preservation?
2. Overflow: Horizontal scroll prevention? Text truncation?
3. Animation: Reduced motion preference (prefers-reduced-motion)?
4. Performance: Layout shift (CLS)? Largest contentful paint (LCP)?

Score each breakpoint /10 and list specific issues.
${DISTILL_SUFFIX}`,
      approach: "systematic",
      maxSteps: 4,
    }),
    description: "Responsive design assessment (Kimi)",
    devlogType: "progress",
  },

  // Phase 4: Judgment (2 tools)
  {
    id: "judge_draft",
    phase: "Judgment",
    tool: "qwen_reason",
    thinking: "First synthesis pass. Now we merge: Qwen's feasibility + Kimi's steps + GPT's critiques. Creates a coherent draft that addresses all findings and includes quality scores.",
    buildParams: (task, _context, codeContext, answers, prior) => ({
      problem: `Synthesize a coherent implementation plan:

TASK: ${task}
${answers ? `USER REQUIREMENTS:\n${answers}` : ""}

ANALYSES:
- Qwen: ${distilledPrior("analyze_qwen", prior) || "N/A"}
- Kimi: ${distilledPrior("analyze_kimi", prior) || "N/A"}
${prior.decompose_kimi ? `\nTASK DECOMPOSITION (subtasks + dependencies):\n${truncateSmart(prior.decompose_kimi, PRIOR_CONTEXT_LIMIT_SYNTHESIS)}` : ""}

CRITIQUE (holes found):
${truncateSmart(prior.critique, PRIOR_CONTEXT_LIMIT_SYNTHESIS) || "N/A"}
${prior.debate_con ? `\nDEBATE SYNTHESIS (key tensions):\n${distilledPrior("debate_con", prior)}` : ""}
${prior.ux_judge ? `\nUX ASSESSMENT:\n${truncateSmart(prior.ux_judge, PRIOR_CONTEXT_LIMIT_SYNTHESIS)}` : ""}
${prior.responsive_judge ? `\nRESPONSIVE ASSESSMENT:\n${truncateSmart(prior.responsive_judge, PRIOR_CONTEXT_LIMIT_SYNTHESIS)}` : ""}
${codeContext ? "\nNote: Analysis was performed on actual code." : ""}

Create a structured plan addressing all concerns.
${prior.decompose_kimi ? "Use the task decomposition to structure steps with correct dependency ordering." : ""}
${prior.debate_con ? "Explicitly resolve each tension from the debate." : ""}
${prior.ux_judge ? "Include UX requirements and accessibility criteria in the plan." : ""}
${prior.responsive_judge ? "Include responsive design requirements and breakpoint specifications." : ""}
Include overall confidence score /10.`,
      approach: "logical",
    }),
    description: "Draft plan synthesis (Qwen)",
    isSynthesis: true,
  },
  {
    id: "judge_final",
    phase: "Judgment",
    tool: "gemini_analyze_text",
    thinking: "Final arbiter with bite-sized TDD output. Gemini sees everything - all analyses, the critique, the draft plan - and produces an actionable plan in writing-plans format: exact files, bite-sized steps (2-5 min each), test-first approach, commit points. This bridges planner_maker's multi-model intelligence with writing-plans' execution format.",
    buildParams: (task, context, codeContext, answers, prior) => ({
      text: `Create the FINAL implementation plan in BITE-SIZED STEPS format.

TASK: ${task}
${context ? `CONTEXT: ${context}` : ""}
${answers ? `USER REQUIREMENTS:\n${answers}` : ""}

QWEN'S DRAFT PLAN:
${prior.judge_draft || "N/A"}

GPT'S PRE-MORTEM + CRITIQUE:
${truncateSmart(prior.critique, PRIOR_CONTEXT_LIMIT_SYNTHESIS) || "N/A"}
${prior.decompose_kimi ? `\nTASK DECOMPOSITION (subtasks + dependencies):\n${truncateSmart(prior.decompose_kimi, PRIOR_CONTEXT_LIMIT_SYNTHESIS)}` : ""}
${prior.ux_judge ? `\nUX ASSESSMENT:\n${truncateSmart(prior.ux_judge, PRIOR_CONTEXT_LIMIT_SYNTHESIS)}` : ""}
${prior.responsive_judge ? `\nRESPONSIVE ASSESSMENT:\n${truncateSmart(prior.responsive_judge, PRIOR_CONTEXT_LIMIT_SYNTHESIS)}` : ""}
${codeContext ? "\nNote: All analysis was performed on actual code provided." : ""}

OUTPUT FORMAT — Each task must be bite-sized (2-5 min):

### Task [T-ID]: [Component Name]
**Dependencies:** Blocked by: T1,T3 | Blocks: T4 | Parallel: yes/no | Complexity: Low/Med/High
**Files:** Create: path/to/file | Modify: path/to/file:lines | Test: path/to/test
**Step 1:** Write the failing test (show test code)
**Step 2:** Run test to verify it fails (exact command + expected output)
**Step 3:** Write minimal implementation (show code)
**Step 4:** Run test to verify it passes (exact command)
**Step 5:** Commit (exact git command with message)

REQUIREMENTS:
1. Exact file paths for every change
2. Test-first (TDD): write test → fail → implement → pass → commit
3. Complete code in each step (not "add validation" — show the actual code)
4. Exact commands with expected output
5. Checkpoints at 50%, 80%, and 100%
6. Address ALL pre-mortem failure causes from critique as mitigations
7. Order tasks topologically: a task MUST appear after all tasks that block it. Within independent groups, order simplest → hardest (using Complexity).
8. Preserve exact task IDs from TASK DECOMPOSITION (T1, T1.1, T2). Do NOT renumber. Each task MUST include the Dependencies line with Blocked by/Blocks/Parallel/Complexity fields.

**QUALITY ASSESSMENT (at the end):**
   - Code Quality: X/10
   - Security: X/10
   - Performance: X/10
${prior.ux_judge ? `   - UX/Accessibility: X/10\n` : ""}${prior.responsive_judge ? `   - Responsiveness: X/10\n` : ""}   - Confidence: X/10
   - Overall: X/10`,
      type: "general",
    }),
    description: "Final plan in bite-sized TDD steps (Gemini)",
    devlogType: "progress",
    isSynthesis: true,
  },
];

// ═══════════════════════════════════════════════════════════════════
// PLANNER_MAKER - Coordinator Pattern
// ═══════════════════════════════════════════════════════════════════

export const plannerMakerTool = {
  name: "planner_maker",
  description: `Multi-model council for creating implementation plans.

COORDINATOR PATTERN - Returns ONE tool to execute at a time:
1. Call with mode: "start" to begin
2. Execute the returned tool
3. Call with mode: "continue" and prior results
4. Repeat until isComplete: true

Example:
  planner_maker({ task: "Add auth", mode: "start" })
  → { nextTool: { tool: "grok_search", params: {...} }, step: 1 }

  [Execute grok_search]

  planner_maker({ task: "Add auth", mode: "continue", step: 2, prior: { search: "..." } })
  → { nextTool: { tool: "qwen_coder", params: {...} }, step: 2 }

  ... continue until isComplete: true`,

  parameters: z.object({
    task: z.string().describe("The task/goal to create a plan for"),
    goal: z.string().optional().describe("Success criteria for this plan — what must be true when done. Checked at every checkpoint. Example: 'GDPR compliant, fail-closed, admin-only toggle'"),
    context: z.string().optional().describe("Additional context"),
    codeContext: z.string().optional().describe("Actual code from relevant files for analysis (read files and paste here)"),
    files: z.array(z.string()).optional().describe("File paths to read as code context. Supports line ranges: 'src/foo.ts:100-200'. Model sees ACTUAL CODE."),
    answers: z.string().optional().describe("Answers to clarifying questions"),
    mode: z.enum(["start", "continue"]).optional().default("start")
      .describe("start: begin new plan, continue: next step"),
    step: z.number().optional().describe("Current step number (for continue mode)"),
    prior: z.record(z.string()).optional()
      .describe("Results from previous steps: { search: '...', analyze_qwen: '...' }"),
    devlog: z.boolean().optional().default(true)
      .describe("Include devlog hints for sync"),
    ux: z.boolean().optional().default(false)
      .describe("Enable UX/accessibility review steps (auto-detected from task keywords, or set true to force)"),
    responsive: z.boolean().optional().default(false)
      .describe("Enable responsive design review (auto-detected from keywords, or set true to force)"),
    debate: z.boolean().optional().default(false)
      .describe("Enable lightweight pro/con debate between Analysis and Critique (adds ~2 steps, main points only)"),
    issueFile: z.string().optional()
      .describe("Path to an issue/spec markdown file. Server reads it and merges into context. Supports .md, .txt, .markdown files."),
  }),

  execute: async (args: {
    task: string;
    goal?: string;
    context?: string;
    codeContext?: string;
    files?: string[];
    answers?: string;
    mode?: "start" | "continue";
    step?: number;
    prior?: Record<string, string>;
    devlog?: boolean;
    ux?: boolean;
    responsive?: boolean;
    debate?: boolean;
    issueFile?: string;
  }, ctx: MCPContext): Promise<string> => {
    // Merge files into codeContext
    const fileContent = args.files?.length
      ? readFilesIntoContext(args.files)
      : "";
    const mergedCodeContext = fileContent
      ? (args.codeContext ? `${args.codeContext}\n\n${fileContent}` : fileContent)
      : (args.codeContext || "");
    const { task, answers = "", mode = "start", devlog = true } = args;
    const codeContext = mergedCodeContext;
    const goal = args.goal || "";
    const prior = args.prior || {};

    // Read issue file and merge into context
    let context = args.context || "";
    if (args.issueFile) {
      try {
        const filePath = path.isAbsolute(args.issueFile)
          ? args.issueFile
          : path.join(process.cwd(), args.issueFile);
        if (fs.existsSync(filePath)) {
          const issueContent = fs.readFileSync(filePath, "utf-8");
          context = context
            ? `${context}\n\n--- ISSUE FILE: ${args.issueFile} ---\n${issueContent}`
            : `--- ISSUE FILE: ${args.issueFile} ---\n${issueContent}`;
          ctx.log.info(`Loaded issue file: ${filePath} (${issueContent.length} chars)`);
        } else {
          ctx.log.warn(`Issue file not found: ${filePath}`);
          context = context
            ? `${context}\n\n[Warning: Issue file not found: ${args.issueFile}]`
            : `[Warning: Issue file not found: ${args.issueFile}]`;
        }
      } catch (err) {
        ctx.log.warn(`Failed to read issue file: ${args.issueFile}`, { error: String(err) });
      }
    }

    // Set overrides if explicitly requested
    _uxOverride = args.ux === true;
    _responsiveOverride = args.responsive === true;
    _debateOverride = args.debate === true;

    // Build active workflow (filters conditional steps like UX/responsive/debate)
    const workflow = getActiveWorkflow(task, context);

    // Reset overrides after building workflow
    _uxOverride = false;
    _responsiveOverride = false;
    _debateOverride = false;

    // Determine current step
    const currentStep = mode === "start" ? 0 : (args.step ?? 1) - 1;
    const totalSteps = workflow.length;

    // On START: create the plan file immediately (empty, in-progress)
    if (mode === "start" && devlog) {
      try {
        const initialBody = buildIncrementalPlan(workflow, {}, 0, totalSteps);
        const filepath = savePlanToFile(task, initialBody, {
          phases: workflow.map(s => s.phase),
          tools_used: [],
          goal,
        }, { planStatus: "in-progress" });
        setPlanFilePath(task, filepath);
        ctx.log.info(`Plan file created: ${filepath}`);
      } catch (err) {
        ctx.log.warn("Failed to create initial plan file", { error: String(err) });
      }
    }

    // On continue: save the JUST-COMPLETED step output to disk
    // The previous step (currentStep - 1) is the one that just finished
    let accumulated: Record<string, string> = {};
    if (mode === "continue" && currentStep > 0) {
      const justCompletedStep = workflow[currentStep - 1];
      if (justCompletedStep) {
        accumulated = accumulateStepOutput(task, justCompletedStep.id, prior);
        ctx.log.info(`Accumulated ${justCompletedStep.id}: ${(prior[justCompletedStep.id] || "").length} chars (disk: ${(accumulated[justCompletedStep.id] || "").length} chars)`);

        // INCREMENTAL SAVE: Update the plan file with current accumulated state
        if (devlog) {
          try {
            const completedTools = workflow.slice(0, currentStep).map(s => s.tool);
            const incrementalBody = buildIncrementalPlan(workflow, accumulated, currentStep, totalSteps);
            const existingPath = getPlanFilePath(task);
            const filepath = savePlanToFile(task, incrementalBody, {
              phases: workflow.map(s => s.phase),
              tools_used: completedTools,
              goal,
            }, { planStatus: "in-progress", existingFilepath: existingPath });
            setPlanFilePath(task, filepath);
            ctx.log.info(`Plan file updated: ${filepath} (step ${currentStep}/${totalSteps})`);
          } catch (err) {
            ctx.log.warn("Failed to update incremental plan file", { error: String(err) });
          }
        }
      }
    }

    // Check if complete
    if (currentStep >= totalSteps) {
      // Also accumulate the final step
      const lastStep = workflow[totalSteps - 1];
      if (lastStep && prior[lastStep.id]) {
        accumulated = accumulateStepOutput(task, lastStep.id, prior);
      }

      // Use SERVER-SIDE accumulated outputs (full text, not Claude's summaries)
      const fullOutputs = Object.keys(accumulated).length > 0 ? accumulated : prior;

      // Build comprehensive plan from ALL step outputs
      const fullPlanSections: string[] = [];

      const stepOrder = workflow.map(s => s.id);
      for (const stepId of stepOrder) {
        const content = fullOutputs[stepId];
        if (!content || content.length < 20) continue;

        const stepDef = workflow.find(s => s.id === stepId);
        const sectionTitle = stepDef
          ? `${stepDef.phase}: ${stepDef.description}`
          : stepId;

        fullPlanSections.push(`## ${sectionTitle}\n\n${content}`);
      }

      // Also include any keys not in the workflow
      for (const [key, content] of Object.entries(fullOutputs)) {
        if (stepOrder.includes(key)) continue;
        if (!content || content.length < 20) continue;
        fullPlanSections.push(`## ${key}\n\n${content}`);
      }

      // The final judge output is the executive summary
      const judgeFinal = fullOutputs.judge_final || prior.judge_final || "";
      const judgeDraft = fullOutputs.judge_draft || prior.judge_draft || "";

      // Build the saved plan: executive summary + full analysis
      let planBody = [
        judgeFinal || judgeDraft || "No final plan generated",
        "",
        "---",
        "",
        "# Full Analysis",
        "",
        ...fullPlanSections,
      ].join("\n");

      if (goal) {
        planBody = `## 🎯 Goal\n\n> ${goal}\n\n---\n\n${planBody}`;
      }

      // Parse quality scores from ALL accumulated text
      const allText = Object.values(fullOutputs).join("\n");
      const scores = parseScoresFromPlan(allText);

      // Clean up accumulator cache
      cleanAccumulator(task);

      // Save FINAL plan to devlog daily directory (reuse incremental filepath)
      let savedPath = "";
      try {
        const existingPath = getPlanFilePath(task);
        savedPath = savePlanToFile(task, planBody, {
          phases: workflow.map(s => s.phase),
          tools_used: workflow.map(s => s.tool),
          scores: Object.keys(scores).length > 0 ? scores : undefined,
          goal,
        }, { planStatus: "pending", existingFilepath: existingPath });
        clearPlanFilePath(task);
        ctx.log.info(`Plan saved to devlog: ${savedPath} (${planBody.length} chars)`);
      } catch (err) {
        ctx.log.warn("Failed to save plan to devlog", { error: String(err) });
      }

      // Response shows the judge_final summary (or full if short)
      const displayResult = judgeFinal || judgeDraft || "No final plan generated";

      const response: CoordinatorResponse = {
        phase: "Complete",
        step: totalSteps,
        totalSteps,
        progress: `${totalSteps}/${totalSteps} (100%)`,
        isComplete: true,
        result: displayResult,
      };

      // Add devlog hint for completion
      if (devlog) {
        response.devlogHint = {
          tool: "devlog_session_log",
          params: {
            entry: `Plan complete: ${task.substring(0, 80)}${savedPath ? ` (saved to devlog)` : ''}`,
            type: "progress",
          },
          description: "Log plan completion to devlog session",
        };
      }

      // Add saved path info
      if (savedPath) {
        response.result = `${displayResult}\n\n---\n📁 Full plan saved to devlog: \`${savedPath}\` (${planBody.length} chars)\nIncludes all analysis from ${fullPlanSections.length} steps.\nThe plan will appear in devlog-ui under the "Plans" filter.\n\nTo execute: \`planner_runner({ plan: <read file>, mode: "start" })\``;
      }

      return formatCoordinatorResponse(response, prior, workflow, getPlanFilePath(task));
    }

    // Get current workflow step
    const workflowStep = workflow[currentStep];
    const progressPct = Math.round(((currentStep + 1) / totalSteps) * 100);

    // Build tool instruction
    const toolInstruction: ToolInstruction = {
      tool: workflowStep.tool,
      params: workflowStep.buildParams(task, context, codeContext, answers, prior),
      maxTokens: getMaxTokens(workflowStep.tool),
      description: workflowStep.description,
    };

    const response: CoordinatorResponse = {
      phase: workflowStep.phase,
      step: currentStep + 1,
      totalSteps,
      progress: `${currentStep + 1}/${totalSteps} (${progressPct}%)`,
      nextTool: toolInstruction,
      isComplete: false,
    };

    // Add devlog hint if enabled
    if (devlog && workflowStep.devlogType) {
      response.devlogHint = {
        tool: "devlog_session_log",
        params: {
          entry: `${workflowStep.phase}: ${workflowStep.description}`,
          type: workflowStep.devlogType,
        },
        description: `Log ${workflowStep.phase.toLowerCase()} phase`,
      };
    }

    return formatCoordinatorResponse(response, prior, workflow, getPlanFilePath(task));
  },
};

/**
 * Format coordinator response for terminal display
 * Shows THINKING prominently, keeps tool details compact
 */
function formatCoordinatorResponse(response: CoordinatorResponse, _prior: Record<string, string>, workflow: WorkflowStep[] = ALL_WORKFLOW_STEPS, planFilePath?: string): string {
  const lines: string[] = [];

  // Progress bar
  const progressBar = generateProgressBar(response.step, response.totalSteps);
  lines.push(`## ${progressBar} Step ${response.step}/${response.totalSteps} · ${response.phase}`);
  lines.push("");

  if (response.isComplete) {
    lines.push("# ✅ Plan Complete");
    lines.push("");
    lines.push(response.result || "");

    if (response.devlogHint) {
      lines.push("");
      lines.push(`📝 Devlog: ${response.devlogHint.tool} → "${response.devlogHint.params.entry}"`);
    }
  } else {
    const tool = response.nextTool!;
    const workflowStep = workflow[response.step - 1];

    // THINKING - the why, front and center
    if (workflowStep?.thinking) {
      lines.push(`### 💭 Why This Step`);
      lines.push("");
      lines.push(workflowStep.thinking);
      lines.push("");
    }

    // Tool call - compact summary
    lines.push(`---`);
    lines.push(`Next → ${tool.tool} · ${tool.description}`);

    // Devlog hint (tiny)
    if (response.devlogHint) {
      lines.push(`📝 ${response.devlogHint.params.entry}`);
    }

    // Plan file path (so user can check progress)
    if (planFilePath) {
      lines.push(`📄 Live plan: ${planFilePath}`);
    }

    // Next step instruction
    lines.push("");
    const stepId = workflowStep?.id || "result";
    lines.push(`▶ Execute ${tool.tool}, then: planner_maker({ mode: "continue", step: ${response.step + 1}, prior: { ...prior, ${stepId}: FULL_RESULT } })`);
    lines.push(`IMPORTANT: Pass the COMPLETE tool output as ${stepId} — do NOT summarize.`);
  }

  return lines.join("\n");
}

/**
 * Generate visual progress bar
 */
function generateProgressBar(current: number, total: number): string {
  const filled = Math.round((current / total) * 10);
  const empty = 10 - filled;
  return '█'.repeat(filled) + '░'.repeat(empty);
}

// ═══════════════════════════════════════════════════════════════════
// PLANNER_RUNNER - Step-by-step execution with verification
// ═══════════════════════════════════════════════════════════════════

/**
 * Parse plan into structured steps
 */
function parsePlanSteps(plan: string): { title: string; details: string }[] {
  const steps: { title: string; details: string }[] = [];

  // Try numbered steps first (### Step 1: or 1. or Step 1:)
  const stepPatterns = [
    /###\s*Step\s*\d+[:\s]+([^\n]+)([\s\S]*?)(?=###\s*Step|\n##[^#]|$)/gi,
    /^\s*(\d+)\.\s*([^\n]+)([\s\S]*?)(?=^\s*\d+\.|$)/gm,
    /^Step\s*\d+[:\s]+([^\n]+)([\s\S]*?)(?=^Step\s*\d+|$)/gim,
  ];

  for (const pattern of stepPatterns) {
    const matches = [...plan.matchAll(pattern)];
    if (matches.length >= 2) {
      for (const match of matches) {
        const title = (match[1] || match[2] || "").trim();
        const details = (match[2] || match[3] || "").trim();
        if (title) {
          steps.push({ title: title.substring(0, 100), details: details.substring(0, 500) });
        }
      }
      break;
    }
  }

  // Fallback: split by "###" headers
  if (steps.length === 0) {
    const sections = plan.split(/^###\s+/m).filter(Boolean);
    for (const section of sections) {
      const [firstLine, ...rest] = section.split('\n');
      if (firstLine && !firstLine.toLowerCase().includes('plan')) {
        steps.push({
          title: firstLine.replace(/^#+\s*/, '').substring(0, 100),
          details: rest.join('\n').substring(0, 500),
        });
      }
    }
  }

  return steps;
}

/**
 * Extract goal from plan frontmatter (planGoal field)
 */
function extractGoalFromPlan(plan: string): string | undefined {
  const match = plan.match(/planGoal:\s*"([^"]+)"/);
  if (match) return match[1];
  const goalSection = plan.match(/##\s*🎯\s*Goal\s*\n+>\s*(.+)/);
  if (goalSection) return goalSection[1].trim();
  return undefined;
}

export const plannerRunnerTool = {
  name: "planner_runner",
  description: `Execute implementation plans step-by-step with goal-oriented verification.

COORDINATOR PATTERN - tracks actual plan steps:
1. Call with mode: "start" to parse plan and begin
2. Call with mode: "step" and stepNum to work on specific step
3. Call with mode: "verify" at 50%, 80%, and 100% for checkpoints

Checkpoints verify GOAL ALIGNMENT with 5 different models (no repeats adjacent):
- step1: Gemini Sherlock gate — "am I building the RIGHT thing?" (6 deduction questions)
- 10%: Grok early drift — catch wrong approach before wasting 90%
- 25%: GPT strategy validation — is the approach working? amendment protocol
- 50%: Qwen reason — progress + goal alignment (different perspective)
- 80%: Kimi decompose remaining work + goal alignment
- 100%: GPT first judge → Gemini final judge (dual) + Reflexion Lite

Pass goal= explicitly, or it's extracted from plan frontmatter (planGoal field).

Evidence params (unblind the checkpoints):
- files: read actual source code from disk
- diff: git diff output (what changed)
- testResults: npm test output (proof it works)
- modifiedFiles: list of touched files (scope creep detection)`,

  parameters: z.object({
    plan: z.string().describe("The implementation plan from planner_maker"),
    goal: z.string().optional().describe("Success criteria — extracted from plan frontmatter or provided manually. Verified at every checkpoint."),
    mode: z.enum(["start", "step", "verify"]).optional().default("start")
      .describe("start: parse plan, step: work on step N, verify: checkpoint"),
    stepNum: z.number().optional().describe("Step number (1-indexed) for mode=step"),
    checkpoint: z.enum(["step1", "10%", "25%", "50%", "80%", "100%"]).optional().describe("Checkpoint for mode=verify — step1 catches wrong-approach, 10% catches drift early, 25% validates strategy"),
    code: z.string().optional().describe("Current code snapshot for verification"),
    files: z.array(z.string()).optional().describe("File paths to read as code context. Supports line ranges: 'src/foo.ts:100-200'. Model sees ACTUAL CODE."),
    diff: z.string().optional().describe("Git diff output showing what changed (run: git diff). Most important evidence for drift detection."),
    testResults: z.string().optional().describe("Test output (run: npm test). Proof that implementation works."),
    modifiedFiles: z.array(z.string()).optional().describe("List of modified files (run: git diff --name-only). Detects scope creep."),
    completed: z.array(z.number()).optional().describe("List of completed step numbers"),
    devlog: z.boolean().optional().default(true),
    ux: z.boolean().optional().default(false)
      .describe("Add UX verification at checkpoints (usability, accessibility, interaction states)"),
    responsive: z.boolean().optional().default(false)
      .describe("Add responsiveness verification at checkpoints (mobile/tablet/desktop, breakpoints, touch targets)"),
  }),

  execute: async (args: {
    plan: string;
    goal?: string;
    mode?: "start" | "step" | "verify";
    stepNum?: number;
    checkpoint?: "step1" | "10%" | "25%" | "50%" | "80%" | "100%";
    code?: string;
    files?: string[];
    diff?: string;
    testResults?: string;
    modifiedFiles?: string[];
    completed?: number[];
    devlog?: boolean;
    ux?: boolean;
    responsive?: boolean;
  }, _ctx: MCPContext): Promise<string> => {
    // Merge files into code context
    const fileContent = args.files?.length
      ? readFilesIntoContext(args.files)
      : "";
    const mergedCode = fileContent
      ? (args.code ? `${args.code}\n\n${fileContent}` : fileContent)
      : args.code;
    const { plan, mode = "start", stepNum, checkpoint, completed = [], devlog = true, ux = false, responsive = false } = args;
    const code = mergedCode;
    const goal = args.goal || extractGoalFromPlan(plan) || "";
    const lines: string[] = [];

    // Build evidence block for checkpoint prompts (unblinding)
    const evidenceParts: string[] = [];
    if (code) evidenceParts.push(`CODE:\n${code.substring(0, 3000)}${code.length > 3000 ? "\n[... truncated, " + code.length + " chars total]" : ""}`);
    if (args.diff) evidenceParts.push(`GIT DIFF (what changed):\n${args.diff.substring(0, 3000)}${args.diff.length > 3000 ? "\n[... truncated]" : ""}`);
    if (args.testResults) evidenceParts.push(`TEST RESULTS:\n${args.testResults.substring(0, 1000)}${args.testResults.length > 1000 ? "\n[... truncated]" : ""}`);
    if (args.modifiedFiles?.length) evidenceParts.push(`MODIFIED FILES:\n${args.modifiedFiles.join("\n")}`);
    const evidence = evidenceParts.length > 0
      ? `\n\nEVIDENCE:\n${evidenceParts.join("\n\n")}`
      : "";

    // Parse plan into steps
    const steps = parsePlanSteps(plan);
    const totalSteps = Math.max(steps.length, completed.length); // handle completed exceeding parsed steps

    if (mode === "start") {
      // ═══════════════════════════════════════════════════════════════
      // START: Show parsed plan and devlog hint
      // ═══════════════════════════════════════════════════════════════
      lines.push(`## 📋 Plan Parsed - ${totalSteps} Steps`);
      lines.push("");
      if (goal) {
        lines.push(`**🎯 Goal:** ${goal}`);
        lines.push("");
      }

      if (totalSteps === 0) {
        lines.push("⚠️ Could not parse steps from plan. Expected numbered steps or ### headers.");
        lines.push("");
        lines.push("Raw plan preview:");
        lines.push(`> ${plan.substring(0, 200)}...`);
        return lines.join("\n");
      }

      // Show steps
      lines.push("| # | Step | Status |");
      lines.push("|---|------|--------|");
      for (let i = 0; i < steps.length; i++) {
        const status = completed.includes(i + 1) ? "✅" : "⏳";
        lines.push(`| ${i + 1} | ${steps[i].title} | ${status} |`);
      }
      lines.push("");

      // Devlog hint
      if (devlog) {
        lines.push("### 📝 Devlog Hint");
        lines.push("");
        lines.push("```");
        lines.push(`devlog_plan_create({`);
        lines.push(`  title: "${steps[0]?.title.substring(0, 40) || 'Implementation'}...",`);
        lines.push(`  items: [`);
        for (const step of steps.slice(0, 10)) {
          lines.push(`    "${step.title}",`);
        }
        lines.push(`  ]`);
        lines.push(`})`);
        lines.push("```");
        lines.push("");
      }

      // First step
      lines.push("---");
      lines.push(`▶ Start with: \`planner_runner({ plan, mode: "step", stepNum: 1 })\``);

    } else if (mode === "step" && stepNum) {
      // ═══════════════════════════════════════════════════════════════
      // STEP: Show specific step details + guidance
      // ═══════════════════════════════════════════════════════════════
      const stepIndex = stepNum - 1;
      const step = steps[stepIndex];
      const progressPct = Math.round((stepNum / totalSteps) * 100);
      const progressBar = generateProgressBar(stepNum, totalSteps);

      if (!step) {
        lines.push(`⚠️ Step ${stepNum} not found. Plan has ${totalSteps} steps.`);
        return lines.join("\n");
      }

      lines.push(`## ${progressBar} Step ${stepNum}/${totalSteps} (${progressPct}%)`);
      lines.push("");
      lines.push(`### 🎯 ${step.title}`);
      lines.push("");

      if (step.details) {
        lines.push(step.details);
        lines.push("");
      }

      // Goal reminder at every step
      if (goal) {
        lines.push(`> 🎯 **Goal:** ${goal}`);
        lines.push("");
      }

      // Show what's done
      if (completed.length > 0) {
        lines.push(`✅ Completed: ${completed.join(", ")}`);
        lines.push("");
      }

      // Checkpoint reminders — early gates catch drift before wasted work
      const tenPctStep = Math.max(2, Math.ceil(totalSteps * 0.1));
      const quarterStep = Math.ceil(totalSteps * 0.25);
      const halfwayStep = Math.ceil(totalSteps / 2);
      const eightyPctStep = Math.ceil(totalSteps * 0.8);

      if (stepNum === 1) {
        lines.push("---");
        lines.push("⚡ **STEP 1 CHECKPOINT** - After this step, verify you're building the RIGHT thing:");
        lines.push(`\`planner_runner({ plan, mode: "verify", checkpoint: "step1", completed: [1]${goal ? `, goal: "${goal.substring(0, 60)}..."` : ""} })\``);
      }
      if (stepNum === tenPctStep && tenPctStep > 1) {
        lines.push("---");
        lines.push("⚡ **10% CHECKPOINT** - After this step, catch drift early:");
        lines.push(`\`planner_runner({ plan, mode: "verify", checkpoint: "10%", completed: [...] })\``);
      }
      if (stepNum === quarterStep && quarterStep > tenPctStep) {
        lines.push("---");
        lines.push("⚡ **25% CHECKPOINT** - After this step, verify approach is working:");
        lines.push(`\`planner_runner({ plan, mode: "verify", checkpoint: "25%", completed: [...] })\``);
      }
      if (stepNum === halfwayStep && halfwayStep !== quarterStep) {
        lines.push("---");
        lines.push("⚡ 50% CHECKPOINT - After this step, run verification:");
        lines.push(`\`planner_runner({ plan, mode: "verify", checkpoint: "50%", completed: [...] })\``);
      }
      if (stepNum === eightyPctStep && eightyPctStep !== halfwayStep) {
        lines.push("---");
        lines.push("⚡ 80% CHECKPOINT - After this step, decompose remaining work:");
        lines.push(`\`planner_runner({ plan, mode: "verify", checkpoint: "80%", completed: [...] })\``);
      }

      // Next step
      lines.push("---");
      if (stepNum < totalSteps) {
        lines.push(`▶ After completing, mark done and continue:`);
        lines.push(`\`planner_runner({ plan, mode: "step", stepNum: ${stepNum + 1}, completed: [${[...completed, stepNum].join(", ")}] })\``);
      } else {
        lines.push(`▶ Final step! After completing, run 100% verification:`);
        lines.push(`\`planner_runner({ plan, mode: "verify", checkpoint: "100%", completed: [${[...completed, stepNum].join(", ")}], code: "..." })\``);
      }

    } else if (mode === "verify" && checkpoint) {
      // ═══════════════════════════════════════════════════════════════
      // VERIFY: Goal-oriented checkpoint with dual-judge verification
      // ═══════════════════════════════════════════════════════════════
      // Preserve original step numbers (not filtered array indices)
      const completedSteps = steps
        .map((step, i) => ({ ...step, stepNum: i + 1 }))
        .filter(s => completed.includes(s.stepNum));
      const remainingSteps = steps
        .map((step, i) => ({ ...step, stepNum: i + 1 }))
        .filter(s => !completed.includes(s.stepNum));

      lines.push(`## 🔍 ${checkpoint} Checkpoint Verification`);
      lines.push("");
      lines.push(`Progress: ${completed.length}/${totalSteps} steps complete`);
      if (goal) {
        lines.push(`**🎯 Goal:** ${goal}`);
      }
      lines.push("");

      if (completedSteps.length > 0) {
        lines.push("✅ Completed:");
        for (const step of completedSteps) {
          lines.push(`- ${step.title}`);
        }
        lines.push("");
      }

      if ((checkpoint === "50%" || checkpoint === "80%" || checkpoint === "25%" || checkpoint === "10%") && remainingSteps.length > 0) {
        lines.push("⏳ Remaining:");
        for (const step of remainingSteps) {
          lines.push(`- ${step.title}`);
        }
        lines.push("");
      }

      const goalPrompt = goal
        ? `\n\nGOAL ALIGNMENT CHECK:\nThe stated goal is: "${goal}"\n- Does current progress serve this goal?\n- Is there any drift from the goal?\n- Are remaining steps still aligned with the goal?\n- Flag any steps that might CONTRADICT the goal.`
        : "";

      // ═══════════════════════════════════════════════════════════════
      // EARLY GATES: step1 + 10% + 25% — catch drift before wasted work
      // ═══════════════════════════════════════════════════════════════

      if (checkpoint === "step1") {
        // Step 1 gate: "Am I building the RIGHT thing?" — Sherlock-style deductions
        const step1Prompt = `STEP 1 CHECKPOINT — "Am I building the RIGHT thing?"

You are a detective examining an implementation plan BEFORE any real work begins.
Deduce whether this plan will build what was actually requested.

PLAN STEP 1: ${steps[0]?.title || "Unknown"}
${steps[0]?.details ? `Details: ${steps[0].details}` : ""}

FULL PLAN (${totalSteps} steps):
${steps.map((s, i) => `${i + 1}. ${s.title}`).join('\n')}
${goal ? `\nSTATED GOAL: "${goal}"` : ""}
${evidence}

ANSWER EACH — Y/N with evidence. Any N = STOP and redesign:

1. GOAL FIDELITY: Does the plan's direction match the stated goal exactly? (not a reinterpretation or adjacent goal)
2. CRITERIA CHECK: Are success criteria specific and measurable? (not vague like "improve" or "better")
3. CONSTRAINT SCAN: Does the approach violate any stated constraint? (tech stack, time, compliance)
4. CONTRADICTION HUNT: Are any requirements internally contradictory? (A requires NOT-B)
5. METHOD FIT: Does the high-level approach match the goal class? (e.g., not building an API when a config change suffices)
6. ASSUMPTION AUDIT: Does step 1 assume anything unverified? (hallucinated prerequisites, unstated dependencies)

VERDICT: PROCEED, STOP_AND_CLARIFY, or WRONG_APPROACH
If not PROCEED: explain what's wrong and suggest correction.`;

        lines.push("### 🔍 Step 1 Gate — Sherlock Deductions");
        lines.push("");
        lines.push("Execute this verification tool:");
        lines.push("");
        lines.push("```json");
        lines.push(JSON.stringify({
          tool: "gemini_analyze_text",
          params: { text: step1Prompt, type: "key-points" },
        }, null, 2));
        lines.push("```");
        lines.push("");
        lines.push("If WRONG_APPROACH or STOP_AND_CLARIFY: **halt and redesign before continuing.**");

      } else if (checkpoint === "10%") {
        // 10% gate: "Is the approach working?" — early drift detection
        const tenPctPrompt = `10% CHECKPOINT — Early Drift Detection

${completed.length}/${totalSteps} steps done. Catching drift early saves the other 90%.

COMPLETED:
${completedSteps.map(s => `${s.stepNum}. ${s.title}`).join('\n')}

REMAINING:
${remainingSteps.map(s => `${s.stepNum}. ${s.title}`).join('\n')}
${goalPrompt}
${evidence}

CHECK:
1. Does early work ACTUALLY serve the goal, or has implementation drifted?
2. Are we solving the RIGHT problem at the RIGHT level of abstraction?
3. Any signs of over-engineering or under-engineering?
4. Should any remaining steps be reordered or dropped?

VERDICT: ON_TRACK or DRIFTING (with evidence and proposed correction)`;

        lines.push("### 🔍 10% — Early Drift Detection (Grok)");
        lines.push("");
        lines.push("Execute this verification tool:");
        lines.push("");
        lines.push("```json");
        lines.push(JSON.stringify({
          tool: "grok_reason",
          params: { query: tenPctPrompt },
        }, null, 2));
        lines.push("```");
        lines.push("");
        lines.push("If DRIFTING: pause and propose plan amendment before continuing.");

      } else if (checkpoint === "25%") {
        // 25% gate: "Is the strategy working?" — GPT judge
        const quarterPrompt = `25% CHECKPOINT — Strategy Validation

${completed.length}/${totalSteps} steps done. Quarter-way check: is the strategy sound?

COMPLETED:
${completedSteps.map(s => `${s.stepNum}. ${s.title}`).join('\n')}

REMAINING:
${remainingSteps.map(s => `${s.stepNum}. ${s.title}`).join('\n')}
${goalPrompt}
${evidence}

EVALUATE:
1. Progress assessment — are completed steps implemented correctly?
2. Strategy check — is the overall approach proving effective?
3. Goal alignment — any drift from stated goal?
4. Plan amendment — should remaining steps change based on what we've learned?

If amendment needed, provide:
- EVIDENCE: What specifically went wrong or changed
- PROPOSED REVISION: New/modified steps
- IMPACT: What changes downstream

VERDICT: ON_TRACK, AMEND_PLAN (with proposal), or WRONG_APPROACH`;

        lines.push("### 🧠 25% — Strategy Validation (GPT Judge)");
        lines.push("");
        lines.push("Execute this verification tool:");
        lines.push("");
        lines.push("```json");
        lines.push(JSON.stringify({
          tool: "openai_reason",
          params: { task: quarterPrompt, reasoning_effort: "high" },
        }, null, 2));
        lines.push("```");
        lines.push("");
        lines.push("If AMEND_PLAN: review proposed changes with user before continuing.");

      } else if (checkpoint === "50%") {
        const verifyPrompt = `50% CHECKPOINT — Progress & Goal Alignment Review\n\nCOMPLETED STEPS:\n${completedSteps.map(s => `${s.stepNum}. ${s.title}`).join('\n')}\n\nREMAINING STEPS:\n${remainingSteps.map(s => `${s.stepNum}. ${s.title}`).join('\n')}${goalPrompt}${evidence}\n\nRESPOND WITH:\n1. Progress assessment — are completed steps implemented correctly?\n2. Goal alignment — does current work serve the stated goal? Any drift?\n3. Remaining plan — should we adjust remaining steps to better serve the goal?\n4. Verdict: ON_TRACK or DRIFTING (with explanation)`;

        lines.push("### 🔍 50% — Progress Check (Qwen Reason)");
        lines.push("");
        lines.push("Execute this verification tool:");
        lines.push("");
        lines.push("```json");
        lines.push(JSON.stringify({
          tool: "qwen_reason",
          params: { query: verifyPrompt },
        }, null, 2));
        lines.push("```");
        lines.push("");
        lines.push("After Qwen judge, continue to next step or adjust plan based on verdict.");

      } else if (checkpoint === "80%") {
        const decomposeContext = `Remaining steps:\n${remainingSteps.map(s => `${s.stepNum}. ${s.title}${s.details ? ': ' + s.details.substring(0, 100) : ''}`).join('\n')}\n\nCompleted: ${completedSteps.map(s => `[${s.stepNum}] ${s.title}`).join(', ')}${goal ? `\n\nGOAL: ${goal}\nEnsure all remaining subtasks serve this goal. Flag any that don't.` : ""}`;

        lines.push("### 🔬 Kimi Decompose + Goal Check");
        lines.push("");
        lines.push("Execute this decomposition tool:");
        lines.push("");
        lines.push("```json");
        lines.push(JSON.stringify({
          tool: "kimi_decompose",
          params: {
            task: "Complete remaining implementation steps — verify each subtask serves the stated goal",
            context: decomposeContext,
            depth: 3,
            outputFormat: "dependencies",
          },
        }, null, 2));
        lines.push("```");
        lines.push("");
        lines.push("Review subtasks for goal alignment, then continue.");

      } else {
        const finalPrompt = `100% FINAL REVIEW — Quality + Goal Alignment\n\nALL STEPS:\n${steps.map((s, i) => `${i + 1}. ${s.title} ${completed.includes(i + 1) ? '✅' : '❌'}`).join('\n')}${goalPrompt}${evidence}\n\nSCORE EACH /10:\n1. Quality — code correctness, error handling\n2. Completeness — all steps done, no gaps\n3. Goal alignment — does the implementation serve "${goal || 'the stated task'}"?\n4. Security — no vulnerabilities introduced\n5. Performance — no obvious bottlenecks\n\nVERDICT: APPROVED or NEEDS_REVISION\nIf NEEDS_REVISION, list specific items to fix.`;

        lines.push("### 🧠 GPT First Judge");
        lines.push("");
        lines.push("Execute GPT review first:");
        lines.push("");
        lines.push("```json");
        lines.push(JSON.stringify({
          tool: "openai_reason",
          params: { task: finalPrompt, reasoning_effort: "high" },
        }, null, 2));
        lines.push("```");
        lines.push("");
        lines.push("### 🏛️ Gemini Final Judge");
        lines.push("");
        lines.push("Then execute Gemini for the final verdict:");
        lines.push("");
        lines.push("```json");
        lines.push(JSON.stringify({
          tool: "gemini_analyze_text",
          params: { text: finalPrompt + "\n\nNote: GPT already reviewed this. Provide your INDEPENDENT assessment — do NOT defer to GPT's verdict." },
        }, null, 2));
        lines.push("```");
        lines.push("");
        lines.push("If BOTH approve: Done! If EITHER flags issues: Address feedback and re-verify.");

        // Reflexion Lite — Gemini judge: "What went wrong? What worked?"
        const reflexionPrompt = `REFLEXION — Post-Implementation Learning

This plan just completed ${completed.length}/${totalSteps} steps.
${goal ? `Goal was: "${goal}"` : ""}

ALL STEPS:
${steps.map((s, i) => `${i + 1}. ${s.title} ${completed.includes(i + 1) ? '✅' : '❌'}`).join('\n')}

REFLECT:
1. What WORKED well? (approaches worth repeating)
2. What went WRONG or was harder than expected? (anti-patterns to avoid)
3. Was the plan's structure effective? (too granular? too vague? wrong order?)
4. Were checkpoints triggered at the right moments? (any drift caught late?)
5. One-sentence LESSON for next time: "Next time, [do X] instead of [Y]"

Output as structured JSON:
{
  "worked": ["..."],
  "failed": ["..."],
  "plan_quality": "good|adequate|poor",
  "lesson": "..."
}`;

        lines.push("");
        lines.push("### 🪞 Reflexion Lite — Learn from this run");
        lines.push("");
        lines.push("After the final judge, run reflexion (Gemini):");
        lines.push("");
        lines.push("```json");
        lines.push(JSON.stringify({
          tool: "gemini_analyze_text",
          params: { text: reflexionPrompt, type: "key-points" },
        }, null, 2));
        lines.push("```");
        lines.push("");
        lines.push("Save the lesson to devlog:");
        lines.push(`\`devlog_session_log({ entry: "Reflexion: [paste lesson here]", type: "learning" })\``);
      }

      // UX verification (when enabled) — two-step: Kimi flow analysis + Gemini scoring
      if (ux) {
        lines.push("");
        lines.push("### 🎨 UX Verification (2-step)");
        lines.push("");
        lines.push("**Step 1 — Kimi UX flow analysis:**");
        lines.push("```json");
        lines.push(JSON.stringify({
          tool: "kimi_thinking",
          params: {
            task: `Trace the user journey for the ${checkpoint} implementation. Check: initial state, interactions, error states, empty states, loading states, keyboard/screen reader access.${goal ? ` Goal: ${goal}` : ""}`,
          },
        }, null, 2));
        lines.push("```");
        lines.push("");
        lines.push("**Step 2 — Gemini UX scoring:**");
        lines.push("```json");
        lines.push(JSON.stringify({
          tool: "gemini_analyze_text",
          params: {
            text: `Score /10: Usability, Accessibility (WCAG 2.1 AA), Interaction Design, Consistency, Performance UX. List top 3 UX blockers.${goal ? ` Goal alignment: ${goal}` : ""}`,
          },
        }, null, 2));
        lines.push("```");
      }

      // Responsiveness verification (when enabled)
      if (responsive) {
        lines.push("");
        lines.push("### 📱 Responsiveness Verification");
        lines.push("");
        lines.push("```json");
        lines.push(JSON.stringify({
          tool: "gemini_analyze_text",
          params: {
            text: `Responsive Design Review at ${checkpoint}:\n1. BREAKPOINTS: Are mobile (≤640px), tablet (641-1024px), desktop (>1024px) handled?\n2. TOUCH TARGETS: Minimum 44x44px for interactive elements?\n3. LAYOUT: Does content reflow correctly? Any horizontal scroll?\n4. TYPOGRAPHY: Font sizes readable on mobile? Line lengths appropriate?\n5. NAVIGATION: Does nav collapse/adapt? Hamburger menu on mobile?\n6. IMAGES/MEDIA: Responsive images? Aspect ratios maintained?\n7. FORMS: Input fields usable on mobile? Appropriate input types?\nScore each /10 and list specific breakpoint issues.`,
          },
        }, null, 2));
        lines.push("```");
      }

      // Devlog hint
      if (devlog) {
        lines.push("");
        lines.push(`📝 Devlog: \`devlog_session_log({ entry: "${checkpoint} checkpoint - ${completed.length}/${totalSteps} steps${goal ? ` - goal: ${goal.substring(0, 40)}` : ""}", type: "progress" })\``);
      }

      // Next action
      lines.push("");
      lines.push("---");
      if (checkpoint === "100%") {
        lines.push("▶ If APPROVED: Done! If NEEDS_REVISION: Address feedback and re-verify.");
      } else {
        const nextStep = completed.length + 1;
        lines.push(`▶ After verification, continue: \`planner_runner({ plan, mode: "step", stepNum: ${nextStep}, completed: [${completed.join(", ")}] })\``);
      }
    }

    return lines.join("\n");
  },
};

// ═══════════════════════════════════════════════════════════════════
// LIST_PLANS - Find recent plans
// ═══════════════════════════════════════════════════════════════════

export const listPlansTool = {
  name: "list_plans",
  description: `List recently created plans from planner_maker.
Shows plans from the last N days (default 7) with filename, task, and status.`,

  parameters: z.object({
    days: z.number().optional().default(7).describe("Show plans from last N days"),
  }),

  execute: async (args: { days?: number }, _ctx: MCPContext): Promise<string> => {
    const { days = 7 } = args;
    const lines: string[] = [];

    const recentPlans = listRecentPlans(days);

    lines.push(`## 📋 Recent Plans (last ${days} days)`);
    lines.push("");

    if (recentPlans.length === 0) {
      const dailyDir = getDevlogDailyDir();
      lines.push(`No plans found in \`${dailyDir}\``);
      lines.push("");
      lines.push("Create a plan with: `planner_maker({ task: \"...\", mode: \"start\" })`");
      return lines.join("\n");
    }

    lines.push("| Created | Plan | Path |");
    lines.push("|---------|------|------|");

    for (const plan of recentPlans) {
      const dateStr = plan.created.toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
      // Extract task name from filename (remove date prefix, dayname, and plan- prefix)
      const taskName = plan.filename
        .replace(/^\d{4}-\d{2}-\d{2}-\d{2}h\d{2}m-\w+-plan-/, "")
        .replace(/\.md$/, "")
        .replace(/-/g, " ");
      lines.push(`| ${dateStr} | ${taskName} | \`${plan.filename}\` |`);
    }

    lines.push("");
    lines.push(`📁 Plans directory: \`${getDevlogDailyDir()}\``);
    lines.push("");
    lines.push("To execute a plan: read the file and call `planner_runner({ plan: <content>, mode: \"start\" })`");

    return lines.join("\n");
  },
};

// ═══════════════════════════════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════════════════════════════

export function getAllPlannerTools() {
  return [plannerMakerTool, plannerRunnerTool, listPlansTool];
}
