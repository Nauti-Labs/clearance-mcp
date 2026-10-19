#!/usr/bin/env node
import { createRequire } from "node:module";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { ClearanceClient } from "./client.js";
import { TOOLS, handleToolCall } from "./tools.js";

const require = createRequire(import.meta.url);
const { version } = require("../package.json") as { version: string };

const API_KEY = process.env.CLEARANCE_API_KEY;
const BASE_URL = process.env.CLEARANCE_BASE_URL || "https://clearance.nauti-labs.com";

if (!API_KEY) {
  console.error("CLEARANCE_API_KEY environment variable is required");
  process.exit(1);
}

const client = new ClearanceClient(API_KEY, BASE_URL);

const server = new Server(
  {
    name: "clearance-mcp",
    version,
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return { tools: TOOLS };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  return handleToolCall(client, name, args);
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Clearance MCP server running on stdio");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
