/**
 * Session-related MCP tools for Focus MCP Server
 * Provides tools for managing, analyzing, and exporting sessions
 */

import { z } from "zod";
import { sessionLogger } from "./session-logger.js";
import { sessionManager } from "./session-manager.js";

// Define schemas for each tool's parameters
const ListSessionsSchema = z.object({
  filter: z.string().optional().describe("Filter by mode, date, or query text"),
  limit: z.number().optional().default(10).describe("Maximum number of sessions to return"),
  sortBy: z.enum(["date", "duration", "steps", "mode"]).optional().default("date")
    .describe("Sort criteria for results")
});

const ReplaySessionSchema = z.object({
  sessionId: z.string().describe("Session ID or filename to replay"),
  format: z.enum(["full", "summary"]).optional().default("full")
    .describe("Output format - full shows all steps, summary shows key points")
});

const ExportSessionSchema = z.object({
  sessionId: z.string().describe("Session ID to export"),
  format: z.enum(["markdown", "json", "html", "pdf"])
    .describe("Export format"),
  outputPath: z.string().optional()
    .describe("Custom output path (optional)")
});

const AnalyzeSessionsSchema = z.object({
  dateRange: z.object({
    start: z.string().describe("Start date (YYYY-MM-DD)"),
    end: z.string().describe("End date (YYYY-MM-DD)")
  }).optional().describe("Date range to analyze"),
  mode: z.string().optional().describe("Filter by specific mode"),
  metrics: z.array(z.enum([
    "model-usage",
    "response-time",
    "token-usage",
    "consensus-rate",
    "topic-clustering"
  ])).optional().default(["model-usage", "response-time", "consensus-rate"])
    .describe("Metrics to calculate"),
  exportReport: z.boolean().optional().default(false)
    .describe("Export analytics report to file")
});

const FindSimilarSchema = z.object({
  query: z.string().describe("Query to find similar sessions for"),
  limit: z.number().optional().default(5)
    .describe("Maximum number of similar sessions to return")
});

const RecommendSchema = z.object({
  query: z.string().describe("Query to get recommendations for")
});

const ClearOldSessionsSchema = z.object({
  daysToKeep: z.number().default(30)
    .describe("Keep sessions from the last N days")
});

const SessionStatusSchema = z.object({});

// Type definitions
type ListSessionsArgs = z.infer<typeof ListSessionsSchema>;
type ReplaySessionArgs = z.infer<typeof ReplaySessionSchema>;
type ExportSessionArgs = z.infer<typeof ExportSessionSchema>;
type AnalyzeSessionsArgs = z.infer<typeof AnalyzeSessionsSchema>;
type FindSimilarArgs = z.infer<typeof FindSimilarSchema>;
type RecommendArgs = z.infer<typeof RecommendSchema>;
type ClearOldSessionsArgs = z.infer<typeof ClearOldSessionsSchema>;
type SessionStatusArgs = z.infer<typeof SessionStatusSchema>;

/**
 * Register all session-related tools with the MCP server
 */
export function registerSessionTools(server: any): void {
  // List saved sessions
  server.addTool({
    name: "focus_list_sessions",
    description: "List all saved Focus MCP brainstorming sessions with metadata",
    parameters: ListSessionsSchema,
    execute: async (args: ListSessionsArgs) => {
      try {
        const sessions = await sessionLogger.listSessions(args.filter, args.limit);
        
        if (sessions.length === 0) {
          return {
            content: [{
              type: "text",
              text: "No sessions found matching the criteria."
            }]
          };
        }
        
        // Format sessions as a table
        const lines = [
          "# Focus MCP Sessions\n",
          "| Date | Mode | Query | Session ID |",
          "|------|------|-------|------------|"
        ];
        
        for (const session of sessions) {
          const date = session.date.toISOString().split('T')[0];
          const query = session.query.length > 50 
            ? session.query.substring(0, 47) + "..." 
            : session.query;
          lines.push(`| ${date} | ${session.mode} | ${query} | ${session.id} |`);
        }
        
        lines.push(`\n**Total sessions found**: ${sessions.length}`);
        
        return {
          content: [{
            type: "text",
            text: lines.join("\n")
          }]
        };
      } catch (error) {
        return {
          content: [{
            type: "text",
            text: `Error listing sessions: ${error}`
          }],
          isError: true
        };
      }
    }
  });
  
  // Replay a saved session
  server.addTool({
    name: "focus_replay_session",
    description: "Replay a saved session to see all model responses and synthesis",
    parameters: ReplaySessionSchema,
    execute: async (args: ReplaySessionArgs) => {
      try {
        const content = await sessionLogger.replaySession(args.sessionId, args.format);
        return {
          content: [{
            type: "text",
            text: content
          }]
        };
      } catch (error) {
        return {
          content: [{
            type: "text",
            text: `Error replaying session: ${error}`
          }],
          isError: true
        };
      }
    }
  });
  
  // Export session in different format
  server.addTool({
    name: "focus_export_session",
    description: "Export a session in different formats for sharing or archiving",
    parameters: ExportSessionSchema,
    execute: async (args: ExportSessionArgs) => {
      try {
        const filepath = await sessionLogger.exportSession(
          args.sessionId,
          args.format as any,
          args.outputPath
        );
        
        return {
          content: [{
            type: "text",
            text: `Session exported successfully to: ${filepath}`
          }]
        };
      } catch (error) {
        return {
          content: [{
            type: "text",
            text: `Error exporting session: ${error}`
          }],
          isError: true
        };
      }
    }
  });
  
  // Analyze sessions for patterns and insights
  server.addTool({
    name: "focus_analyze_sessions",
    description: "Analyze multiple sessions for patterns, model performance, and insights",
    parameters: AnalyzeSessionsSchema,
    execute: async (args: AnalyzeSessionsArgs) => {
      try {
        // Parse date range if provided
        let dateRange: { start: Date; end: Date } | undefined;
        if (args.dateRange) {
          dateRange = {
            start: new Date(args.dateRange.start),
            end: new Date(args.dateRange.end)
          };
        }
        
        // Analyze sessions
        const analytics = await sessionManager.analyzeSessions(
          dateRange,
          args.mode,
          args.metrics
        );
        
        // Format analytics report
        const lines = [
          "# Session Analytics Report\n",
          "## Overview",
          `- **Total Sessions**: ${analytics.totalSessions}`,
          `- **Average Duration**: ${(analytics.averageDuration / 1000).toFixed(1)}s`,
          `- **Average Steps**: ${analytics.averageSteps.toFixed(1)}`,
          `- **Consensus Rate**: ${(analytics.consensusRate * 100).toFixed(1)}%\n`
        ];
        
        if (analytics.modelUsageStats.size > 0) {
          lines.push("## Model Usage");
          for (const [model, stats] of analytics.modelUsageStats.entries()) {
            lines.push(`- **${model}**: ${stats.count} uses, ${
              (stats.averageDuration / 1000).toFixed(1)
            }s avg, ${stats.totalTokens} tokens`);
          }
          lines.push("");
        }
        
        if (analytics.topicClusters.length > 0) {
          lines.push("## Topic Clusters");
          for (const cluster of analytics.topicClusters) {
            lines.push(`- **${cluster.topic}**: ${cluster.sessions.length} sessions`);
            if (cluster.commonPatterns.length > 0) {
              lines.push(`  Patterns: ${cluster.commonPatterns.join(", ")}`);
            }
          }
          lines.push("");
        }
        
        // Export if requested
        if (args.exportReport) {
          const filepath = await sessionManager.exportAnalyticsReport("markdown");
          lines.push(`\n📊 Full report exported to: ${filepath}`);
        }
        
        return {
          content: [{
            type: "text",
            text: lines.join("\n")
          }]
        };
      } catch (error) {
        return {
          content: [{
            type: "text",
            text: `Error analyzing sessions: ${error}`
          }],
          isError: true
        };
      }
    }
  });
  
  // Find similar sessions
  server.addTool({
    name: "focus_find_similar",
    description: "Find sessions similar to a given query for learning from past interactions",
    parameters: FindSimilarSchema,
    execute: async (args: FindSimilarArgs) => {
      try {
        const similar = await sessionManager.findSimilarSessions(args.query, args.limit);
        
        if (similar.length === 0) {
          return {
            content: [{
              type: "text",
              text: "No similar sessions found."
            }]
          };
        }
        
        const lines = [
          `# Similar Sessions for: "${args.query}"\n`
        ];
        
        for (const { session, similarity } of similar) {
          lines.push(`## ${session.id}`);
          lines.push(`- **Query**: ${session.query}`);
          lines.push(`- **Mode**: ${session.mode}`);
          lines.push(`- **Similarity**: ${(similarity * 100).toFixed(1)}%`);
          lines.push(`- **Date**: ${session.timestamp}`);
          
          if (session.synthesis) {
            lines.push(`- **Key Insight**: ${
              session.synthesis.substring(0, 200)
            }${session.synthesis.length > 200 ? "..." : ""}`);
          }
          lines.push("");
        }
        
        return {
          content: [{
            type: "text",
            text: lines.join("\n")
          }]
        };
      } catch (error) {
        return {
          content: [{
            type: "text",
            text: `Error finding similar sessions: ${error}`
          }],
          isError: true
        };
      }
    }
  });
  
  // Get recommendations based on history
  server.addTool({
    name: "focus_recommend",
    description: "Get mode and model recommendations based on session history",
    parameters: RecommendSchema,
    execute: async (args: RecommendArgs) => {
      try {
        const recommendations = await sessionManager.getRecommendations(args.query);
        
        const lines = [
          `# Recommendations for: "${args.query}"\n`,
          `## Suggested Mode: **${recommendations.suggestedMode}**\n`
        ];
        
        if (recommendations.suggestedModels.length > 0) {
          lines.push("## Suggested Models:");
          for (const model of recommendations.suggestedModels) {
            lines.push(`- ${model}`);
          }
          lines.push("");
        }
        
        if (recommendations.similarSessions.length > 0) {
          lines.push("## Similar Past Sessions:");
          for (const session of recommendations.similarSessions) {
            lines.push(`- **${session.id}**`);
            lines.push(`  Query: "${session.query}"`);
            lines.push(`  Similarity: ${(session.similarity * 100).toFixed(1)}%`);
          }
        }
        
        return {
          content: [{
            type: "text",
            text: lines.join("\n")
          }]
        };
      } catch (error) {
        return {
          content: [{
            type: "text",
            text: `Error getting recommendations: ${error}`
          }],
          isError: true
        };
      }
    }
  });
  
  // Clear old sessions
  server.addTool({
    name: "focus_clear_old_sessions",
    description: "Clean up old session files to save disk space",
    parameters: ClearOldSessionsSchema,
    execute: async (args: ClearOldSessionsArgs) => {
      try {
        const deletedCount = await sessionLogger.clearOldSessions(args.daysToKeep);
        
        return {
          content: [{
            type: "text",
            text: `Successfully deleted ${deletedCount} old session files (kept last ${args.daysToKeep} days).`
          }]
        };
      } catch (error) {
        return {
          content: [{
            type: "text",
            text: `Error clearing old sessions: ${error}`
          }],
          isError: true
        };
      }
    }
  });
  
  // Get session status
  server.addTool({
    name: "focus_session_status",
    description: "Get the status of the current active session",
    parameters: SessionStatusSchema,
    execute: async (args: SessionStatusArgs) => {
      try {
        const currentSession = sessionManager.getCurrentSession();
        
        if (!currentSession) {
          return {
            content: [{
              type: "text",
              text: "No active session."
            }]
          };
        }
        
        const lines = [
          "# Current Session Status\n",
          `- **ID**: ${currentSession.id}`,
          `- **Mode**: ${currentSession.mode}`,
          `- **Query**: ${currentSession.query}`,
          `- **Status**: ${currentSession.status}`,
          `- **Steps Completed**: ${currentSession.steps.length}`,
          `- **Started**: ${currentSession.timestamp}`
        ];
        
        if (currentSession.totalDuration) {
          lines.push(`- **Duration**: ${(currentSession.totalDuration / 1000).toFixed(1)}s`);
        }
        
        if (currentSession.steps.length > 0) {
          lines.push("\n## Recent Steps:");
          const recentSteps = currentSession.steps.slice(-3);
          for (const step of recentSteps) {
            lines.push(`- Step ${step.stepNumber}: ${step.mode} (${step.model})`);
          }
        }
        
        return {
          content: [{
            type: "text",
            text: lines.join("\n")
          }]
        };
      } catch (error) {
        return {
          content: [{
            type: "text",
            text: `Error getting session status: ${error}`
          }],
          isError: true
        };
      }
    }
  });
  
  console.error("✅ Session tools registered successfully");
}