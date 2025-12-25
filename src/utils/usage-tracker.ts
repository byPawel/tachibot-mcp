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
 * Get summary of tool usage for current repo
 */
export function getUsageSummary(repoPath?: string): string {
  const stats = getRepoStats(repoPath);
  if (!stats) {
    return 'No usage data for this repo yet.';
  }

  const lines: string[] = [
    `📊 Usage Stats for: ${stats.repoName}`,
    `   Total calls: ${stats.totalCalls}`,
    `   First used: ${stats.firstSeen.split('T')[0]}`,
    `   Last used: ${stats.lastSeen.split('T')[0]}`,
    '',
    '🔧 Tools Used:',
  ];

  // Sort by calls descending
  const sortedTools = Object.entries(stats.tools)
    .sort(([, a], [, b]) => b.calls - a.calls);

  for (const [toolName, usage] of sortedTools) {
    const topModel = Object.entries(usage.models)
      .sort(([, a], [, b]) => b - a)[0];

    lines.push(
      `   ${toolName}: ${usage.calls} calls` +
      (topModel ? ` (${topModel[0]}: ${topModel[1]})` : '') +
      ` | $${usage.totalCost.toFixed(4)}`
    );
  }

  // Suggest unused tools
  lines.push('');
  lines.push('💡 Tip: Tools not in this list are unused - consider removing from profile.');

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
 * Get all repos summary (for "all" scope)
 */
export function getAllReposSummary(): string {
  const data = loadStats();
  const repos = Object.values(data.repos);

  if (repos.length === 0) {
    return 'No usage data yet.';
  }

  const lines: string[] = ['📊 Usage Stats (All Repos)', ''];

  // Sort by total calls descending
  repos.sort((a, b) => b.totalCalls - a.totalCalls);

  let grandTotal = { calls: 0, tokens: 0, cost: 0 };

  for (const repo of repos) {
    const totalCost = Object.values(repo.tools).reduce((sum, t) => sum + t.totalCost, 0);
    const totalTokens = Object.values(repo.tools).reduce((sum, t) => sum + t.totalTokens, 0);

    lines.push(`**${repo.repoName}**: ${repo.totalCalls} calls | ${totalTokens} tok | $${totalCost.toFixed(4)}`);

    grandTotal.calls += repo.totalCalls;
    grandTotal.tokens += totalTokens;
    grandTotal.cost += totalCost;
  }

  lines.push('');
  lines.push(`**TOTAL**: ${grandTotal.calls} calls | ${grandTotal.tokens} tok | $${grandTotal.cost.toFixed(4)}`);

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
