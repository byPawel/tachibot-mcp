#!/usr/bin/env node

// Simplified server with guaranteed keepalive
import { FastMCP } from "fastmcp";
import { z } from "zod";

// CRITICAL: Keep the process alive FIRST
process.stdin.resume();
setInterval(() => {}, 1 << 30); // Keepalive forever

// Log to stderr only
const log = (...args: any[]) => console.error(...args);

log("🚀 TachiBot MCP Server (Simplified) Starting...");

const server = new FastMCP({
  name: "tachibot-mcp",
  version: "2.0.0"
});

// Add minimal test tools
server.addTool({
  name: "think",
  description: "Log a thought",
  parameters: z.object({
    thought: z.string()
  }),
  execute: async (args: any) => {
    log("Think:", args.thought);
    return `Thought recorded: ${args.thought}`;
  }
});

server.addTool({
  name: "test",
  description: "Test tool",
  parameters: z.object({
    message: z.string()
  }),
  execute: async (args: any) => {
    return `Test response: ${args.message}`;
  }
});

// Start server
log("Starting FastMCP server...");
server.start({
  transportType: "stdio"
});

log("✅ Server started and will stay alive");

// Handle signals
process.on('SIGINT', () => {
  log('Received SIGINT, shutting down...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  log('Received SIGTERM, shutting down...');
  process.exit(0);
});

// Log any errors but don't crash
process.on('uncaughtException', (error) => {
  log('Uncaught Exception:', error);
});

process.on('unhandledRejection', (reason) => {
  log('Unhandled Rejection:', reason);
});