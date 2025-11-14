#!/usr/bin/env node

// IMMEDIATE DIAGNOSTIC - Log before ANY imports or operations
console.error("🔴 DIAGNOSTIC: Script started at", new Date().toISOString());
console.error("🔴 DIAGNOSTIC: Process info:", {
  pid: process.pid,
  cwd: process.cwd(),
  argv: process.argv,
  nodeVersion: process.version,
  platform: process.platform
});

// Keep alive IMMEDIATELY
process.stdin.resume();
const keepAlive = setInterval(() => {}, 2147483647); // Max 32-bit int

console.error("🔴 DIAGNOSTIC: Keepalive set");

// Now try imports
console.error("🔴 DIAGNOSTIC: Starting imports...");

(async () => {
  try {
    // Test if we can even import
    const { FastMCP } = await import("fastmcp");
    const { z } = await import("zod");
    console.error("🔴 DIAGNOSTIC: FastMCP imported successfully");

    const server = new FastMCP({
      name: "tachibot-mcp",
      version: "2.0.0"
    });

    console.error("🔴 DIAGNOSTIC: FastMCP instance created");

    // Add a simple tool
    server.addTool({
      name: "diagnostic_test",
      description: "Test diagnostic tool",
      parameters: z.object({
        message: z.string()
      }),
      execute: async (args: any) => {
        console.error("🔴 DIAGNOSTIC: Tool executed with:", args);
        return `Diagnostic response: ${args.message}`;
      }
    });

    console.error("🔴 DIAGNOSTIC: Tool added");

    // Start server
    console.error("🔴 DIAGNOSTIC: Starting server...");
    server.start({
      transportType: "stdio"
    });

    console.error("🔴 DIAGNOSTIC: Server.start() called");

  } catch (error) {
    console.error("🔴 DIAGNOSTIC ERROR:", error);
    console.error("🔴 DIAGNOSTIC: Keeping process alive despite error");
  }
})();

// Add multiple safety nets
process.on('SIGINT', () => {
  console.error('🔴 DIAGNOSTIC: SIGINT received');
  clearInterval(keepAlive);
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.error('🔴 DIAGNOSTIC: SIGTERM received');
  clearInterval(keepAlive);
  process.exit(0);
});

process.on('uncaughtException', (error) => {
  console.error('🔴 DIAGNOSTIC: Uncaught Exception:', error);
});

process.on('unhandledRejection', (reason) => {
  console.error('🔴 DIAGNOSTIC: Unhandled Rejection:', reason);
});

process.on('exit', (code) => {
  console.error('🔴 DIAGNOSTIC: Process exiting with code:', code);
});

console.error("🔴 DIAGNOSTIC: All handlers set, process should stay alive");