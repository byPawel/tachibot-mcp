/**
 * Session Logger for Focus MCP Server
 * Provides full visibility into multi-model brainstorming sessions
 */

import { z } from "zod";
import * as fs from "fs/promises";
import * as fsSync from "fs";
import * as path from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";
import { generateSessionId as generateSessionIdUtil } from "../utils/timestamp-formatter.js";

// Session configuration schema
export const SessionConfigSchema = z.object({
  saveSession: z.boolean().default(false),
  outputFormat: z.enum(["markdown", "json", "html"]).default("markdown"),
  includeTimestamps: z.boolean().default(true),
  includeModelMetadata: z.boolean().default(true),
  sessionDir: z.string().default("./workflow-output/sessions"),
  verbose: z.boolean().default(false),
  autoSave: z.boolean().default(false),
  maxHistorySize: z.number().default(100)
});

export type SessionConfig = z.infer<typeof SessionConfigSchema>;

// Step in the reasoning chain
export interface SessionStep {
  stepNumber: number;
  model: string;
  provider: string;
  mode: string;
  prompt: string;
  response: string;
  startTime: Date;
  endTime: Date;
  duration: number; // milliseconds
  tokens?: {
    input?: number;
    output?: number;
    total?: number;
  };
  error?: string;
  metadata?: Record<string, any>;
}

// Complete session data
export interface Session {
  id: string;
  timestamp: Date;
  mode: string;
  query: string;
  domain?: string;
  steps: SessionStep[];
  synthesis?: string;
  totalDuration?: number;
  status: "active" | "completed" | "failed";
  metadata?: Record<string, any>;
}

/**
 * Session Logger Class
 */
export class SessionLogger {
  private config: SessionConfig;
  private currentSession: Session | null = null;
  private sessions: Map<string, Session> = new Map();
  private sessionDir: string;
  
  constructor(config: Partial<SessionConfig> = {}) {
    this.config = SessionConfigSchema.parse(config);
    
    // Get the project root directory (where this file is located)
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = dirname(__filename);
    const projectRoot = path.resolve(__dirname, '..', '..');
    
    // If sessionDir is relative (starts with .), make it relative to project root
    if (this.config.sessionDir.startsWith('.')) {
      this.sessionDir = path.join(projectRoot, this.config.sessionDir);
    } else {
      // Otherwise use as-is (absolute path)
      this.sessionDir = path.resolve(this.config.sessionDir);
    }
    
    this.ensureSessionDirectorySync();
  }
  
  /**
   * Update configuration at runtime
   */
  updateConfig(config: Partial<SessionConfig>): void {
    this.config = SessionConfigSchema.parse({ ...this.config, ...config });
    
    // Update sessionDir if it changed
    if (config.sessionDir) {
      const __filename = fileURLToPath(import.meta.url);
      const __dirname = dirname(__filename);
      const projectRoot = path.resolve(__dirname, '..', '..');
      
      if (config.sessionDir.startsWith('.')) {
        this.sessionDir = path.join(projectRoot, config.sessionDir);
      } else {
        this.sessionDir = path.resolve(config.sessionDir);
      }
      
      this.ensureSessionDirectorySync();
    }
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
        // Try async as fallback
        this.ensureSessionDirectory();
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
    domain?: string
  ): Promise<string> {
    const sessionId = this.generateSessionId(mode);
    
    this.currentSession = {
      id: sessionId,
      timestamp: new Date(),
      mode,
      query,
      domain,
      steps: [],
      status: "active"
    };
    
    this.sessions.set(sessionId, this.currentSession);
    
    if (this.config.verbose) {
      console.error(`\n🎬 Session Started: ${sessionId}`);
      console.error(`Mode: ${mode}`);
      console.error(`Query: ${query}`);
      if (domain) console.error(`Domain: ${domain}`);
      console.error("─".repeat(50));
    }
    
    return sessionId;
  }
  
  /**
   * Log a step in the current session
   */
  async logStep(
    model: string,
    provider: string,
    mode: string,
    prompt: string,
    response: string,
    metadata?: Record<string, any>
  ): Promise<void> {
    if (!this.currentSession) {
      console.error("No active session to log step");
      return;
    }
    
    const startTime = new Date();
    
    const step: SessionStep = {
      stepNumber: this.currentSession.steps.length + 1,
      model,
      provider,
      mode,
      prompt,
      response,
      startTime,
      endTime: new Date(),
      duration: 0, // Will be updated
      metadata
    };
    
    // Simulate processing time (in real usage, this would be actual API call time)
    step.endTime = new Date();
    step.duration = step.endTime.getTime() - step.startTime.getTime();
    
    this.currentSession.steps.push(step);
    
    if (this.config.verbose) {
      this.printStepVerbose(step);
    }
    
    // Auto-save if configured
    if (this.config.autoSave) {
      await this.saveSession(this.currentSession.id);
    }
  }
  
  /**
   * Print step in verbose mode
   */
  private printStepVerbose(step: SessionStep): void {
    console.error(`\n📍 Step ${step.stepNumber}: ${step.mode.toUpperCase()}`);
    console.error(`Model: ${step.model} (${step.provider})`);
    console.error(`Duration: ${step.duration}ms`);
    
    if (step.tokens) {
      console.error(`Tokens: ${step.tokens.total || 'N/A'}`);
    }
    
    console.error("\n🤖 Response:");
    console.error("─".repeat(50));
    
    // Truncate very long responses in verbose mode
    const maxLength = 1000;
    if (step.response.length > maxLength) {
      console.error(step.response.substring(0, maxLength) + "...\n[Truncated]");
    } else {
      console.error(step.response);
    }
    
    console.error("─".repeat(50));
  }
  
  /**
   * Add synthesis to session
   */
  async addSynthesis(synthesis: string): Promise<void> {
    if (!this.currentSession) {
      console.error("No active session for synthesis");
      return;
    }
    
    this.currentSession.synthesis = synthesis;
    this.currentSession.status = "completed";
    this.currentSession.totalDuration = this.currentSession.steps.reduce(
      (sum, step) => sum + step.duration, 0
    );
    
    if (this.config.verbose) {
      console.error("\n🎯 Final Synthesis:");
      console.error("═".repeat(50));
      console.error(synthesis);
      console.error("═".repeat(50));
      console.error(`\nTotal Duration: ${this.currentSession.totalDuration}ms`);
      console.error(`Total Steps: ${this.currentSession.steps.length}`);
    }
  }
  
  /**
   * End the current session
   */
  async endSession(save: boolean = true): Promise<string | void> {
    if (!this.currentSession) {
      console.error("No active session to end");
      return;
    }
    
    if (this.currentSession.status === "active") {
      this.currentSession.status = "completed";
    }
    
    let filepath: string | undefined;
    if (save || this.config.saveSession) {
      try {
        filepath = await this.saveSession(this.currentSession.id);
        if (this.config.verbose) {
          console.error(`\n✅ Session saved: ${filepath}`);
        }
      } catch (error) {
        console.error(`\n❌ Failed to save session: ${error}`);
        // Don't throw, just log the error
      }
    }
    
    if (this.config.verbose) {
      console.error(`\n🏁 Session Ended: ${this.currentSession.id}`);
    }
    
    const sessionId = this.currentSession.id;
    this.currentSession = null;
    
    // Return filepath if saved, otherwise return sessionId for reference
    return filepath || (save ? sessionId : undefined);
  }
  
  /**
   * Save session to file
   */
  async saveSession(
    sessionId: string,
    format?: "markdown" | "json" | "html"
  ): Promise<string> {
    // Try to get session from Map first, then check currentSession
    let session = this.sessions.get(sessionId);
    if (!session && this.currentSession?.id === sessionId) {
      session = this.currentSession;
      // Ensure it's also in the Map for consistency
      this.sessions.set(sessionId, this.currentSession);
    }
    
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }
    
    const outputFormat = format || this.config.outputFormat;
    const filename = `${sessionId}.${outputFormat === "html" ? "html" : outputFormat === "json" ? "json" : "md"}`;
    const filepath = path.join(this.sessionDir, filename);
    
    let content: string;
    
    switch (outputFormat) {
      case "json":
        content = this.formatAsJSON(session);
        break;
      case "html":
        content = this.formatAsHTML(session);
        break;
      case "markdown":
      default:
        content = this.formatAsMarkdown(session);
        break;
    }
    
    await fs.writeFile(filepath, content, "utf-8");
    
    if (this.config.verbose) {
      console.error(`\n💾 Session saved: ${filepath}`);
    }
    
    return filepath;
  }
  
  /**
   * Format session as Markdown
   */
  private formatAsMarkdown(session: Session): string {
    const lines: string[] = [];
    
    lines.push(`# Focus MCP ${session.mode} Session\n`);
    lines.push("## Metadata");
    lines.push(`- **Session ID**: ${session.id}`);
    lines.push(`- **Date**: ${session.timestamp.toISOString()}`);
    lines.push(`- **Mode**: ${session.mode}`);
    
    if (session.domain) {
      lines.push(`- **Domain**: ${session.domain}`);
    }
    
    const models = [...new Set(session.steps.map(s => `${s.model} (${s.provider})`))];
    lines.push(`- **Models Used**: ${models.join(", ")}`);
    
    if (session.totalDuration) {
      lines.push(`- **Total Duration**: ${(session.totalDuration / 1000).toFixed(1)}s`);
    }
    
    lines.push(`- **Query**: "${session.query}"\n`);
    lines.push("---\n");
    
    // Add each step
    session.steps.forEach(step => {
      lines.push(`## Step ${step.stepNumber}: ${step.mode}`);
      lines.push(`**Model**: ${step.model}`);
      lines.push(`**Provider**: ${step.provider}`);
      lines.push(`**Duration**: ${(step.duration / 1000).toFixed(1)}s`);
      
      if (step.tokens && this.config.includeModelMetadata) {
        lines.push(`**Tokens**: ${step.tokens.total || 'N/A'}`);
      }
      
      lines.push("\n### Prompt:");
      lines.push("```");
      lines.push(step.prompt);
      lines.push("```\n");
      
      lines.push("### Response:");
      lines.push(step.response);
      lines.push("\n---\n");
    });
    
    // Add synthesis if available
    if (session.synthesis) {
      lines.push("## Final Synthesis");
      lines.push(session.synthesis);
      lines.push("\n---\n");
    }
    
    // Add summary statistics
    lines.push("## Summary Statistics");
    lines.push(`- Total Models Used: ${models.length}`);
    lines.push(`- Total Steps: ${session.steps.length}`);
    
    if (session.totalDuration) {
      lines.push(`- Total Response Time: ${(session.totalDuration / 1000).toFixed(1)}s`);
    }
    
    const totalTokens = session.steps.reduce(
      (sum, step) => sum + (step.tokens?.total || 0), 0
    );
    if (totalTokens > 0) {
      lines.push(`- Total Tokens: ${totalTokens}`);
    }
    
    return lines.join("\n");
  }
  
  /**
   * Format session as JSON
   */
  private formatAsJSON(session: Session): string {
    return JSON.stringify(session, null, 2);
  }
  
  /**
   * Format session as HTML
   */
  private formatAsHTML(session: Session): string {
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Focus MCP Session - ${session.id}</title>
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
        .metadata {
            background: white;
            padding: 20px;
            border-radius: 10px;
            margin-bottom: 20px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        .step {
            background: white;
            padding: 20px;
            border-radius: 10px;
            margin-bottom: 20px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        .step-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 15px;
            padding-bottom: 10px;
            border-bottom: 2px solid #f0f0f0;
        }
        .model-badge {
            background: #667eea;
            color: white;
            padding: 5px 10px;
            border-radius: 5px;
            font-size: 14px;
        }
        .prompt, .response {
            background: #f8f9fa;
            padding: 15px;
            border-radius: 5px;
            margin: 10px 0;
            border-left: 3px solid #667eea;
        }
        .synthesis {
            background: #e8f5e9;
            padding: 20px;
            border-radius: 10px;
            border-left: 4px solid #4caf50;
        }
        .stats {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 15px;
            margin-top: 20px;
        }
        .stat-card {
            background: white;
            padding: 15px;
            border-radius: 8px;
            text-align: center;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        .stat-value {
            font-size: 24px;
            font-weight: bold;
            color: #667eea;
        }
        .stat-label {
            font-size: 14px;
            color: #666;
            margin-top: 5px;
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>Focus MCP ${session.mode} Session</h1>
        <p>${session.query}</p>
    </div>
    
    <div class="metadata">
        <h2>Session Information</h2>
        <p><strong>ID:</strong> ${session.id}</p>
        <p><strong>Date:</strong> ${session.timestamp.toISOString()}</p>
        <p><strong>Status:</strong> ${session.status}</p>
        ${session.domain ? `<p><strong>Domain:</strong> ${session.domain}</p>` : ''}
    </div>
    
    ${session.steps.map(step => `
        <div class="step">
            <div class="step-header">
                <h3>Step ${step.stepNumber}: ${step.mode}</h3>
                <span class="model-badge">${step.model}</span>
            </div>
            <div class="prompt">
                <strong>Prompt:</strong><br>
                ${step.prompt.replace(/\n/g, '<br>')}
            </div>
            <div class="response">
                <strong>Response:</strong><br>
                ${step.response.replace(/\n/g, '<br>')}
            </div>
            <p><small>Duration: ${(step.duration / 1000).toFixed(1)}s</small></p>
        </div>
    `).join('')}
    
    ${session.synthesis ? `
        <div class="synthesis">
            <h2>Final Synthesis</h2>
            <p>${session.synthesis.replace(/\n/g, '<br>')}</p>
        </div>
    ` : ''}
    
    <div class="stats">
        <div class="stat-card">
            <div class="stat-value">${session.steps.length}</div>
            <div class="stat-label">Total Steps</div>
        </div>
        <div class="stat-card">
            <div class="stat-value">${[...new Set(session.steps.map(s => s.model))].length}</div>
            <div class="stat-label">Models Used</div>
        </div>
        ${session.totalDuration ? `
        <div class="stat-card">
            <div class="stat-value">${(session.totalDuration / 1000).toFixed(1)}s</div>
            <div class="stat-label">Total Duration</div>
        </div>
        ` : ''}
    </div>
</body>
</html>`;
    
    return html;
  }
  
  /**
   * List all saved sessions
   */
  async listSessions(
    filter?: string,
    limit: number = 10
  ): Promise<Array<{ id: string; date: Date; mode: string; query: string }>> {
    try {
      const files = await fs.readdir(this.sessionDir);
      const sessions: Array<{ id: string; date: Date; mode: string; query: string }> = [];
      
      for (const file of files) {
        if (file.endsWith(".json")) {
          const filepath = path.join(this.sessionDir, file);
          const content = await fs.readFile(filepath, "utf-8");
          const session = JSON.parse(content) as Session;
          
          if (!filter || 
              session.mode.includes(filter) || 
              session.query.includes(filter)) {
            sessions.push({
              id: session.id,
              date: new Date(session.timestamp),
              mode: session.mode,
              query: session.query
            });
          }
        }
      }
      
      // Sort by date descending and limit
      return sessions
        .sort((a, b) => b.date.getTime() - a.date.getTime())
        .slice(0, limit);
    } catch (error) {
      console.error(`Error listing sessions: ${error}`);
      return [];
    }
  }
  
  /**
   * Load and replay a session
   */
  async replaySession(
    sessionId: string,
    format: "full" | "summary" = "full"
  ): Promise<string> {
    // Try different file extensions
    const extensions = [".json", ".md", ".html"];
    let session: Session | null = null;
    
    for (const ext of extensions) {
      try {
        const filepath = path.join(this.sessionDir, sessionId + ext);
        const content = await fs.readFile(filepath, "utf-8");
        
        if (ext === ".json") {
          session = JSON.parse(content) as Session;
          break;
        }
      } catch {
        // Try next extension
      }
    }
    
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }
    
    if (format === "summary") {
      return this.formatSessionSummary(session);
    } else {
      return this.formatAsMarkdown(session);
    }
  }
  
  /**
   * Format session summary
   */
  private formatSessionSummary(session: Session): string {
    const lines: string[] = [];
    
    lines.push(`# Session Summary: ${session.id}\n`);
    lines.push(`**Query**: ${session.query}`);
    lines.push(`**Mode**: ${session.mode}`);
    lines.push(`**Date**: ${session.timestamp}`);
    lines.push(`**Steps**: ${session.steps.length}`);
    
    if (session.synthesis) {
      lines.push("\n## Final Synthesis");
      lines.push(session.synthesis);
    }
    
    return lines.join("\n");
  }
  
  /**
   * Generate session ID with human-readable format
   * Format: session-YYYY-MM-DD-DayName-HH-MM-mode
   * Example: session-2025-11-23-Sunday-22-44-advanced-pingpong
   */
  private generateSessionId(mode: string): string {
    return generateSessionIdUtil(mode);
  }
  
  /**
   * Export session in different format
   */
  async exportSession(
    sessionId: string,
    format: "markdown" | "json" | "html" | "pdf",
    outputPath?: string
  ): Promise<string> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      // Try to load from file
      const loaded = await this.replaySession(sessionId);
      if (!loaded) {
        throw new Error(`Session ${sessionId} not found`);
      }
    }
    
    if (format === "pdf") {
      // PDF export would require additional dependencies
      throw new Error("PDF export not yet implemented");
    }
    
    const filepath = outputPath || 
      path.join(this.sessionDir, `${sessionId}-export.${format}`);
    
    await this.saveSession(sessionId, format as any);
    
    return filepath;
  }
  
  /**
   * Get current session
   */
  getCurrentSession(): Session | null {
    return this.currentSession;
  }
  
  /**
   * Clear old sessions
   */
  async clearOldSessions(daysToKeep: number = 30): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);
    
    let deletedCount = 0;
    
    try {
      const files = await fs.readdir(this.sessionDir);
      
      for (const file of files) {
        const filepath = path.join(this.sessionDir, file);
        const stats = await fs.stat(filepath);
        
        if (stats.mtime < cutoffDate) {
          await fs.unlink(filepath);
          deletedCount++;
        }
      }
    } catch (error) {
      console.error(`Error clearing old sessions: ${error}`);
    }
    
    return deletedCount;
  }
}

// Export singleton instance with default config that can be updated
export const sessionLogger = new SessionLogger({
  saveSession: true,  // Default to true for saving sessions
  verbose: false,
  outputFormat: "markdown"
});