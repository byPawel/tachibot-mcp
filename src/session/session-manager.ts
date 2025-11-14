/**
 * Session Manager for Focus MCP Server
 * Manages session lifecycle, analytics, and cross-session intelligence
 */

import { z } from "zod";
import * as fs from "fs/promises";
import * as fsSync from "fs";
import * as path from "path";
import { SessionLogger, Session, SessionStep, SessionConfig } from "./session-logger.js";

export interface SessionAnalytics {
  totalSessions: number;
  averageDuration: number;
  averageSteps: number;
  modelUsageStats: Map<string, {
    count: number;
    averageDuration: number;
    totalTokens: number;
  }>;
  modeDistribution: Map<string, number>;
  domainDistribution: Map<string, number>;
  consensusRate: number;
  topicClusters: Array<{
    topic: string;
    sessions: string[];
    commonPatterns: string[];
  }>;
}

export interface SessionPattern {
  pattern: string;
  frequency: number;
  sessions: string[];
  effectiveness: number; // 0-1 score
}

export class SessionManager {
  private sessionLogger: SessionLogger;
  private sessionCache: Map<string, Session> = new Map();
  private analytics: SessionAnalytics | null = null;
  private sessionDir: string;
  
  constructor(sessionDir: string = "./.focus-sessions") {
    this.sessionLogger = new SessionLogger({ sessionDir });
    this.sessionDir = path.resolve(sessionDir);
    this.ensureSessionDirectorySync();
  }
  
  /**
   * Ensure session directory exists (synchronous version for constructor)
   */
  private ensureSessionDirectorySync(): void {
    try {
      fsSync.mkdirSync(this.sessionDir, { recursive: true });
    } catch (error: any) {
      // Ignore EEXIST errors (directory already exists)
      if (error?.code !== 'EEXIST') {
        console.error(`Failed to create session directory: ${error}`);
      }
    }
  }
  
  /**
   * Ensure session directory exists (async version for other operations)
   */
  private async ensureSessionDirectory(): Promise<void> {
    try {
      await fs.mkdir(this.sessionDir, { recursive: true });
    } catch (error) {
      console.error(`Failed to create session directory: ${error}`);
    }
  }
  
  /**
   * Start a new session
   */
  async startSession(
    mode: string,
    query: string,
    config?: Partial<SessionConfig>
  ): Promise<string> {
    return this.sessionLogger.startSession(mode, query);
  }
  
  /**
   * Get current active session
   */
  getCurrentSession(): Session | null {
    return this.sessionLogger.getCurrentSession();
  }
  
  /**
   * End current session
   */
  async endSession(save: boolean = true): Promise<void> {
    await this.sessionLogger.endSession(save);
  }
  
  /**
   * Load all sessions for analysis
   */
  private async loadAllSessions(): Promise<Session[]> {
    const sessions: Session[] = [];
    
    try {
      const files = await fs.readdir(this.sessionDir);
      
      for (const file of files) {
        if (file.endsWith(".json")) {
          const filepath = path.join(this.sessionDir, file);
          const content = await fs.readFile(filepath, "utf-8");
          const session = JSON.parse(content) as Session;
          sessions.push(session);
          this.sessionCache.set(session.id, session);
        }
      }
    } catch (error) {
      console.error(`Error loading sessions: ${error}`);
    }
    
    return sessions;
  }
  
  /**
   * Analyze sessions for patterns and insights
   */
  async analyzeSessions(
    dateRange?: { start: Date; end: Date },
    mode?: string,
    metrics: string[] = ["model-usage", "response-time", "consensus-rate"]
  ): Promise<SessionAnalytics> {
    const sessions = await this.loadAllSessions();
    
    // Filter sessions by date range and mode
    const filteredSessions = sessions.filter(session => {
      const sessionDate = new Date(session.timestamp);
      
      if (dateRange) {
        if (sessionDate < dateRange.start || sessionDate > dateRange.end) {
          return false;
        }
      }
      
      if (mode && session.mode !== mode) {
        return false;
      }
      
      return true;
    });
    
    // Calculate analytics
    const analytics: SessionAnalytics = {
      totalSessions: filteredSessions.length,
      averageDuration: 0,
      averageSteps: 0,
      modelUsageStats: new Map(),
      modeDistribution: new Map(),
      domainDistribution: new Map(),
      consensusRate: 0,
      topicClusters: []
    };
    
    if (filteredSessions.length === 0) {
      return analytics;
    }
    
    // Calculate basic metrics
    let totalDuration = 0;
    let totalSteps = 0;
    
    for (const session of filteredSessions) {
      // Duration
      if (session.totalDuration) {
        totalDuration += session.totalDuration;
      }
      
      // Steps
      totalSteps += session.steps.length;
      
      // Mode distribution
      const modeCount = analytics.modeDistribution.get(session.mode) || 0;
      analytics.modeDistribution.set(session.mode, modeCount + 1);
      
      // Domain distribution
      if (session.domain) {
        const domainCount = analytics.domainDistribution.get(session.domain) || 0;
        analytics.domainDistribution.set(session.domain, domainCount + 1);
      }
      
      // Model usage stats
      for (const step of session.steps) {
        const modelKey = `${step.model}:${step.provider}`;
        const stats = analytics.modelUsageStats.get(modelKey) || {
          count: 0,
          averageDuration: 0,
          totalTokens: 0
        };
        
        stats.count++;
        stats.averageDuration = 
          (stats.averageDuration * (stats.count - 1) + step.duration) / stats.count;
        stats.totalTokens += step.tokens?.total || 0;
        
        analytics.modelUsageStats.set(modelKey, stats);
      }
    }
    
    analytics.averageDuration = totalDuration / filteredSessions.length;
    analytics.averageSteps = totalSteps / filteredSessions.length;
    
    // Calculate consensus rate (simplified - looks for similar responses)
    if (metrics.includes("consensus-rate")) {
      analytics.consensusRate = this.calculateConsensusRate(filteredSessions);
    }
    
    // Topic clustering (simplified)
    if (metrics.includes("topic-clustering")) {
      analytics.topicClusters = this.clusterTopics(filteredSessions);
    }
    
    this.analytics = analytics;
    return analytics;
  }
  
  /**
   * Calculate consensus rate across sessions
   */
  private calculateConsensusRate(sessions: Session[]): number {
    if (sessions.length < 2) return 1.0;
    
    let totalComparisons = 0;
    let agreements = 0;
    
    // Compare synthesis or final responses
    for (let i = 0; i < sessions.length - 1; i++) {
      for (let j = i + 1; j < sessions.length; j++) {
        const session1 = sessions[i];
        const session2 = sessions[j];
        
        // Skip if different modes
        if (session1.mode !== session2.mode) continue;
        
        totalComparisons++;
        
        // Simple similarity check (could be enhanced with NLP)
        const text1 = session1.synthesis || session1.steps[session1.steps.length - 1]?.response || "";
        const text2 = session2.synthesis || session2.steps[session2.steps.length - 1]?.response || "";
        
        const similarity = this.calculateTextSimilarity(text1, text2);
        if (similarity > 0.7) {
          agreements++;
        }
      }
    }
    
    return totalComparisons > 0 ? agreements / totalComparisons : 0;
  }
  
  /**
   * Simple text similarity calculation
   */
  private calculateTextSimilarity(text1: string, text2: string): number {
    const words1 = new Set(text1.toLowerCase().split(/\s+/));
    const words2 = new Set(text2.toLowerCase().split(/\s+/));
    
    const intersection = new Set([...words1].filter(x => words2.has(x)));
    const union = new Set([...words1, ...words2]);
    
    return union.size > 0 ? intersection.size / union.size : 0;
  }
  
  /**
   * Cluster sessions by topic
   */
  private clusterTopics(sessions: Session[]): Array<{
    topic: string;
    sessions: string[];
    commonPatterns: string[];
  }> {
    const clusters: Map<string, string[]> = new Map();
    
    // Simple keyword-based clustering
    const topicKeywords = {
      "architecture": ["architecture", "design", "system", "pattern", "structure"],
      "debugging": ["debug", "error", "bug", "fix", "issue"],
      "optimization": ["optimize", "performance", "speed", "efficiency", "improve"],
      "security": ["security", "vulnerability", "authentication", "authorization", "encryption"],
      "testing": ["test", "testing", "unit", "integration", "coverage"],
      "database": ["database", "sql", "query", "schema", "migration"],
      "api": ["api", "endpoint", "rest", "graphql", "webhook"],
      "frontend": ["frontend", "ui", "ux", "react", "vue", "css"],
      "backend": ["backend", "server", "api", "database", "microservice"],
      "devops": ["devops", "deployment", "ci", "cd", "docker", "kubernetes"]
    };
    
    for (const session of sessions) {
      const queryLower = session.query.toLowerCase();
      
      for (const [topic, keywords] of Object.entries(topicKeywords)) {
        if (keywords.some(keyword => queryLower.includes(keyword))) {
          const sessionIds = clusters.get(topic) || [];
          sessionIds.push(session.id);
          clusters.set(topic, sessionIds);
          break; // Only assign to first matching topic
        }
      }
    }
    
    // Convert to result format
    const result: Array<{
      topic: string;
      sessions: string[];
      commonPatterns: string[];
    }> = [];
    
    for (const [topic, sessionIds] of clusters.entries()) {
      result.push({
        topic,
        sessions: sessionIds,
        commonPatterns: this.findCommonPatterns(sessionIds, sessions)
      });
    }
    
    return result;
  }
  
  /**
   * Find common patterns in a group of sessions
   */
  private findCommonPatterns(
    sessionIds: string[],
    allSessions: Session[]
  ): string[] {
    const patterns: string[] = [];
    const sessions = allSessions.filter(s => sessionIds.includes(s.id));
    
    if (sessions.length < 2) return patterns;
    
    // Find common model sequences
    const modelSequences = sessions.map(s => 
      s.steps.map(step => step.model).join(" -> ")
    );
    
    // Find most common sequence
    const sequenceCount = new Map<string, number>();
    for (const seq of modelSequences) {
      sequenceCount.set(seq, (sequenceCount.get(seq) || 0) + 1);
    }
    
    const mostCommonSequence = [...sequenceCount.entries()]
      .sort((a, b) => b[1] - a[1])[0];
    
    if (mostCommonSequence && mostCommonSequence[1] > 1) {
      patterns.push(`Model sequence: ${mostCommonSequence[0]}`);
    }
    
    // Find common response patterns (simplified)
    const commonWords = this.findCommonWords(sessions);
    if (commonWords.length > 0) {
      patterns.push(`Common terms: ${commonWords.slice(0, 5).join(", ")}`);
    }
    
    return patterns;
  }
  
  /**
   * Find common words across sessions
   */
  private findCommonWords(sessions: Session[]): string[] {
    const wordFrequency = new Map<string, number>();
    
    for (const session of sessions) {
      const text = session.synthesis || 
        session.steps.map(s => s.response).join(" ");
      
      const words = text.toLowerCase()
        .split(/\s+/)
        .filter(word => word.length > 4); // Filter short words
      
      for (const word of words) {
        wordFrequency.set(word, (wordFrequency.get(word) || 0) + 1);
      }
    }
    
    // Sort by frequency and return top words
    return [...wordFrequency.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(entry => entry[0])
      .slice(0, 10);
  }
  
  /**
   * Find sessions similar to a query
   */
  async findSimilarSessions(
    query: string,
    limit: number = 5
  ): Promise<Array<{ session: Session; similarity: number }>> {
    const sessions = await this.loadAllSessions();
    const results: Array<{ session: Session; similarity: number }> = [];
    
    for (const session of sessions) {
      const similarity = this.calculateTextSimilarity(query, session.query);
      results.push({ session, similarity });
    }
    
    // Sort by similarity and return top results
    return results
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, limit);
  }
  
  /**
   * Get session recommendations based on history
   */
  async getRecommendations(
    currentQuery: string
  ): Promise<{
    similarSessions: Array<{ id: string; query: string; similarity: number }>;
    suggestedModels: string[];
    suggestedMode: string;
  }> {
    const similar = await this.findSimilarSessions(currentQuery, 3);
    
    // Extract suggested models from similar sessions
    const modelCounts = new Map<string, number>();
    const modeCounts = new Map<string, number>();
    
    for (const { session } of similar) {
      // Count models
      for (const step of session.steps) {
        const modelKey = `${step.model}:${step.provider}`;
        modelCounts.set(modelKey, (modelCounts.get(modelKey) || 0) + 1);
      }
      
      // Count modes
      modeCounts.set(session.mode, (modeCounts.get(session.mode) || 0) + 1);
    }
    
    // Get top models
    const suggestedModels = [...modelCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(entry => entry[0]);
    
    // Get most common mode
    const suggestedMode = [...modeCounts.entries()]
      .sort((a, b) => b[1] - a[1])[0]?.[0] || "brainstorm";
    
    return {
      similarSessions: similar.map(({ session, similarity }) => ({
        id: session.id,
        query: session.query,
        similarity
      })),
      suggestedModels,
      suggestedMode
    };
  }
  
  /**
   * Export analytics report
   */
  async exportAnalyticsReport(
    format: "markdown" | "json" | "html" = "markdown"
  ): Promise<string> {
    if (!this.analytics) {
      await this.analyzeSessions();
    }
    
    const filename = `analytics-${new Date().toISOString().split('T')[0]}.${
      format === "html" ? "html" : format === "json" ? "json" : "md"
    }`;
    const filepath = path.join(this.sessionDir, filename);
    
    let content: string;
    
    switch (format) {
      case "json":
        content = this.formatAnalyticsAsJSON();
        break;
      case "html":
        content = this.formatAnalyticsAsHTML();
        break;
      case "markdown":
      default:
        content = this.formatAnalyticsAsMarkdown();
        break;
    }
    
    await fs.writeFile(filepath, content, "utf-8");
    return filepath;
  }
  
  /**
   * Format analytics as Markdown
   */
  private formatAnalyticsAsMarkdown(): string {
    if (!this.analytics) return "No analytics data available";
    
    const lines: string[] = [];
    const a = this.analytics;
    
    lines.push("# Focus MCP Session Analytics Report\n");
    lines.push(`Generated: ${new Date().toISOString()}\n`);
    
    lines.push("## Overview");
    lines.push(`- **Total Sessions**: ${a.totalSessions}`);
    lines.push(`- **Average Duration**: ${(a.averageDuration / 1000).toFixed(1)}s`);
    lines.push(`- **Average Steps**: ${a.averageSteps.toFixed(1)}`);
    lines.push(`- **Consensus Rate**: ${(a.consensusRate * 100).toFixed(1)}%\n`);
    
    lines.push("## Mode Distribution");
    for (const [mode, count] of a.modeDistribution.entries()) {
      lines.push(`- ${mode}: ${count} sessions`);
    }
    lines.push("");
    
    if (a.domainDistribution.size > 0) {
      lines.push("## Domain Distribution");
      for (const [domain, count] of a.domainDistribution.entries()) {
        lines.push(`- ${domain}: ${count} sessions`);
      }
      lines.push("");
    }
    
    lines.push("## Model Usage Statistics");
    lines.push("| Model | Provider | Count | Avg Duration | Total Tokens |");
    lines.push("|-------|----------|-------|--------------|--------------|");
    
    for (const [modelKey, stats] of a.modelUsageStats.entries()) {
      const [model, provider] = modelKey.split(":");
      lines.push(
        `| ${model} | ${provider} | ${stats.count} | ${
          (stats.averageDuration / 1000).toFixed(1)
        }s | ${stats.totalTokens} |`
      );
    }
    lines.push("");
    
    if (a.topicClusters.length > 0) {
      lines.push("## Topic Clusters");
      for (const cluster of a.topicClusters) {
        lines.push(`\n### ${cluster.topic}`);
        lines.push(`- Sessions: ${cluster.sessions.length}`);
        if (cluster.commonPatterns.length > 0) {
          lines.push("- Common Patterns:");
          for (const pattern of cluster.commonPatterns) {
            lines.push(`  - ${pattern}`);
          }
        }
      }
    }
    
    return lines.join("\n");
  }
  
  /**
   * Format analytics as JSON
   */
  private formatAnalyticsAsJSON(): string {
    if (!this.analytics) return "{}";
    
    return JSON.stringify({
      ...this.analytics,
      modelUsageStats: Object.fromEntries(this.analytics.modelUsageStats),
      modeDistribution: Object.fromEntries(this.analytics.modeDistribution),
      domainDistribution: Object.fromEntries(this.analytics.domainDistribution)
    }, null, 2);
  }
  
  /**
   * Format analytics as HTML
   */
  private formatAnalyticsAsHTML(): string {
    if (!this.analytics) return "<p>No analytics data available</p>";
    
    const a = this.analytics;
    
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Focus MCP Analytics Report</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            line-height: 1.6;
            max-width: 1200px;
            margin: 0 auto;
            padding: 20px;
            background: #f5f5f5;
        }
        .header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 30px;
            border-radius: 10px;
            margin-bottom: 30px;
        }
        .card {
            background: white;
            padding: 20px;
            border-radius: 10px;
            margin-bottom: 20px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        .stats-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 20px;
            margin: 20px 0;
        }
        .stat-card {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 20px;
            border-radius: 10px;
            text-align: center;
        }
        .stat-value {
            font-size: 32px;
            font-weight: bold;
        }
        .stat-label {
            font-size: 14px;
            opacity: 0.9;
            margin-top: 5px;
        }
        table {
            width: 100%;
            border-collapse: collapse;
        }
        th, td {
            padding: 12px;
            text-align: left;
            border-bottom: 1px solid #ddd;
        }
        th {
            background: #f0f0f0;
            font-weight: 600;
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>Focus MCP Analytics Report</h1>
        <p>Generated: ${new Date().toISOString()}</p>
    </div>
    
    <div class="stats-grid">
        <div class="stat-card">
            <div class="stat-value">${a.totalSessions}</div>
            <div class="stat-label">Total Sessions</div>
        </div>
        <div class="stat-card">
            <div class="stat-value">${(a.averageDuration / 1000).toFixed(1)}s</div>
            <div class="stat-label">Avg Duration</div>
        </div>
        <div class="stat-card">
            <div class="stat-value">${a.averageSteps.toFixed(1)}</div>
            <div class="stat-label">Avg Steps</div>
        </div>
        <div class="stat-card">
            <div class="stat-value">${(a.consensusRate * 100).toFixed(1)}%</div>
            <div class="stat-label">Consensus Rate</div>
        </div>
    </div>
    
    <div class="card">
        <h2>Model Usage Statistics</h2>
        <table>
            <thead>
                <tr>
                    <th>Model</th>
                    <th>Provider</th>
                    <th>Count</th>
                    <th>Avg Duration</th>
                    <th>Total Tokens</th>
                </tr>
            </thead>
            <tbody>
                ${[...a.modelUsageStats.entries()].map(([modelKey, stats]) => {
                  const [model, provider] = modelKey.split(":");
                  return `
                    <tr>
                        <td>${model}</td>
                        <td>${provider}</td>
                        <td>${stats.count}</td>
                        <td>${(stats.averageDuration / 1000).toFixed(1)}s</td>
                        <td>${stats.totalTokens}</td>
                    </tr>
                  `;
                }).join('')}
            </tbody>
        </table>
    </div>
    
    ${a.topicClusters.length > 0 ? `
    <div class="card">
        <h2>Topic Clusters</h2>
        ${a.topicClusters.map(cluster => `
            <h3>${cluster.topic}</h3>
            <p>Sessions: ${cluster.sessions.length}</p>
            ${cluster.commonPatterns.length > 0 ? `
                <p>Common Patterns:</p>
                <ul>
                    ${cluster.commonPatterns.map(p => `<li>${p}</li>`).join('')}
                </ul>
            ` : ''}
        `).join('')}
    </div>
    ` : ''}
</body>
</html>`;
  }
}

// Export singleton instance
export const sessionManager = new SessionManager();