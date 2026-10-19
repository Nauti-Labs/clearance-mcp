import type { CallToolResult, Tool } from "@modelcontextprotocol/sdk/types.js";
import { ClearanceClient } from "./client.js";
import type { ClearanceRequest, KeyCreateRequest } from "./types.js";

const CLEARANCE_STATUSES = ["pending", "approved", "denied", "expired", "revoked"] as const;

export const TOOLS: Tool[] = [
  {
    name: "clearances_create",
    description:
      "Create a human approval request. Requires title and scope. Returns the clearance, including approval_url. The human opens that URL to approve or deny; poll clearances_get or pass callback_url to hear the decision.",
    inputSchema: {
      type: "object",
      properties: {
        title: {
          type: "string",
          description: "Short description of what the agent wants to do (max 200 characters)",
        },
        scope: {
          type: "string",
          description: "Machine-readable scope (e.g. 'purchase:flight', 'transfer:usdc')",
        },
        description: {
          type: "string",
          description: "Longer explanation shown to the human approver",
        },
        budget_amount: {
          type: "number",
          description: "Maximum amount the agent is requesting to spend",
        },
        budget_currency: {
          type: "string",
          description: "Currency code. The API defaults to USD when this is omitted.",
          default: "USD",
        },
        callback_url: {
          type: "string",
          description: "Webhook URL the API calls when the clearance is decided",
        },
        metadata: {
          type: "object",
          description: "Arbitrary key-value data attached to the clearance",
        },
        expires_in: {
          type: "integer",
          description: "Seconds until expiry (60–604800). The API defaults to 3600.",
        },
      },
      required: ["title", "scope"],
    },
  },
  {
    name: "clearances_get",
    description:
      "Get one clearance by ID. Returns status, approval_url, expiry, and the signed token when status is approved.",
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
    description:
      "List clearances for this API key. Optional status filter and limit (API default 50). Returns a JSON array, newest first. Status values: pending, approved, denied, expired, revoked.",
    inputSchema: {
      type: "object",
      properties: {
        status: {
          type: "string",
          enum: [...CLEARANCE_STATUSES],
          description: "Filter by status",
        },
        limit: {
          type: "number",
          description: "Maximum number of clearances to return (API default: 50)",
        },
      },
      required: [],
    },
  },
  {
    name: "clearances_approve",
    description:
      "Approve a pending clearance. Calls POST /v1/clearances/{id}/decide with approved=true. Returns id, status, decided_at, and the signed token.",
    inputSchema: {
      type: "object",
      properties: {
        id: {
          type: "string",
          description: "Clearance ID to approve",
        },
        note: {
          type: "string",
          description: "Optional decision note stored with the approval (max 500 characters)",
        },
      },
      required: ["id"],
    },
  },
  {
    name: "clearances_deny",
    description:
      "Deny a pending clearance. Calls POST /v1/clearances/{id}/decide with approved=false. Optional note is stored as the decision note.",
    inputSchema: {
      type: "object",
      properties: {
        id: {
          type: "string",
          description: "Clearance ID to deny",
        },
        note: {
          type: "string",
          description: "Optional decision note (max 500 characters). 'reason' is accepted as an alias.",
        },
      },
      required: ["id"],
    },
  },
  {
    name: "clearances_revoke",
    description:
      "Revoke an approved clearance. Calls POST /v1/clearances/{id}/revoke. The signed token will no longer verify.",
    inputSchema: {
      type: "object",
      properties: {
        id: {
          type: "string",
          description: "Clearance ID to revoke",
        },
      },
      required: ["id"],
    },
  },
  {
    name: "verify_token",
    description:
      "Verify a signed clearance token via GET /v1/verify/{token}. No authentication is required by the API. Returns valid, clearance_id, scope, budget, approved_at, expires_at, and error when invalid.",
    inputSchema: {
      type: "object",
      properties: {
        token: {
          type: "string",
          description: "The JWT returned when a clearance was approved",
        },
      },
      required: ["token"],
    },
  },
  {
    name: "keys_create",
    description:
      "Create a new Clearance API key. Email is required. Keys always start on the free Starter tier (50 clearances/month); tier cannot be chosen here. Returns api_key, tier, credits_remaining, and a message. The raw key is only shown once.",
    inputSchema: {
      type: "object",
      properties: {
        email: {
          type: "string",
          description: "Email address for the new key",
        },
        name: {
          type: "string",
          description: "Optional display name for the key",
        },
      },
      required: ["email"],
    },
  },
  {
    name: "usage_get",
    description:
      "Get usage for this API key: tier, credits_used, credits_remaining, clearances_this_month, period_start, and period_end.",
    inputSchema: {
      type: "object",
      properties: {},
      required: [],
    },
  },
];

function asArgs(args: unknown): Record<string, unknown> {
  if (args === undefined || args === null) return {};
  if (typeof args !== "object" || Array.isArray(args)) {
    throw new Error("Tool arguments must be an object");
  }
  return args as Record<string, unknown>;
}

function requireString(args: Record<string, unknown>, key: string): string {
  const value = args[key];
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`"${key}" is required and must be a non-empty string`);
  }
  return value;
}

function optionalString(args: Record<string, unknown>, key: string): string | undefined {
  if (!Object.prototype.hasOwnProperty.call(args, key) || args[key] === undefined || args[key] === null) {
    return undefined;
  }
  const value = args[key];
  if (typeof value !== "string") {
    throw new Error(`"${key}" must be a string`);
  }
  return value;
}

function optionalNumber(args: Record<string, unknown>, key: string): number | undefined {
  if (!Object.prototype.hasOwnProperty.call(args, key) || args[key] === undefined || args[key] === null) {
    return undefined;
  }
  const value = args[key];
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`"${key}" must be a finite number`);
  }
  return value;
}

function optionalObject(args: Record<string, unknown>, key: string): Record<string, unknown> | undefined {
  if (!Object.prototype.hasOwnProperty.call(args, key) || args[key] === undefined || args[key] === null) {
    return undefined;
  }
  const value = args[key];
  if (typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`"${key}" must be an object`);
  }
  return value as Record<string, unknown>;
}

function decisionNote(args: Record<string, unknown>): string | undefined {
  const note = optionalString(args, "note");
  if (note !== undefined) return note;
  return optionalString(args, "reason");
}

function jsonResult(result: unknown): CallToolResult {
  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(result, null, 2),
      },
    ],
  };
}

export async function handleToolCall(
  client: ClearanceClient,
  name: string,
  rawArgs?: Record<string, unknown>
): Promise<CallToolResult> {
  try {
    const args = asArgs(rawArgs);
    let result: unknown;

    switch (name) {
      case "clearances_create": {
        const data: ClearanceRequest = {
          title: requireString(args, "title"),
          scope: requireString(args, "scope"),
        };
        const description = optionalString(args, "description");
        const budgetAmount = optionalNumber(args, "budget_amount");
        const budgetCurrency = optionalString(args, "budget_currency");
        const callbackUrl = optionalString(args, "callback_url") ?? optionalString(args, "webhook_url");
        const metadata = optionalObject(args, "metadata");
        const expiresIn = optionalNumber(args, "expires_in");
        if (description !== undefined) data.description = description;
        if (budgetAmount !== undefined) data.budget_amount = budgetAmount;
        if (budgetCurrency !== undefined) data.budget_currency = budgetCurrency;
        if (callbackUrl !== undefined) data.callback_url = callbackUrl;
        if (metadata !== undefined) data.metadata = metadata;
        if (expiresIn !== undefined) data.expires_in = expiresIn;
        result = await client.createClearance(data);
        break;
      }
      case "clearances_get": {
        result = await client.getClearance(requireString(args, "id"));
        break;
      }
      case "clearances_list": {
        const status = optionalString(args, "status");
        const limit = optionalNumber(args, "limit");
        result = await client.listClearances({
          status: status && status.trim() !== "" ? status : undefined,
          limit,
        });
        break;
      }
      case "clearances_approve": {
        result = await client.approveClearance(requireString(args, "id"), decisionNote(args));
        break;
      }
      case "clearances_deny": {
        result = await client.denyClearance(requireString(args, "id"), decisionNote(args));
        break;
      }
      case "clearances_revoke": {
        result = await client.revokeClearance(requireString(args, "id"));
        break;
      }
      case "verify_token": {
        result = await client.verifyToken(requireString(args, "token"));
        break;
      }
      case "keys_create": {
        const data: KeyCreateRequest = { email: requireString(args, "email") };
        const nameValue = optionalString(args, "name");
        if (nameValue !== undefined) data.name = nameValue;
        result = await client.createKey(data);
        break;
      }
      case "usage_get": {
        result = await client.getUsage();
        break;
      }
      default:
        throw new Error(`Unknown tool: ${name}`);
    }

    return jsonResult(result);
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
}
