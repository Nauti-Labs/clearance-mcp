#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  type Tool,
} from "@modelcontextprotocol/sdk/types.js";
import { ClearanceClient } from "./client.js";

const API_KEY = process.env.CLEARANCE_API_KEY;
const BASE_URL = process.env.CLEARANCE_BASE_URL || "https://clearance.nauti-labs.com";

if (!API_KEY) {
  console.error("CLEARANCE_API_KEY environment variable is required");
  process.exit(1);
}

const client = new ClearanceClient(API_KEY, BASE_URL);

const TOOLS: Tool[] = [
  {
    name: "clearances_create",
    description: "Create a new human approval request. The agent describes what it wants to do, the human gets a URL to approve or deny with one tap. Returns the clearance with an approve_url and deny_url.",
    inputSchema: {
      type: "object",
      properties: {
        title: {
          type: "string",
          description: "Human-readable description of what the agent wants to do",
        },
        scope: {
          type: "string",
          description: "Machine-readable scope tag (e.g. 'purchase:flight', 'transfer:usdc')",
        },
        budget_amount: {
          type: "number",
          description: "Maximum amount the agent is requesting to spend",
        },
        budget_currency: {
          type: "string",
          description: "Currency code (default: USD)",
          default: "USD",
        },
        metadata: {
          type: "object",
          description: "Arbitrary key-value data attached to the clearance",
        },
        webhook_url: {
          type: "string",
          description: "URL to POST when the clearance is approved or denied",
        },
      },
      required: ["title"],
    },
  },
  {
    name: "clearances_get",
    description: "Get a single clearance by ID. Returns the full status, token, approval URL, and metadata.",
    inputSchema: {
      type: "object",
      properties: {
        id: {
          type: "string",
          description: "Clearance ID (e.g. clr_a1b2c3d4)",
        },
      },
      required: ["id"],
    },
  },
  {
    name: "clearances_list",
    description: "List all clearances with optional filtering by status, pagination.",
    inputSchema: {
      type: "object",
      properties: {
        status: {
          type: "string",
          description: "Filter by status: pending, approved, denied, revoked",
        },
        limit: {
          type: "number",
          description: "Max items per page (default: 20)",
          default: 20,
        },
        offset: {
          type: "number",
          description: "Pagination offset (default: 0)",
          default: 0,
        },
      },
      required: [],
    },
  },
  {
    name: "clearances_approve",
    description: "Approve a pending clearance by ID. This is typically done by the human, not the agent — but the API allows it for automated flows. Returns the updated clearance with a signed token.",
    inputSchema: {
      type: "object",
      properties: {
        id: {
          type: "string",
          description: "Clearance ID to approve",
        },
      },
      required: ["id"],
    },
  },
  {
    name: "clearances_deny",
    description: "Deny a pending clearance by ID. Optionally provide a reason. Returns the updated clearance.",
    inputSchema: {
      type: "object",
      properties: {
        id: {
          type: "string",
          description: "Clearance ID to deny",
        },
        reason: {
          type: "string",
          description: "Optional reason for denial",
        },
      },
      required: ["id"],
    },
  },
  {
    name: "verify_token",
    description: "Verify a signed clearance token. Any service can verify a token without authentication — this is how you prove a clearance was approved.",
    inputSchema: {
      type: "object",
      properties: {
        token: {
          type: "string",
          description: "The JWT token returned when a clearance was approved",
        },
      },
      required: ["token"],
    },
  },
  {
    name: "keys_create",
    description: "Create a new Clearance API key. You can request a specific tier (starter, pro, scale). Returns the new key and its limits.",
    inputSchema: {
      type: "object",
      properties: {
        tier: {
          type: "string",
          description: "Tier: starter (free), pro ($19/mo), scale ($49/mo)",
          default: "starter",
        },
        email: {
          type: "string",
          description: "Optional email for key notifications",
        },
      },
      required: [],
    },
  },
  {
    name: "usage_get",
    description: "Get current usage and limits for this API key. Shows tier, monthly quota, used count, remaining count, and reset date.",
    inputSchema: {
      type: "object",
      properties: {},
      required: [],
    },
  },
];

const server = new Server(
  {
    name: "clearance-mcp",
    version: "1.0.0",
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

  try {
    let result: unknown;

    switch (name) {
      case "clearances_create": {
        const { title, scope, budget_amount, budget_currency, metadata, webhook_url } = args as Record<string, unknown>;
        result = await client.createClearance({
          title: String(title),
          scope: scope ? String(scope) : undefined,
          budget_amount: typeof budget_amount === "number" ? budget_amount : undefined,
          budget_currency: budget_currency ? String(budget_currency) : undefined,
          metadata: typeof metadata === "object" && metadata !== null ? (metadata as Record<string, unknown>) : undefined,
          webhook_url: webhook_url ? String(webhook_url) : undefined,
        });
        break;
      }
      case "clearances_get": {
        const { id } = args as Record<string, string>;
        result = await client.getClearance(id);
        break;
      }
      case "clearances_list": {
        const { status, limit, offset } = args as Record<string, unknown>;
        result = await client.listClearances({
          status: status ? String(status) : undefined,
          limit: typeof limit === "number" ? limit : undefined,
          offset: typeof offset === "number" ? offset : undefined,
        });
        break;
      }
      case "clearances_approve": {
        const { id } = args as Record<string, string>;
        result = await client.approveClearance(id);
        break;
      }
      case "clearances_deny": {
        const { id, reason } = args as Record<string, string>;
        result = await client.denyClearance(id, reason);
        break;
      }
      case "verify_token": {
        const { token } = args as Record<string, string>;
        result = await client.verifyToken(token);
        break;
      }
      case "keys_create": {
        const { tier, email } = args as Record<string, unknown>;
        result = await client.createKey({
          tier: tier ? String(tier) : undefined,
          email: email ? String(email) : undefined,
        });
        break;
      }
      case "usage_get": {
        result = await client.getUsage();
        break;
      }
      default:
        throw new Error(`Unknown tool: ${name}`);
    }

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(result, null, 2),
        },
      ],
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      content: [
        {
          type: "text",
          text: `Error: ${message}`,
        },
      ],
      isError: true,
    };
  }
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
