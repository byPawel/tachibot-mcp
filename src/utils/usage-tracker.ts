/**
 * Usage Stats Tracker
 * Tracks tool usage per git repo to help identify which tools are actually used
 *
 * Config: TACHIBOT_USAGE_TRACKING=true (default) | false
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { getModelDisplayName, MODEL_PRICING } from '../config/model-constants.js';

// Config: enabled by default, set TACHIBOT_USAGE_TRACKING=false to disable
export const isTrackingEnabled = (): boolean => {
  return process.env.TACHIBOT_USAGE_TRACKING !== 'false';
};

// Config: show model tags in output (default: true)
export const showModelTags = (): boolean => {
  return process.env.TACHIBOT_SHOW_MODEL_TAGS !== 'false';
};

interface ToolUsage {
  calls: number;
  lastUsed: string;
  models: Record<string, number>; // model -> count
  totalTokens: number;
  totalCost: number;
}

interface RepoStats {
  repoPath: string;
  repoName: string;
  tools: Record<string, ToolUsage>;
  firstSeen: string;
  lastSeen: string;
  totalCalls: number;
}

interface UsageData {
  version: 1;
  repos: Record<string, RepoStats>; // repoPath -> stats
}

const STATS_FILE = path.join(os.homedir(), '.tachibot-usage.json');

function loadStats(): UsageData {
  try {
    if (fs.existsSync(STATS_FILE)) {
      const data = fs.readFileSync(STATS_FILE, 'utf-8');
      return JSON.parse(data);
    }
  } catch (e) {
    console.error('[UsageTracker] Failed to load stats:', e);
  }
  return { version: 1, repos: {} };
}

function saveStats(data: UsageData): void {
  try {
    fs.writeFileSync(STATS_FILE, JSON.stringify(data, null, 2));
  } catch (e) {
    console.error('[UsageTracker] Failed to save stats:', e);
  }
}

function getRepoName(repoPath: string): string {
  return path.basename(repoPath) || 'unknown';
}

function estimateCost(model: string, tokens: number): number {
  const pricing = MODEL_PRICING[model] || 0.005; // default ~$5/M
  return (tokens / 1000) * pricing;
}

/**
 * Track a tool call
 */
export function trackToolCall(
  toolName: string,
  model: string,
  tokens: number = 0,
  repoPath?: string
): void {
  if (!isTrackingEnabled()) return;

  const cwd = repoPath || process.cwd();
  const now = new Date().toISOString();
  const cost = estimateCost(model, tokens);

  const data = loadStats();

  if (!data.repos[cwd]) {
    data.repos[cwd] = {
      repoPath: cwd,
      repoName: getRepoName(cwd),
      tools: {},
      firstSeen: now,
      lastSeen: now,
      totalCalls: 0,
    };
  }

  const repo = data.repos[cwd];
  repo.lastSeen = now;
  repo.totalCalls++;

  if (!repo.tools[toolName]) {
    repo.tools[toolName] = {
      calls: 0,
      lastUsed: now,
      models: {},
      totalTokens: 0,
      totalCost: 0,
    };
  }

  const tool = repo.tools[toolName];
  tool.calls++;
  tool.lastUsed = now;
  tool.models[model] = (tool.models[model] || 0) + 1;
  tool.totalTokens += tokens;
  tool.totalCost += cost;

  saveStats(data);
}

/**
 * Get stats for current repo
 */
export function getRepoStats(repoPath?: string): RepoStats | null {
  const cwd = repoPath || process.cwd();
  const data = loadStats();
  return data.repos[cwd] || null;
}

/**
 * Get all repos stats
 */
export function getAllStats(): UsageData {
  return loadStats();
}

/**
 * Create ASCII bar
 */
function createBar(value: number, max: number, width: number = 12): string {
  if (max === 0) return '░'.repeat(width);
  const filled = Math.round((value / max) * width);
  return '█'.repeat(filled) + '░'.repeat(width - filled);
}

/**
 * Get summary of tool usage for current repo with visual bars
 */
export function getUsageSummary(repoPath?: string): string {
  const stats = getRepoStats(repoPath);
  if (!stats) {
    return 'No usage data for this repo yet.';
  }

  // Sort by calls descending
  const sortedTools = Object.entries(stats.tools)
    .sort(([, a], [, b]) => b.calls - a.calls);

  if (sortedTools.length === 0) {
    return 'No usage data for this repo yet.';
  }

  // Calculate totals and max for scaling
  const maxCalls = Math.max(...sortedTools.map(([, t]) => t.calls));
  const totalCost = sortedTools.reduce((sum, [, t]) => sum + t.totalCost, 0);
  const totalTokens = sortedTools.reduce((sum, [, t]) => sum + t.totalTokens, 0);

  // Find max tool name length for alignment (cap at 28 for workflow: prefix)
  const maxNameLen = Math.min(28, Math.max(...sortedTools.map(([name]) => name.length)));

  const lines: string[] = [
    ``,
    `📊 USAGE STATS ─ ${stats.repoName}`,
    ``,
  ];

  // Tool bars
  for (const [toolName, usage] of sortedTools) {
    const name = toolName.length > maxNameLen
      ? toolName.slice(0, maxNameLen - 2) + '..'
      : toolName.padEnd(maxNameLen);
    const bar = createBar(usage.calls, maxCalls, 12);
    const calls = String(usage.calls).padStart(4);
    const cost = `$${usage.totalCost.toFixed(2)}`.padStart(6);

    lines.push(`${name} ${bar} ${calls}  ${cost}`);
  }

  // Footer with totals
  lines.push(`${'─'.repeat(maxNameLen + 28)}`);
  lines.push(`${'TOTAL'.padEnd(maxNameLen)} ${''.padStart(12)} ${String(stats.totalCalls).padStart(4)}  ${'$' + totalCost.toFixed(2).padStart(5)}`);
  lines.push(``);
  lines.push(`Tokens: ~${totalTokens.toLocaleString()} | Period: ${stats.firstSeen.split('T')[0]} → ${stats.lastSeen.split('T')[0]}`);
  lines.push(``);

  return lines.join('\n');
}

/**
 * Format model name for display in tool output
 * Uses MODEL_DISPLAY_NAMES from model-constants.ts (single source of truth)
 */
export function formatModelTag(model: string): string {
  if (!showModelTags()) return '';
  return `[${getModelDisplayName(model)}]`;
}

/**
 * Create output with model tag
 */
export function tagOutput(content: string, model: string, tokens?: number): string {
  const tag = formatModelTag(model);
  const tokenInfo = tokens ? ` ${tokens}tok` : '';
  return `${tag}${tokenInfo}\n\n${content}`;
}

/**
 * Infer model/provider from tool name
 * Used when actual model info isn't available
 */
export function inferModelFromTool(toolName: string): string {
  if (toolName.startsWith('grok_')) return 'grok';
  if (toolName.startsWith('openai_')) return 'openai';
  if (toolName.startsWith('gemini_')) return 'gemini';
  if (toolName.startsWith('perplexity_')) return 'perplexity';
  if (toolName.startsWith('qwen_')) return 'qwen';
  if (toolName.startsWith('kimi_')) return 'kimi';
  if (toolName === 'think' || toolName === 'focus') return 'openai';
  if (toolName === 'nextThought') return 'openai';
  return 'unknown';
}

/**
 * Estimate token count from text (rough: ~4 chars per token)
 */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

/**
 * Get all repos summary (for "all" scope) with visual bars
 */
export function getAllReposSummary(): string {
  const data = loadStats();
  const repos = Object.values(data.repos);

  if (repos.length === 0) {
    return 'No usage data yet.';
  }

  // Calculate totals per repo
  const repoData = repos.map(repo => ({
    name: repo.repoName,
    calls: repo.totalCalls,
    tokens: Object.values(repo.tools).reduce((sum, t) => sum + t.totalTokens, 0),
    cost: Object.values(repo.tools).reduce((sum, t) => sum + t.totalCost, 0),
  }));

  // Sort by calls descending
  repoData.sort((a, b) => b.calls - a.calls);

  const maxCalls = Math.max(...repoData.map(r => r.calls));
  const maxNameLen = Math.min(20, Math.max(...repoData.map(r => r.name.length)));
  const grandTotal = repoData.reduce((acc, r) => ({
    calls: acc.calls + r.calls,
    tokens: acc.tokens + r.tokens,
    cost: acc.cost + r.cost,
  }), { calls: 0, tokens: 0, cost: 0 });

  const lines: string[] = [
    ``,
    `📊 USAGE STATS ─ All Repos`,
    ``,
  ];

  for (const repo of repoData) {
    const name = repo.name.length > maxNameLen
      ? repo.name.slice(0, maxNameLen - 2) + '..'
      : repo.name.padEnd(maxNameLen);
    const bar = createBar(repo.calls, maxCalls, 10);
    const calls = String(repo.calls).padStart(4);
    const cost = `$${repo.cost.toFixed(2)}`.padStart(7);

    lines.push(`${name} ${bar} ${calls} ${cost}`);
  }

  lines.push(`${'─'.repeat(maxNameLen + 26)}`);
  lines.push(`${'TOTAL'.padEnd(maxNameLen)} ${''.padStart(10)} ${String(grandTotal.calls).padStart(4)} ${'$' + grandTotal.cost.toFixed(2).padStart(6)}`);
  lines.push(``);
  lines.push(`Tokens: ~${grandTotal.tokens.toLocaleString()}`);
  lines.push(``);

  return lines.join('\n');
}

/**
 * Get stats as JSON
 */
export function getStatsJson(scope: 'current' | 'all', repoPath?: string): string {
  if (scope === 'current') {
    const stats = getRepoStats(repoPath);
    return JSON.stringify(stats, null, 2);
  }
  return JSON.stringify(loadStats(), null, 2);
}

/**
 * Reset stats
 */
export function resetStats(scope: 'current' | 'all', repoPath?: string): string {
  const data = loadStats();

  if (scope === 'all') {
    saveStats({ version: 1, repos: {} });
    return '✅ All usage statistics have been reset.';
  }

  const cwd = repoPath || process.cwd();
  if (data.repos[cwd]) {
    delete data.repos[cwd];
    saveStats(data);
    return `✅ Usage statistics for ${path.basename(cwd)} have been reset.`;
  }

  return 'No stats to reset for this repo.';
}
