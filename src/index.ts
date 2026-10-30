#!/usr/bin/env node
import { createRequire } from "node:module";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { ClearanceClient, type ClearanceApi } from "./client.js";
import { isOfflineMode, resolveApiUrl } from "./config.js";
import { OfflineClearanceClient } from "./offline.js";
import { TOOLS, handleToolCall } from "./tools.js";

const require = createRequire(import.meta.url);
const { version } = require("../package.json") as { version: string };

const offline = isOfflineMode();
const apiKey = process.env.CLEARANCE_API_KEY?.trim() ?? "";

if (!offline && apiKey === "") {
  console.error(
    "CLEARANCE_API_KEY environment variable is required. Set CLEARANCE_OFFLINE=1 to run without the API."
  );
  process.exit(1);
}

let apiUrl = "";
if (!offline) {
  try {
    apiUrl = resolveApiUrl();
  } catch (err) {
    console.error(err instanceof Error ? err.message : String(err));
    process.exit(1);
  }
}

const client: ClearanceApi = offline ? new OfflineClearanceClient() : new ClearanceClient(apiKey, apiUrl);

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
  if (offline) {
    console.error(
      "Clearance MCP server running on stdio (offline mode; responses stay in memory and are not sent to the Clearance API)"
    );
  } else {
    console.error(`Clearance MCP server running on stdio (${apiUrl})`);
  }
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
