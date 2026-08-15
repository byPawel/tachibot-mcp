/**
 * Prompt Technique Tools
 * Transparent prompt engineering - discover, preview, and execute with full visibility
 */

import { z } from "zod";
import { defineModelTool } from "./factory/define-model-tool.js";
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

// Technique type definition.
// `tier` curates the default list: 'core' techniques still earn their keep on
// 2026 reasoning models (they impose an OUTPUT CONTRACT — the visible sections
// they force — which native reasoning does not); everything else is 'advanced'
// (a reasoning SCAFFOLD that mainly helps weaker/routed models, or a framing
// lens). `kind` explains why a technique survives. Untagged ⇒ advanced/lens.
interface Technique {
  name: string;
  alias: string | null;
  description: string;
  tier?: 'core' | 'advanced';
  kind?: 'contract' | 'scaffold' | 'lens';
}

// Technique definitions organized by category
const TECHNIQUES: Record<string, Technique[]> = {
  retrieval: [
    { name: "chain_of_note", alias: "note_taking", description: "Note each retrieved source (relevant? what it actually says?) BEFORE answering — the fix for citing a source that didn't say that (arXiv:2311.09210)", tier: 'core', kind: 'contract' },
    { name: "self_rag", alias: "adaptive_retrieval", description: "Decide whether to retrieve at all, critique what returns, mark each claim SUPPORTED/UNSUPPORTED (arXiv:2310.11511)" },
    { name: "ircot", alias: "interleaved_retrieval", description: "Interleave retrieval with each reasoning step — for multi-hop questions where query 2 depends on result 1 (arXiv:2212.10509)" },
    { name: "flare", alias: "active_rag", description: "Retrieve on demand: mark low-confidence spans mid-answer and look up only those (arXiv:2305.06983)" },
  ],
  security: [
    { name: "spotlighting", alias: "untrusted_input", description: "Fence untrusted text in explicit markers so a fetched page saying 'ignore previous instructions' reads as data, not instruction (arXiv:2403.14720)", tier: 'core', kind: 'contract' },
  ],
  few_shot: [
    { name: "analogical", alias: "self_examples", description: "Model writes its OWN worked examples, then solves by analogy — few-shot quality with zero curation (arXiv:2310.01714)", tier: 'core', kind: 'contract' },
    { name: "contrastive_cot", alias: "good_and_bad", description: "Show a correct chain AND a plausible wrong one, labelled — teaches what the trap looks like (arXiv:2311.09277)" },
    { name: "auto_cot", alias: "auto_examples", description: "Cluster the case types, generate one exemplar per cluster — diversity beats polish (arXiv:2210.03493)" },
    { name: "complexity_based", alias: "diverse_examples", description: "Reason at three depths, prefer the longest complete chain over the majority (arXiv:2210.00720)" },
    { name: "exemplar_selection", alias: "pick_examples", description: "Choose examples by similarity to the live query; watch label balance and ordering effects (arXiv:2406.06608)" },
  ],
  creative: [
    { name: "verbalized_sampling", alias: "spread_candidates", description: "Ask for N candidates WITH probabilities in one pass — directly targets the mode collapse that makes what_if/innovate feel same-y (arXiv:2510.01171)" },
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
    { name: "s2a", alias: "clean_context", description: "System 2 Attention: rewrite the input keeping only what's relevant, then answer the clean version (arXiv:2311.11829)" },
    { name: "metacognitive", alias: "think_about_thinking", description: "Understand, judge, evaluate, confirm, report confidence — a general-purpose thinking wrapper (arXiv:2308.05342)" },
    { name: "rephrase_respond", alias: "rar", description: "Rewrite the question more precisely, surface the ambiguity, then answer the rewrite (arXiv:2311.04205)" },
    { name: "re2", alias: "reread", description: "Re-Reading: put the question in twice. Near-zero cost, works surprisingly well (arXiv:2309.06275)" },
    { name: "analyze", alias: "systematic", description: "Components, relationships, patterns, conclusions" },
    { name: "first_principles", alias: "first_prin", description: "Truths, assumptions, atomic units, rebuild" },
    { name: "feasibility", alias: "feasible", description: "Technical/economic/time/resources/risks" },
    { name: "step_back", alias: "abstract_first", description: "Solve the general principle first, then apply it to the specific case" },
  ],
  reflective: [
    { name: "chain_of_density", alias: "densify", description: "Summarise, then repeatedly add missing entities WITHOUT growing the length — forces real compression (arXiv:2309.04269)" },
    { name: "hourglass", alias: "bottleneck", description: "Explore wide, compress to a schema + one rule, DISCARD the exploration, rebuild from the rule. On failure fix the rule, don't append the error (arXiv:2607.11696)" },
    { name: "reflect", alias: null, description: "Patterns, surprises, key insight, gaps" },
    { name: "patterns", alias: "connections", description: "Themes, causality, cycles, anomalies" },
    { name: "decompose", alias: "breakdown", description: "Core, sub-problems, dependencies, steps" },
    { name: "integrate", alias: "synthesize", description: "Convergent themes, contradictions, meta-pattern" },
  ],
  reasoning: [
    { name: "self_ask", alias: "follow_up_questions", description: "Generate explicit follow-up questions and answer each before concluding — better than decompose for multi-hop facts (arXiv:2210.03350)" },
    { name: "atom_of_thoughts", alias: "aot", description: "Each step rewritten as a fresh self-contained question, no history carried, so errors can't compound (arXiv:2502.12018)" },
    { name: "algorithm_of_thoughts", alias: "in_prompt_search", description: "Whole search including dead ends inside ONE prompt — tree-of-thoughts behaviour at ~one query's cost (arXiv:2308.10379)" },
    { name: "chain_of_draft", alias: "cod", description: "CoT with ~5 words per step. Same accuracy on many tasks at a fraction of the tokens (arXiv:2502.18600)" },
    { name: "thread_of_thought", alias: "thot", description: "Walk a long, chaotic context piece by piece, summarising as you go, before answering (arXiv:2311.08734)" },
    { name: "backtrack", alias: "rewind", description: "Mark steps validated/provisional; on a late failure rewind to the last validated checkpoint instead of restarting or patching (arXiv:2607.07492)" },
    { name: "chain_of_thought", alias: "step_by_step", description: "Think step-by-step: identify, breakdown, logic, conclude" },
    { name: "tree_of_thoughts", alias: "explore_paths", description: "Branch 3 paths, explore, evaluate, prune, synthesize" },
    { name: "graph_of_thoughts", alias: "idea_map", description: "Map as graph: nodes=ideas, edges=connections, find loops" },
  ],
  verification: [
    { name: "universal_consistency", alias: "usc", description: "Pick among candidates by READING them, not string-matching — fixes vote-by-string-match on prose, code and plans (arXiv:2311.17311)", tier: 'core', kind: 'contract' },
    { name: "self_verification", alias: "backward_check", description: "Re-derive a hidden given from your own answer. Catches different errors than checking forwards (arXiv:2212.09561)" },
    { name: "self_calibration", alias: "fresh_eyes", description: "Judge your answer in a FRESH context — a model that just justified an answer will defend it (arXiv:2406.06608)" },
    { name: "paraphrase_ensemble", alias: "reframe_ensemble", description: "Ask the same question in 3 framings and compare — catches phrasing-sensitivity (arXiv:2406.06608)" },
    { name: "adaptive_consistency", alias: "early_stop_consistency", description: "Sample until consensus is clear instead of a fixed N — same accuracy, often half the tokens (arXiv:2406.06608)" },
    { name: "maieutic", alias: "socratic", description: "Explain both a proposition and its negation, recursively, keep the consistent subtree (arXiv:2205.11822)" },
    { name: "breadth_then_depth", alias: "refine_over_resample", description: "Sample 3 different approaches, then repair each step-by-step, then pick — beats spending the whole budget on more samples (arXiv:2608.05643)" },
    { name: "prompt_coverage", alias: "spec_coverage", description: "Map each test to the requirement it covers; unmapped requirements are the real gaps (arXiv:2607.02057)" },
    { name: "self_consistency", alias: "consensus", description: "Generate 3 solutions, compare, vote best, explain confidence" },
    { name: "constitutional", alias: "principles", description: "Solve, critique against accuracy/safety/helpfulness, revise" },
    { name: "cove", alias: "verify_chain", description: "Draft, list its claims, write a falsifying question per claim, keep only what survives" },
    { name: "cross_verify", alias: "second_opinion", description: "Generate, then audit from a different angle. Report the audit separately." },
  ],
  meta: [
    { name: "context_preflight", alias: "preflight", description: "Score the context on 7 criteria (role, guardrails, consistency, tools, grounding, untrusted input, efficiency) BEFORE spending tokens (arXiv:2607.14275)" },
    { name: "meta_prompting", alias: "improve_prompt", description: "Write better prompt for this, then solve using it" },
    { name: "cascade", alias: "escalate", description: "Answer briefly with a confidence statement, escalate to full reasoning only if needed" },
  ],
  debate: [
    { name: "adversarial", alias: "critic", description: "Argue FOR then AGAINST, find counterarguments, synthesize", tier: 'core', kind: 'contract' },
    { name: "persona_simulation", alias: "debate", description: "Simulate experts debating (single prompt, not real multi-agent)" },
  ],
  judgment: [
    { name: "council_of_experts", alias: "judge", description: "Multi-model council: gather diverse perspectives, extract best elements, synthesize final verdict" },
  ],
  engineering: [
    { name: "structured_thoughts", alias: "try_outcome", description: "Alternate <try> scratch work with standalone <outcome> blocks, so the tries can be dropped from context later (arXiv:2607.10386)", tier: 'core', kind: 'contract' },
    { name: "loop_spec", alias: "agent_loop", description: "Declare the agent loop before running it: trigger, goal, 5-rung verification ladder, stopping rule, carried memory (arXiv:2607.00038)", tier: 'core', kind: 'contract' },
    { name: "reflexion", alias: "iterate", description: "Generate→Critique→Revise loop (2-3 rounds, score each criterion 1-10)", tier: 'core', kind: 'contract' },
    { name: "react", alias: "thought_action", description: "Thought→Action→Observation loops for multi-step coding tasks", tier: 'core', kind: 'contract' },
    { name: "rubber_duck", alias: "explain_code", description: "Explain code line-by-line to a novice, flag bugs/assumptions", tier: 'core', kind: 'contract' },
    { name: "test_driven", alias: "tdd", description: "List edge cases→Write tests→Minimal code→Refactor. Tests before code.", tier: 'core', kind: 'contract' },
  ],
  research_advanced: [
    { name: "least_to_most", alias: "build_up", description: "Decompose to atomic sub-problems, solve simplest first, build up to hardest" },
  ],
  decision: [
    { name: "compute_ration", alias: "ration", description: "For a SET of items: score difficulty x payoff, budget effort per item, then solve — models otherwise front-load thought on whatever came first (arXiv:2608.07968)" },
    { name: "pre_mortem", alias: "failure_analysis", description: "Assume project failed → brainstorm 7-10 causes → rank → mitigate top 5", tier: 'core', kind: 'contract' },
  ],
  structured_coding: [
    { name: "chain_of_code", alias: "coc", description: "Write code; run what runs; SIMULATE the interpreter for steps code can't express (arXiv:2312.04474)" },
    { name: "skeleton_parallel", alias: "sot", description: "Full skeleton first, then expand each point independently of the others (arXiv:2307.15337). Distinct from `skeleton`, which expands sequentially." },
    { name: "scot", alias: "structured_cot", description: "Structured CoT: reason in code structures (sequence/branch/loop) before writing code (Li et al. 2025, +13.79%)", tier: 'core', kind: 'contract' },
    { name: "pre_post", alias: "contracts", description: "Design by contract: state preconditions + postconditions before implementing", tier: 'core', kind: 'contract' },
    { name: "bdd_spec", alias: "given_when_then", description: "Behavioral specs: Given/When/Then scenarios before code. Each scenario = a test.", tier: 'core', kind: 'contract' },
    { name: "program_of_thoughts", alias: "pot", description: "Compute in code, not prose: state the language, write the code, show its output" },
    { name: "skeleton", alias: "outline_first", description: "Structure first (headings/signatures, no bodies), review for gaps, then expand" },
  ],
};

// All technique names for validation
const ALL_TECHNIQUE_NAMES = Object.values(TECHNIQUES)
  .flat()
  .flatMap(t => [t.name, t.alias].filter(Boolean)) as string[];

// Flat view with category attached — the single lookup surface.
const FLAT_TECHNIQUES: (Technique & { category: string })[] = Object.entries(TECHNIQUES)
  .flatMap(([category, techs]) => techs.map(t => ({ ...t, category })));

const CORE_TECHNIQUES = FLAT_TECHNIQUES.filter(t => t.tier === 'core');

function findTechnique(nameOrAlias: string): (Technique & { category: string }) | null {
  const n = nameOrAlias.toLowerCase().replace(/-/g, '_');
  return FLAT_TECHNIQUES.find(t => t.name === n || t.alias === n) || null;
}

// Deterministic intent → technique recommender (zero model calls). Rules are
// scanned against the task; each hit contributes its techniques with a reason.
// This is what powers preview_prompt_technique(technique="auto").
const RECOMMEND_RULES: { match: RegExp; techniques: string[]; why: string }[] = [
  { match: /\b(bug|error|crash|exception|stack ?trace|failing|broken|throws?|undefined|null)\b/i,
    techniques: ["rubber_duck", "react"], why: "isolate the fault by explaining the code and looping thought→action→observation" },
  { match: /\b(test|spec|acceptance|requirement|behav|scenario)\b/i,
    techniques: ["bdd_spec", "test_driven"], why: "pin behavior as Given/When/Then scenarios, then tests-before-code" },
  { match: /\b(refactor|restructure|clean ?up|migrate|rewrite|port)\b/i,
    techniques: ["pre_post", "scot", "test_driven"], why: "lock behavior with contracts + structure the change, tests guard the move" },
  { match: /\b(should we|vs\.?|versus|trade[- ]?off|choose|decide|decision|which (one|approach|option))\b/i,
    techniques: ["adversarial", "pre_mortem"], why: "argue both sides, then assume the choice failed to surface hidden risk" },
  { match: /\b(risk|ship|launch|deploy|release|rollout|what could go wrong|fail)\b/i,
    techniques: ["pre_mortem"], why: "assume it already failed and work backward to the causes" },
  { match: /\b(design|architect|structure|algorithm|implement|build|data ?structure)\b/i,
    techniques: ["scot", "pre_post"], why: "reason in code structures and state pre/postconditions before writing" },
  { match: /\b(review|critique|harden|secure|audit|red[- ]?team|attack)\b/i,
    techniques: ["adversarial", "constitutional"], why: "steelman then attack, and critique against explicit principles" },
  { match: /\b(idea|brainstorm|creative|novel|alternative|possibilit)\b/i,
    techniques: ["innovate", "what_if", "alt_view"], why: "generate unconventional options and view from several angles" },
  { match: /\b(arithmetic|calculat\w*|comput(e|es|ing|ation\w*)|count\w*|how many|sum|total|percentage|math|numeric)\b/i,
    techniques: ["program_of_thoughts"], why: "compute it in code rather than in prose, where digits drift" },
  { match: /\b(verif\w*|fact[- ]?check\w*|double[- ]?check|is (this|that) (true|correct|right)|accura\w*|claims?|hallucinat\w*)\b/i,
    techniques: ["cove", "cross_verify"], why: "turn each claim into a falsifiable question, then audit from outside" },
  { match: /\b(cost|cheap\w*|expensive|budget|latency|speed|fast\w*|slow\w*|overkill|too (much|slow|expensive))\b/i,
    techniques: ["cascade", "chain_of_draft", "adaptive_consistency"], why: "answer at the lowest sufficient effort, keep steps terse, and stop sampling once consensus is clear" },

  // Retrieval — these fire on the language people use when they've just run a search
  // tool. This repo ships five of them, so the retrieved-text case is common and was
  // previously unmatched by any rule.
  { match: /\b(search|retriev\w*|sources?|cite|citation|reference|according to|web ?page|scrape[d]?|fetched|docs?|documentation)\b/i,
    techniques: ["chain_of_note", "self_rag"], why: "note what each source actually says before answering, and mark which claims it supports" },
  { match: /\b(multi[- ]?hop|follow[- ]?up search|then look up|chain of|depends on (the )?result)\b/i,
    techniques: ["ircot"], why: "interleave retrieval with reasoning when query 2 depends on result 1" },

  // Untrusted input
  { match: /\b(untrusted|user[- ]?supplied|third[- ]?party|injection|jailbreak|prompt[- ]?inject\w*|ignore previous|external content|scraped)\b/i,
    techniques: ["spotlighting"], why: "fence the untrusted text so it reads as data, never as instruction" },

  // Few-shot / examples
  { match: /\b(example|exemplar|few[- ]?shot|demonstrat\w*|sample (input|case)|show me how)\b/i,
    techniques: ["analogical", "contrastive_cot"], why: "have the model write its own worked examples, and show the plausible wrong path too" },

  // Batches — the failure is spending the budget on item one
  { match: /\b(each of|all of these|batch|these \d+|list of|every (file|item|pr|module|question)|across (the )?(files|items|repos))\b/i,
    techniques: ["compute_ration"], why: "triage difficulty x payoff and budget per item before solving any of them" },

  // Long / messy context
  { match: /\b(long (context|thread|document)|messy|unstructured|dump|transcript|many (docs|files|sources)|summar\w*)\b/i,
    techniques: ["thread_of_thought", "s2a", "chain_of_density"], why: "walk the context piece by piece, strip what's irrelevant, and densify without growing" },

  // Ambiguous or under-specified asks
  { match: /\b(unclear|ambiguous|not sure what|vague|ill[- ]?defined|what do you mean|underspecified)\b/i,
    techniques: ["rephrase_respond", "self_ask", "context_preflight"], why: "fix the question before answering it, and check the context is even sufficient" },

  // Long agent runs
  { match: /\b(agent|loop|iterate until|keep going|multi[- ]?step|long[- ]?running|workflow|pipeline)\b/i,
    techniques: ["loop_spec", "structured_thoughts"], why: "declare the loop and its stopping rule, and separate scratch work from conclusions so it can be pruned" },
];

interface Recommendation { technique: string; kind: string; tier: string; category: string; why: string; }

function recommendTechniques(task: string): Recommendation[] {
  const seen = new Set<string>();
  const recs: Recommendation[] = [];
  for (const rule of RECOMMEND_RULES) {
    if (!rule.match.test(task)) continue;
    for (const name of rule.techniques) {
      if (seen.has(name)) continue;
      const t = findTechnique(name);
      if (!t) continue;
      seen.add(name);
      recs.push({ technique: t.name, kind: t.kind || 'lens', tier: t.tier || 'advanced', category: t.category, why: rule.why });
    }
  }
  // No rule matched → fall back to the core contracts (always safe on frontier models).
  if (recs.length === 0) {
    for (const t of CORE_TECHNIQUES.slice(0, 3)) {
      recs.push({ technique: t.name, kind: t.kind || 'contract', tier: 'core', category: t.category, why: "safe default output-structure contract for frontier models" });
    }
  }
  return recs.slice(0, 4);
}

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
 * Discovery tool - shows all 37 techniques organized by category
 */
export const listPromptTechniquesTool = defineModelTool({
  name: "list_prompt_techniques",
  description: "Discover prompt engineering techniques. By default shows the ~9 CORE techniques that still help 2026 reasoning models (output-structure contracts). Pass all=true for all 37, or filter by category. Don't know which? preview_prompt_technique with technique=\"auto\".",
  parameters: z.object({
    all: z.boolean().optional().default(false).describe("Show all 37 techniques (default false = core only)"),
    filter: z.enum(["all", "creative", "research", "analytical", "reflective", "reasoning", "verification", "meta", "debate", "judgment", "engineering", "research_advanced", "decision", "structured_coding", "retrieval", "security", "few_shot"])
      .optional()
      .describe("Show one category in full (implies all techniques in it)")
  }),
  execute: async (args: { all?: boolean; filter?: string }): Promise<string> => {
    const { all = false, filter } = args;

    // Curated by default; a category filter or all=true opens the full set.
    const showAll = all || (filter !== undefined && filter !== "all");

    let output: string;
    let shown = 0;

    if (filter && filter !== "all") {
      const techs = TECHNIQUES[filter] || [];
      output = `PROMPT TECHNIQUES · ${filter}\n${'='.repeat(50)}\n\n`;
      for (const t of techs) {
        const aliasStr = t.alias ? ` (alias: ${t.alias})` : '';
        const badge = t.tier === 'core' ? ' [core]' : '';
        output += `  ${t.name}${aliasStr}${badge}\n    ${t.description}\n\n`;
        shown++;
      }
    } else if (showAll) {
      output = `PROMPT TECHNIQUES · all\n${'='.repeat(50)}\n\n`;
      for (const [category, techs] of Object.entries(TECHNIQUES)) {
        output += `${category.toUpperCase()}\n${'-'.repeat(category.length)}\n`;
        for (const t of techs) {
          const aliasStr = t.alias ? ` (alias: ${t.alias})` : '';
          const badge = t.tier === 'core' ? ' [core]' : '';
          output += `  ${t.name}${aliasStr}${badge}\n    ${t.description}\n\n`;
          shown++;
        }
      }
    } else {
      // Default: core only, with the "why these" framing.
      output = `CORE PROMPT TECHNIQUES\n${'='.repeat(50)}\n`;
      output += `The techniques that still help 2026 reasoning models — each imposes an\noutput CONTRACT (the sections it forces), which native reasoning doesn't.\n\n`;
      for (const t of CORE_TECHNIQUES) {
        const aliasStr = t.alias ? ` (alias: ${t.alias})` : '';
        output += `  ${t.name}${aliasStr}\n    ${t.description}\n\n`;
        shown++;
      }
    }

    output += `${'-'.repeat(50)}\n`;
    output += showAll
      ? `Shown: ${shown} techniques\n\n`
      : `Shown: ${shown} core (of ${FLAT_TECHNIQUES.length} total — list_prompt_techniques all=true for the rest)\n\n`;
    output += `Usage:\n`;
    output += `  preview_prompt_technique --technique "auto" --query "your task"   (recommends techniques)\n`;
    output += `  preview_prompt_technique --technique scot --tool grok_reason --query "your question"\n`;
    output += `  execute_prompt_technique --execution_token "pt_..." (from preview)\n`;

    return stripFormatting(output);
  }
});

/**
 * Tool 2: preview_prompt_technique
 * Read-only preview - shows enhanced prompt WITHOUT execution
 */
export const previewPromptTechniqueTool = defineModelTool({
  name: "preview_prompt_technique",
  description: "Preview how a technique enhances your prompt WITHOUT executing (returns an execution_token). Or pass technique=\"auto\" with just a query to get the top techniques recommended for that task.",
  parameters: z.object({
    technique: z.string().describe("Technique name (e.g. scot, pre_mortem), or \"auto\" to recommend techniques for the query"),
    tool: z.string().optional().describe("Target tool (e.g. grok_reason). Not needed when technique=\"auto\""),
    query: z.string().describe("Your query, problem, or task")
  }),
  execute: async (args: { technique: string; tool?: string; query: string }): Promise<string> => {
    const { technique, tool, query } = args;

    // Auto mode: recommend techniques for the task instead of applying one.
    if (technique.toLowerCase() === "auto") {
      const recs = recommendTechniques(query);
      let out = `RECOMMENDED TECHNIQUES\n${'='.repeat(50)}\n`;
      out += `For: ${query}\n\n`;
      recs.forEach((r, i) => {
        out += `${i + 1}. ${r.technique}  [${r.kind}${r.tier === 'core' ? ', core' : ''}]\n`;
        out += `   why: ${r.why}\n`;
        out += `   preview: preview_prompt_technique --technique ${r.technique} --tool <tool> --query "..."\n\n`;
      });
      out += `${'-'.repeat(50)}\n`;
      out += `Contracts (core) impose visible output structure and are safe on reasoning models;\n`;
      out += `scaffolds mainly help weaker/routed models. Pick one, then preview it with a target tool.\n`;
      return stripFormatting(out);
    }

    if (!tool) {
      return stripFormatting(`ERROR: 'tool' is required to preview a specific technique.\n\n` +
        `Provide a target tool (e.g. grok_reason), or use technique="auto" to get recommendations first.`);
    }

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
});

/**
 * Tool 3: execute_prompt_technique
 * Executes tool with technique. Accepts token OR full params.
 */
export const executePromptTechniqueTool = defineModelTool({
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
});

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
      return qwenCoderTool.execute({ query: prompt, task: 'analyze' }, context);
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
