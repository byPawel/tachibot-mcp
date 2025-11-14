#!/usr/bin/env node

// IMMEDIATE LOG - Before ANY code execution
process.stderr.write("🔥 RAW MCP: Process started PID=" + process.pid + "\n");

// RAW MCP Server - No FastMCP dependency
console.error("🟢 RAW MCP: Starting at", new Date().toISOString());

// Keep process alive
process.stdin.resume();
setInterval(() => {
  console.error("🟢 RAW MCP: Heartbeat", new Date().toISOString());
}, 30000);

console.error("🟢 RAW MCP: Setting up readline for JSON-RPC");

import * as readline from 'readline';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  terminal: false
});

// Server capabilities
const serverInfo = {
  name: "tachibot-mcp",
  version: "2.0.0"
};

const tools = {
  test: {
    description: "Test tool",
    inputSchema: {
      type: "object",
      properties: {
        message: { type: "string" }
      }
    }
  },
  think: {
    description: "Log a thought",
    inputSchema: {
      type: "object",
      properties: {
        thought: { type: "string" }
      }
    }
  }
};

// Send JSON-RPC response
function sendResponse(id: any, result: any) {
  const response = {
    jsonrpc: "2.0",
    id: id,
    result: result
  };
  console.log(JSON.stringify(response));
  console.error("🟢 RAW MCP: Sent response for id", id);
}

// Send JSON-RPC error
function sendError(id: any, code: any, message: any) {
  const response = {
    jsonrpc: "2.0",
    id: id,
    error: {
      code: code,
      message: message
    }
  };
  console.log(JSON.stringify(response));
  console.error("🟢 RAW MCP: Sent error for id", id);
}

// Handle JSON-RPC requests
rl.on('line', (line: any) => {
  console.error("🟢 RAW MCP: Received line:", line.substring(0, 100) + "...");

  try {
    const request = JSON.parse(line);
    console.error("🟢 RAW MCP: Parsed request method:", request.method);

    if (request.method === "initialize") {
      console.error("🟢 RAW MCP: Handling initialize");
      // Match the client's protocol version
      const clientVersion = request.params?.protocolVersion || "2024-11-05";
      console.error("🟢 RAW MCP: Client protocol version:", clientVersion);

      sendResponse(request.id, {
        protocolVersion: clientVersion, // Echo back client's version
        capabilities: {
          tools: {}
        },
        serverInfo: serverInfo
      });

    } else if (request.method === "initialized") {
      console.error("🟢 RAW MCP: Client initialized");
      // No response needed for notification

    } else if (request.method === "tools/list") {
      console.error("🟢 RAW MCP: Listing tools");
      sendResponse(request.id, {
        tools: Object.entries(tools).map(([name, tool]) => ({
          name: name,
          description: tool.description,
          inputSchema: tool.inputSchema
        }))
      });

    } else if (request.method === "tools/call") {
      console.error("🟢 RAW MCP: Tool call:", request.params?.name);
      const toolName = request.params?.name;
      const args = request.params?.arguments || {};

      if (toolName === "test") {
        sendResponse(request.id, {
          content: [{
            type: "text",
            text: `Test response: ${args.message || "no message"}`
          }]
        });
      } else if (toolName === "think") {
        console.error("🟢 RAW MCP: Think:", args.thought);
        sendResponse(request.id, {
          content: [{
            type: "text",
            text: `Thought recorded: ${args.thought || "no thought"}`
          }]
        });
      } else {
        sendError(request.id, -32601, `Unknown tool: ${toolName}`);
      }

    } else {
      console.error("🟢 RAW MCP: Unknown method:", request.method);
      sendError(request.id, -32601, `Method not found: ${request.method}`);
    }

  } catch (error) {
    console.error("🟢 RAW MCP: Error processing request:", error);
    // Try to send error response if we can parse the id
    try {
      const partial = JSON.parse(line);
      if (partial.id) {
        sendError(partial.id, -32700, "Parse error");
      }
    } catch {
      // Can't even parse id, ignore
    }
  }
});

// Handle errors and signals
process.on('SIGINT', () => {
  console.error('🟢 RAW MCP: SIGINT received');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.error('🟢 RAW MCP: SIGTERM received');
  process.exit(0);
});

process.on('uncaughtException', (error) => {
  console.error('🟢 RAW MCP: Uncaught Exception:', error);
});

process.on('unhandledRejection', (reason) => {
  console.error('🟢 RAW MCP: Unhandled Rejection:', reason);
});

console.error("🟢 RAW MCP: Server ready and listening");