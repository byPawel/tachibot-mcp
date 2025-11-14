#!/usr/bin/env node

/**
 * CommonJS wrapper for TachiBot MCP Server
 * This file loads the ES module server and makes it compatible with MCPB packaging
 */

const { pathToFileURL } = require('url');
const path = require('path');
const fs = require('fs');

// CRITICAL DIAGNOSTIC: Catch ALL uncaught errors and write to file
// This bypasses stdio buffering issues that might hide the real error
process.on('uncaughtException', (err) => {
  const logPath = '/tmp/MCPB_FATAL_ERROR.log';
  const timestamp = new Date().toISOString();
  const errorReport = `
=== UNCAUGHT EXCEPTION ===
Time: ${timestamp}
Error: ${err.message}
Stack:
${err.stack}

Process Info:
- PID: ${process.pid}
- Node: ${process.version}
- CWD: ${process.cwd()}
- Args: ${JSON.stringify(process.argv)}
`;
  try {
    fs.writeFileSync(logPath, errorReport);
    console.error(`❌ FATAL ERROR logged to ${logPath}`);
  } catch (writeErr) {
    console.error('❌ Could not write fatal error log:', writeErr);
  }
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  const logPath = '/tmp/MCPB_FATAL_ERROR.log';
  const timestamp = new Date().toISOString();
  const errorReport = `
=== UNHANDLED PROMISE REJECTION ===
Time: ${timestamp}
Reason: ${reason}
Stack: ${reason?.stack || 'No stack trace'}
Promise: ${promise}

Process Info:
- PID: ${process.pid}
- Node: ${process.version}
- CWD: ${process.cwd()}
- Args: ${JSON.stringify(process.argv)}
`;
  try {
    fs.writeFileSync(logPath, errorReport);
    console.error(`❌ UNHANDLED REJECTION logged to ${logPath}`);
  } catch (writeErr) {
    console.error('❌ Could not write rejection log:', writeErr);
  }
  process.exit(1);
});

// Log startup
console.error('🔥 TachiBot MCP Server (CJS Wrapper) starting...');
console.error(`🔧 Node version: ${process.version}`);
console.error(`🔧 Working directory: ${process.cwd()}`);
console.error(`🔧 Script path: ${__filename}`);

// Calculate the path to the ES module server
// From dist/src/server-cjs.cjs to dist/src/server.js
const serverPath = path.join(__dirname, 'server.js');
const serverURL = pathToFileURL(serverPath).href;

console.error(`🔧 Loading ES module from: ${serverPath}`);
console.error(`🔧 Module URL: ${serverURL}`);

// Keep the process alive
process.stdin.resume();

// DIAGNOSTIC: Force event loop to stay active
// If this fixes the crash, it proves FastMCP isn't registering with event loop in time
const keepAlive = setInterval(() => {
  // This interval prevents Node from exiting due to empty event loop
  // Remove this once the root cause is identified and fixed
}, 60000);
console.error('✅ Keep-alive interval established (60s)');

// Handle process termination gracefully
process.on('SIGINT', () => {
  console.error('Received SIGINT, shutting down gracefully...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.error('Received SIGTERM, shutting down gracefully...');
  process.exit(0);
});

// NOTE: stdin.on('end') handler deliberately NOT registered here
// FastMCP manages the MCP connection lifecycle internally via stdio transport
// Registering stdin.on('end') here causes premature shutdown before FastMCP initializes

// Catch unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  // Don't exit on unhandled rejection - log and continue
});

// Catch uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  // For MCP servers, we should try to continue if possible
  // Only exit if it's a critical error
  if (error.message?.includes('EADDRINUSE') || error.message?.includes('EACCES')) {
    process.exit(1);
  }
});

// Dynamically import the ES module with enhanced error handling
console.error('🚀 Importing ES module server...');
import(serverURL)
  .then((module) => {
    console.error('✅ ES module server loaded successfully');
    console.error(`✅ Module exports: ${Object.keys(module || {}).join(', ') || 'default export'}`);
  })
  .catch((error) => {
    console.error('❌ Failed to load ES module server');
    console.error('❌ Error type:', error.constructor.name);
    console.error('❌ Error message:', error.message);
    console.error('❌ Error stack:', error.stack);
    console.error('❌ Server path attempted:', serverPath);
    console.error('❌ Server URL attempted:', serverURL);
    console.error('❌ __dirname:', __dirname);
    console.error('❌ __filename:', __filename);

    // Try to provide helpful diagnostics
    try {
      const fs = require('fs');
      const exists = fs.existsSync(serverPath);
      console.error(`❌ File exists check: ${exists}`);
      if (exists) {
        const stats = fs.statSync(serverPath);
        console.error(`❌ File size: ${stats.size} bytes`);
        console.error(`❌ File permissions: ${stats.mode.toString(8)}`);
      }
    } catch (diagError) {
      console.error('❌ Could not run diagnostics:', diagError.message);
    }

    process.exit(1);
  });
