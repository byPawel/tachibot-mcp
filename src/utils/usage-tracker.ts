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
// import {
//   renderTable,
//   renderKeyValueTable,
//   brailleBar,
//   brailleSparkline,
//   renderReceipt,
//   renderGradientDivider,
//   renderGradientBorderBox,
//   renderBadgeGroup,
//   renderPieChart,
//   renderDonutChart,
//   renderBigText,
//   icons,
// } from './ink-renderer.js';
// Ink disabled - using plain text functions
const renderTable = (data: Record<string, string>[]): string => {
  if (data.length === 0) return '';
  const keys = Object.keys(data[0]);
  const header = '| ' + keys.join(' | ') + ' |';
  const separator = '|' + keys.map(() => '---').join('|') + '|';
  const rows = data.map(row => '| ' + keys.map(k => row[k] || '').join(' | ') + ' |');
  return [header, separator, ...rows].join('\n');
};
const renderKeyValueTable = (data: Record<string, string | number>): string => {
  return Object.entries(data).map(([k, v]) => `${k}: ${v}`).join('\n');
};
const brailleBar = (value: number, max: number, width: number = 20): string => {
  const filled = Math.round((value / max) * width);
  return '[' + '#'.repeat(filled) + '-'.repeat(width - filled) + ']';
};
const brailleSparkline = (_data: number[]): string => '';
const renderReceipt = (_opts: { model: string; inputTokens: number; outputTokens: number; cachedTokens?: number; duration?: number }): string => '';
const renderGradientDivider = (width: number = 50, _preset?: string): string => '-'.repeat(width);
const renderGradientBorderBox = (content: string, _opts?: { width?: number; gradient?: string }): string => content;
const renderBadgeGroup = (_badges: string[]): string => '';
const renderPieChart = (_data: { label: string; value: number }[], _opts?: { width?: number; title?: string }): string => '';
const renderDonutChart = (_data: { label: string; value: number; displayValue?: string }[], _opts?: { width?: number; title?: string; centerLabel?: string }): string => '';
const renderBigText = (text: string, _opts?: { font?: string; gradient?: string }): string => `== ${text} ==`;
const icons = {
  chartBar: '|',
  brain: '*',
  search: '?',
  check: '+',
  error: 'x',
  warning: '!',
  info: 'i',
  sparkle: '*',
  starFilled: '*',
  alertCircle: '!',
  file: '#',
  folder: '#',
  bot: '@',
  comment: '#',
  list: '-',
  target: '>',
  workflow: '>',
  cpu: '#',
  question: '?',
};

// Config: enabled by default, set TACHIBOT_USAGE_TRACKING=false to disable
export const isTrackingEnabled = (): boolean => {
  return process.env.TACHIBOT_USAGE_TRACKING !== 'false';
};

// Config: plain output mode (markdown instead of ANSI)
// Default: plain (fewer tokens). Set TACHIBOT_PLAIN_OUTPUT=false for fancy Ink visuals
export const usePlainOutput = (): boolean => {
  const value = process.env.TACHIBOT_PLAIN_OUTPUT?.toLowerCase();
  if (value === 'false') return false;
  // Default: plain mode (less tokens, better for LLM context)
  return true;
};

// Config: show model tags in output (default: true)
export const showModelTags = (): boolean => {
  return process.env.TACHIBOT_SHOW_MODEL_TAGS !== 'false';
};

// Config: show receipt after tool calls (default: false, set TACHIBOT_SHOW_RECEIPT=true to enable)
export const showReceipt = (): boolean => {
  return process.env.TACHIBOT_SHOW_RECEIPT === 'true';
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
  model: string | null,
  tokens: number = 0,
  repoPath?: string
): void {
  if (!isTrackingEnabled()) return;

  const cwd = repoPath || process.cwd();
  const now = new Date().toISOString();
  // Use tool name for local tools (when model is null)
  const effectiveModel = model || toolName;
  const cost = estimateCost(effectiveModel, tokens);

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
  tool.models[effectiveModel] = (tool.models[effectiveModel] || 0) + 1;
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
 * Get summary of tool usage for current repo - plain markdown format
 */
function getUsageSummaryPlain(repoPath?: string): string {
  const stats = getRepoStats(repoPath);
  if (!stats) {
    return 'No usage data for this repo yet.';
  }

  const sortedTools = Object.entries(stats.tools)
    .sort(([, a], [, b]) => b.calls - a.calls);

  if (sortedTools.length === 0) {
    return 'No usage data for this repo yet.';
  }

  const totalCost = sortedTools.reduce((sum, [, t]) => sum + t.totalCost, 0);
  const totalTokens = sortedTools.reduce((sum, [, t]) => sum + t.totalTokens, 0);

  const lines: string[] = [
    `## TachiBot Usage Stats - ${stats.repoName}`,
    ``,
    `**Period:** ${stats.firstSeen.split('T')[0]} → ${stats.lastSeen.split('T')[0]}`,
    ``,
    `| Tool | Calls | Cost |`,
    `|------|------:|-----:|`,
  ];

  // Add tool rows
  for (const [toolName, usage] of sortedTools) {
    lines.push(`| ${toolName} | ${usage.calls} | $${usage.totalCost.toFixed(3)} |`);
  }

  lines.push(``);
  lines.push(`### Summary`);
  lines.push(``);
  lines.push(`| Metric | Value |`);
  lines.push(`|--------|------:|`);
  lines.push(`| Total Calls | ${stats.totalCalls.toLocaleString()} |`);
  lines.push(`| Total Tokens | ~${totalTokens.toLocaleString()} |`);
  lines.push(`| Total Cost | **$${totalCost.toFixed(4)}** |`);

  return lines.join('\n');
}

/**
 * Get summary of tool usage for current repo with Ink components
 */
export function getUsageSummary(repoPath?: string): string {
  // Use plain markdown output for better compatibility
  if (usePlainOutput()) {
    return getUsageSummaryPlain(repoPath);
  }

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

  const lines: string[] = [
    renderBigText('TachiBot', { font: 'block', gradient: 'cristal' }),
    `${icons.chartBar} USAGE STATS ─ ${stats.repoName}`,
    renderGradientDivider(50, 'cristal'),
    ``,
  ];

  // Pie chart for top tools usage distribution (top 6)
  const topTools = sortedTools.slice(0, 6);
  const pieData = topTools.map(([toolName, usage]) => ({
    label: toolName, // Full name - no truncation
    value: usage.calls,
  }));
  // Add "Other" if there are more tools
  if (sortedTools.length > 6) {
    const otherCalls = sortedTools.slice(6).reduce((sum, [, t]) => sum + t.calls, 0);
    pieData.push({ label: 'Other', value: otherCalls });
  }
  lines.push(renderPieChart(pieData, { width: 50, title: 'Tool Usage Distribution' }));
  lines.push(``);

  // Build table data with braille bars
  const tableData = sortedTools.map(([toolName, usage]) => ({
    Tool: toolName, // Full name - no truncation
    Usage: brailleBar(usage.calls, maxCalls, 15),
    Calls: String(usage.calls),
    Cost: `$${usage.totalCost.toFixed(3)}`,
  }));

  lines.push(renderTable(tableData));
  lines.push(``);

  // Donut chart for cost distribution (if there's meaningful cost data)
  if (totalCost > 0) {
    const costData = topTools
      .filter(([, usage]) => usage.totalCost > 0)
      .map(([toolName, usage]) => ({
        label: toolName,
        value: Math.round(usage.totalCost * 10000), // Scale for pie sizing
        displayValue: `$${usage.totalCost.toFixed(3)}`, // Show actual cost
      }));
    if (costData.length > 0) {
      lines.push(renderDonutChart(costData, {
        width: 50,
        title: 'Cost Distribution',
        centerLabel: `$${totalCost.toFixed(2)}`
      }));
      lines.push(``);
    }
  }

  // Summary using key-value table
  lines.push(renderKeyValueTable({
    'Total Calls': stats.totalCalls.toLocaleString(),
    'Total Tokens': `~${totalTokens.toLocaleString()}`,
    'Total Cost': `$${totalCost.toFixed(4)}`,
    'Period': `${stats.firstSeen.split('T')[0]} → ${stats.lastSeen.split('T')[0]}`,
  }));

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
 * Create output with model tag and optional receipt
 */
export function tagOutput(content: string, model: string, tokens?: number, inputTokens?: number, outputTokens?: number, durationMs?: number): string {
  const tag = formatModelTag(model);
  const tokenInfo = tokens ? ` ${tokens}tok` : '';

  let output = `${tag}${tokenInfo}\n\n${content}`;

  // Append receipt if enabled
  if (showReceipt() && (inputTokens || outputTokens)) {
    output += '\n\n' + renderReceipt({
      model,
      inputTokens: inputTokens || 0,
      outputTokens: outputTokens || tokens || 0,
      duration: durationMs,
    });
  }

  return output;
}

/**
 * Generate a standalone receipt for tool output
 */
export function generateReceipt(model: string, inputTokens: number, outputTokens: number, cachedTokens?: number, durationMs?: number): string {
  if (!showReceipt()) return '';

  return renderReceipt({
    model,
    inputTokens,
    outputTokens,
    cachedTokens,
    duration: durationMs,
  });
}

/**
 * Infer model/provider from tool name
 * Used when actual model info isn't available
 * Returns null for tools without a known model (allows fallback to tool name)
 */
export function inferModelFromTool(toolName: string): string | null {
  if (toolName.startsWith('grok_')) return 'grok';
  if (toolName.startsWith('openai_')) return 'openai';
  if (toolName.startsWith('gemini_')) return 'gemini';
  if (toolName.startsWith('perplexity_')) return 'perplexity';
  if (toolName.startsWith('qwen_')) return 'qwen';
  if (toolName.startsWith('kimi_')) return 'kimi';
  if (toolName === 'think') return 'openai';
  // Tools with custom BigText headers - return null to skip extra badge
  if (toolName === 'focus' || toolName === 'nextThought' || toolName === 'workflow') return null;
  // Return null for local tools - allows fallback to tool name for display
  return null;
}

/**
 * Estimate token count from text (rough: ~4 chars per token)
 */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

/**
 * Get all repos summary - plain markdown format
 */
function getAllReposSummaryPlain(): string {
  const data = loadStats();
  const repos = Object.values(data.repos);

  if (repos.length === 0) {
    return 'No usage data yet.';
  }

  const repoData = repos.map(repo => ({
    name: repo.repoName,
    calls: repo.totalCalls,
    tokens: Object.values(repo.tools).reduce((sum, t) => sum + t.totalTokens, 0),
    cost: Object.values(repo.tools).reduce((sum, t) => sum + t.totalCost, 0),
  }));

  repoData.sort((a, b) => b.calls - a.calls);

  const grandTotal = repoData.reduce((acc, r) => ({
    calls: acc.calls + r.calls,
    tokens: acc.tokens + r.tokens,
    cost: acc.cost + r.cost,
  }), { calls: 0, tokens: 0, cost: 0 });

  const lines: string[] = [
    `## TachiBot Usage Stats - All Repos`,
    ``,
    `| Repo | Calls | Tokens | Cost |`,
    `|------|------:|-------:|-----:|`,
  ];

  for (const repo of repoData) {
    lines.push(`| ${repo.name} | ${repo.calls} | ~${(repo.tokens / 1000).toFixed(1)}k | $${repo.cost.toFixed(3)} |`);
  }

  lines.push(``);
  lines.push(`### Summary`);
  lines.push(``);
  lines.push(`| Metric | Value |`);
  lines.push(`|--------|------:|`);
  lines.push(`| Total Repos | ${repos.length} |`);
  lines.push(`| Total Calls | ${grandTotal.calls.toLocaleString()} |`);
  lines.push(`| Total Tokens | ~${grandTotal.tokens.toLocaleString()} |`);
  lines.push(`| Total Cost | **$${grandTotal.cost.toFixed(4)}** |`);

  return lines.join('\n');
}

/**
 * Get all repos summary (for "all" scope) with Ink components
 */
export function getAllReposSummary(): string {
  // Use plain markdown output for better compatibility
  if (usePlainOutput()) {
    return getAllReposSummaryPlain();
  }

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
  const grandTotal = repoData.reduce((acc, r) => ({
    calls: acc.calls + r.calls,
    tokens: acc.tokens + r.tokens,
    cost: acc.cost + r.cost,
  }), { calls: 0, tokens: 0, cost: 0 });

  const lines: string[] = [
    ``,
    `${icons.chartBar} USAGE STATS ─ All Repos`,
    renderGradientDivider(50, 'rainbow'),
    ``,
  ];

  // Build table data with braille bars
  const tableData = repoData.map(repo => ({
    Repo: repo.name.length > 18 ? repo.name.slice(0, 16) + '..' : repo.name,
    Usage: brailleBar(repo.calls, maxCalls, 12),
    Calls: String(repo.calls),
    Tokens: `~${(repo.tokens / 1000).toFixed(1)}k`,
    Cost: `$${repo.cost.toFixed(3)}`,
  }));

  lines.push(renderTable(tableData));
  lines.push(``);

  // Summary using key-value table
  lines.push(renderKeyValueTable({
    'Total Repos': repos.length.toString(),
    'Total Calls': grandTotal.calls.toLocaleString(),
    'Total Tokens': `~${grandTotal.tokens.toLocaleString()}`,
    'Total Cost': `$${grandTotal.cost.toFixed(4)}`,
  }));

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
