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
